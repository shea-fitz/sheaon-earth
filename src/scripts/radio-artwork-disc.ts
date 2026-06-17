const FADE_MS = 800;
const SC_API_URL = 'https://w.soundcloud.com/player/api.js';

interface SoundCloudWidget {
  bind: (event: string, callback: () => void) => void;
  unbind: (event: string) => void;
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
let hideTimeout: number | null = null;

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

function getDiscElements() {
  const disc = document.querySelector<HTMLElement>('.radio-artwork-disc');
  const inner = disc?.querySelector<HTMLElement>('.radio-artwork-disc__inner') ?? null;
  return { disc, inner };
}

function clearHideTimeout() {
  if (hideTimeout !== null) {
    window.clearTimeout(hideTimeout);
    hideTimeout = null;
  }
}

function showDisc(artwork: string) {
  const { disc, inner } = getDiscElements();
  if (!disc || !inner) return;

  clearHideTimeout();
  inner.style.backgroundImage = `url("${artwork}")`;
  disc.removeAttribute('hidden');
  disc.classList.add('is-visible');

  if (!prefersReducedMotion()) {
    disc.classList.add('is-spinning');
  }
}

function hideDisc() {
  const { disc } = getDiscElements();
  if (!disc) return;

  clearHideTimeout();
  disc.classList.remove('is-visible', 'is-spinning');

  hideTimeout = window.setTimeout(() => {
    if (!disc.classList.contains('is-visible')) {
      disc.setAttribute('hidden', '');
    }
    hideTimeout = null;
  }, FADE_MS);
}

function bindWidget(iframe: HTMLIFrameElement, signal: AbortSignal) {
  if (!window.SC) return;

  const widget = window.SC.Widget(iframe);
  const artwork = iframe.dataset.artwork;
  if (!artwork) return;

  const onPlay = () => {
    if (signal.aborted) return;
    activeIframe = iframe;
    showDisc(artwork);
  };

  const onStop = () => {
    if (signal.aborted) return;
    if (activeIframe !== iframe) return;
    activeIframe = null;
    hideDisc();
  };

  widget.bind(window.SC.Widget.Events.READY, () => {
    if (signal.aborted) return;
    widget.bind(window.SC!.Widget.Events.PLAY, onPlay);
    widget.bind(window.SC!.Widget.Events.PAUSE, onStop);
    widget.bind(window.SC!.Widget.Events.FINISH, onStop);
  });
}

function teardown() {
  activeController?.abort();
  activeController = null;
  activeIframe = null;
  clearHideTimeout();

  const { disc } = getDiscElements();
  if (disc) {
    disc.classList.remove('is-visible', 'is-spinning');
    disc.setAttribute('hidden', '');
  }
}

async function init() {
  teardown();

  const { disc } = getDiscElements();
  if (!disc) return;

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

  iframes.forEach((iframe) => bindWidget(iframe, signal));
}

document.addEventListener('astro:before-preparation', teardown);
document.addEventListener('astro:page-load', init);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
