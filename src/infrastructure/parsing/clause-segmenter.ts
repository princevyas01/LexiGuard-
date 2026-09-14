import { Clause, DocumentSection, TextSpan } from '@/domain/documents/types';

/**
 * Segmenter that breaks legal raw text into structured DocumentSections and Clauses,
 * preserving exact character offsets for evidence verification.
 */
export function segmentDocument(
  rawText: string,
  docId: string
): { sections: DocumentSection[]; clauses: Clause[] } {
  if (!rawText || rawText.trim().length === 0) {
    return { sections: [], clauses: [] };
  }

  const sections: DocumentSection[] = [];
  const clauses: Clause[] = [];

  // Match common legal section headers like:
  // "1. PREMISES AND TERM" or "SECTION 1: DEFINITIONS" or "ARTICLE 2. WARRANTIES"
  const sectionHeaderRegex =
    /(?:^|\n\n+)(?:(?:SECTION|ARTICLE|CLAUSE)\s+([0-9A-ZIVX]+)[:.\s-]+([^\n]+)|([0-9]+)\.\s+([A-Z\s]{3,}))/gi;

  const sectionMatches: Array<{
    title: string;
    sectionNumber: string;
    index: number;
    length: number;
  }> = [];

  let match: RegExpExecArray | null;
  while ((match = sectionHeaderRegex.exec(rawText)) !== null) {
    const sectionNum = match[1] || match[3] || '';
    const sectionTitle = (match[2] || match[4] || '').trim();
    sectionMatches.push({
      title: sectionTitle,
      sectionNumber: sectionNum,
      index: match.index,
      length: match[0].length,
    });
  }

  // If no formal section headers found, treat entire text or paragraphs as single/generic sections
  if (sectionMatches.length === 0) {
    const paragraphs = rawText.split(/\n\n+/);
    let currentOffset = 0;
    const genericClauses: Clause[] = [];

    paragraphs.forEach((pText, idx) => {
      const trimmed = pText.trim();
      if (trimmed.length > 0) {
        const start = rawText.indexOf(trimmed, currentOffset);
        const end = start + trimmed.length;
        currentOffset = end;

        const clauseId = `${docId}-clause-${idx + 1}`;
        const clause: Clause = {
          id: clauseId,
          clauseNumber: `${idx + 1}`,
          title: trimmed.slice(0, 40),
          text: trimmed,
          pageNumber: 1,
          sectionId: `${docId}-sec-1`,
          span: { start, end, text: trimmed },
        };
        genericClauses.push(clause);
        clauses.push(clause);
      }
    });

    const singleSection: DocumentSection = {
      id: `${docId}-sec-1`,
      sectionNumber: '1',
      title: 'General Provisions',
      clauses: genericClauses,
      pageNumber: 1,
      span: { start: 0, end: rawText.length, text: rawText },
    };
    sections.push(singleSection);

    return { sections, clauses };
  }

  // Regex hoisted outside loop to avoid per-iteration recompilation
  const clauseRegex =
    /(?:^|\n)(?:([0-9]+\.[0-9]+|[a-z]\))\s*([^:\n]+)?:?\s*)([^\n]+(?:\n(?![0-9]+\.[0-9]+|[a-z]\)|[A-Z]{3,})[^\n]+)*)/g;

  // Process formal sections
  for (let i = 0; i < sectionMatches.length; i++) {
    const current = sectionMatches[i];
    const next = sectionMatches[i + 1];
    const sectionStart = current.index;
    const sectionEnd = next ? next.index : rawText.length;
    const sectionContent = rawText.slice(sectionStart, sectionEnd);
    const sectionContentTrimmed = sectionContent.trim();

    const sectionId = `${docId}-sec-${current.sectionNumber || i + 1}`;
    const sectionClauses: Clause[] = [];

    // Reset regex state for each section
    clauseRegex.lastIndex = 0;

    let clauseMatch: RegExpExecArray | null;
    let foundSubClauses = false;

    while ((clauseMatch = clauseRegex.exec(sectionContent)) !== null) {
      foundSubClauses = true;
      const clauseNum = clauseMatch[1] || '';
      const clauseTitle = (clauseMatch[2] || '').trim();
      const clauseBody = clauseMatch[3] ? clauseMatch[3].trim() : clauseMatch[0].trim();
      const fullClauseText = clauseMatch[0].trim();

      const clauseStartInDoc = sectionStart + clauseMatch.index;
      const clauseEndInDoc = clauseStartInDoc + clauseMatch[0].length;

      const clauseId = `${sectionId}-cl-${clauseNum.replace(/[^a-zA-Z0-9]/g, '_') || sectionClauses.length + 1}`;
      const span: TextSpan = {
        start: clauseStartInDoc,
        end: clauseEndInDoc,
        text: rawText.slice(clauseStartInDoc, clauseEndInDoc),
      };

      const clause: Clause = {
        id: clauseId,
        clauseNumber: clauseNum,
        title: clauseTitle || clauseBody.slice(0, 30),
        text: fullClauseText,
        pageNumber: Math.max(1, Math.floor(clauseStartInDoc / 2500) + 1), // Approximate page estimate
        sectionId,
        span,
      };

      sectionClauses.push(clause);
      clauses.push(clause);
    }

    // If section had no sub-clause numbers, treat section body as a clause
    if (!foundSubClauses) {
      const clauseId = `${sectionId}-cl-1`;
      const span: TextSpan = {
        start: sectionStart,
        end: sectionEnd,
        text: sectionContentTrimmed,
      };
      const clause: Clause = {
        id: clauseId,
        clauseNumber: current.sectionNumber,
        title: current.title,
        text: sectionContentTrimmed,
        pageNumber: Math.max(1, Math.floor(sectionStart / 2500) + 1),
        sectionId,
        span,
      };
      sectionClauses.push(clause);
      clauses.push(clause);
    }

    const section: DocumentSection = {
      id: sectionId,
      sectionNumber: current.sectionNumber,
      title: current.title,
      clauses: sectionClauses,
      pageNumber: Math.max(1, Math.floor(sectionStart / 2500) + 1),
      span: {
        start: sectionStart,
        end: sectionEnd,
        text: sectionContentTrimmed,
      },
    };

    sections.push(section);
  }

  return { sections, clauses };
}
