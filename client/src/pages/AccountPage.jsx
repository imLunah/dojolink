import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Layout from '../components/layout/Layout';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { ONBOARDING_ENABLED } from '../lib/features';
import { PRESET_AVATARS } from '../lib/avatars';
import StaffBadge from '../components/shared/StaffBadge';
import { CARD } from '../lib/surfaces';
import useIsDesktop from '../lib/useIsDesktop';
import { MoonIcon, SunIcon } from '../components/ui/icons';
import MyStudioConnect, { MyStudioRow } from '../components/manager/MyStudioConnect';
import DeleteAccountCard from '../components/shared/DeleteAccountCard';
import {
  UserIcon,
  LockIcon,
  FlaskConicalIcon as FlaskIcon,
  CircleQuestionMarkIcon as HelpIcon,
  PaletteIcon,
  ChevronRightIcon as Chevron,
  SettingsIcon,
  MapPinIcon,
  PanelTopIcon,
  Trash2Icon,
} from 'lucide-react';

const FIELD =
  'w-full bg-ninja-bg border border-ninja-border text-ninja-navy rounded-lg px-3 py-2 font-ninja text-sm focus:outline-none focus:border-ninja-blue';

export default function AccountPage() {
  const { user, setUser, logout, switchLocation } = useAuth();
  const { dark, toggle, experimental, setExperimental, horizontalNav, setHorizontalNav } = useTheme();
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();

  const [username, setUsername] = useState(user?.username || '');
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [section, setSection] = useState('profile');

  // Edit profile is the ID card itself: taps on the printed name, the photo
  // and the username commit straight to the API, and this is where those
  // commits report back, under the card.
  const [cardMsg, setCardMsg] = useState(null); // { type: 'error' | 'success', text }

  // The MyStudio connection for this center. Fetched for any director, not
  // only one who has the Experimental toggle on: the connection belongs to the
  // center and keeps running whatever this director's own display preferences
  // say, so whether there is one to manage cannot be answered by a flag living
  // in this browser.
  const isManager = ['manager', 'admin'].includes(user?.role);
  const [mystudio, setMystudio] = useState(null);
  const [showMyStudio, setShowMyStudio] = useState(false);

  useEffect(() => {
    if (!isManager) return;
    let cancelled = false;
    api
      .get('/mystudio/status')
      .then((data) => { if (!cancelled) setMystudio(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isManager, user?.activeLocation?.id]);

  // ?mystudio=1 opens the connection panel straight away, so the board's
  // "connection ran out" notice can lead somewhere instead of describing where
  // to go. The parameter is dropped once used so a refresh does not reopen it.
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (!isManager || searchParams.get('mystudio') !== '1') return;
    setShowMyStudio(true);
    // 'preferences' is the key the Experimental section is registered under.
    // Anything else leaves the settings body rendering nothing behind the panel.
    setSection('preferences');
    searchParams.delete('mystudio');
    setSearchParams(searchParams, { replace: true });
  }, [isManager, searchParams, setSearchParams]);

  // Tapping the photo steps to the next preset. The card updates on the tap
  // and the save waits for the tapping to stop, so stepping through the whole
  // ring is ten slides and one PATCH, not ten.
  const avatarTimer = useRef(null);
  const pendingAvatar = useRef(null);
  const lastSavedAvatar = useRef(user?.profilePicUrl || null);
  useEffect(() => () => {
    if (avatarTimer.current) {
      clearTimeout(avatarTimer.current);
      if (pendingAvatar.current) api.patch('/users/me/avatar', { profile_pic_url: pendingAvatar.current }).catch(() => {});
    }
  }, []);
  const saveAvatar = async (src) => {
    avatarTimer.current = null;
    pendingAvatar.current = null;
    try {
      await api.patch('/users/me/avatar', { profile_pic_url: src });
      lastSavedAvatar.current = src;
      setCardMsg({ type: 'success', text: 'Photo updated.' });
    } catch {
      setUser((prev) => ({ ...prev, profilePicUrl: lastSavedAvatar.current }));
      setCardMsg({ type: 'error', text: 'Failed to save the photo. Try again.' });
    }
  };
  const cycleAvatar = () => {
    const list = PRESET_AVATARS.map((a) => a.src);
    const next = list[(list.indexOf(user?.profilePicUrl) + 1) % list.length];
    setCardMsg(null);
    setUser((prev) => ({ ...prev, profilePicUrl: next }));
    pendingAvatar.current = next;
    if (avatarTimer.current) clearTimeout(avatarTimer.current);
    avatarTimer.current = setTimeout(() => saveAvatar(next), 900);
  };

  // Commits from the card. Each one is a single field, saved the moment the
  // editor closes; validation mirrors server/lib/username.js and the server
  // stays the authority.
  const commitName = async (value) => {
    const t = value.trim();
    setCardMsg(null);
    if (!t) return setCardMsg({ type: 'error', text: 'Display name cannot be empty.' });
    if (t === user?.displayName) return;
    try {
      await api.patch('/users/me', { display_name: t });
      setDisplayName(t);
      setUser((prev) => ({ ...prev, displayName: t }));
      setCardMsg({ type: 'success', text: 'Name updated.' });
    } catch (err) {
      setCardMsg({ type: 'error', text: err?.message || 'Failed to update name.' });
    }
  };
  const commitUsername = async (value) => {
    const t = value.trim();
    setCardMsg(null);
    if (!t || t === user?.username) return;
    if (t.length < 3) return setCardMsg({ type: 'error', text: 'Username must be at least 3 characters.' });
    if (!/^[A-Za-z0-9._-]+$/.test(t)) {
      return setCardMsg({ type: 'error', text: 'Username can only use letters, numbers, dots, underscores and hyphens. No spaces.' });
    }
    try {
      const res = await api.patch('/users/me', { username: t });
      const finalName = res?.username || t;
      setUsername(finalName);
      setUser((prev) => ({ ...prev, username: finalName }));
      setCardMsg({ type: 'success', text: 'Username updated.' });
    } catch (err) {
      setCardMsg({ type: 'error', text: err?.message || 'Failed to update username.' });
    }
  };

  const initials = user?.displayName?.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase() || '?';

  const isForced = !!user?.mustResetPassword;

  const roleLabel = user?.role === 'manager' ? 'Center Director' : user?.role === 'admin' ? 'Admin' : 'Sensei';

  const dashPath = user?.role === 'sensei' ? '/sensei/dashboard'
    : user?.role === 'admin' ? '/admin/locations'
    : '/manager/overview';

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Name, username and avatar commit straight from the ID card, so this
    // form only ever changes the password.
    const trimmedPassword = newPassword.trim();

    if (!trimmedPassword) {
      return setError(isForced ? 'You must set a new password to continue.' : 'Enter a new password.');
    }
    if (trimmedPassword !== confirmPassword.trim()) return setError('Passwords do not match.');
    if (trimmedPassword && (trimmedPassword.length < 6 || !/[A-Z]/.test(trimmedPassword) || !/[^A-Za-z0-9]/.test(trimmedPassword))) {
      return setError('Password must be at least 6 characters and include an uppercase letter and a special character.');
    }

    const payload = { new_password: trimmedPassword };
    if (!isForced) payload.current_password = currentPassword.trim();

    setSaving(true);
    try {
      await api.patch('/users/me', payload);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      if (isForced) {
        setUser((prev) => ({ ...prev, mustResetPassword: false }));
        navigate(dashPath);
      } else {
        setSuccess('Password updated.');
      }
    } catch (err) {
      setError(err?.message || 'Failed to update account.');
    } finally {
      setSaving(false);
    }
  };

  /* ------------------------------------------------------------- pieces -- */
  // Each block is built once and placed by whichever layout is active.

  // The staff badge IS the profile editor: tap the printed name or the Staff
  // ID to retype it in place, tap the photo to pick another, tap anywhere
  // else to turn the card over. Each edit saves as its editor closes.
  const profileBadge = (scale) => (
    <StaffBadge
      name={displayName}
      username={username}
      avatar={user?.profilePicUrl}
      role={roleLabel}
      center={user?.activeLocation?.name}
      scale={scale}
      editable={{ onName: commitName, onUsername: commitUsername, onAvatar: cycleAvatar }}
    />
  );

  const cardNote = (
    <div className="text-center space-y-1.5 max-w-sm mx-auto">
      <p className="text-ninja-muted font-ninja text-xs">
        Tap the photo for the next avatar, and tap the name to retype it. The username is printed on the back; tap the card to turn it over.
      </p>
      {cardMsg && (
        <p className={`font-ninja text-sm font-semibold ${cardMsg.type === 'error' ? 'text-ninja-red' : 'text-green-600'}`}>
          {cardMsg.text}
        </p>
      )}
    </div>
  );

  const identity = (
    <div className="relative bg-[#dbe4f2] dark:bg-ninja-hero rounded-2xl overflow-hidden px-6 pt-7 pb-6 shadow-lg">
      <img src="/CodeNinjasIcon.svg" alt="" className="absolute right-4 top-4 w-20 opacity-[0.08] pointer-events-none" />
      <div className="flex items-center gap-4 relative z-10">
        <div className="relative flex-shrink-0">
          {user?.profilePicUrl ? (
            <img src={user.profilePicUrl} alt={user.displayName} className="w-16 h-16 rounded-full object-cover border-3 border-ninja-navy/15 dark:border-white/30 shadow-lg" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-ninja-blue border-2 border-ninja-navy/15 dark:border-white/20 flex items-center justify-center text-white font-ninja font-bold text-xl shadow-lg">
              {initials}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-ninja-navy font-ninja font-bold text-lg leading-tight truncate">{user?.displayName}</p>
          <p className="text-ninja-muted font-ninja text-xs mt-0.5 capitalize">{roleLabel}</p>
          <p className="text-ninja-muted/70 font-ninja text-xs">@{user?.username}</p>
        </div>
      </div>
    </div>
  );

  const forcedBanner = isForced && (
    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3">
      <LockIcon className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-amber-800 font-ninja font-semibold text-sm">Password reset required</p>
        <p className="text-amber-700 font-ninja text-xs mt-0.5">Your password was reset by an admin. Set a new password to continue.</p>
      </div>
    </div>
  );

  // Mobile only: the desktop sidebar already carries the same toggle.
  const appearanceCard = (
    <div className={`${CARD} p-5`}>
      <p className="text-ninja-muted font-ninja text-xs font-semibold uppercase tracking-wide mb-3">Appearance</p>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span aria-hidden className={`w-9 h-9 rounded-xl flex items-center justify-center ${dark ? 'text-yellow-300 bg-yellow-400/10' : 'text-ninja-muted bg-ninja-bg'}`}>
            {dark ? <MoonIcon width="17" height="17" /> : <SunIcon width="17" height="17" />}
          </span>
          <div>
            <p className="text-ninja-navy font-ninja font-semibold text-sm">Dark mode</p>
            <p className="text-ninja-muted font-ninja text-xs">{dark ? 'On' : 'Off'}</p>
          </div>
        </div>
        <button
          type="button" role="switch" aria-checked={dark} aria-label="Toggle dark mode" onClick={toggle}
          className={`relative w-12 h-7 rounded-full flex-shrink-0 transition-colors duration-200 ${dark ? 'bg-ninja-blue' : 'bg-ninja-border'}`}
        >
          <motion.span layout transition={{ type: 'spring', stiffness: 500, damping: 32 }}
            className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-md ${dark ? 'right-1' : 'left-1'}`} />
        </button>
      </div>
    </div>
  );

  const experimentalPrefs = (
    <div className={`${CARD} p-5`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${experimental ? 'text-ninja-blue-ink bg-ninja-blue/10' : 'text-ninja-muted bg-ninja-bg'}`}>
            <FlaskIcon width="17" height="17" />
          </span>
          <div>
            <p className="text-ninja-navy font-ninja font-semibold text-sm">Experimental features</p>
            <p className="text-ninja-muted font-ninja text-xs">Unlock in-progress extras. May change or break.</p>
          </div>
        </div>
        <button
          type="button" role="switch" aria-checked={experimental} aria-label="Toggle experimental features"
          onClick={() => setExperimental(!experimental)}
          className={`relative w-12 h-7 rounded-full flex-shrink-0 transition-colors duration-200 ${experimental ? 'bg-ninja-blue' : 'bg-ninja-border'}`}
        >
          <motion.span layout transition={{ type: 'spring', stiffness: 500, damping: 32 }}
            className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-md ${experimental ? 'right-1' : 'left-1'}`} />
        </button>
      </div>

      <AnimatePresence initial={false}>
        {experimental && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
            className="overflow-hidden"
          >
            <button
              type="button"
              onClick={() => navigate('/appearance')}
              className="mt-4 w-full flex items-center justify-between rounded-xl border border-ninja-border p-3 text-left transition-[transform,border-color] duration-150 ease-[var(--ease-out)] hover:border-ninja-blue/50 active:scale-[0.98]"
            >
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-xl flex items-center justify-center text-ninja-blue-ink bg-ninja-blue/10">
                  <PaletteIcon width="17" height="17" />
                </span>
                <div>
                  <p className="text-ninja-navy font-ninja font-semibold text-sm">Theme &amp; color</p>
                  <p className="text-ninja-muted font-ninja text-xs">Accent color picker &amp; more</p>
                </div>
              </div>
              <Chevron width="18" height="18" className="text-ninja-muted" />
            </button>

            {/* Directors only: the connection belongs to a center, and a sensei
                has no center to connect. Hidden here once it is connected,
                because it moves below and showing it twice is worse than
                showing it in the less obvious of the two places. */}
            {isManager && !mystudio?.connected && (
              <MyStudioRow
                status={mystudio}
                centerName={user?.activeLocation?.name}
                onOpen={() => setShowMyStudio(true)}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );

  // A card of its own once the center is connected, rather than a row under the
  // Experimental switch.
  //
  // Two reasons, and the second is the load bearing one. Turning Experimental
  // off is a preference about what this director wants to see; it no longer
  // stops the center's bookings arriving for everyone else, so it must not be
  // the thing that hides the only screen where they can switch those bookings
  // off or disconnect. And a row sitting under a switch that is off reads as
  // something that switch controls, which is the misunderstanding this whole
  // change exists to remove. Undiscovered until you connect, permanent after.
  const myStudioCard = isManager && mystudio?.connected ? (
    <div className={`${CARD} p-5`}>
      <MyStudioRow
        status={mystudio}
        centerName={user?.activeLocation?.name}
        onOpen={() => setShowMyStudio(true)}
        className=""
      />
    </div>
  ) : null;

  const experimentalCard = (
    <>
      {experimentalPrefs}
      {myStudioCard}
    </>
  );

  // Portals to the body, so it goes in whichever layout is rendering rather
  // than into the experimental card's own subtree.
  const myStudioPanel = isManager ? (
    <MyStudioConnect
      isOpen={showMyStudio}
      onClose={() => setShowMyStudio(false)}
      status={mystudio}
      centerName={user?.activeLocation?.name}
      onChanged={setMystudio}
    />
  ) : null;

  // Desktop-only setting, so it only appears in the desktop layout's rail.
  // Picked from little window previews rather than a switch, so you can see
  // what each layout looks like before committing to it.
  // The two layouts carry names rather than descriptions, so the preview has to
  // do the explaining: the nav region is tinted in both, which puts the shape
  // you are choosing (a left column or a top strip) first. `hint` never renders,
  // it only feeds the radio's accessible name, where a bare noun says nothing.
  const navLayouts = [
    {
      value: false,
      label: 'Tokyo',
      hint: 'Nav down the left',
      preview: (
        <div className="flex h-full">
          <div className="w-[34%] h-full border-r border-ninja-border bg-ninja-blue/10 p-1.5 flex flex-col gap-1.5">
            <div className="h-2.5 w-2.5 rounded-md bg-ninja-blue" />
            <div className="h-1.5 w-full rounded-full bg-ninja-blue" />
            <div className="h-1.5 w-full rounded-full bg-ninja-blue/25" />
            <div className="h-1.5 w-4/5 rounded-full bg-ninja-blue/25" />
            <div className="h-1.5 w-4/5 rounded-full bg-ninja-blue/25" />
            <div className="h-1.5 w-3/5 rounded-full bg-ninja-blue/25" />
          </div>
          <div className="flex-1 p-1.5 space-y-1.5">
            <div className="h-1.5 w-2/3 rounded-full bg-ninja-border" />
            <div className="h-7 w-full rounded-md bg-white border border-ninja-border" />
            <div className="h-7 w-full rounded-md bg-white border border-ninja-border" />
          </div>
        </div>
      ),
    },
    {
      value: true,
      label: 'Hokkaido',
      hint: 'Nav across the top',
      preview: (
        <div className="flex h-full flex-col">
          <div className="flex items-center gap-1.5 border-b border-ninja-border bg-ninja-blue/10 px-1.5 py-2">
            <div className="h-2.5 w-2.5 rounded-md bg-ninja-blue flex-shrink-0" />
            <div className="h-1.5 w-1/5 rounded-full bg-ninja-blue" />
            <div className="h-1.5 w-1/6 rounded-full bg-ninja-blue/25" />
            <div className="h-1.5 w-1/6 rounded-full bg-ninja-blue/25" />
            <div className="h-1.5 w-1/12 rounded-full bg-ninja-blue/25" />
          </div>
          <div className="flex-1 p-1.5 space-y-1.5">
            <div className="h-1.5 w-1/3 rounded-full bg-ninja-border" />
            <div className="flex gap-1.5">
              <div className="h-7 flex-1 rounded-md bg-white border border-ninja-border" />
              <div className="h-7 flex-1 rounded-md bg-white border border-ninja-border" />
            </div>
            <div className="h-4 w-full rounded-md bg-white border border-ninja-border" />
          </div>
        </div>
      ),
    },
  ];

  const displayCard = (
    <div className={`${CARD} p-5`}>
      <div className="flex items-center gap-3 mb-4">
        <span className="w-9 h-9 rounded-xl flex items-center justify-center text-ninja-blue-ink bg-ninja-blue/10">
          <PanelTopIcon width="17" height="17" />
        </span>
        <p className="text-ninja-navy font-ninja font-semibold text-sm">Navigation layout</p>
      </div>
      <div role="radiogroup" aria-label="Navigation layout" className="grid grid-cols-2 gap-4 max-w-md">
        {navLayouts.map(({ value, label, hint, preview }) => {
          const selected = horizontalNav === value;
          return (
            <button
              key={label}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`${label}, ${hint.toLowerCase()}`}
              onClick={() => setHorizontalNav(value)}
              className="group text-center"
            >
              <div
                className={`aspect-[16/10] rounded-xl overflow-hidden border-2 bg-ninja-bg transition-all ${
                  selected
                    ? 'border-ninja-blue ring-2 ring-ninja-blue/30'
                    : 'border-ninja-border group-hover:border-ninja-blue/50'
                }`}
              >
                {preview}
              </div>
              <p className={`mt-2 font-ninja text-sm transition-colors ${
                selected ? 'text-ninja-navy font-bold' : 'text-ninja-muted font-semibold group-hover:text-ninja-navy'
              }`}>
                {label}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );

  // Mobile only: the desktop sidebar carries the centre switcher.
  const locationCard = (
    <div className={`${CARD} p-5`}>
      <p className="text-ninja-muted font-ninja text-xs font-semibold uppercase tracking-wide mb-3">Location</p>
      {(['manager', 'admin'].includes(user?.role) || (user?.availableLocations?.length > 1)) ? (
        <select
          value={user?.activeLocation?.id ?? ''}
          onChange={(e) => switchLocation(Number(e.target.value))}
          className="w-full bg-ninja-bg border border-ninja-border text-ninja-navy rounded-lg px-3 py-2.5 font-ninja text-sm font-semibold focus:outline-none focus:border-ninja-blue"
        >
          {user?.availableLocations?.map((loc) => (
            <option key={loc.id} value={loc.id}>{loc.name}</option>
          ))}
        </select>
      ) : (
        <div className="flex items-center gap-3">
          <span className="w-9 h-9 rounded-xl bg-ninja-bg text-ninja-blue flex items-center justify-center flex-shrink-0">
            <MapPinIcon width="17" height="17" />
          </span>
          <p className="text-ninja-navy font-ninja font-semibold text-sm truncate">{user?.activeLocation?.name ?? '—'}</p>
        </div>
      )}
    </div>
  );

  const gettingStarted = ONBOARDING_ENABLED && (
    <a href="/getting-started" className={`block ${CARD} p-5 hover:border-ninja-blue/50 transition-colors`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="w-9 h-9 rounded-xl flex items-center justify-center text-ninja-blue-ink bg-ninja-blue/10">
            <HelpIcon width="17" height="17" />
          </span>
          <div>
            <p className="text-ninja-navy font-ninja font-semibold text-sm">Getting Started</p>
            <p className="text-ninja-muted font-ninja text-xs">How to use DojoLink</p>
          </div>
        </div>
        <Chevron width="18" height="18" className="text-ninja-muted" />
      </div>
    </a>
  );

  // The same entry the desktop rail carries, in the shape the phone uses.
  // Without it a director on a phone has no way into their center's settings at
  // all, which is where they are most likely to be when they need one.
  const adminSettings = isManager && (
    <Link to="/admin/locations" className={`block ${CARD} p-5 hover:border-ninja-blue/50 transition-colors`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="w-9 h-9 rounded-xl flex items-center justify-center text-ninja-blue-ink bg-ninja-blue/10">
            <SettingsIcon width="17" height="17" />
          </span>
          <div>
            <p className="text-ninja-navy font-ninja font-semibold text-sm">Admin settings</p>
            <p className="text-ninja-muted font-ninja text-xs">Your center, staff and curriculum</p>
          </div>
        </div>
        <Chevron width="18" height="18" className="text-ninja-muted" />
      </div>
    </Link>
  );

  const messages = (
    <>
      {error && <p className="text-ninja-red font-ninja text-sm">{error}</p>}
      {success && <p className="text-green-600 font-ninja text-sm">{success}</p>}
    </>
  );

  const saveButton = (
    <button
      type="submit"
      disabled={saving}
      className="w-full bg-ninja-blue text-white font-ninja font-bold text-sm py-2.5 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
    >
      {saving ? 'Saving...' : 'Save Changes'}
    </button>
  );

  const passwordFields = (
    <>
      <div>
        <label className="block text-ninja-muted text-xs font-ninja mb-1.5">New Password</label>
        <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Leave blank to keep current" autoComplete="new-password" className={FIELD} />
      </div>
      {newPassword && !isForced && (
        <div>
          <label className="block text-ninja-muted text-xs font-ninja mb-1.5">Current Password</label>
          <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Confirm your current password" autoComplete="current-password" className={FIELD} />
        </div>
      )}
      <div>
        <label className="block text-ninja-muted text-xs font-ninja mb-1.5">Confirm New Password</label>
        <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" className={FIELD} />
      </div>
    </>
  );

  // Deleting the account. Username and password again, typed, then the
  // director's permanent delete runs on this user: logged sessions stay on
  // the ninjas' records with no author. Admins can't from here.
  const deleteCard = user?.role === 'admin' ? null : (
    <DeleteAccountCard
      intro="This permanently deletes your DojoLink account. Sessions you logged stay on the ninjas' records, with no name on them. Type your username and password to confirm; this can't be undone."
      fields={[
        { id: 'username', label: 'Username', autoComplete: 'username' },
        { id: 'password', label: 'Password', type: 'password', autoComplete: 'current-password' },
      ]}
      onDelete={async ({ reason, details, username, password }) => {
        await api.post('/auth/delete-account', { reason, details, username, password });
        setUser(null);
        navigate('/login', { replace: true });
      }}
    />
  );

  const signOut = (
    <button
      onClick={async () => { try { await logout(); } catch { /* sign out locally anyway */ } navigate('/login'); }}
      className="w-full border border-ninja-red text-ninja-red font-ninja font-semibold text-sm py-2.5 rounded-xl hover:bg-red-50 transition-colors"
    >
      Sign Out
    </button>
  );

  /* ------------------------------------------------- forced reset layout -- */
  // One narrow column: this flow is the banner and the password form, nothing
  // else, and a rail with a single reachable item would be noise.
  if (isForced) {
    return (
      <Layout>
        <div className="mx-auto w-full max-w-md space-y-6">
          {identity}
          {forcedBanner}
          <form onSubmit={handleSave} className={`${CARD} p-6 space-y-5`}>
            <div className="space-y-4">
              <p className="text-ninja-muted font-ninja text-xs font-semibold uppercase tracking-wide">Change Password</p>
              {passwordFields}
            </div>
            {messages}
            {saveButton}
          </form>
          {signOut}
        </div>
      </Layout>
    );
  }

  /* ------------------------------------------------------ desktop layout -- */
  if (isDesktop) {
    const GROUPS = [
      { title: 'Your account', items: [
        { key: 'profile', label: 'Edit profile', Icon: UserIcon },
        { key: 'password', label: 'Password', Icon: LockIcon },
        ...(deleteCard ? [{ key: 'delete', label: 'Delete account', Icon: Trash2Icon }] : []),
      ] },
      { title: 'Preferences', items: [
        { key: 'display', label: 'Display', Icon: PanelTopIcon },
        { key: 'preferences', label: 'Experimental', Icon: FlaskIcon },
        ...(ONBOARDING_ENABLED ? [{ key: 'help', label: 'Getting started', Icon: HelpIcon }] : []),
      ] },
      // Leaves this page rather than switching a section, so it renders as a
      // link. Managing a center is settings work and belongs with the settings,
      // not hidden behind a gear beside somebody's name.
      ...(isManager
        ? [{ title: 'Center', items: [
            { key: 'admin', label: 'Admin settings', Icon: SettingsIcon, to: '/admin/locations' },
          ] }]
        : []),
    ];

    const HEADINGS = {
      profile: 'Edit profile',
      password: 'Password',
      display: 'Display',
      preferences: 'Preferences',
      help: 'Getting started',
      delete: 'Delete account',
    };

    return (
      <Layout>
        {/* Fills the width main gives it, like the dashboard does. Capped and
            centred, collapsing the sidebar just turned the freed space into
            margin instead of giving the content room. The pane caps its own
            content below so form fields don't stretch across a wide monitor;
            leftover space lands to the right rather than as dead margin on
            both sides. */}
        <div className="w-full">
          {/* No items-start on the grid: that shrinks each column to its own
              content height, which leaves a sticky child nowhere to travel.
              The column stretches, and the sticky element lives inside it. */}
          <div className="grid grid-cols-[272px_1fr]">
            {/* Rail. The page title lives in here rather than above the grid so
                it stays put with the sections and Sign Out while the pane
                scrolls past. Active state is a background tint and text colour
                only, no left-edge marker. The divider sits on this grid item
                rather than on the sticky block inside it, so the line runs the
                whole height of the pane instead of stopping where the rail
                content ends. */}
            <div className="pr-8 border-r border-ninja-border">
            <div className="space-y-6 sticky top-8 max-h-[calc(100dvh-5rem)] overflow-y-auto">
              <h1 className="font-ninja font-black text-2xl text-ninja-navy tracking-tight">Settings</h1>
            <nav aria-label="Settings sections" className="space-y-6">
              {GROUPS.map((group) => (
                <div key={group.title}>
                  <p className="px-3 mb-1.5 font-ninja text-xs font-bold uppercase tracking-wide text-ninja-muted">
                    {group.title}
                  </p>
                  <div className="space-y-0.5">
                    {group.items.map(({ key, label, Icon, to }) => {
                      const active = section === key;
                      return (
                        to ? (
                          <Link
                            key={key}
                            to={to}
                            className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left font-ninja text-sm font-semibold text-ninja-muted hover:text-ninja-navy hover:bg-ninja-bg/60 transition-colors"
                          >
                            <Icon className="w-[18px] h-[18px] flex-shrink-0" />
                            {label}
                          </Link>
                        ) : (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setSection(key)}
                          aria-current={active ? 'page' : undefined}
                          className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left font-ninja text-sm font-semibold transition-colors ${
                            active
                              ? 'bg-ninja-bg text-ninja-navy'
                              : 'text-ninja-muted hover:text-ninja-navy hover:bg-ninja-bg/60'
                          }`}
                        >
                          <Icon className="w-[18px] h-[18px] flex-shrink-0" />
                          {label}
                        </button>
                        )
                      );
                    })}
                  </div>
                </div>
              ))}

            </nav>
              <div className="pt-4 border-t border-ninja-border">{signOut}</div>
            </div>
            </div>

            {/* Pane */}
            <motion.section
              key={section}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
              aria-labelledby="section-heading"
              className="space-y-6 min-w-0 pl-10 max-w-3xl"
            >
              <h2 id="section-heading" className="font-ninja font-bold text-lg text-ninja-navy">
                {HEADINGS[section]}
              </h2>

              {section === 'profile' && (
                <div className="flex flex-col items-center gap-5 py-2">
                  {profileBadge(1)}
                  {cardNote}
                </div>
              )}

              {section === 'password' && (
                <form onSubmit={handleSave} className={`${CARD} p-6 space-y-4`}>
                  {passwordFields}
                  {messages}
                  {saveButton}
                </form>
              )}

              {section === 'display' && displayCard}
              {section === 'preferences' && experimentalCard}
              {section === 'help' && gettingStarted}
              {section === 'delete' && deleteCard}
            </motion.section>
          </div>
        </div>
        {myStudioPanel}
      </Layout>
    );
  }

  /* ------------------------------------------------------- mobile layout -- */
  return (
    <Layout>
      <div className="mx-auto w-full max-w-md space-y-6">
        <div className="flex justify-center">{profileBadge(0.62)}</div>
        {cardNote}
        {appearanceCard}
        {experimentalCard}
        {locationCard}
        {adminSettings}
        {gettingStarted}

        <form onSubmit={handleSave} className={`${CARD} p-6 space-y-5`}>
          <p className="text-ninja-muted font-ninja text-xs font-semibold uppercase tracking-wide">Change Password</p>
          {passwordFields}
          {messages}
          {saveButton}
        </form>

        {signOut}
        {deleteCard}
      </div>
      {myStudioPanel}
    </Layout>
  );
}
