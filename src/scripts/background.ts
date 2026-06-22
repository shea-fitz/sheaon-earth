export function crossfadeBackground(background: string, flip = false) {
  const primary = document.getElementById('page-bg-primary');
  const secondary = document.getElementById('page-bg-secondary');
  if (!primary || !secondary) return;

  const visible = primary.classList.contains('is-visible') ? primary : secondary;
  const visibleBackground = [...visible.classList].find((className) => className.startsWith('page-bg-bg'));
  const visibleFlip = visible.classList.contains('is-flipped');

  if (visibleBackground === `page-bg-${background}` && visibleFlip === flip) return;

  const hidden = visible === primary ? secondary : primary;

  hidden.className = 'page-bg page-bg-layer';
  if (background) hidden.classList.add(`page-bg-${background}`);
  if (flip) hidden.classList.add('is-flipped');
  hidden.classList.add('is-visible');
  visible.classList.remove('is-visible');
}

export function syncVisibleLayerFlip(flip: boolean) {
  document.querySelectorAll('.page-bg-layer.is-visible').forEach((layer) => {
    layer.classList.toggle('is-flipped', flip);
  });
}
