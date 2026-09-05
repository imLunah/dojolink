import { useEffect, useMemo, useState } from 'react';
import ParentLayout from '../../components/layout/ParentLayout';
import { api } from '../../api/client';
import { useParentAuth } from '../../context/ParentAuthContext';
import { PinnedHero, PageSheet, MoreLink } from '../../components/parent/ParentUI';
import Logo from '../../components/ui/Logo';
import { SkeletonCards } from '../../components/ui/Skeleton';
import { FLAT } from '../../lib/surfaces';
import EventCard from '../../components/parent/EventCard';
import { ymd, byMonth, HOUSE } from '../../lib/eventListing';

// Everything the center has coming up, on one page.
//
// The home billboard is a poster: it rotates, it shows one listing at a time,
// and it is aimed at the parent who was not looking for it. This is the other
// half — the parent who WAS looking, who wants to know what is on in October
// before they book a weekend. So it is an AGENDA, not a grid of tiles.
//
// Three things follow from that, and they are the whole design:
//
//   THE MONTH IS THE SPINE. Listings are cut into month groups under a small
//   rule, because the first question about an event is when, and a person
//   scanning for "anything in October" should be able to find October rather
//   than read ten dates. Undated evergreen promos ("join our club") get their
//   own group at the end; they belong to no month and dating them would be an
//   invention.
//
//   A DATE IS PRINTED ONCE. The heading carries the month, so a row says
//   "Sat 6 · 10:00 AM" and stops. Repeating "Saturday, October 6" inside a
//   card that already sits under a heading reading October is the standard
//   way an events list turns into noise.
//
//   THE ARTWORK IS THE HOOK. A center posts a designed poster for an open
//   house, and a 40px thumbnail wastes it. Each listing gets a real panel of
//   its own art — a strip across the top on a phone, a column down the left
//   on a desktop — and a listing with no art wears the house navy and the
//   mark, exactly as it does on the billboard, so the two pages agree about
//   what a listing with no picture looks like.
//
// No sticky month headings. They earn their keep on a calendar with a year in
// it; a center runs a handful of events at a time, and a heading that detaches
// and floats over a two-item group is machinery for nothing.

export default function ParentEventsPage() {
  const { parent } = useParentAuth();
  const [events, setEvents] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    // The complete list, not the billboard's handful. `today` is the browser's
    // local date so an event stays on the page through its own evening.
    api.get(`/parent/events?today=${ymd(new Date())}&limit=50`)
      .then((rows) => { if (alive) setEvents(rows || []); })
      .catch(() => { if (alive) { setEvents([]); setError('Could not load the events. Try again in a moment.'); } });
    return () => { alive = false; };
  }, []);

  const groups = useMemo(() => byMonth(events || []), [events]);
  const count = events?.length || 0;

  return (
    <ParentLayout>
      <div className="relative">
        {/* The page's own band, and deliberately not a second billboard. The
            billboard is home's signature and it is 24rem of somebody's
            artwork; repeating it here would make the two pages open the same
            way and would give the next event a second, larger printing right
            above its own card. This says where you are and how much there is,
            in the house colours, and gets out of the way. */}
        <PinnedHero>
          <section
            className="relative left-1/2 -translate-x-1/2 w-[100cqw] overflow-hidden text-white"
            style={{ background: HOUSE }}
          >
            <div className="relative h-44 sm:h-52 lg:h-60">
              <div className="relative h-full max-w-6xl mx-auto flex items-center px-4 sm:px-6">
                <span aria-hidden className="absolute right-6 top-1/2 -translate-y-1/2 hidden sm:block" style={{ color: '#ffffff', opacity: 0.22 }}>
                  <Logo variant="mark" className="h-24" />
                </span>
                <div className="min-w-0">
                  {parent?.centerName && (
                    <p className="font-ninja text-[12px] sm:text-[13px] font-extrabold uppercase tracking-[0.08em] opacity-90 truncate">
                      {parent.centerName}
                    </p>
                  )}
                  <h1 className="font-ninja font-extrabold text-[34px] sm:text-[40px] lg:text-[46px] leading-none mt-1.5 tracking-[-0.02em]">
                    Events
                  </h1>
                  <p className="font-ninja text-[14px] sm:text-[15px] font-bold opacity-90 mt-2">
                    {events === null
                      ? 'Loading what is on'
                      : count
                        ? `${count} coming up`
                        : 'Nothing on the calendar right now'}
                  </p>
                </div>
              </div>
            </div>
          </section>
        </PinnedHero>

        <PageSheet corner="square">
          {events === null ? (
            <SkeletonCards count={3} cols="" height={172} label="Loading events" />
          ) : error ? (
            <div className={`${FLAT} p-8 text-center`}><p className="text-ninja-red font-ninja text-sm">{error}</p></div>
          ) : count === 0 ? (
            <div className={`${FLAT} p-10 text-center space-y-1.5`}>
              <p className="text-ninja-navy font-ninja font-bold">Nothing on the calendar right now.</p>
              <p className="pt-1"><MoreLink to="/parent/dashboard">Back to Home</MoreLink></p>
            </div>
          ) : (
            <div className="space-y-7 lg:space-y-8">
              {groups.map((g) => (
                <section key={g.key} aria-labelledby={`month-${g.key.replace(/\s+/g, '-')}`}>
                  {/* The rule between the month and its count is what makes
                      this read as an agenda rather than as a stack of cards
                      with a label on top. */}
                  <div className="flex items-center gap-3">
                    <h2 id={`month-${g.key.replace(/\s+/g, '-')}`} className="font-ninja text-[12px] font-extrabold uppercase tracking-[0.1em] text-ninja-muted">
                      {g.key}
                    </h2>
                    <span aria-hidden className="h-px flex-1 bg-ninja-navy/[0.10]" />
                    <span aria-hidden className="font-ninja text-[12px] font-extrabold text-ninja-navy/35">{g.events.length}</span>
                  </div>
                  <div className="mt-3 space-y-3 lg:space-y-4">
                    {g.events.map((ev) => <EventCard key={ev.id} ev={ev} />)}
                  </div>
                </section>
              ))}
            </div>
          )}
        </PageSheet>
      </div>
    </ParentLayout>
  );
}
