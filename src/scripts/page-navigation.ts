import { swapFunctions } from 'astro:transitions/client';

const TIMING = {
  contentOut: 300,
  bgPause: 150,
  bgFade: 600,
  contentInDelay: 150,
  contentIn: 600,
} as const;

let contentEnterDelay = TIMING.contentInDelay;
let pendingBackground: string | null = null;

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function crossfadeBackground(background: string) {
  const primary = document.getElementById('page-bg-primary');
  const secondary = document.getElementById('page-bg-secondary');
  if (!primary || !secondary) return;

  const visible = primary.classList.contains('is-visible') ? primary : secondary;
  const hidden = visible === primary ? secondary : primary;

  hidden.className = 'page-bg page-bg-layer';
  if (background) hidden.classList.add(`page-bg-${background}`);
  hidden.classList.add('is-visible');
  visible.classList.remove('is-visible');
}

function prepareIncomingSiteMain(siteMain: HTMLElement) {
  siteMain.classList.remove('is-leaving', 'is-entering');
  siteMain.classList.add('is-awaiting');

  if (prefersReducedMotion()) {
    siteMain.classList.remove('is-awaiting');
    return;
  }

  siteMain.style.setProperty('--content-enter-delay', `${contentEnterDelay}ms`);
}

function startEnterAnimation(siteMain: HTMLElement) {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      siteMain.classList.remove('is-awaiting');
      siteMain.classList.add('is-entering');
    });
  });
}

function runInitialEnter() {
  if (prefersReducedMotion()) return;

  const siteMain = document.querySelector('.site-main');
  if (!siteMain) return;

  prepareIncomingSiteMain(siteMain as HTMLElement);
  startEnterAnimation(siteMain as HTMLElement);

  window.setTimeout(() => {
    siteMain.classList.remove('is-entering', 'is-awaiting');
    siteMain.style.removeProperty('--content-enter-delay');
  }, TIMING.contentIn);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', runInitialEnter);
} else {
  runInitialEnter();
}

document.addEventListener('astro:before-preparation', (event) => {
  const originalLoader = event.loader;

  event.loader = async function loader(this: { newDocument: Document }) {
    contentEnterDelay = TIMING.contentInDelay;
    pendingBackground = null;

    if (prefersReducedMotion()) {
      await originalLoader.call(this);
      return;
    }

    document.querySelector('.site-main')?.classList.add('is-leaving');
    await delay(TIMING.contentOut);
    await originalLoader.call(this);

    const currentBackground = document.querySelector('.site-main')?.dataset.background ?? '';
    const nextBackground = this.newDocument.querySelector('.site-main')?.dataset.background ?? '';

    if (nextBackground && nextBackground !== currentBackground) {
      await delay(TIMING.bgPause);
      pendingBackground = nextBackground;
      contentEnterDelay = 0;
    }
  };
});

document.addEventListener('astro:before-swap', (event) => {
  event.viewTransition?.skipTransition();

  event.swap = () => {
    swapFunctions.deselectScripts(event.newDocument);
    swapFunctions.swapRootAttributes(event.newDocument);
    swapFunctions.swapHeadElements(event.newDocument);

    const restoreFocus = swapFunctions.saveFocus();
    const oldSiteMain = document.querySelector('.site-main');
    const newSiteMain = event.newDocument.querySelector('.site-main');

    if (oldSiteMain && newSiteMain) {
      const importedSiteMain = document.importNode(newSiteMain, true) as HTMLElement;
      prepareIncomingSiteMain(importedSiteMain);
      oldSiteMain.replaceWith(importedSiteMain);
    }

    restoreFocus();
  };
});

document.addEventListener('astro:after-swap', async () => {
  const siteMain = document.querySelector('.site-main');
  if (!siteMain) return;

  if (prefersReducedMotion()) {
    if (pendingBackground) {
      crossfadeBackground(pendingBackground);
      pendingBackground = null;
    }

    siteMain.classList.remove('is-leaving', 'is-awaiting', 'is-entering');
    siteMain.style.removeProperty('--content-enter-delay');
    contentEnterDelay = TIMING.contentInDelay;
    return;
  }

  const bgEntering = pendingBackground !== null;

  if (pendingBackground) {
    crossfadeBackground(pendingBackground);
    pendingBackground = null;
  }

  startEnterAnimation(siteMain as HTMLElement);

  const animDuration = bgEntering
    ? Math.max(TIMING.contentIn, TIMING.bgFade)
    : contentEnterDelay + TIMING.contentIn;

  await delay(animDuration);
  siteMain.classList.remove('is-entering', 'is-leaving');
  siteMain.style.removeProperty('--content-enter-delay');
  contentEnterDelay = TIMING.contentInDelay;
});
