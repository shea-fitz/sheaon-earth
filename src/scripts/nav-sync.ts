function normalizePath(path: string) {
  if (path !== '/' && path.endsWith('/')) return path.slice(0, -1);
  return path;
}

function isLinkActive(
  href: string,
  pathname: string,
  hash: string,
  hasChildren = false
) {
  const hashIndex = href.indexOf('#');
  if (hashIndex !== -1) {
    const path = href.slice(0, hashIndex) || '/';
    const linkHash = href.slice(hashIndex);
    return normalizePath(pathname) === normalizePath(path) && hash === linkHash;
  }

  const normalized = normalizePath(href);
  const normalizedCurrent = normalizePath(pathname);
  if (normalizedCurrent === normalized) return true;
  if (hasChildren && normalizedCurrent.startsWith(`${normalized}/`)) return true;
  return false;
}

export function syncNavActiveState(
  pathname = window.location.pathname,
  hash = window.location.hash
) {
  const homeLink = document.querySelector('.nav-home');
  const homeActive = normalizePath(pathname) === '/';

  if (homeLink) {
    homeLink.classList.toggle('active', homeActive);
    if (homeActive) {
      homeLink.setAttribute('aria-current', 'page');
    } else {
      homeLink.removeAttribute('aria-current');
    }
  }

  document.querySelectorAll<HTMLAnchorElement>('[data-nav-href]').forEach((link) => {
    const href = link.dataset.navHref ?? link.getAttribute('href') ?? '';
    const hasChildren = link.dataset.navHasChildren === 'true';
    const active = isLinkActive(href, pathname, hash, hasChildren);

    link.classList.toggle('active', active);
    if (active) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  });
}
