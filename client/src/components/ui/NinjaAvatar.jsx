import { stickerUrl, stickerLabel } from '../../utils/stickers';

// A ninja's face. Their Code.AI sticker when they have one, otherwise their
// initials on a colour derived from their name.
//
// This lived twice, letter for letter, in StudentRoster and StudentProfile,
// and the club session page wanted it a third time. The colour has to be the
// same everywhere or the same child is a different colour on two screens, so
// the palette and the hash are exported rather than pasted again.

export const AVATAR_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6',
  '#8b5cf6', '#ec4899', '#14b8a6', '#6366f1', '#f59e0b',
];

export function getAvatarColor(name) {
  const sum = [...name].reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}

export function getInitials(name) {
  const parts = String(name || '').trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// The sticker sits on a white disc with its own hairline, because the sticker
// art is drawn for white and a coloured disc behind it muddies the ink. Inline
// hex, not `bg-white`: `.dark .bg-white` would repaint the disc slate and the
// artwork would lose its ground in dark mode.
export default function NinjaAvatar({ name, sticker, className = 'w-9 h-9 text-xs' }) {
  const url = stickerUrl(sticker);
  return (
    <div
      className={`rounded-full flex items-center justify-center flex-shrink-0 text-white font-ninja font-bold overflow-hidden ${className}`}
      style={url
        ? { backgroundColor: '#ffffff', border: '1px solid #e2e8f0' }
        : { backgroundColor: getAvatarColor(name || '?') }}
    >
      {url
        ? <img src={url} alt={`${stickerLabel(sticker)} sticker`} className="w-full h-full object-contain p-0.5" />
        : getInitials(name)}
    </div>
  );
}
