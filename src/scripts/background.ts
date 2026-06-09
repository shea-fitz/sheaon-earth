export function crossfadeBackground(background: string) {
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
