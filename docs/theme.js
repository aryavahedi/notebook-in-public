(() => {
  const storageKey = 'living-folio-theme';
  const root = document.documentElement;
  const normalize = value => value === 'dark' ? 'dark' : 'light';

  function applyTheme(value) {
    const theme = normalize(value);
    const dark = theme === 'dark';
    root.dataset.theme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = dark ? '#221F1D' : '#F3F2ED';
    const button = document.querySelector('[data-theme-toggle]');
    if (button) {
      const action = dark ? 'Switch to light mode' : 'Switch to dark mode';
      button.setAttribute('aria-label', action);
      button.setAttribute('aria-pressed', String(dark));
      button.title = action;
    }
  }

  let savedTheme = 'light';
  try { savedTheme = localStorage.getItem(storageKey); } catch {}
  applyTheme(savedTheme);

  document.addEventListener('DOMContentLoaded', () => {
    applyTheme(root.dataset.theme);
    const button = document.querySelector('[data-theme-toggle]');
    if (!button) return;
    button.addEventListener('click', () => {
      const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      try { localStorage.setItem(storageKey, next); } catch {}
    });
  });

  window.addEventListener('storage', event => {
    if (event.key === storageKey || event.key === null) applyTheme(event.newValue);
  });
})();
