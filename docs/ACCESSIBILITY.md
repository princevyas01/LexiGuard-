# LexiGuard Accessibility (WCAG 2.2 AA) Documentation & Verification

## 1. Conformance Statement

LexiGuard is engineered to adhere to **WCAG 2.2 Level AA** design and technical criteria. Accessibility is treated as an architectural requirement rather than a cosmetic stylesheet layer. Automated audits via `@axe-core/playwright` and component axe audits verify zero violations for landmarks, color contrast, keyboard focus trapping, visible focus rings, and ARIA attributes in our test suite. Note that full formal WCAG 2.2 AA certification additionally requires independent multi-user assistive technology audits across diverse screen readers and environments.

---

## 2. Implemented Accessibility Controls

### 2.1 Semantic HTML & Landmark Hierarchy

- All pages structure content with semantic landmarks: `<header>`, `<nav>`, `<main id="main-content">`, `<section>`, `<article>`, `<aside>`, and `<footer>`.
- Headings strictly follow logical nesting (`<h1>` ➔ `<h2>` ➔ `<h3>`) without skipped levels.
- A prominent **Skip to Main Content** link (`focus:not-sr-only`) allows keyboard screen reader users to bypass top navigation.

### 2.2 Keyboard Operability & Visible Focus Management

- **Zero Mouse Dependence**: 100% of interactive controls (buttons, links, file upload area, filters, tabs, modal triggers) are reachable via `Tab` and `Shift+Tab`.
- **Explicit Focus Indicators**: All interactive elements display a high-contrast focus ring (`focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none`) meeting 3:1 contrast against adjacent backgrounds.
- **No Keyboard Traps**: Focus cycles predictably through the DOM order.

### 2.3 Accessible Dialogs & Modals (`src/components/common/AccessibleModal.tsx`)

- Implements `role="dialog"`, `aria-modal="true"`, and `aria-labelledby="modal-title"`.
- **Focus Trapping**: When opened, focus is automatically directed to the primary close button. Pressing `Tab` cycles focus strictly inside the dialog bounds.
- **Focus Restoration**: Upon dismissal, focus is programmatically restored to the trigger element that launched the modal.
- **Escape Key Dismissal**: Pressing the `Escape` key immediately closes the active dialog.

### 2.4 Non-Color-Only Information Conveyance

- In accordance with WCAG Success Criterion 1.4.1 (Use of Color), risk severity is never communicated through color alone.
- Every risk level utilizes a triple indicator pattern: `Icon + Text Label + Border/Color`:
  - **High Attention**: AlertTriangle icon + "High Attention" text label + red border/background.
  - **Review Soon**: AlertCircle icon + "Review Soon" text label + amber border/background.
  - **Low Concern**: Info icon + "Low Concern" text label + blue border/background.
  - **Informational**: CheckCircle2 icon + "Informational" text label + slate border/background.

### 2.5 Screen Reader Live Announcements

- Asynchronous document uploads, parsing, and status messages are announced to assistive technology using `role="status"` and `aria-live="polite"`.
- Emergency legal escalation triggers utilize `role="alert"` and `aria-live="assertive"` to immediately notify users of eviction or hearing deadlines.

### 2.6 Table Accessibility (`src/components/risks/RisksAndObligationsView.tsx`)

- The obligations table employs semantic HTML table elements: `<table>`, `<thead>`, `<th scope="col">`, `<tbody>`, and `<td>`.
- Headers provide clear column context for assistive devices.

### 2.7 Responsive Reflow, Zoom & Reduced Motion

- **320px Viewport Support**: The layout adapts seamlessly without horizontal scrolling or clipped text down to 320px width.
- **200% Zoom Support**: Text scales cleanly without overlapping or breaking containers.
- **Reduced Motion**: Respects `prefers-reduced-motion: reduce` in `globals.css` by neutralizing non-essential CSS transitions.

---

## 3. Manual Keyboard Verification Procedure

Evaluators can manually test keyboard accessibility in any modern browser:

1. Open `http://localhost:3000`.
2. Press `Tab` to display the "Skip to main content" link. Press `Enter` to jump past header navigation.
3. Tab to the **Residential Lease** button and press `Enter`. Verify that document analysis loads without mouse interaction.
4. Tab to the **Risks & Obligations** tab and press `Enter`.
5. Tab to **Inspect Evidence** on a risk card and press `Enter`.
6. Verify focus shifts inside the dialog modal. Press `Tab` and confirm focus remains trapped inside the modal.
7. Press `Escape`. Verify the modal closes and focus returns to the "Inspect Evidence" button.
8. Tab to the question input field on the **Ask** tab, type a question, and press `Enter`.
