import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import ModalPortal from './ModalPortal';
import { TriangleAlertIcon, LightbulbIcon, ChevronLeftIcon } from 'lucide-react';
import TicketStatus from '../shared/TicketStatus';
import { SkeletonList } from './Skeleton';
import { ticketName, shortDate } from '../../lib/tickets';

const BUG_CATEGORIES = [
  'Login Issue',
  'Student Progress',
  'Check-In Issue',
  'Parent Portal',
  'UI / Visual Bug',
  'Slow Performance',
  'Other',
];

const FEATURE_CATEGORIES = [
  'Check-In',
  'Student Progress',
  'Clubs',
  'Reports',
  'Parent Portal',
  'UI / Design',
  'Other',
];

// Per-type copy so one modal handles both bug reports and feature ideas.
const COPY = {
  bug: {
    title: 'Report a Bug',
    categories: BUG_CATEGORIES,
    descLabel: 'What happened?',
    descPlaceholder: '',
    shotLabel: 'Screenshot',
    submit: 'Send Report',
    sending: 'Sending…',
    doneTitle: 'Report sent!',
    doneBody: "Thanks! We'll look into it soon.",
    footer: "We'll automatically include your current page, browser, screen size, and account info.",
  },
  feature: {
    title: 'Suggest a Feature',
    categories: FEATURE_CATEGORIES,
    descLabel: 'What would you like to see?',
    descPlaceholder: 'Describe the idea and how it would help.',
    shotLabel: 'Screenshot / mockup',
    submit: 'Send Suggestion',
    sending: 'Sending…',
    doneTitle: 'Suggestion sent!',
    doneBody: "Thanks! We'll take a look.",
    footer: "We'll automatically include your current page and account info.",
  },
};

// Capture recent console errors to include in bug reports
const recentConsoleErrors = [];
const _origConsoleError = console.error;
console.error = (...args) => {
  recentConsoleErrors.push(
    `[${new Date().toISOString()}] ${args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')}`
  );
  if (recentConsoleErrors.length > 20) recentConsoleErrors.shift();
  _origConsoleError(...args);
};

// Every report is a ticket (server/routes/bugs.js). Staff follow theirs, and
// everything already known, on the Issues & roadmap page; a parent has no
// such page, so the dialog itself lists what they have sent.
export default function BugReportButton({ reporter, open, onClose }) {
  const navigate = useNavigate();
  const isParent = reporter?.role === 'parent';
  const [view, setView] = useState('form');
  const [mine, setMine] = useState(null);
  const [type, setType] = useState('bug');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [screenshot, setScreenshot] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef();

  const copy = COPY[type];

  const switchType = (next) => {
    if (next === type) return;
    setType(next);
    setCategory(''); // category lists differ between types
    setError('');
  };

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('File must be under 5MB.');
      return;
    }
    setError('');
    const reader = new FileReader();
    reader.onload = (ev) => setScreenshot(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!description.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      await api.post('/bugs', {
        type,
        category: category || 'Other',
        description: description.trim(),
        screenshot: screenshot || undefined,
        pageUrl: window.location.href,
        userAgent: navigator.userAgent,
        screenSize: `${window.innerWidth}×${window.innerHeight}`,
        timestamp: new Date().toISOString(),
        // Console errors only matter for bug diagnosis, not feature ideas.
        consoleErrors: type === 'bug' ? recentConsoleErrors.slice() : [],
      });
      setDone(true);
    } catch {
      setError('Failed to send. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const showMine = () => {
    if (!isParent) {
      handleClose();
      navigate('/feedback?tab=mine');
      return;
    }
    setView('mine');
    setMine(null);
    api.get('/bugs/mine').then((rows) => setMine(Array.isArray(rows) ? rows : [])).catch(() => setMine([]));
  };

  const handleClose = () => {
    onClose();
    setView('form');
    setMine(null);
    setType('bug');
    setCategory('');
    setDescription('');
    setScreenshot(null);
    setError('');
    setDone(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <>
      {open && (
        <ModalPortal><div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={handleClose} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              {view === 'mine' ? (
                <h2 className="text-lg font-bold font-ninja text-ninja-navy flex items-center gap-1">
                  <button type="button" onClick={() => setView('form')} aria-label="Back" className="-ml-1.5 w-7 h-7 flex items-center justify-center rounded-full text-ninja-muted hover:text-ninja-navy hover:bg-ninja-bg">
                    <ChevronLeftIcon size={18} aria-hidden="true" />
                  </button>
                  Your reports
                </h2>
              ) : (
                <h2 className="text-lg font-bold font-ninja text-ninja-navy flex items-center gap-2">
                  {type === 'bug' ? <BugIcon /> : <BulbIcon />} {copy.title}
                </h2>
              )}
              <div className="flex items-center gap-3">
                {view === 'form' && (
                  <button type="button" onClick={showMine} className="font-ninja text-xs font-bold text-ninja-blue hover:text-ninja-blue-hover">
                    {isParent ? 'Your reports' : 'Issues & roadmap'}
                  </button>
                )}
                <button onClick={handleClose} aria-label="Close" className="text-ninja-muted hover:text-ninja-navy text-xl leading-none">✕</button>
              </div>
            </div>

            {view === 'mine' ? (
              mine === null ? (
                <div className="py-2"><SkeletonList rows={3} label="Loading your reports" /></div>
              ) : mine.length === 0 ? (
                <p className="py-8 text-center font-ninja text-sm text-ninja-muted">You haven't sent any reports yet.</p>
              ) : (
                <ul className="divide-y divide-ninja-border -mx-1">
                  {mine.map((t) => (
                    <li key={t.id} className="px-1 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-ninja text-sm font-semibold text-ninja-navy break-words min-w-0">{ticketName(t)}</p>
                        <TicketStatus status={t.status} className="mt-0.5" />
                      </div>
                      <p className="font-ninja text-xs text-ninja-muted mt-1">
                        {t.type === 'feature' ? 'Feature idea' : 'Bug'} · {shortDate(t.created_at)}
                      </p>
                    </li>
                  ))}
                </ul>
              )
            ) : done ? (
              <div className="text-center py-8 space-y-3">
                <p className="text-4xl">✓</p>
                <p className="font-ninja font-bold text-ninja-navy text-lg">{copy.doneTitle}</p>
                <p className="text-ninja-muted font-ninja text-sm">{copy.doneBody}</p>
                <div className="flex items-center justify-center gap-5 mt-2">
                  <button onClick={showMine} className="text-ninja-blue font-ninja text-sm font-semibold hover:underline">
                    {isParent ? 'Your reports' : 'Track it'}
                  </button>
                  <button onClick={handleClose} className="text-ninja-muted font-ninja text-sm font-semibold hover:underline">Close</button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">

                <div className="relative flex bg-ninja-bg border border-ninja-border rounded-2xl p-1">
                  <motion.div
                    className="absolute top-1 bottom-1 bg-white rounded-xl shadow-sm"
                    layout
                    transition={{ type: 'spring', damping: 28, stiffness: 380 }}
                    style={{ width: 'calc(50% - 4px)', left: type === 'bug' ? 4 : 'calc(50%)' }}
                  />
                  {[
                    { key: 'bug', label: 'Report a bug' },
                    { key: 'feature', label: 'Suggest a feature' },
                  ].map(({ key, label }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => switchType(key)}
                      className={`relative z-10 flex-1 py-2 font-ninja font-bold text-sm rounded-xl transition-colors duration-200 ${
                        type === key ? 'text-ninja-navy' : 'text-ninja-muted'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div>
                  <label className="block text-ninja-muted text-xs font-ninja font-semibold uppercase tracking-wide mb-1.5">
                    Category <span className="text-ninja-red">*</span>
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    required
                    className="w-full bg-ninja-bg border border-ninja-border text-ninja-navy rounded-xl px-3 py-2.5 font-ninja text-sm focus:outline-none focus:border-ninja-blue"
                  >
                    <option value="" disabled>Select a category</option>
                    {copy.categories.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-ninja-muted text-xs font-ninja font-semibold uppercase tracking-wide mb-1.5">
                    {copy.descLabel} <span className="text-ninja-red">*</span>
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    maxLength={2000}
                    required
                    placeholder={copy.descPlaceholder}
                    className="w-full bg-ninja-bg border border-ninja-border text-ninja-navy rounded-xl px-3 py-2.5 font-ninja text-sm focus:outline-none focus:border-ninja-blue resize-none"
                  />
                  <p className="text-right text-ninja-muted font-ninja text-xs mt-0.5">{description.length}/2000</p>
                </div>

                <div>
                  <label className="block text-ninja-muted text-xs font-ninja font-semibold uppercase tracking-wide mb-1.5">
                    {copy.shotLabel} <span className="font-normal normal-case text-ninja-muted">(optional)</span>
                  </label>
                  <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
                  {screenshot ? (
                    <div className="relative rounded-xl overflow-hidden border border-ninja-border bg-ninja-bg">
                      <img src={screenshot} alt="Preview" className="w-full max-h-48 object-contain" />
                      <button
                        type="button"
                        onClick={() => { setScreenshot(null); if (fileRef.current) fileRef.current.value = ''; }}
                        className="absolute top-2 right-2 bg-white rounded-full w-6 h-6 flex items-center justify-center text-ninja-muted hover:text-ninja-red text-sm shadow border border-ninja-border"
                      >✕</button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileRef.current.click()}
                      className="w-full border border-ninja-border rounded-xl py-4 text-ninja-muted font-ninja text-sm hover:border-ninja-blue hover:text-ninja-blue transition-colors flex items-center justify-center gap-2"
                    >
                      Attach a screenshot
                    </button>
                  )}
                </div>

                {error && <p className="text-ninja-red font-ninja text-sm">{error}</p>}

                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="flex-1 border border-ninja-border text-ninja-muted font-ninja font-semibold text-sm py-2.5 rounded-xl hover:border-ninja-navy transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !description.trim() || !category}
                    className="flex-1 bg-ninja-blue text-white font-ninja font-bold text-sm py-2.5 rounded-xl disabled:opacity-50 hover:bg-ninja-blue-hover transition-colors"
                  >
                    {submitting ? copy.sending : copy.submit}
                  </button>
                </div>

                <p className="text-ninja-muted font-ninja text-xs text-center leading-relaxed">
                  {copy.footer}
                </p>
              </form>
            )}
          </div>
        </div></ModalPortal>
      )}
    </>
  );
}

function BugIcon() {
  return (
    <TriangleAlertIcon className="w-3.5 h-3.5 flex-shrink-0" />
  );
}

function BulbIcon() {
  return (
    <LightbulbIcon className="w-3.5 h-3.5 flex-shrink-0" />
  );
}
