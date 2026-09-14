#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('--- LexiGuard Final Submission Verification Gate ---');

let hasErrors = false;

// 1. Check Git Branch
try {
  const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
  console.log(`[PASS] Git Branch: ${branch}`);
  const branches = execSync('git branch --list', { encoding: 'utf-8' })
    .trim()
    .split('\n')
    .map((b) => b.trim())
    .filter(Boolean);

  if (branches.length > 1) {
    console.error(`[FAIL] More than one local git branch found: ${branches.join(', ')}`);
    hasErrors = true;
  } else {
    console.log('[PASS] Exactly one branch exists.');
  }
} catch (err) {
  console.error(`[FAIL] Security gate error: Unable to verify git branch: ${err.message}`);
  hasErrors = true;
}

// 2. Check Repository Tracked Size
try {
  const gitObjectsOutput = execSync('git count-objects -vH', { encoding: 'utf-8' });
  console.log(gitObjectsOutput);

  // Check tracked files size
  const trackedFiles = execSync('git ls-files', { encoding: 'utf-8' })
    .trim()
    .split('\n')
    .map((f) => f.trim())
    .filter(Boolean);

  let totalTrackedBytes = 0;
  for (const file of trackedFiles) {
    if (fs.existsSync(file)) {
      totalTrackedBytes += fs.statSync(file).size;
    }
  }
  const trackedMB = (totalTrackedBytes / (1024 * 1024)).toFixed(2);
  console.log(`[INFO] Total size of tracked working tree files: ${trackedMB} MB`);

  if (totalTrackedBytes > 10 * 1024 * 1024) {
    console.error(`[FAIL] Tracked files exceed 10 MB limit! (${trackedMB} MB)`);
    hasErrors = true;
  } else {
    console.log(`[PASS] Repository tracked size is well within 10 MB limit.`);
  }
} catch (err) {
  console.error(`[FAIL] Security gate error: Unable to compute repository tracked size: ${err.message}`);
  hasErrors = true;
}

// 3. Scan for Disallowed Files and Committed Secrets in File Contents
const forbiddenFilePatterns = [
  /^\.env(\..+)?$/,
  /^node_modules\//,
  /^\.next\//,
  /^coverage\//,
  /^test-results\//,
  /\.pem$/,
  /\.key$/,
];

const secretPatterns = [
  /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/,
  /AIzaSy[A-Za-z0-9_-]{33}/,
  /sk-[A-Za-z0-9_-]{20,}/,
  /ghp_[A-Za-z0-9]{36}/,
  /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, // JWT token pattern
];

try {
  const trackedFiles = execSync('git ls-files', { encoding: 'utf-8' })
    .trim()
    .split('\n')
    .map((f) => f.trim())
    .filter(Boolean);

  for (const file of trackedFiles) {
    // A. Check filenames
    if (file !== '.env.example') {
      for (const pattern of forbiddenFilePatterns) {
        if (pattern.test(file)) {
          console.error(`[FAIL] Forbidden tracked file detected: ${file}`);
          hasErrors = true;
        }
      }
    }

    // B. Check file contents (skip package-lock.json integrity hashes)
    if (file === 'package-lock.json') continue;

    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf-8');
      for (const pattern of secretPatterns) {
        if (pattern.test(content)) {
          console.error(`[FAIL] Potential secret/private key detected in file content: ${file}`);
          hasErrors = true;
        }
      }
    }
  }

  if (!hasErrors) {
    console.log('[PASS] No forbidden files or secrets tracked in git.');
  }
} catch (err) {
  console.error(`[FAIL] Security gate error: Secret scan failed closed: ${err.message}`);
  hasErrors = true;
}

if (hasErrors) {
  console.error('\n[FATAL] Verification Gate FAILED. Address all errors before final submission.');
  process.exit(1);
} else {
  console.log('\n[SUCCESS] All verification gate checks PASSED cleanly.');
}
