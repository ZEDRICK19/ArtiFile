import api from '../../core/api.js';
import {
  icon, escapeHtml, statusBadge, formatDate, formatBytes, toast, loadingState, emptyState, confirmModal
} from '../../core/ui.js';

export function render() {
  return `
  <div class="student-sub-page">
    <div class="subpage-header">
      <a class="btn btn--ghost btn--sm" href="/student" data-link>${icon('chevronLeft', 16)} Back to dashboard</a>
      <h1>Requirements</h1>
      <p>Upload, replace, and monitor each submitted document.</p>
    </div>
    <div id="requirements-panel">${loadingState('Loading requirements…')}</div>
  </div>`;
}

export async function mount({ query = {} } = {}) {
  const container = document.getElementById('requirements-panel');
  if (!container) return;
  await renderPanel(container, { category: query.category || null });
}

export async function renderPanel(container, options = {}) {
  container.innerHTML = loadingState('Loading requirements…');

  let requirements;
  try {
    const response = await api.get('/student/requirements');
    requirements = Array.isArray(response.data) ? response.data : [];
    requirements.forEach((item) => { requirementsCache[item.key] = item; });
  } catch (error) {
    container.innerHTML = emptyState('Unable to load requirements', error.message, 'alert');
    return;
  }

  let visible = requirements;
  if (options.category) {
    visible = requirements.filter((item) => item.category === options.category);
  }

  if (visible.length === 0) {
    container.innerHTML = emptyState('No requirements found', 'No active requirements are configured for this category.', 'file');
    return;
  }

  const sections = [
    { key: 'PRE_AUDITION', title: 'Pre-Audition Requirements', note: 'Available to all student applicants.' },
    { key: 'POST_AUDITION', title: 'Post-Audition Requirements', note: 'Available only when your application status is ACCEPTED.' }
  ];

  container.innerHTML = sections.map((section) => {
    const items = visible.filter((item) => item.category === section.key);
    if (items.length === 0) return '';
    return `
      <section class="req-section">
        <div class="req-section__head">
          <h2>${section.title}</h2>
          <p>${section.note}</p>
        </div>
        <div class="req-grid">${items.map((item) => cardHtml(item)).join('')}</div>
      </section>`;
  }).join('');

  bindCards(container);
}

function cardHtml(item) {
  const doc = item.document || {};
  const hasFile = Boolean(doc.id && doc.fileName);
  const locked = Boolean(item.locked);
  const needsRevision = doc.status === 'REVISION_REQUIRED' || doc.status === 'REJECTED';

  if (locked) {
    return `
    <article class="req-card req-card--locked">
      <div class="req-card__icon">${icon('lock', 22)}</div>
      <h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.description || "Performer's Profile form")}</p>
      <div class="req-card__locked">${icon('lock', 15)} ${escapeHtml(item.lockReason || 'Locked until accepted')}</div>
    </article>`;
  }

  const formats = (item.allowedExtensions || []).map((ext) => `.${ext}`).join(', ');

  return `
  <article class="req-card" data-card="${item.key}">
    <div class="req-card__top">
      <div class="req-card__icon">${icon(item.key === 'performer_profile' ? 'user' : 'file', 22)}</div>
      <div>${statusBadge(doc.status || 'NOT_SUBMITTED')}</div>
    </div>
    <h3>${escapeHtml(item.title)}</h3>
    <p>${escapeHtml(item.description || '')}</p>

    ${needsRevision && doc.feedback ? `<div class="feedback feedback--danger"><strong>${icon('alert', 15)} Reviewer feedback</strong><p>${escapeHtml(doc.feedback)}</p></div>` : ''}
    ${doc.status === 'ACCEPTED' ? `<div class="feedback feedback--success"><strong>${icon('checkCircle', 15)} Accepted</strong><p>This requirement has been approved by the Administrative Aide VI.</p></div>` : ''}

    <div class="req-card__file ${hasFile ? '' : 'is-empty'}">
      ${hasFile
        ? `${icon('file', 16)} <span><strong>${escapeHtml(doc.fileName)}</strong><small>${formatBytes(doc.fileSize)} · Uploaded ${formatDate(doc.submittedAt)} · Version ${doc.versionCount || 1}</small></span>`
        : `${icon('info', 16)} <span>No file submitted yet.</span>`}
    </div>

    <div class="req-card__meta">Accepted: ${escapeHtml(formats || 'PDF, JPG, PNG')} · Max ${item.maxFileSizeMb || 5} MB</div>

    <div class="req-card__actions">
      <label class="btn btn--primary btn--sm" for="file-${item.key}">
        ${icon(hasFile ? 'refresh' : 'upload', 16)} ${hasFile ? 'Replace document' : 'Upload document'}
      </label>
      <input type="file" id="file-${item.key}" data-input="${item.key}" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" hidden />
      ${hasFile ? `<button class="btn btn--ghost btn--sm" data-download="${doc.id}" type="button">${icon('download', 16)} Download</button>` : ''}
    </div>
    <div class="req-card__status" id="status-${item.key}"></div>
  </article>`;
}

function bindCards(container) {
  container.querySelectorAll('[data-input]').forEach((input) => {
    input.addEventListener('change', async () => {
      const file = input.files && input.files[0];
      if (!file) return;

      const key = input.dataset.input;
      const card = container.querySelector(`[data-card="${key}"]`);
      const status = card && card.querySelector('.req-card__status');
      const requirement = requirementsCache[key];

      if (requirement && requirement.document && requirement.document.id) {
        const confirmed = await confirmModal({
          title: 'Replace this document?',
          message: 'The previous version will be kept in the submission history, but the current file will be replaced. Continue?',
          confirmText: 'Replace document'
        });
        if (!confirmed) {
          input.value = '';
          return;
        }
      }

      const formData = new FormData();
      formData.append('requirementKey', key);
      formData.append('file', file);

      if (status) status.innerHTML = `<span class="inline-loading">${icon('refresh', 14)} Uploading…</span>`;

      try {
        const isPost = key === 'performer_profile';
        if (requirement && requirement.document && requirement.document.id) {
          await api.uploadPut(`/documents/${requirement.document.id}/replace`, formData);
        } else if (isPost) {
          await api.upload('/documents/post/upload', formData);
        } else {
          await api.upload('/documents/upload', formData);
        }
        toast('Document saved successfully.');
        await renderPanel(container, options);
      } catch (error) {
        if (status) status.innerHTML = `<span class="inline-error">${escapeHtml(error.message)}</span>`;
        toast(error.message, 'error');
      } finally {
        input.value = '';
      }
    });
  });

  container.querySelectorAll('[data-download]').forEach((button) => {
    button.addEventListener('click', () => {
      window.open(api.fileUrl(button.dataset.download, true), '_blank');
    });
  });
}

const requirementsCache = {};

export async function loadRequirementsIntoCache() {
  try {
    const response = await api.get('/student/requirements');
    (response.data || []).forEach((item) => {
      requirementsCache[item.key] = item;
    });
  } catch (error) {
    // Cache stays empty; upload still works.
  }
}
