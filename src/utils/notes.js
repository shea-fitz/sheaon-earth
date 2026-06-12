export function isListedNote(entry) {
  return !entry.data.hidden;
}

export function getListedNotes(entries) {
  return entries.filter(isListedNote);
}
