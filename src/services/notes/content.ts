/** Text representation used by archive titles, search, and empty-note checks. */
export function noteText(content: string): string {
  return decodeEntities(
    content
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(?:div|p|li|ul|ol)>/gi, '\n')
      .replace(/<[^>]*>/g, '')
  ).replace(/\*\*([^*\n]+)\*\*/g, '$1').replace(/\*([^*\n]+)\*/g, '$1').replace(/\n{3,}/g, '\n\n');
}

function decodeEntities(value: string): string {
  return value.replace(/&(amp|lt|gt|quot|#39);/g, (entity) => ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" }[entity]!));
}
