// Negative rate makes the layer lag behind scroll, appearing farther back in depth.
const DEPTH_RATE = -0.3;
const HEADROOM_RATIO = 0.18;
const PARALLAX_SELECTOR = '[data-section-parallax]';

let activeController: AbortController | null = null;
let rafId: number | null = null;
let parallaxLayers: HTMLElement[] = [];

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function updateParallaxOffsets() {
  rafId = null;

  parallaxLayers.forEach((layer) => {
    const container = layer.closest('.section-image-placeholder');
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const headroom = rect.height * HEADROOM_RATIO;
    const rawOffset = rect.top * DEPTH_RATE;
    const offset = Math.max(-headroom, Math.min(headroom, rawOffset));

    layer.style.setProperty('--parallax-y', `${offset}px`);
  });
}

function scheduleParallaxUpdate() {
  if (rafId !== null) return;
  rafId = window.requestAnimationFrame(updateParallaxOffsets);
}

function teardown() {
  activeController?.abort();
  activeController = null;

  if (rafId !== null) {
    window.cancelAnimationFrame(rafId);
    rafId = null;
  }

  parallaxLayers.forEach((layer) => {
    layer.style.removeProperty('--parallax-y');
  });
  parallaxLayers = [];
}

function init() {
  teardown();

  if (prefersReducedMotion()) return;

  const layers = Array.from(
    document.querySelectorAll<HTMLElement>(PARALLAX_SELECTOR)
  );
  if (layers.length === 0) return;

  const controller = new AbortController();
  activeController = controller;
  const { signal } = controller;
  parallaxLayers = layers;

  window.addEventListener('scroll', scheduleParallaxUpdate, { passive: true, signal });
  window.addEventListener('resize', scheduleParallaxUpdate, { passive: true, signal });

  scheduleParallaxUpdate();
}

document.addEventListener('astro:before-preparation', teardown);
document.addEventListener('astro:page-load', init);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
