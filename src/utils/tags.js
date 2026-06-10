export function slugifyTag(tag) {
  return tag.trim().toLowerCase().replace(/\s+/g, '-');
}

export function tagsMatch(a, b) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function getUniqueTags(entries) {
  const seen = new Map();

  for (const entry of entries) {
    for (const tag of entry.data.tags) {
      const slug = slugifyTag(tag);
      if (!seen.has(slug)) {
        seen.set(slug, tag);
      }
    }
  }

  return [...seen.entries()]
    .map(([slug, label]) => ({ slug, label }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
}

export function resolveTagFromSlug(slug, uniqueTags) {
  return uniqueTags.find((t) => t.slug === slug)?.label ?? null;
}

export function filterNotesByTag(entries, tagLabel) {
  return entries.filter((entry) =>
    entry.data.tags.some((t) => tagsMatch(t, tagLabel))
  );
}

export function releaseNotesTag(release) {
  return release.notesTag ?? release.title.toLowerCase();
}
