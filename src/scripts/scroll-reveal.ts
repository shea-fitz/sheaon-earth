const REVEAL_SELECTORS = [
  'section',
  '.timeline-entry',
  '.release-item',
  '.shows-row',
  '.notes-list > li',
  '.entry-header',
  '.entry-content',
  '.mix-list > iframe',
  'main > p',
].join(', ');

const EXCLUDE_SELECTORS = '[aria-hidden="true"], .home-spacer, [data-reveal-skip]';
const PAGE_ENTER_FALLBACK_MS = 700;

let activeController: AbortController | null = null;
let observer: IntersectionObserver | null = null;
let pageEnterTimeout: number | null = null;

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function isExcluded(element: Element) {
  return element.matches(EXCLUDE_SELECTORS) || Boolean(element.closest(EXCLUDE_SELECTORS));
}

function discoverElements(main: HTMLElement) {
  const seen = new Set<Element>();
  const elements: Element[] = [];

  main.querySelectorAll(REVEAL_SELECTORS).forEach((element) => {
    if (isExcluded(element) || seen.has(element)) return;
    seen.add(element);
    element.setAttribute('data-reveal', '');
    elements.push(element);
  });

  return elements;
}

function revealElement(element: Element) {
  element.classList.add('is-revealed');
  observer?.unobserve(element);
}

function waitForPageEnter(signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }

    const siteMain = document.querySelector('.site-main');
    const isEntering =
      siteMain?.classList.contains('is-entering') || siteMain?.classList.contains('is-awaiting');

    if (!isEntering) {
      resolve();
      return;
    }

    const finish = () => {
      cleanup();
      resolve();
    };

    const onAbort = () => {
      cleanup();
      resolve();
    };

    const onAnimationEnd = (event: AnimationEvent) => {
      if (event.target !== siteMain) return;
      finish();
    };

    const cleanup = () => {
      siteMain?.removeEventListener('animationend', onAnimationEnd);
      signal.removeEventListener('abort', onAbort);
      if (pageEnterTimeout !== null) {
        window.clearTimeout(pageEnterTimeout);
        pageEnterTimeout = null;
      }
    };

    siteMain?.addEventListener('animationend', onAnimationEnd);
    signal.addEventListener('abort', onAbort, { once: true });
    pageEnterTimeout = window.setTimeout(finish, PAGE_ENTER_FALLBACK_MS);
  });
}

function startObserving(elements: Element[], signal: AbortSignal) {
  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        revealElement(entry.target);
      });
    },
    {
      threshold: 0.12,
      rootMargin: '0px 0px -8% 0px',
    }
  );

  elements.forEach((element) => {
    if (signal.aborted) return;
    observer?.observe(element);
  });
}

function teardown() {
  activeController?.abort();
  activeController = null;
  observer?.disconnect();
  observer = null;

  if (pageEnterTimeout !== null) {
    window.clearTimeout(pageEnterTimeout);
    pageEnterTimeout = null;
  }
}

async function init() {
  teardown();

  const main = document.querySelector('main');
  if (!main) return;

  const controller = new AbortController();
  activeController = controller;
  const { signal } = controller;

  const elements = discoverElements(main);

  if (elements.length === 0) return;

  if (prefersReducedMotion()) {
    elements.forEach((element) => element.classList.add('is-revealed'));
    return;
  }

  await waitForPageEnter(signal);
  if (signal.aborted) return;

  startObserving(elements, signal);
}

document.addEventListener('astro:before-preparation', teardown);
document.addEventListener('astro:page-load', init);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
