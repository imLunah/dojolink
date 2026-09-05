import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CalendarIcon, MegaphoneIcon, PlusIcon } from 'lucide-react';
import Layout from '../../components/layout/Layout';
import Logo from '../../components/ui/Logo';
import { CARD } from '../../lib/surfaces';
import { SkeletonCards } from '../../components/ui/Skeleton';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

// Events: the listings families see on the Parent Portal home, authored here
// the way they will be read there — title, hook line, banner image, a link to
// sign up. This is a different thing from the calendar: the calendar is the
// center's operational schedule for staff; a listing is a promotion written
// for parents, and the two never share a record so staff notes can never leak
// into a family's banner.

const EASE = [0.23, 1, 0.32, 1];


function fmtDate(dIso) {
  if (!dIso) return null;
  const d = new Date(`${dIso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

const todayIso = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
};

function ListingCard({ listing, canManage, onEdit, onDelete, onTogglePublished }) {
  const [confirmDel, setConfirmDel] = useState(false);
  const past = listing.event_date && listing.event_date < todayIso();
  const when = [fmtDate(listing.event_date), listing.event_time].filter(Boolean).join(' · ');
  const status = past ? 'Ended' : listing.published ? 'Live for families' : 'Draft';
  return (
    <article className={`${CARD} overflow-hidden flex flex-col`}>
      <div className="relative">
        {listing.image_url ? (
          <img src={listing.image_url} alt="" className="w-full aspect-[2/1] object-cover" />
        ) : (
          <div className="w-full aspect-[2/1] flex items-center justify-center text-white/80"
            style={{ background: 'linear-gradient(135deg, #12264d 0%, #0b3d8f 100%)' }}>
            <Logo variant="mark" className="h-10" />
          </div>
        )}
        {/* The whole status in one dot on the banner's corner: green live,
            amber draft, gray ended. The word lives in the tooltip. */}
        <span
          role="img"
          title={status}
          aria-label={status}
          className="absolute top-2.5 right-2.5 w-2.5 h-2.5 rounded-full"
          style={{ background: past ? '#94a3b8' : listing.published ? '#22c55e' : '#f59e0b', boxShadow: '0 0 0 3px rgb(10 16 32 / 0.45)' }}
        />
      </div>
      <div className="p-4 flex flex-col gap-2 flex-1">
        <div className="min-w-0">
          <h3 className="font-ninja font-extrabold text-[16px] text-ninja-navy leading-tight truncate">{listing.title}</h3>
          {listing.subtitle && <p className="font-ninja text-[12.5px] text-ninja-muted truncate mt-0.5">{listing.subtitle}</p>}
        </div>
        {when && (
          <p className="flex items-center gap-1 font-ninja text-xs text-ninja-muted"><CalendarIcon size={12} aria-hidden />{when}</p>
        )}
        {canManage && (
          <div className="flex items-center gap-3 pt-1 mt-auto">
            <button onClick={onEdit} className="font-ninja text-sm font-bold text-ninja-blue hover:underline rounded">Edit</button>
            {!past && (
              <button onClick={onTogglePublished} className="font-ninja text-sm font-bold text-ninja-muted hover:text-ninja-navy rounded">
                {listing.published ? 'Unpublish' : 'Publish'}
              </button>
            )}
            <span className="flex-1" />
            {confirmDel ? (
              <span className="flex items-center gap-2">
                <button onClick={onDelete} className="font-ninja text-sm font-bold px-2.5 py-1 rounded-lg bg-ninja-red text-white">Delete</button>
                <button onClick={() => setConfirmDel(false)} className="font-ninja text-sm font-bold text-ninja-muted hover:text-ninja-navy rounded">Keep</button>
              </span>
            ) : (
              <button onClick={() => setConfirmDel(true)} className="font-ninja text-sm font-bold text-ninja-red hover:underline rounded">Delete</button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

export default function EventsPage() {
  const { isReadOnly } = useAuth();
  const canManage = !isReadOnly;
  const navigate = useNavigate();
  const [listings, setListings] = useState(null);

  useEffect(() => {
    let alive = true;
    api.get('/event-listings')
      .then((rows) => { if (alive) setListings(rows || []); })
      .catch(() => { if (alive) setListings([]); });
    return () => { alive = false; };
  }, []);

  const remove = async (id) => {
    const previous = listings;
    setListings((prev) => prev.filter((l) => l.id !== id));
    try { await api.delete(`/event-listings/${id}`); }
    catch { setListings(previous); }
  };

  const togglePublished = async (listing) => {
    const next = { ...listing, published: !listing.published };
    setListings((prev) => prev.map((l) => (l.id === listing.id ? next : l)));
    try {
      const saved = await api.patch(`/event-listings/${listing.id}`, {
        title: listing.title, subtitle: listing.subtitle, description: listing.description,
        event_url: listing.event_url, event_date: listing.event_date, event_time: listing.event_time,
        published: !listing.published,
      });
      setListings((prev) => prev.map((l) => (l.id === saved.id ? { ...saved, image_url: l.image_url } : l)));
    } catch {
      setListings((prev) => prev.map((l) => (l.id === listing.id ? listing : l)));
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <motion.header initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: EASE }}
          className="flex items-end justify-between gap-4">
          <div>
            <h1 className="font-ninja font-extrabold text-2xl text-ninja-navy">Events</h1>
            <p className="font-ninja text-sm text-ninja-muted mt-0.5">What families see on the Parent Portal home. Listings rotate there like a slideshow.</p>
          </div>
          {canManage && (
            <button type="button" onClick={() => navigate('/manager/events/new')}
              className="flex-shrink-0 inline-flex items-center gap-1.5 font-ninja text-sm font-bold px-3.5 py-2 rounded-lg bg-ninja-blue text-white transition-transform duration-150 ease-[var(--ease-out)] active:scale-[0.97]">
              <PlusIcon size={15} strokeWidth={2.75} aria-hidden />
              New listing
            </button>
          )}
        </motion.header>

        {listings === null ? (
          <SkeletonCards count={3} cols="sm:grid-cols-2 xl:grid-cols-3" height={260} label="Loading events" />
        ) : listings.length === 0 ? (
          <div className={`${CARD} p-10 text-center space-y-1.5`}>
            <MegaphoneIcon size={26} strokeWidth={1.6} className="mx-auto text-ninja-muted" aria-hidden />
            <p className="font-ninja font-bold text-ninja-navy">Nothing listed yet.</p>
            <p className="font-ninja text-sm text-ninja-muted">Create a listing and it appears as a banner on every family's home page.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {listings.map((l) => (
              <ListingCard key={l.id} listing={l} canManage={canManage}
                onEdit={() => navigate(`/manager/events/${l.id}/edit`, { state: { listing: l } })}
                onDelete={() => remove(l.id)}
                onTogglePublished={() => togglePublished(l)} />
            ))}
          </div>
        )}
      </div>

    </Layout>
  );
}
