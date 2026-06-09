const HOME_BACKGROUND = 'bg1';
const MOBILE_QUERY = '(max-width: 47.99rem)';

let activeController: AbortController | null = null;

function isHomePage() {
  return (
    window.location.pathname === '/' &&
    document.querySelector('.site-main')?.dataset.background === HOME_BACKGROUND
  );
}

function getAvailableHeight(fold: Element, siteMain: Element) {
  const foldTop = fold.getBoundingClientRect().top;
  const paddingBottom = parseFloat(getComputedStyle(siteMain).paddingBottom) || 0;
  const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
  return Math.max(0, Math.round(viewportHeight - foldTop - paddingBottom));
}

function updateHomeFoldHeight() {
  const fold = document.querySelector('.home-fold');
  const siteMain = document.querySelector('.site-main');
  if (!fold || !siteMain || !isHomePage()) return;

  const available = getAvailableHeight(fold, siteMain);
  const isMobile = window.matchMedia(MOBILE_QUERY).matches;

  if (isMobile) {
    const info = fold.querySelector('.info');
    const releasesHeader = document.querySelector('.releases-header');
    const infoHeight = info?.getBoundingClientRect().height ?? 0;
    const headerHeight = releasesHeader?.getBoundingClientRect().height ?? 0;
    const gapHeight = Math.max(0, available - infoHeight - headerHeight);

    document.documentElement.style.setProperty('--home-bg-gap-height', `${gapHeight}px`);
    document.documentElement.style.removeProperty('--home-fold-height');
    return;
  }

  document.documentElement.style.setProperty('--home-fold-height', `${available}px`);
  document.documentElement.style.removeProperty('--home-bg-gap-height');
}

function teardown() {
  activeController?.abort();
  activeController = null;
  document.documentElement.style.removeProperty('--home-fold-height');
  document.documentElement.style.removeProperty('--home-bg-gap-height');
}

function init() {
  teardown();

  if (!isHomePage()) return;

  const controller = new AbortController();
  activeController = controller;
  const { signal } = controller;

  updateHomeFoldHeight();

  window.addEventListener('resize', updateHomeFoldHeight, { passive: true, signal });
  window.visualViewport?.addEventListener('resize', updateHomeFoldHeight, {
    passive: true,
    signal,
  });
  window.matchMedia(MOBILE_QUERY).addEventListener('change', updateHomeFoldHeight, { signal });

  document.fonts?.ready.then(updateHomeFoldHeight).catch(() => {});
}

document.addEventListener('astro:before-preparation', () => {
  if (!isHomePage()) teardown();
});

document.addEventListener('astro:page-load', init);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
