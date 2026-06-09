let activeController: AbortController | null = null;

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function scrollToTarget(id: string) {
  const el = document.getElementById(id);
  if (!el) return false;

  el.scrollIntoView({
    behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    block: 'start',
  });
  return true;
}

function onNavClick(event: Event) {
  const link = (event.target as Element).closest('a[data-smooth-scroll]') as HTMLAnchorElement | null;
  if (!link) return;

  const targetId = link.dataset.smoothScroll;
  if (!targetId) return;

  const url = new URL(link.href, window.location.origin);
  const onSamePage = url.pathname === window.location.pathname;

  if (onSamePage && document.getElementById(targetId)) {
    event.preventDefault();
    scrollToTarget(targetId);
    history.pushState(null, '', `#${targetId}`);
  }
}

function scrollToHashIfPresent() {
  const hash = window.location.hash;
  if (!hash) return;

  const id = hash.slice(1);
  if (!id) return;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      scrollToTarget(id);
    });
  });
}

function teardown() {
  activeController?.abort();
  activeController = null;
}

function init() {
  teardown();

  const controller = new AbortController();
  activeController = controller;
  const { signal } = controller;

  document.querySelectorAll('a[data-smooth-scroll]').forEach((link) => {
    link.addEventListener('click', onNavClick, { signal });
  });

  scrollToHashIfPresent();
}

document.addEventListener('astro:before-preparation', teardown);
document.addEventListener('astro:page-load', init);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
