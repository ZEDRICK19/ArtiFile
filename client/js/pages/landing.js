import { icon } from '../core/ui.js';
import { CONTACT, APP_NAME } from '../core/constants.js';

export function render() {
  return `
  <div class="public-shell">
    <header class="public-header">
      <a class="public-brand" href="/" data-link>
        <span class="brand-mark">A</span>
        <span><strong>${APP_NAME}</strong><small>Office of Culture and Arts</small></span>
      </a>
      <nav class="public-nav">
        <a href="/#features" data-link>Features</a>
        <a href="/#workflow" data-link>Workflow</a>
        <a href="/login" data-link>Sign in</a>
        <a class="btn btn--primary btn--sm" href="/register" data-link>Register</a>
      </nav>
    </header>

    <main>
      <section class="hero">
        <div class="hero__content">
          <span class="hero__eyebrow">Batangas State University TNEU · Alangilan Campus</span>
          <h1>Digital Filing and<br />Records Management</h1>
          <p>ArtiFile centralizes student performer requirements, audition records, and document reviews for the Office of Culture and Arts — secure, organized, and always accessible.</p>
          <div class="hero__actions">
            <a class="btn btn--primary" href="/register" data-link>Get started ${icon('chevronRight', 16)}</a>
            <a class="btn btn--ghost" href="/login" data-link>Sign in to your account</a>
          </div>
          <div class="hero__note">${icon('shield', 16)} <span>Sign in uses your BSU Google Workspace (GSuite) account only.</span></div>
        </div>
        <div class="hero__visual">
          <div class="hero-card hero-card--main">
            <div class="hero-card__top"><span class="avatar">JM</span><div><strong>John Monterey</strong><small>BatStateU Ad Libitum Chorus</small></div></div>
            <div class="hero-card__row"><span>Pre-Audition Requirements</span><span class="badge badge--success">Accepted</span></div>
            <div class="hero-card__row"><span>Photocopy of Parent's ID</span><span class="badge badge--warning">Under Review</span></div>
            <div class="hero-card__row"><span>Performer's Profile</span><span class="badge badge--neutral">Not Submitted</span></div>
          </div>
          <div class="hero-card hero-card--float">${icon('checkCircle', 22)}<div><strong>Documents verified</strong><small>Reviewed by Administrative Aide VI</small></div></div>
        </div>
      </section>

      <section class="public-section" id="features">
        <div class="section-heading">
          <span class="section-kicker">Built for OCA</span>
          <h2>Everything the office needs, in one place</h2>
          <p>From application to audition to membership records — ArtiFile keeps every document accounted for.</p>
        </div>
        <div class="feature-grid">
          <article class="feature-card">${icon('files', 24)}<h3>Two requirement stages</h3><p>Pre-audition documents are open to all applicants. Post-audition uploads unlock only when an application is accepted.</p></article>
          <article class="feature-card">${icon('shield', 24)}<h3>Role-based access</h3><p>Students see only their own records. Only the Administrative Aide VI can review, approve, and manage applications.</p></article>
          <article class="feature-card">${icon('chart', 24)}<h3>Live records and reports</h3><p>Dashboard statistics and charts are calculated directly from the database — never hardcoded.</p></article>
          <article class="feature-card">${icon('bell', 24)}<h3>Notifications and audit trail</h3><p>Students are notified of reviews. Administrators see submissions and every important action is logged.</p></article>
        </div>
      </section>

      <section class="public-section public-section--tint" id="workflow">
        <div class="section-heading"><span class="section-kicker">How it works</span><h2>A clear path from application to acceptance</h2></div>
        <div class="steps">
          <div class="step"><span>1</span><h3>Create account</h3><p>Register with your BSU GSuite email.</p></div>
          <div class="step"><span>2</span><h3>Submit requirements</h3><p>Upload your waiver and parent's ID.</p></div>
          <div class="step"><span>3</span><h3>Office review</h3><p>The Administrative Aide VI reviews each document.</p></div>
          <div class="step"><span>4</span><h3>Audition and beyond</h3><p>Accepted applicants submit their Performer's Profile.</p></div>
        </div>
      </section>

      <section class="public-cta">
        <h2>Ready to submit your requirements?</h2>
        <p>Use your BSU GSuite account to register or sign in.</p>
        <div class="hero__actions">
          <a class="btn btn--light" href="/register" data-link>Register now</a>
          <a class="btn btn--outline-light" href="/login" data-link>I already have an account</a>
        </div>
      </section>
    </main>

    <footer class="public-footer">
      <div><strong>${APP_NAME}</strong><p>${CONTACT.office}</p></div>
      <div>
        <p>${icon('mail', 14)} <a href="mailto:${CONTACT.email}">${CONTACT.email}</a></p>
        <p>${icon('phone', 14)} ${CONTACT.telephone}</p>
        <p>${icon('external', 14)} <a href="${CONTACT.facebook}" target="_blank" rel="noopener">Facebook page</a></p>
      </div>
    </footer>
  </div>`;
}
