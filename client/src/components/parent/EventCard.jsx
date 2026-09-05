import { Link } from 'react-router-dom';
import { ChevronRightIcon } from 'lucide-react';
import Logo from '../ui/Logo';
import { FLAT } from '../../lib/surfaces';
import { listingHook, rowWhen, listingDate, daysUntil, HOUSE, ANYTIME } from '../../lib/eventListing';

// One event listing, as a card, in the two shapes the portal needs it.
//
// It lived in the Events page and now two surfaces draw a listing card: the
// index's agenda and the bottom of a listing's own page. Same rules either
// way, so one component rather than two that will drift.
//
//   'row'  a wide card with the art down one side. The index is a list you
//          read top to bottom, so a row gives the hook room to be a sentence.
//   'tile' art on top, words under. For a grid of three, where a row would be
//          a letterbox with four words in it.
//
// THE ARTWORK IS THE POINT of both. A center posts a designed poster for an
// open house and a 40px thumbnail wastes it, so the art gets a real panel. A
// listing with none wears the house navy and the mark, exactly as it does on
// the home billboard, so every surface agrees about what a listing with no
// picture looks like.

// The art panel, and what stands in for it when a listing has none.
function Art({ ev, className }) {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      {ev.image_url ? (
        <img
          src={ev.image_url}
          alt=""
          aria-hidden="true"
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-[600ms] ease-out group-hover:scale-[1.045]"
        />
      ) : (
        <span aria-hidden className="absolute inset-0 flex items-center justify-center" style={{ background: HOUSE }}>
          {/* Opacity on the element, not the colour: the mark's paths overlap,
              and a translucent colour doubles up where they do. */}
          <span style={{ color: '#ffffff', opacity: 0.28 }}><Logo variant="mark" className="h-14" /></span>
        </span>
      )}
    </div>
  );
}

// The date, as the two lines a tile has room for: the month over the day.
// A tile sits in a grid with no month heading above it, so unlike the index's
// rows it has to carry its own month.
function DateRail({ dateStr }) {
  const d = listingDate(dateStr);
  if (!d) {
    return (
      <span className="flex-shrink-0 w-9 font-ninja text-[11px] font-extrabold uppercase tracking-[0.06em] text-ninja-muted leading-tight">
        Any<br />time
      </span>
    );
  }
  return (
    <span className="flex-shrink-0 w-9 text-center">
      <span className="block font-ninja text-[11px] font-extrabold uppercase tracking-[0.06em] text-ninja-blue-ink leading-none">
        {d.toLocaleDateString('en-US', { month: 'short' })}
      </span>
      <span className="block font-ninja text-[19px] font-extrabold text-ninja-navy leading-tight">{d.getDate()}</span>
    </span>
  );
}

export default function EventCard({ ev, layout = 'row' }) {
  const days = daysUntil(ev.event_date);
  const when = rowWhen(ev);
  const hook = listingHook(ev);
  // Only the two dates a parent has to act on today get called out. Every
  // other listing is far enough away that the date itself is the whole
  // answer, and a flag on all of them is a flag on none of them.
  //
  // Plain blue words, not a badge. The house rule (AGENTS.md, from the
  // sticker count) is that a value like this stays unboxed: no rounded
  // background, no capsule, no status chip.
  const soon = days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : null;

  if (layout === 'tile') {
    return (
      <Link
        to={`/parent/events/${ev.id}`}
        className={`${FLAT} group block overflow-hidden transition-colors hover:border-ninja-blue/40`}
      >
        <Art ev={ev} className="h-36" />
        <div className="flex items-start gap-3 p-4">
          <DateRail dateStr={ev.event_date} />
          <span className="min-w-0 flex-1">
            <span className="block font-ninja font-extrabold text-[15px] leading-snug text-ninja-navy line-clamp-2">{ev.title}</span>
            {(ev.event_time || soon) && (
              <span className="block font-ninja text-[12.5px] font-bold text-ninja-muted mt-1 truncate">
                {soon ? <span className="text-ninja-blue-ink">{soon}</span> : null}
                {soon && ev.event_time ? ' · ' : null}
                {ev.event_time}
              </span>
            )}
          </span>
        </div>
      </Link>
    );
  }

  return (
    <Link
      to={`/parent/events/${ev.id}`}
      className={`${FLAT} group block overflow-hidden transition-colors hover:border-ninja-blue/40`}
    >
      <div className="sm:flex sm:items-stretch sm:min-h-[172px]">
        {/* `absolute inset-0` inside a stretched flex item is what lets one
            picture be a strip on a phone and a full height column on a
            desktop without cropping to a fixed box. */}
        <Art ev={ev} className="h-40 sm:h-auto sm:w-[38%] sm:max-w-[280px] shrink-0" />

        <div className="min-w-0 flex-1 flex flex-col justify-center gap-1.5 p-4 sm:p-5 lg:p-6">
          <p className="flex items-center gap-2 font-ninja text-[11.5px] font-extrabold uppercase tracking-[0.08em] text-ninja-muted">
            <span className="truncate">{when || ANYTIME}</span>
            {soon && <span className="flex-shrink-0 text-ninja-blue-ink">{soon}</span>}
          </p>
          <h3 className="font-ninja font-extrabold text-[19px] sm:text-[21px] leading-[1.15] tracking-[-0.02em] text-ninja-navy">
            {ev.title}
          </h3>
          {hook && <p className="font-ninja text-[13.5px] leading-relaxed text-ninja-muted line-clamp-2">{hook}</p>}
          <span className="mt-1.5 inline-flex items-center gap-0.5 font-ninja text-[13px] font-extrabold text-ninja-blue-ink">
            Details
            <ChevronRightIcon size={15} strokeWidth={2.6} aria-hidden className="transition-transform duration-200 group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}
