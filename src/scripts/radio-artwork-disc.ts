const FADE_MS = 800;
const SC_API_URL = 'https://w.soundcloud.com/player/api.js';

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
let activeIframe: HTMLIFrameElement | null = null;
let activeMixIndex: number | null = null;
let hideTimeout: number | null = null;
let suppressStop = false;
let suppressStopTimeout: number | null = null;
const widgetsByIndex = new Map<number, SoundCloudWidget>();

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

function pauseAllExcept(index: number) {
  widgetsByIndex.forEach((widget, mixIndex) => {
    if (mixIndex !== index) widget.pause();
  });
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
      orb.classList.remove('is-center', 'is-floating', 'is-clickable');
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
    orb.classList.toggle('is-clickable', !isCenter);
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

function beginMixSwitch() {
  suppressStop = true;
  if (suppressStopTimeout !== null) {
    window.clearTimeout(suppressStopTimeout);
  }
  suppressStopTimeout = window.setTimeout(() => {
    suppressStop = false;
    suppressStopTimeout = null;
  }, 500);
}

function endMixSwitch() {
  suppressStop = false;
  if (suppressStopTimeout !== null) {
    window.clearTimeout(suppressStopTimeout);
    suppressStopTimeout = null;
  }
}

function playMixAtIndex(index: number) {
  const widget = widgetsByIndex.get(index);
  const iframe = getIframeByIndex(index);
  if (!widget || !iframe) return;

  beginMixSwitch();
  activeMixIndex = index;
  activeIframe = iframe;
  pauseAllExcept(index);
  widget.play();
}

function pauseMixAtIndex(index: number) {
  endMixSwitch();
  widgetsByIndex.get(index)?.pause();
}

function handleJukeboxClick(event: Event) {
  const target = event.target as Element;
  const orb = target.closest<HTMLElement>('.radio-jukebox__orb');
  if (!orb?.dataset.mixIndex || orb.hasAttribute('hidden')) return;

  const mixIndex = Number(orb.dataset.mixIndex);

  if (orb.classList.contains('is-center')) {
    if (activeMixIndex === mixIndex) pauseMixAtIndex(mixIndex);
    return;
  }

  event.preventDefault();
  playMixAtIndex(mixIndex);
}

function bindWidget(iframe: HTMLIFrameElement, signal: AbortSignal) {
  if (!window.SC) return;

  const widget = window.SC.Widget(iframe);
  const artwork = iframe.dataset.artwork;
  const mixIndex = iframe.dataset.mixIndex;

  if (!artwork || mixIndex === undefined) return;

  const mixIndexNum = Number(mixIndex);

  const onPlay = () => {
    if (signal.aborted) return;
    endMixSwitch();
    activeMixIndex = mixIndexNum;
    activeIframe = iframe;
    pauseAllExcept(mixIndexNum);
    showJukebox(mixIndexNum);
  };

  const onStop = () => {
    if (signal.aborted || suppressStop) return;
    if (activeIframe !== iframe) return;
    activeMixIndex = null;
    activeIframe = null;
    hideJukebox();
  };

  widget.bind(window.SC.Widget.Events.READY, () => {
    if (signal.aborted) return;
    widgetsByIndex.set(mixIndexNum, widget);
    widget.bind(window.SC!.Widget.Events.PLAY, onPlay);
    widget.bind(window.SC!.Widget.Events.PAUSE, onStop);
    widget.bind(window.SC!.Widget.Events.FINISH, onStop);
  });
}

function teardown() {
  activeController?.abort();
  activeController = null;
  activeIframe = null;
  activeMixIndex = null;
  suppressStop = false;
  if (suppressStopTimeout !== null) {
    window.clearTimeout(suppressStopTimeout);
    suppressStopTimeout = null;
  }
  widgetsByIndex.clear();
  clearHideTimeout();

  const jukebox = getJukebox();
  if (!jukebox) return;

  jukebox.classList.remove('is-visible');
  jukebox.setAttribute('hidden', '');
  jukebox.querySelectorAll('.radio-jukebox__orb').forEach((orb) => {
    orb.classList.remove('is-floating', 'is-clickable');
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

  jukebox.addEventListener('click', handleJukeboxClick, { signal });

  iframes.forEach((iframe) => bindWidget(iframe, signal));
}

document.addEventListener('astro:before-preparation', teardown);
document.addEventListener('astro:page-load', init);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
