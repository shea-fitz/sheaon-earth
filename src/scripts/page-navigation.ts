import { swapFunctions } from 'astro:transitions/client';
import { crossfadeBackground, syncVisibleLayerFlip } from './background';
import { syncNavActiveState } from './nav-sync';

const TIMING = {
  contentOut: 200,
  bgPause: 150,
  bgFade: 500,
  contentInDelay: 150,
  contentIn: 500,
} as const;

let contentEnterDelay = TIMING.contentInDelay;
let deferThemeSync = false;
let skipTransitionAnimations = false;

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function getFlipFromSiteMain(siteMain: Element | null | undefined) {
  return (siteMain as HTMLElement | null)?.dataset.backgroundFlip === 'true';
}

function setNavigating(active: boolean) {
  document.body.classList.toggle('is-navigating', active);
}

function syncBodyTheme(siteMain: Element | null) {
  const el = siteMain as HTMLElement | null;
  const background = el?.dataset.background;
  if (background) {
    document.body.dataset.background = background;
  } else {
    delete document.body.dataset.background;
  }
}

function scheduleThemeAndNavSync(siteMain: Element | null, delayMs: number) {
  window.setTimeout(() => {
    syncBodyTheme(siteMain);
    syncNavActiveState();
  }, delayMs);
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

function swapPageHead(newDocument: Document) {
  const newTitle = newDocument.querySelector('title');
  if (newTitle?.textContent) {
    document.title = newTitle.textContent;
  }

  const persistedSelector = '[data-astro-transition-persist]';
  const currentStyles = Array.from(
    document.head.querySelectorAll(`style:not(${persistedSelector})`)
  );
  const newStyles = Array.from(
    newDocument.head.querySelectorAll(`style:not(${persistedSelector})`)
  );

  const currentKeys = new Set(
    currentStyles.map((style) => style.textContent?.trim() ?? '')
  );

  for (const style of currentStyles) {
    const key = style.textContent?.trim() ?? '';
    const stillNeeded = newStyles.some((next) => (next.textContent?.trim() ?? '') === key);
    if (!stillNeeded) {
      style.remove();
    }
  }

  for (const style of newStyles) {
    const key = style.textContent?.trim() ?? '';
    if (!key || currentKeys.has(key)) continue;
    document.head.appendChild(document.importNode(style, true));
    currentKeys.add(key);
  }
}

function runInitialEnter() {
  const siteMain = document.querySelector('.site-main');
  if (!siteMain) return;

  syncNavActiveState();

  if (prefersReducedMotion()) {
    siteMain.classList.remove('is-awaiting', 'is-entering', 'is-leaving');
    return;
  }

  startEnterAnimation(siteMain as HTMLElement);

  window.setTimeout(() => {
    siteMain.classList.remove('is-entering', 'is-awaiting');
    siteMain.style.removeProperty('--content-enter-delay');
  }, contentEnterDelay + TIMING.contentIn);
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
    deferThemeSync = false;
    skipTransitionAnimations = false;
    setNavigating(true);

    if (prefersReducedMotion()) {
      await originalLoader.call(this);
      return;
    }

    const currentBackground =
      document.querySelector('.site-main')?.dataset.background ?? '';

    await originalLoader.call(this);

    const nextSiteMain = this.newDocument.querySelector('.site-main');
    const nextBackground = nextSiteMain?.dataset.background ?? '';
    const nextFlip = getFlipFromSiteMain(nextSiteMain);

    if (nextBackground === currentBackground) {
      skipTransitionAnimations = true;
      return;
    }

    document.querySelector('.site-main')?.classList.add('is-leaving');
    await delay(TIMING.contentOut);

    if (nextBackground && nextBackground !== currentBackground) {
      await delay(TIMING.bgPause);
      contentEnterDelay = Math.max(0, TIMING.bgFade - 200);
      deferThemeSync = true;
      crossfadeBackground(nextBackground, nextFlip);
    }
  };
});

document.addEventListener('astro:before-swap', (event) => {
  event.viewTransition?.skipTransition();

  event.swap = () => {
    swapFunctions.deselectScripts(event.newDocument);
    swapFunctions.swapRootAttributes(event.newDocument);
    swapPageHead(event.newDocument);

    const restoreFocus = swapFunctions.saveFocus();
    const oldSiteMain = document.querySelector('.site-main');
    const newSiteMain = event.newDocument.querySelector('.site-main');

    if (oldSiteMain && newSiteMain) {
      const importedSiteMain = document.importNode(newSiteMain, true) as HTMLElement;

      if (skipTransitionAnimations) {
        importedSiteMain.classList.remove('is-leaving', 'is-entering', 'is-awaiting');
        importedSiteMain.style.removeProperty('--content-enter-delay');
        syncBodyTheme(importedSiteMain);
        syncVisibleLayerFlip(getFlipFromSiteMain(importedSiteMain));
      } else {
        prepareIncomingSiteMain(importedSiteMain);
      }

      oldSiteMain.replaceWith(importedSiteMain);

      if (!deferThemeSync && !skipTransitionAnimations) {
        syncBodyTheme(importedSiteMain);
      }
    }

    restoreFocus();
  };
});

document.addEventListener('astro:after-swap', async () => {
  const siteMain = document.querySelector('.site-main');
  if (!siteMain) {
    setNavigating(false);
    return;
  }

  if (prefersReducedMotion()) {
    syncBodyTheme(siteMain);
    syncNavActiveState();

    const background = siteMain.dataset.background;
    if (background) {
      crossfadeBackground(background, getFlipFromSiteMain(siteMain));
    }

    siteMain.classList.remove('is-leaving', 'is-awaiting', 'is-entering');
    siteMain.style.removeProperty('--content-enter-delay');
    contentEnterDelay = TIMING.contentInDelay;
    setNavigating(false);
    return;
  }

  if (skipTransitionAnimations) {
    syncNavActiveState();
    siteMain.classList.remove('is-leaving', 'is-awaiting', 'is-entering');
    siteMain.style.removeProperty('--content-enter-delay');
    contentEnterDelay = TIMING.contentInDelay;
    requestAnimationFrame(() => setNavigating(false));
    return;
  }

  if (deferThemeSync) {
    scheduleThemeAndNavSync(siteMain, contentEnterDelay);
  } else {
    syncBodyTheme(siteMain);
    syncNavActiveState();
  }

  startEnterAnimation(siteMain as HTMLElement);

  const animDuration = contentEnterDelay + TIMING.contentIn;

  await delay(animDuration);
  siteMain.classList.remove('is-entering', 'is-leaving');
  siteMain.style.removeProperty('--content-enter-delay');
  contentEnterDelay = TIMING.contentInDelay;
  deferThemeSync = false;
  setNavigating(false);
});
