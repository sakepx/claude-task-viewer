// Pure utility functions — no imports needed

export function formatDate(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now - date;

  if (diff < 60000) return i18next.t('time.justNow');
  if (diff < 3600000) return i18next.t('time.minutesAgo', { count: Math.floor(diff / 60000) });
  if (diff < 86400000) return i18next.t('time.hoursAgo', { count: Math.floor(diff / 3600000) });
  return date.toLocaleDateString();
}

export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function fuzzyMatch(text, query) {
  if (!query) return true;
  if (!text) return false;

  text = text.toLowerCase();
  query = query.toLowerCase();

  // Prioritize exact substring match
  if (text.includes(query)) return true;

  // Split by common delimiters to search in individual words
  const words = text.split(/[\s\-_\/\.]+/);

  // Check if query matches start of any word
  for (const word of words) {
    if (word.startsWith(query)) return true;
  }

  // Check if any word contains the query
  for (const word of words) {
    if (word.includes(query)) return true;
  }

  return false;
}
