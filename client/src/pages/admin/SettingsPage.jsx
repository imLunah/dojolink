import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Layout from '../../components/layout/Layout';

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
};
const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};
import { api } from '../../api/client';
import { CARD } from '../../lib/surfaces';
import { SkeletonCards } from '../../components/ui/Skeleton';
import { WarningIcon } from '../../components/ui/icons';
import { useAuth } from '../../context/AuthContext';

const ADMIN_NAV_LINKS = [
  { to: '/admin/locations', label: 'Locations' },
  { to: '/admin/users', label: 'Users' },
  { to: '/admin/curriculum', label: 'Curriculum' },
  { to: '/admin/settings', label: 'Settings' },
];

function AdminNav() {
  const path = window.location.pathname;
  const links = ADMIN_NAV_LINKS;
  return (
    <div className="flex items-center gap-4 mb-6 border-b border-ninja-border pb-4">
      {links.map((l) => (
        <a
          key={l.to}
          href={l.to}
          className={`font-ninja text-sm font-semibold transition-colors ${
            path === l.to
              ? 'text-ninja-navy border-b-2 border-ninja-blue pb-0.5'
              : 'text-ninja-muted hover:text-ninja-navy'
          }`}
        >
          {l.label}
        </a>
      ))}
    </div>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [announcement, setAnnouncement] = useState('');
  const [savedAnnouncement, setSavedAnnouncement] = useState('');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/settings')
      .then((data) => {
        const val = data.announcement || '';
        setAnnouncement(val);
        setSavedAnnouncement(val);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setStatus('');
    try {
      await api.put('/admin/settings/announcement', { value: announcement.trim() });
      setSavedAnnouncement(announcement.trim());
      setStatus('saved');
      setTimeout(() => setStatus(''), 2500);
    } catch {
      setStatus('error');
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setSaving(true);
    setStatus('');
    try {
      await api.put('/admin/settings/announcement', { value: '' });
      setAnnouncement('');
      setSavedAnnouncement('');
      setStatus('cleared');
      setTimeout(() => setStatus(''), 2500);
    } catch {
      setStatus('error');
    } finally {
      setSaving(false);
    }
  };

  const isDirty = announcement.trim() !== savedAnnouncement;

  return (
    <Layout>
      <motion.div className="max-w-2xl mx-auto px-4 py-8" variants={stagger} initial="hidden" animate="show">
        <AdminNav />

        <motion.div variants={fadeUp}>
          <h1 className="text-ninja-navy font-ninja font-bold text-2xl mb-1">Settings</h1>
          <p className="text-ninja-muted font-ninja text-sm mb-8">Global configuration for all centers</p>
        </motion.div>

        {/* Directors reach this page now, and what is on it is not theirs
            alone. Saying so where the buttons are is the only thing standing
            between a Yorba Linda edit and a surprise in Cerritos. */}
        {!isAdmin && (
          <motion.div
            variants={fadeUp}
            className="flex items-start gap-2.5 rounded-xl border border-ninja-border bg-amber-500/5 p-3 mb-6"
          >
            <span aria-hidden className="mt-0.5 text-amber-600 dark:text-amber-400 flex-shrink-0">
              <WarningIcon width="16" height="16" />
            </span>
            <p className="font-ninja text-xs text-ninja-navy">
              This is shared by every center. Changes here show up at Yorba Linda,
              Fullerton and Cerritos alike, not only at yours.
            </p>
          </motion.div>
        )}


        {loading ? (
          <SkeletonCards count={2} cols="sm:grid-cols-2" label="Loading settings" />
        ) : (
          <motion.div variants={fadeUp} className="space-y-6">
            <div className={`${CARD} p-6`}>
              <div className="mb-4">
                <h2 className="text-ninja-navy font-ninja font-bold text-base">Announcement Banner</h2>
                <p className="text-ninja-muted font-ninja text-xs mt-0.5">
                  Shown to all staff on every page until dismissed. Clear to hide.
                </p>
              </div>

              {savedAnnouncement && !isDirty && (
                <div className="mb-4 border border-ninja-border rounded-xl px-4 py-3 flex items-center gap-3">
                  <WarningIcon className="w-4 h-4 text-ninja-blue flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-ninja-blue font-ninja text-xs font-bold uppercase tracking-wide">Live </span>
                    <span className="text-ninja-navy font-ninja text-sm">{savedAnnouncement}</span>
                  </div>
                </div>
              )}

              <textarea
                value={announcement}
                onChange={(e) => setAnnouncement(e.target.value)}
                rows={3}
                maxLength={300}
                placeholder="e.g. System maintenance scheduled for Saturday 10pm–midnight."
                className="w-full bg-ninja-bg border border-ninja-border text-ninja-navy rounded-xl px-4 py-3 font-ninja text-sm focus:outline-none focus:border-ninja-blue resize-none"
              />
              <div className="flex items-center justify-between mt-1">
                <span className="text-ninja-muted font-ninja text-xs">{announcement.length}/300</span>
              </div>

              <div className="flex items-center gap-3 mt-4">
                <button
                  onClick={handleSave}
                  disabled={saving || !isDirty}
                  className="bg-ninja-blue text-white font-ninja font-semibold rounded-xl px-4 py-2 text-sm hover:opacity-90 disabled:opacity-40 transition-opacity"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
                {savedAnnouncement && (
                  <button
                    onClick={handleClear}
                    disabled={saving}
                    className="text-ninja-muted font-ninja text-sm hover:text-ninja-red transition-colors disabled:opacity-40"
                  >
                    Clear banner
                  </button>
                )}
                {status === 'saved' && <span className="text-green-600 font-ninja text-sm">Saved</span>}
                {status === 'cleared' && <span className="text-ninja-muted font-ninja text-sm">Banner cleared</span>}
                {status === 'error' && <span className="text-ninja-red font-ninja text-sm">Failed to save</span>}
              </div>
            </div>
          </motion.div>
        )}
      </motion.div>
    </Layout>
  );
}
