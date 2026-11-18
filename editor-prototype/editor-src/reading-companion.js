const publicNotebook = new URL('https://aryavahedi.github.io/notebook-in-public/');
const normalizedPath = path => path.replace(/(?:\/index\.html)?\/$|\/index\.html$/, '');

// Recognize links to this notebook from both the live site and local previews.
export function notebookLink(href, location, aliases = {}) {
 if (!href) return null;
 let url;
 try { url = new URL(href, location.href); } catch { return null; }
 const path = normalizedPath(url.pathname);
 const samePage = url.origin === location.origin && path === normalizedPath(location.pathname);
 const publicPage = url.origin === publicNotebook.origin && path === normalizedPath(publicNotebook.pathname);
 const localPage = url.origin === location.origin && ['/site', '/published'].includes(path) &&
  ['/site', '/published'].includes(normalizedPath(location.pathname));
 if (!samePage && !publicPage && !localPage) return null;
 const [route, query] = url.hash.slice(1).split('?');
 const entryId = /^\/entry\/(\d+)$/.exec(route)?.[1] || aliases[route];
 return entryId ? {entryId, anchor: new URLSearchParams(query).get('at')} : null;
}

export function installReadingCompanion() {
 const wide = window.matchMedia('(min-width: 1040px)');
 const header = document.querySelector('.site-header');
 const dialog = document.createElement('dialog');
 dialog.className = 'reading-companion';
 dialog.setAttribute('aria-label', 'Related reading');
 dialog.innerHTML = `
  <div class="companion-toolbar">
   <button type="button" data-companion-back hidden>← Back</button>
   <span class="eyebrow">Related reading</span>
   <a data-companion-full>Open full page <span aria-hidden="true">↗</span></a>
   <button type="button" data-companion-close aria-label="Close related reading">×</button>
  </div>
  <div class="companion-content"></div>`;
 document.body.append(dialog);
 const content = dialog.querySelector('.companion-content');
 const back = dialog.querySelector('[data-companion-back]');
 const full = dialog.querySelector('[data-companion-full]');
 const views = [];
 let opener;
 let sourceRoute;
 const pageRoute = () => window.location.hash.split('?')[0];
 const view = () => views.at(-1);

 function alignSource(top) {
  if (opener?.isConnected && top !== undefined) {
   window.scrollBy({top: opener.getBoundingClientRect().top - top, behavior: 'instant'});
  }
 }

 function positionPanel() {
  if (dialog.open && wide.matches && header) {
   dialog.style.setProperty('--companion-top', Math.max(16, header.getBoundingClientRect().bottom + 12) + 'px');
  }
 }

 function close({restore = true} = {}) {
  if (!views.length) return;
  const sourceTop = restore && wide.matches ? opener?.getBoundingClientRect().top : undefined;
  dialog.close();
  document.body.classList.remove('companion-split', 'companion-modal');
  content.replaceChildren();
  views.length = 0;
  alignSource(sourceTop);
  if (restore && opener?.isConnected) opener.focus({preventScroll: true});
  opener = undefined;
 }

 function showPanel() {
  const sourceTop = wide.matches ? opener?.getBoundingClientRect().top : undefined;
  document.body.classList.toggle('companion-split', wide.matches);
  document.body.classList.toggle('companion-modal', !wide.matches);
  if (wide.matches) dialog.show();
  else dialog.showModal();
  alignSource(sourceTop);
  positionPanel();
 }

 function focusAnchor(anchor) {
  if (!anchor) return false;
  const target = [...content.querySelectorAll('[id]')].find(el => el.id === 'companion-' + anchor);
  if (!target) return false;
  content.querySelector('.footnote-target')?.classList.remove('footnote-target');
  target.classList.add('footnote-target');
  target.tabIndex = -1;
  content.scrollTop += target.getBoundingClientRect().top - content.getBoundingClientRect().top - 28;
  target.focus({preventScroll: true});
  return true;
 }

 function showView(anchor, focus) {
  content.replaceChildren(view().article);
  full.href = '#/entry/' + view().entryId;
  back.hidden = views.length < 2;
  content.scrollTop = view().scrollTop;
  if (!focusAnchor(anchor)) (focus || view().article.querySelector('.essay-title')).focus({preventScroll: true});
 }

 function openEntry(entry, link, anchor, fromPane) {
  const catalogue = window.folioCatalogue;
  if (fromPane && entry.entryId === view().entryId) {
   focusAnchor(anchor);
   return;
  }
  if (!fromPane) {
   opener = link;
   sourceRoute = pageRoute();
   views.length = 0;
  } else {
   view().scrollTop = content.scrollTop;
   view().nextLink = link;
  }
  const earlier = views.findIndex(item => item.entryId === entry.entryId);
  if (earlier >= 0) {
   views.splice(earlier + 1);
  } else {
   const template = document.createElement('template');
   template.innerHTML = catalogue.renderer(entry, false);
   const article = template.content.querySelector('article');
   article.querySelector('.page-kicker')?.remove();
   article.querySelector('.essay-pagination')?.remove();
   for (const el of article.querySelectorAll('[id]')) el.id = 'companion-' + el.id;
   for (const el of article.querySelectorAll('[aria-controls]')) {
    const ids = el.getAttribute('aria-controls').split(/\s+/);
    el.setAttribute('aria-controls', ids.map(id => 'companion-' + id).join(' '));
   }
   article.querySelector('.essay-title').tabIndex = -1;
   views.push({entryId: entry.entryId, article, scrollTop: 0});
  }
  if (!dialog.open) showPanel();
  showView(anchor);
 }

 back.addEventListener('click', () => {
  if (views.length < 2) return;
  views.pop();
  showView(null, view().nextLink);
 });
 dialog.querySelector('[data-companion-close]').addEventListener('click', () => close());
 dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
 window.addEventListener('hashchange', () => {
  if (dialog.open && pageRoute() !== sourceRoute) close({restore: false});
 });
 window.addEventListener('scroll', positionPanel, {passive: true});
 wide.addEventListener('change', () => {
  if (!dialog.open) return;
  const focus = dialog.contains(document.activeElement) ? document.activeElement : view().article.querySelector('.essay-title');
  dialog.close();
  showPanel();
  focus.focus({preventScroll: true});
 });

 document.addEventListener('keydown', event => {
  if (event.key !== 'Escape' || !dialog.open || document.querySelector('#colophon[open]')) return;
  event.preventDefault();
  event.stopPropagation();
  close();
 }, true);

 document.addEventListener('click', event => {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
  const link = event.target.closest('a[href]');
  if (!link || link.hasAttribute('download')) return;
  if (link === full) {
   close({restore: false});
   return;
  }
  const fromPane = content.contains(link);
  if (!fromPane && !link.closest('#main > .structured-preview')) return;
  const catalogue = window.folioCatalogue;
  const target = notebookLink(link.getAttribute('href'), window.location, catalogue?.aliases);
  if (!target) return;
  const entry = catalogue?.items.find(item => item.entryId === target.entryId);
  if (!entry) return;
  const source = notebookLink(window.location.href, window.location, catalogue.aliases);
  if (!fromPane && source?.entryId === target.entryId) return;
  event.preventDefault();
  openEntry(entry, link, target.anchor, fromPane);
 }, true);

 return dialog;
}
