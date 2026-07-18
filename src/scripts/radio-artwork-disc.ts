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

type AudioSource = 'list' | 'orb';

let activeController: AbortController | null = null;
let apiLoadPromise: Promise<void> | null = null;
let activeMixIndex: number | null = null;
let hideTimeout: number | null = null;
let audioSource: AudioSource | null = null;

const listWidgetsByIndex = new Map<number, SoundCloudWidget>();
const orbWidgetsByPlayer = new WeakMap<HTMLIFrameElement, SoundCloudWidget>();

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

function getOrbPlayers() {
  return document.querySelectorAll<HTMLIFrameElement>('.radio-jukebox__orb-player');
}

function pauseAllListWidgets(exceptIndex?: number) {
  listWidgetsByIndex.forEach((widget, index) => {
    if (index !== exceptIndex) widget.pause();
  });
}

function pauseAllOrbWidgets(exceptPlayer?: HTMLIFrameElement) {
  getOrbPlayers().forEach((player) => {
    if (player === exceptPlayer) return;
    orbWidgetsByPlayer.get(player)?.pause();
  });
}

function pauseAllWidgets(except?: { index?: number; orbPlayer?: HTMLIFrameElement }) {
  pauseAllListWidgets(except?.index);
  pauseAllOrbWidgets(except?.orbPlayer);
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

function updateOrbPlayer(orb: HTMLElement, mixIndex: number, title: string) {
  const player = orb.querySelector<HTMLIFrameElement>('.radio-jukebox__orb-player');
  const listIframe = getIframeByIndex(mixIndex);
  if (!player || !listIframe?.src) return;

  if (player.dataset.mixIndex === String(mixIndex)) return;

  player.dataset.mixIndex = String(mixIndex);
  player.title = title;
  player.src = listIframe.src;
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
      orb.setAttribute('aria-label', `Pause ${title}`);
    }
    orb.removeAttribute('hidden');
    visibleCount += 1;

    orb.classList.toggle('is-center', isCenter);
    orb.classList.toggle('is-floating', isCenter && !prefersReducedMotion());
    orb.classList.toggle('is-side', !isCenter);

    if (!isCenter) {
      updateOrbPlayer(orb, mixIndex, title);
    }
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

function activateMix(index: number) {
  activeMixIndex = index;
  showJukebox(index);
}

function stopPlayback() {
  activeMixIndex = null;
  audioSource = null;
  hideJukebox();
}

function handleMixPlay(
  mixIndex: number,
  source: AudioSource,
  activePlayer?: HTMLIFrameElement,
  signal?: AbortSignal
) {
  if (signal?.aborted) return;

  pauseAllWidgets({ index: mixIndex, orbPlayer: activePlayer });
  audioSource = source;
  activateMix(mixIndex);
}

function pauseActivePlayback() {
  if (activeMixIndex === null) return;

  if (audioSource === 'list') {
    listWidgetsByIndex.get(activeMixIndex)?.pause();
    return;
  }

  if (audioSource === 'orb') {
    getOrbPlayers().forEach((player) => {
      if (player.dataset.mixIndex === String(activeMixIndex)) {
        orbWidgetsByPlayer.get(player)?.pause();
      }
    });
  }
}

function bindCenterOrb(signal: AbortSignal) {
  const centerOrb = getJukebox()?.querySelector<HTMLButtonElement>('.radio-jukebox__orb[data-offset="0"]');
  if (!centerOrb) return;

  centerOrb.addEventListener(
    'pointerup',
    (event) => {
      if (signal.aborted || centerOrb.hasAttribute('hidden') || !centerOrb.dataset.mixIndex) return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;

      event.preventDefault();
      event.stopPropagation();

      const mixIndex = Number(centerOrb.dataset.mixIndex);
      if (activeMixIndex === mixIndex) pauseActivePlayback();
    },
    { passive: false, signal }
  );
}

function bindOrbPlayer(orb: HTMLElement, signal: AbortSignal) {
  const player = orb.querySelector<HTMLIFrameElement>('.radio-jukebox__orb-player');
  if (!player || !window.SC) return;

  const attachWidget = () => {
    if (signal.aborted || !window.SC) return;

    const widget = window.SC.Widget(player);
    orbWidgetsByPlayer.set(player, widget);

    const onPlay = () => {
      const mixIndex = Number(orb.dataset.mixIndex);
      if (Number.isNaN(mixIndex)) return;
      handleMixPlay(mixIndex, 'orb', player, signal);
    };

    const onStop = () => {
      if (signal.aborted) return;
      if (audioSource !== 'orb') return;
      if (activeMixIndex !== Number(orb.dataset.mixIndex)) return;
      stopPlayback();
    };

    widget.bind(window.SC.Widget.Events.READY, () => {
      if (signal.aborted) return;
      widget.bind(window.SC.Widget.Events.PLAY, onPlay);
      widget.bind(window.SC.Widget.Events.PAUSE, onStop);
      widget.bind(window.SC.Widget.Events.FINISH, onStop);
    });
  };

  player.addEventListener('load', attachWidget, { signal });
  if (player.src) attachWidget();
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
    handleMixPlay(mixIndexNum, 'list', undefined, signal);
  };

  const onStop = () => {
    if (signal.aborted) return;
    if (audioSource !== 'list') return;
    if (activeMixIndex !== mixIndexNum) return;
    stopPlayback();
  };

  widget.bind(window.SC.Widget.Events.READY, () => {
    if (signal.aborted) return;
    widget.bind(window.SC.Widget.Events.PLAY, onPlay);
    widget.bind(window.SC.Widget.Events.PAUSE, onStop);
    widget.bind(window.SC.Widget.Events.FINISH, onStop);
  });
}

function teardown() {
  activeController?.abort();
  activeController = null;
  activeMixIndex = null;
  audioSource = null;
  listWidgetsByIndex.clear();
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

  jukebox.querySelectorAll<HTMLElement>('.radio-jukebox__orb').forEach((orb) => {
    if (orb.dataset.offset === '0') return;
    bindOrbPlayer(orb, signal);
  });

  bindCenterOrb(signal);
  iframes.forEach((iframe) => bindListWidget(iframe, signal));
}

document.addEventListener('astro:before-preparation', teardown);
document.addEventListener('astro:page-load', init);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
