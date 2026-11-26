import { institutionStrip } from './ui.js';

const routes = [];
let guard = null;
let fallback = null;
let isRendering = false;

export function route(pattern, handler) {
  routes.push({ pattern, tokens: tokenize(pattern), handler });
}

function tokenize(pattern) {
  return pattern.split('/').filter(Boolean).map((segment) => ({
    name: segment.startsWith(':') ? segment.slice(1) : null,
    value: segment.startsWith(':') ? null : segment
  }));
}

function matchPattern(tokens, parts) {
  if (tokens.length !== parts.length) return null;
  const params = {};
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const part = decodeURIComponent(parts[index]);
    if (token.name) {
      params[token.name] = part;
    } else if (token.value !== part) {
      return null;
    }
  }
  return params;
}

export function setGuard(fn) {
  guard = fn;
}

export function setFallback(fn) {
  fallback = fn;
}

export async function navigate(path, options = {}) {
  const target = path || '/';
  if (options.replace) {
    window.history.replaceState({}, '', target);
  } else {
    window.history.pushState({}, '', target);
  }
  await render();
}

export async function render() {
  if (isRendering) return;
  isRendering = true;

  const url = new URL(window.location.href);
  const parts = url.pathname.split('/').filter(Boolean);
  const query = {};
  url.searchParams.forEach((value, key) => {
    query[key] = value;
  });
  if (url.hash) query._hash = url.hash.replace('#', '');

  let matched = null;
  let params = {};

  for (const entry of routes) {
    const result = matchPattern(entry.tokens, parts);
    if (result) {
      matched = entry;
      params = result;
      break;
    }
  }

  try {
    let allowed = true;
    let redirect = null;
    if (guard) {
      const guardResult = await guard({ path: url.pathname, query, params, handler: matched });
      allowed = guardResult.allowed !== false;
      redirect = guardResult.redirect || null;
    }

    if (redirect) {
      await navigate(redirect, { replace: true });
      return;
    }

    const app = document.getElementById('app');

    if (!allowed || !matched) {
      app.innerHTML = institutionStrip() + (fallback
        ? await fallback({ path: url.pathname, query })
        : '<div class="state state--empty"><h3>Page not found</h3></div>');
      bindGlobalLinks(app);
      return;
    }

    const handler = matched.handler;
    const renderFn = typeof handler === 'function' ? handler : handler.render;
    app.innerHTML = institutionStrip() + (await renderFn({ params, query, path: url.pathname }));
    bindGlobalLinks(app);

    if (handler && typeof handler.mount === 'function') {
      await handler.mount({ params, query });
    }

    bindGlobalLinks(app);
    window.scrollTo({ top: 0, behavior: 'auto' });
  } finally {
    isRendering = false;
  }
}

export function bindGlobalLinks(scope = document) {
  scope.querySelectorAll('[data-link]').forEach((link) => {
    if (link.dataset.bound === 'true') return;
    link.dataset.bound = 'true';
    link.addEventListener('click', (event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
      const href = link.getAttribute('href');
      if (!href || href.startsWith('http') || href.startsWith('#')) return;
      event.preventDefault();
      navigate(href);
    });
  });

  scope.querySelectorAll('[data-logout]').forEach((button) => {
    if (button.dataset.bound === 'true') return;
    button.dataset.bound = 'true';
    button.addEventListener('click', async () => {
      const { logout } = await import('./session.js');
      await logout();
    });
  });
}

export function startRouter() {
  window.addEventListener('popstate', () => {
    render();
  });
  return render();
}
