import { crossfadeBackground } from './background';

const SCROLL_THRESHOLD = 0.5;
const HOME_BACKGROUND = 'bg1';
const SCROLL_BACKGROUND = 'bg4';

let activeController: AbortController | null = null;
let currentBackground: string | null = null;

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function isHomePage() {
  return (
    window.location.pathname === '/' &&
    document.querySelector('.site-main')?.dataset.background === HOME_BACKGROUND
  );
}

function getScrollDepth() {
  const scrollable = document.documentElement.scrollHeight - window.innerHeight;
  if (scrollable <= 0) return 0;
  return window.scrollY / scrollable;
}

function backgroundForScrollDepth(depth: number) {
  return depth >= SCROLL_THRESHOLD ? SCROLL_BACKGROUND : HOME_BACKGROUND;
}

function applyBackgroundForScroll() {
  const nextBackground = backgroundForScrollDepth(getScrollDepth());
  if (nextBackground === currentBackground) return;

  currentBackground = nextBackground;
  crossfadeBackground(nextBackground);
}

function teardown() {
  activeController?.abort();
  activeController = null;
  currentBackground = null;
}

function init() {
  teardown();

  if (!isHomePage() || prefersReducedMotion()) return;

  const controller = new AbortController();
  activeController = controller;

  applyBackgroundForScroll();

  window.addEventListener('scroll', applyBackgroundForScroll, {
    passive: true,
    signal: controller.signal,
  });
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
