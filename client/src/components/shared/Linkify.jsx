// Comments are plain text, not markdown — a pasted URL rendered as dead words
// makes someone retype it into the address bar. This finds the unambiguous
// ones (http(s):// and www.) and renders them as links with the same look the
// rendered-markdown views use. Bare domains like "code.org" stay text on
// purpose: matching them from prose means linking every "e.g." and filename.
const URL_RE = /(https?:\/\/[^\s<]+|www\.[^\s<]+)/g;

export default function Linkify({ children }) {
  const text = String(children ?? '');
  if (!/https?:\/\/|www\./.test(text)) return text;
  // Split on a capturing group: URLs land at the odd indices.
  return text.split(URL_RE).map((part, i) =>
    i % 2 === 1 ? (
      <a
        key={i}
        href={part.startsWith('www.') ? `https://${part}` : part}
        target="_blank"
        rel="noreferrer"
        className="text-ninja-blue underline underline-offset-2 hover:text-ninja-blue-hover break-all"
      >
        {part}
      </a>
    ) : (
      part
    )
  );
}
