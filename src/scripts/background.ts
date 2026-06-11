export function crossfadeBackground(background: string, flip = false) {
  const primary = document.getElementById('page-bg-primary');
  const secondary = document.getElementById('page-bg-secondary');
  if (!primary || !secondary) return;

  const visible = primary.classList.contains('is-visible') ? primary : secondary;
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
