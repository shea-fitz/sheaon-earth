const FADE_MS = 800;
const SC_API_URL = 'https://w.soundcloud.com/player/api.js';
const SWITCH_TIMEOUT_MS = 4000;

interface SoundCloudWidget {
  bind: (event: string, callback: () => void) => void;
  unbind: (event: string) => void;
  play: () => void;
  pause: () => void;
}

interface SoundCloudGlobal {
  Widget: ((iframe: HTMLIFrameElement) => SoundCloudWidget) & {
    Events: {
      READY: string;
      PLAY: string;
      PAUSE: string;
      FINISH: string;
    };
  };
}

declare global {
  interface Window {
    SC?: SoundCloudGlobal;
  }
}

let activeController: AbortController | null = null;
let apiLoadPromise: Promise<void> | null = null;
let activeMixIndex: number | null = null;
let hideTimeout: number | null = null;
let pendingPlayIndex: number | null = null;
let pendingPlayTimeout: number | null = null;

const listWidgetsByIndex = new Map<number, SoundCloudWidget>();
const readyByIndex = new Set<number>();

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing) {
      if (window.SC) {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.addEventListener('load', () => resolve(), { once: true });
    script.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true });
    document.head.appendChild(script);
  });
}

function loadSoundCloudApi() {
  if (!apiLoadPromise) {
    apiLoadPromise = loadScript(SC_API_URL).then(() => {
      if (!window.SC) {
        throw new Error('SoundCloud Widget API unavailable');
      }
    });
  }
  return apiLoadPromise;
}

function getJukebox() {
  return document.querySelector<HTMLElement>('.radio-jukebox');
}

function getMixIframes() {
  return document.querySelectorAll<HTMLIFrameElement>('.radio-list .radio-player');
}

function getMixArtworks() {
  return Array.from(getMixIframes()).map((iframe) => iframe.dataset.artwork ?? '');
}

function getMixTitles() {
  return Array.from(getMixIframes()).map((iframe) => iframe.title);
}

function getIframeByIndex(index: number) {
  return document.querySelector<HTMLIFrameElement>(`.radio-player[data-mix-index="${index}"]`);
}

function wrapIndex(index: number, length: number) {
  if (length === 0) return 0;
  return ((index % length) + length) % length;
}

function clearHideTimeout() {
  if (hideTimeout !== null) {
    window.clearTimeout(hideTimeout);
    hideTimeout = null;
  }
}

function clearPendingPlay() {
  pendingPlayIndex = null;
  if (pendingPlayTimeout !== null) {
    window.clearTimeout(pendingPlayTimeout);
    pendingPlayTimeout = null;
  }
}

function beginMixSwitch(targetIndex: number) {
  pendingPlayIndex = targetIndex;

  if (pendingPlayTimeout !== null) {
    window.clearTimeout(pendingPlayTimeout);
  }

  pendingPlayTimeout = window.setTimeout(() => {
    clearPendingPlay();
  }, SWITCH_TIMEOUT_MS);
}

function showJukebox(activeIndex: number) {
  const jukebox = getJukebox();
  if (!jukebox) return;

  const artworks = getMixArtworks();
  const titles = getMixTitles();
  const orbs = jukebox.querySelectorAll<HTMLElement>('.radio-jukebox__orb');
  let visibleCount = 0;

  if (artworks.length === 0) return;

  orbs.forEach((orb) => {
    const offset = Number(orb.dataset.offset);
    const mixIndex = wrapIndex(activeIndex + offset, artworks.length);
    const artwork = artworks[mixIndex];
    const title = titles[mixIndex];
    const inner = orb.querySelector<HTMLElement>('.radio-jukebox__orb-inner');
    const label = orb.querySelector<HTMLElement>('.radio-jukebox__orb-label');

    if (!inner || !artwork) {
      orb.setAttribute('hidden', '');
      inner?.style.removeProperty('background-image');
      if (label) label.textContent = '';
      orb.classList.remove('is-center', 'is-floating', 'is-side');
      delete orb.dataset.mixIndex;
      return;
    }

    inner.style.backgroundImage = `url("${artwork}")`;
    if (label) label.textContent = title;
    orb.dataset.mixIndex = String(mixIndex);

    const isCenter = offset === 0;
    if (orb instanceof HTMLButtonElement) {
      orb.setAttribute('aria-label', isCenter ? `Pause ${title}` : `Play ${title}`);
    }
    orb.removeAttribute('hidden');
    visibleCount += 1;

    orb.classList.toggle('is-center', isCenter);
    orb.classList.toggle('is-floating', isCenter && !prefersReducedMotion());
    orb.classList.toggle('is-side', !isCenter);
  });

  if (visibleCount === 0) return;

  clearHideTimeout();
  jukebox.removeAttribute('hidden');
  jukebox.classList.add('is-visible');
}

function hideJukebox() {
  const jukebox = getJukebox();
  if (!jukebox) return;

  clearHideTimeout();
  jukebox.classList.remove('is-visible');
  jukebox.querySelectorAll('.radio-jukebox__orb').forEach((orb) => {
    orb.classList.remove('is-floating');
  });

  hideTimeout = window.setTimeout(() => {
    if (!jukebox.classList.contains('is-visible')) {
      jukebox.setAttribute('hidden', '');
    }
    hideTimeout = null;
  }, FADE_MS);
}

function stopPlayback() {
  clearPendingPlay();
  activeMixIndex = null;
  hideJukebox();
}

function requestMixPlay(index: number) {
  if (activeMixIndex === index) return;

  const widget = listWidgetsByIndex.get(index);
  if (!widget) return;

  beginMixSwitch(index);
  showJukebox(index);

  getIframeByIndex(index)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });

  // Must run synchronously inside the tap handler (iOS audio policy).
  widget.play();
}

function pauseActivePlayback() {
  clearPendingPlay();

  if (activeMixIndex !== null) {
    listWidgetsByIndex.get(activeMixIndex)?.pause();
  }
}

function bindJukeboxOrbs(signal: AbortSignal) {
  const jukebox = getJukebox();
  if (!jukebox) return;

  jukebox.querySelectorAll<HTMLButtonElement>('.radio-jukebox__orb').forEach((orb) => {
    const isCenterOrb = orb.dataset.offset === '0';

    const onSideOrbTap = (event: Event) => {
      if (signal.aborted || isCenterOrb || orb.hasAttribute('hidden') || !orb.dataset.mixIndex) return;

      event.preventDefault();
      event.stopPropagation();
      requestMixPlay(Number(orb.dataset.mixIndex));
    };

    const onCenterOrbTap = (event: Event) => {
      if (signal.aborted || orb.hasAttribute('hidden') || !orb.dataset.mixIndex) return;

      event.preventDefault();
      event.stopPropagation();

      const mixIndex = Number(orb.dataset.mixIndex);
      if (activeMixIndex === mixIndex) pauseActivePlayback();
    };

    if (isCenterOrb) {
      orb.addEventListener('pointerup', onCenterOrbTap, { passive: false, signal });
      return;
    }

    orb.addEventListener('touchstart', onSideOrbTap, { passive: false, signal });
    orb.addEventListener('pointerup', (event) => {
      if (event.pointerType === 'touch') return;
      onSideOrbTap(event);
    }, { passive: false, signal });
  });
}

function bindListWidget(iframe: HTMLIFrameElement, signal: AbortSignal) {
  if (!window.SC) return;

  const widget = window.SC.Widget(iframe);
  const artwork = iframe.dataset.artwork;
  const mixIndex = iframe.dataset.mixIndex;

  if (!artwork || mixIndex === undefined) return;

  const mixIndexNum = Number(mixIndex);
  listWidgetsByIndex.set(mixIndexNum, widget);

  const onPlay = () => {
    if (signal.aborted) return;
    if (pendingPlayIndex !== null && mixIndexNum !== pendingPlayIndex) return;

    const previousIndex = activeMixIndex;
    clearPendingPlay();
    activeMixIndex = mixIndexNum;

    if (previousIndex !== null && previousIndex !== mixIndexNum) {
      listWidgetsByIndex.get(previousIndex)?.pause();
    }

    showJukebox(mixIndexNum);
  };

  const onStop = () => {
    if (signal.aborted) return;
    if (pendingPlayIndex !== null) return;
    if (activeMixIndex !== mixIndexNum) return;

    stopPlayback();
  };

  widget.bind(window.SC.Widget.Events.READY, () => {
    if (signal.aborted) return;

    readyByIndex.add(mixIndexNum);

    if (pendingPlayIndex === mixIndexNum) {
      widget.play();
    }

    widget.bind(window.SC.Widget.Events.PLAY, onPlay);
    widget.bind(window.SC.Widget.Events.PAUSE, onStop);
    widget.bind(window.SC.Widget.Events.FINISH, onStop);
  });
}

async function warmWidgets(signal: AbortSignal) {
  const savedScrollY = window.scrollY;

  for (const iframe of getMixIframes()) {
    if (signal.aborted) break;

    const mixIndex = iframe.dataset.mixIndex;
    if (mixIndex === undefined || readyByIndex.has(Number(mixIndex))) continue;

    iframe.scrollIntoView({ block: 'nearest' });
    await new Promise<void>((resolve) => {
      const timeout = window.setTimeout(resolve, 400);
      const check = window.setInterval(() => {
        if (readyByIndex.has(Number(mixIndex))) {
          window.clearInterval(check);
          window.clearTimeout(timeout);
          resolve();
        }
      }, 50);
      signal.addEventListener('abort', () => {
        window.clearInterval(check);
        window.clearTimeout(timeout);
        resolve();
      }, { once: true });
    });
  }

  window.scrollTo(0, savedScrollY);
}

function teardown() {
  activeController?.abort();
  activeController = null;
  activeMixIndex = null;
  clearPendingPlay();
  listWidgetsByIndex.clear();
  readyByIndex.clear();
  clearHideTimeout();

  const jukebox = getJukebox();
  if (!jukebox) return;

  jukebox.classList.remove('is-visible');
  jukebox.setAttribute('hidden', '');
  jukebox.querySelectorAll('.radio-jukebox__orb').forEach((orb) => {
    orb.classList.remove('is-floating', 'is-side');
    orb.setAttribute('hidden', '');
  });
}

async function init() {
  teardown();

  const jukebox = getJukebox();
  if (!jukebox) return;

  const iframes = document.querySelectorAll<HTMLIFrameElement>('.radio-player[data-artwork]');
  if (iframes.length === 0) return;

  const controller = new AbortController();
  activeController = controller;
  const { signal } = controller;

  try {
    await loadSoundCloudApi();
  } catch {
    return;
  }

  if (signal.aborted) return;

  iframes.forEach((iframe) => bindListWidget(iframe, signal));
  bindJukeboxOrbs(signal);

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(() => {
      void warmWidgets(signal);
    });
  } else {
    window.setTimeout(() => {
      void warmWidgets(signal);
    }, 500);
  }
}

document.addEventListener('astro:before-preparation', teardown);
document.addEventListener('astro:page-load', init);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
