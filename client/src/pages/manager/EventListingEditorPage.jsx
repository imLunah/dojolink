import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeftIcon, ImageIcon } from 'lucide-react';
import Layout from '../../components/layout/Layout';
import LazyMarkdownEditor from '../../components/shared/LazyMarkdownEditor';
import { CARD } from '../../lib/surfaces';
import { Skeleton } from '../../components/ui/Skeleton';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { uploadToSigned } from '../../lib/supabase';

// Authoring a listing is a sit-down task, so it gets a whole page rather than
// a dialog over the grid. Two columns keep the form from becoming a tall
// tunnel of fields; the description runs full width underneath.

const field = 'w-full rounded-lg border border-ninja-border bg-white px-3 py-2 font-ninja text-sm text-ninja-navy placeholder:text-ninja-muted focus:outline-none focus:border-ninja-blue transition-colors';
const label = 'block font-ninja text-xs font-bold uppercase tracking-wide text-ninja-muted mb-1.5';
const optional = <span className="opacity-60 normal-case font-semibold">(optional)</span>;

// The count appears once the field has ink and matches the server's caps.
// Only the description can actually go over (the inputs clamp themselves),
// and there it turns red and holds the save.
const MAX_DESC = 2000;
function Count({ len, max }) {
  if (!len) return null;
  return (
    <span className={`float-right normal-case tracking-normal font-semibold ${len >= max ? 'text-ninja-red' : 'opacity-60'}`}>
      {len.toLocaleString()}/{max.toLocaleString()}
    </span>
  );
}

function ListingForm({ initial, onSave, onCancel, busy, error }) {
  const [title, setTitle] = useState(initial.title || '');
  const [subtitle, setSubtitle] = useState(initial.subtitle || '');
  const [eventUrl, setEventUrl] = useState(initial.event_url || '');
  const [date, setDate] = useState(initial.event_date || '');
  // One stored string, two fields: "6:00 PM - 8:00 PM" round-trips through
  // the same separator it was joined with.
  const [timeStart, setTimeStart] = useState((initial.event_time || '').split(' - ')[0] || '');
  const [timeEnd, setTimeEnd] = useState((initial.event_time || '').split(' - ')[1] || '');
  const [description, setDescription] = useState(initial.description || '');
  // The image travels separately from the fields: a chosen file is held here
  // and uploaded after the listing row exists, because the attach route needs
  // an id to hang it on.
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(initial.image_url || null);
  const [removeImage, setRemoveImage] = useState(false);
  const objectUrl = useRef(null);
  useEffect(() => () => { if (objectUrl.current) URL.revokeObjectURL(objectUrl.current); }, []);

  const pickFile = (f) => {
    if (!f || !f.type.startsWith('image/')) return;
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = URL.createObjectURL(f);
    setFile(f);
    setPreview(objectUrl.current);
    setRemoveImage(false);
  };

  const clearImage = () => {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = null;
    setFile(null);
    setPreview(null);
    setRemoveImage(Boolean(initial.image_url));
  };

  const descOver = description.length > MAX_DESC;
  const canSave = title.trim() && !descOver;
  const wasPublished = Boolean(initial.id) && initial.published !== false;
  const submit = (pub) => onSave(
    {
      title, subtitle, event_url: eventUrl, event_date: date || null,
      event_time: [timeStart.trim(), timeEnd.trim()].filter(Boolean).join(' - '),
      description, published: pub,
    },
    { file, removeImage },
  );

  return (
    <div className="space-y-5">
      {/* Two columns so the form reads as a desk, not a tunnel: the words on
          the left, the picture on the right, and the long text full width
          underneath. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
       <div className="space-y-4">
      <div>
        <label className={label}>Title <Count len={title.length} max={200} /></label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200}
          placeholder="e.g. Parent's Night Out" className={field} autoFocus />
      </div>

      <div>
        <label className={label}>Subtitle {optional} <Count len={subtitle.length} max={200} /></label>
        <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} maxLength={200}
          placeholder="e.g. Drop them off. Just remember to pick them up!" className={field} />
      </div>

      <div>
        <label className={label}>Sign-up link {optional} <Count len={eventUrl.length} max={500} /></label>
        <input value={eventUrl} onChange={(e) => setEventUrl(e.target.value)} maxLength={500} type="url"
          placeholder="https://…" className={field} />
        <p className="font-ninja text-xs text-ninja-muted mt-1">Where the banner sends a family who taps it: a MyStudio event page, a form, anything.</p>
      </div>

      <div>
        <label className={label}>Date {optional}</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>Starts {optional}</label>
          <input value={timeStart} onChange={(e) => setTimeStart(e.target.value)} maxLength={18}
            placeholder="e.g. 6:00 PM" className={field} />
        </div>
        <div>
          <label className={label}>Ends {optional}</label>
          <input value={timeEnd} onChange={(e) => setTimeEnd(e.target.value)} maxLength={18}
            placeholder="e.g. 8:00 PM" className={field} />
        </div>
      </div>
      <p className="font-ninja text-xs text-ninja-muted -mt-2">With a date, the banner comes down by itself once the day passes. Without one, it stays up until you unpublish it.</p>
       </div>

       <div className="space-y-4">
      <div>
        <label className={label}>Banner image {optional}</label>
        {preview ? (
          <div>
            <img src={preview} alt="" className="w-full aspect-[2/1] object-cover rounded-xl border border-ninja-border" />
            <div className="flex items-center gap-3 mt-1.5">
              <label className="font-ninja text-xs font-bold text-ninja-blue hover:underline cursor-pointer rounded">
                Replace
                <input type="file" accept="image/*" className="sr-only" onChange={(e) => pickFile(e.target.files?.[0])} />
              </label>
              <button type="button" onClick={clearImage} className="font-ninja text-xs font-bold text-ninja-muted hover:text-ninja-navy rounded">Remove</button>
            </div>
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center gap-1.5 w-full aspect-[2/1] rounded-xl border-2 border-dashed border-ninja-border hover:border-ninja-blue text-ninja-muted hover:text-ninja-blue cursor-pointer transition-colors">
            <ImageIcon size={22} strokeWidth={1.8} aria-hidden />
            <span className="font-ninja text-xs font-bold">Add an image</span>
            <span className="font-ninja text-[11px]">wide works best, about 1600 × 800</span>
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => pickFile(e.target.files?.[0])} />
          </label>
        )}
      </div>

       </div>
      </div>

      <div>
        <label className={label}>Description {optional} <Count len={description.length} max={MAX_DESC} /></label>
        {/* The same editor senseis log with, storing markdown; the parent
            banner renders it formatted. Full width under the columns, and a
            long description scrolls inside the box instead of growing the
            form. */}
        <LazyMarkdownEditor
          value={description}
          onChange={setDescription}
          bodyClass="max-h-60 overflow-y-auto"
          placeholder="What families should know. Try **bold** or start a line with '- ' for a list."
        />
        {descOver && (
          <p className="font-ninja text-xs text-ninja-red mt-1">
            The description is over the {MAX_DESC.toLocaleString()}-character limit — trim it to save.
          </p>
        )}
      </div>

      {error && <p className="font-ninja text-sm text-ninja-red">{error}</p>}

      <div className="flex items-center justify-end gap-2 pt-1">
        <button onClick={onCancel} className="font-ninja text-sm font-bold text-ninja-muted hover:text-ninja-navy px-2 py-2 rounded">Cancel</button>
        <button
          onClick={() => submit(false)}
          disabled={busy || !canSave}
          className="font-ninja text-sm font-bold px-4 py-2 rounded-lg border border-ninja-border bg-white text-ninja-navy hover:bg-ninja-bg transition-colors disabled:opacity-50">
          {wasPublished ? 'Move to draft' : 'Save draft'}
        </button>
        <button
          onClick={() => submit(true)}
          disabled={busy || !canSave}
          className="font-ninja text-sm font-bold px-4 py-2 rounded-lg bg-ninja-blue text-white transition-transform duration-150 ease-[var(--ease-out)] active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100">
          {busy ? 'Saving…' : wasPublished ? 'Save' : 'Publish'}
        </button>
      </div>
    </div>
  );
}

export default function EventListingEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { state } = useLocation();
  const { isReadOnly } = useAuth();
  // Coming from the Events grid the listing rides along in route state; on a
  // direct URL (refresh, shared link) it is fetched instead.
  const [listing, setListing] = useState(() => (id ? state?.listing ?? null : {}));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const back = () => navigate('/manager/events');

  useEffect(() => {
    if (isReadOnly) { navigate('/manager/events', { replace: true }); }
  }, [isReadOnly, navigate]);

  useEffect(() => {
    if (!id || listing) return;
    let alive = true;
    api.get('/event-listings')
      .then((rows) => {
        if (!alive) return;
        const found = (rows || []).find((l) => String(l.id) === String(id));
        if (found) setListing(found);
        else navigate('/manager/events', { replace: true });
      })
      .catch(() => { if (alive) navigate('/manager/events', { replace: true }); });
    return () => { alive = false; };
  }, [id, listing, navigate]);

  const save = async (payload, { file, removeImage }) => {
    setBusy(true);
    setError('');
    try {
      let saved = id
        ? await api.patch(`/event-listings/${id}`, payload)
        : await api.post('/event-listings', payload);
      if (file) {
        const { bucket, path, token } = await api.post('/storage/event-image', { contentType: file.type });
        await uploadToSigned(bucket, path, token, file, file.type);
        await api.patch(`/event-listings/${saved.id}/image`, { path });
      } else if (removeImage && id) {
        await api.patch(`/event-listings/${saved.id}/image`, { path: null });
      }
      back();
    } catch (err) {
      setError(err.message || 'Could not save the listing.');
      setBusy(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-5">
        <header className="flex items-center gap-3">
          <button
            type="button"
            onClick={back}
            title="Back to Events"
            aria-label="Back to Events"
            className="flex items-center justify-center w-9 h-9 rounded-lg text-ninja-muted hover:text-ninja-navy hover:bg-ninja-bg transition-colors"
          >
            <ArrowLeftIcon size={18} aria-hidden />
          </button>
          <div>
            <h1 className="font-ninja font-extrabold text-2xl text-ninja-navy">{id ? 'Edit listing' : 'New listing'}</h1>
            <p className="font-ninja text-sm text-ninja-muted mt-0.5">What families see on the Parent Portal home.</p>
          </div>
        </header>

        {listing ? (
          <div className={`${CARD} p-5 sm:p-6`}>
            <ListingForm initial={listing} onSave={save} onCancel={back} busy={busy} error={error} />
          </div>
        ) : (
          <div className={`${CARD} p-5 sm:p-6`}>
            <Skeleton className="h-64 w-full" label="Loading listing" />
          </div>
        )}
      </div>
    </Layout>
  );
}
