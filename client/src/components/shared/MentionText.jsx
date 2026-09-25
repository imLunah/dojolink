import Linkify from './Linkify';

// Plain text with its recorded mentions drawn as name tags. Only the names in
// `mentions` (who the server says was addressed) are highlighted, so an "@"
// typed by hand never passes for a mention that notified nobody. Longest names
// first, so "@Sam Lee" is not claimed by "@Sam".
export default function MentionText({ text, mentions }) {
  const names = (mentions || [])
    .map((mention) => mention.display_name)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  if (names.length === 0) return <Linkify>{text}</Linkify>;

  const escaped = names.map((name) => `@${name}`.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(`(${escaped.join('|')})`, 'g');
  const tagged = new Set(names.map((name) => `@${name}`));
  let offset = 0;

  return text.split(pattern).map((part) => {
    const start = offset;
    offset += part.length;
    return tagged.has(part) ? (
      <span key={`mention:${start}`} className="rounded-md bg-ninja-blue/15 px-1 py-0.5 font-bold text-ninja-blue-ink">
        {part}
      </span>
    ) : (
      <Linkify key={`text:${start}`}>{part}</Linkify>
    );
  });
}
