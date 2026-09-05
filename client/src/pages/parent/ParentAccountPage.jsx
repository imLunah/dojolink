import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserRoundIcon, Trash2Icon, UsersRoundIcon } from 'lucide-react';
import { api } from '../../api/client';
import ParentLayout from '../../components/layout/ParentLayout';
import FamilyPass from '../../components/shared/FamilyPass';
import DeleteAccountCard from '../../components/shared/DeleteAccountCard';
import { useParentAuth } from '../../context/ParentAuthContext';
import { useParentPortal } from '../../context/ParentPortalContext';
import { CARD } from '../../lib/surfaces';
import useIsDesktop from '../../lib/useIsDesktop';
import { calcAge } from '../../lib/parentProgress';
import { NINJA_TONES, NINJA_TONE_LABELS, DEFAULT_TONE, ninjaSrc } from '../../utils/ninjas';

// The parent's settings. The same shape as the staff settings screen: a
// rail with the sections and Sign Out, and a pane with the section. Two
// sections: Delete account, and Edit profile: the family pass up top printing the draft as it
// is typed, then the form — first name, last name, email, relationship — and
// the center code, shown and not editable, because the center hands it out
// and a parent cannot move themselves to another center by retyping it.
//
// Email is the sign-in identity, so the save moves every ninja record that
// carried the old address. The server refuses an address already on another
// family's records.

const RELATIONSHIPS = ['Mom', 'Dad', 'Guardian', 'Grandparent', 'Other'];
const FIELD = 'w-full px-4 py-3 rounded-xl bg-ninja-bg border border-ninja-border text-ninja-navy font-ninja text-sm focus:border-ninja-blue focus:outline-none transition-colors';
const LABEL = 'block text-ninja-muted font-ninja text-xs font-semibold uppercase tracking-wide mb-1.5';

// The belt a ninja's art is drawn at: their CREATE belt if they are in CREATE,
// otherwise any belt they hold. A ninja with none gets null, and `ninjaSrc`
// falls back to White, which is where everyone starts.
function beltOf(student) {
  const programs = student?.programs || [];
  const withBelt = programs.find((p) => p.program === 'CREATE' && p.belt_level) || programs.find((p) => p.belt_level);
  return withBelt?.belt_level || null;
}

function ninjasOf(students) {
  return (students || []).map((s) => ({ name: s.full_name, age: calcAge(s.birthday), belt: beltOf(s) }));
}

// Choosing the family's ninjas, one child at a time.
//
// This lives in Settings rather than on the child's profile banner, where it
// started. It is a setting: it is decided once, it is not part of reading how
// a ninja is doing, and a control floating on the artwork it changes was one
// more thing on a page whose job is progress. Settings is also where a parent
// can see all of their ninjas at once, which is the only place the choice
// reads as a family's rather than as one page's.
//
// The three are drawn as the real ninja at that child's own belt, so the only
// thing changing between them is the thing being chosen. There is no Save
// button: a tap is the whole decision and it saves immediately.
// `heading` is off in the desktop pane, which prints the section's name above
// the card already. On the phone there is no pane and the card is on its own.
function NinjaLook({ students, onSave, heading = true }) {
  const [saving, setSaving] = useState(null); // student id
  const [error, setError] = useState(null);   // student id

  const pick = async (student, tone) => {
    if (tone === (student.ninja_skin_tone || DEFAULT_TONE)) return;
    setSaving(student.id); setError(null);
    try { await onSave(student.id, tone); }
    catch { setError(student.id); }
    finally { setSaving(null); }
  };

  if (!students?.length) return null;

  return (
    <div className={`${CARD} p-6 space-y-6`}>
      <div>
        {heading && <h3 className="font-ninja font-extrabold text-[17px] text-ninja-navy mb-0.5">Your ninjas</h3>}
        <p className="font-ninja text-[13px] text-ninja-muted">
          Pick the ninja each of your kids wants to be. It shows on their profile and everywhere their belt does.
        </p>
      </div>

      {students.map((student) => {
        const belt = beltOf(student);
        const current = student.ninja_skin_tone || DEFAULT_TONE;
        const firstName = student.full_name?.split(' ')[0] || student.full_name;
        return (
          <div key={student.id} className="space-y-2">
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-ninja font-extrabold text-sm text-ninja-navy truncate">{firstName}</p>
              {error === student.id && <p className="font-ninja text-xs text-ninja-red">Could not save. Try again.</p>}
            </div>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={`${firstName}'s ninja`}>
              {NINJA_TONES.map((tone) => {
                const selected = current === tone;
                return (
                  <button
                    key={tone}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={saving === student.id}
                    onClick={() => pick(student, tone)}
                    className={`flex flex-col items-center rounded-xl border p-2 transition-colors disabled:opacity-60 ${
                      selected ? 'border-ninja-blue bg-ninja-blue/10' : 'border-ninja-border bg-ninja-bg hover:border-ninja-blue/40'
                    }`}
                  >
                    <img src={ninjaSrc(belt, 'wave', tone)} alt="" aria-hidden draggable={false} className="h-24 w-full object-contain" />
                    <span className={`mt-1 font-ninja text-xs font-extrabold ${selected ? 'text-ninja-blue' : 'text-ninja-muted'}`}>
                      {NINJA_TONE_LABELS[tone]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function ParentAccountPage() {
  const { parent, saveProfile, logout } = useParentAuth();
  const portal = useParentPortal();
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();

  const [first, setFirst] = useState(parent?.firstName || '');
  const [last, setLast] = useState(parent?.lastName || '');
  const [email, setEmail] = useState(parent?.email || '');
  const [relationship, setRelationship] = useState(parent?.relationship || '');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null); // { ok, text }
  const [section, setSection] = useState('profile'); // 'profile' | 'ninjas' | 'delete'

  // A save that changes the email re-keys the parent; follow it.
  useEffect(() => {
    setFirst(parent?.firstName || '');
    setLast(parent?.lastName || '');
    setEmail(parent?.email || '');
    setRelationship(parent?.relationship || '');
  }, [parent?.firstName, parent?.lastName, parent?.email, parent?.relationship]);

  const fullName = `${first.trim()} ${last.trim()}`.trim();
  const dirty = first.trim() !== (parent?.firstName || '') || last.trim() !== (parent?.lastName || '')
    || email.trim().toLowerCase() !== (parent?.email || '') || (relationship || null) !== (parent?.relationship || null);

  const handleSave = async (e) => {
    e.preventDefault();
    setMsg(null);
    if (!first.trim() || !last.trim()) { setMsg({ ok: false, text: 'Please enter your first and last name.' }); return; }
    setSaving(true);
    try {
      await saveProfile({ first_name: first.trim(), last_name: last.trim(), email: email.trim(), relationship: relationship || null });
      setMsg({ ok: true, text: 'Saved.' });
    } catch (err) {
      setMsg({ ok: false, text: err?.message || 'Could not save. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const pass = (
    <div className="flex justify-center">
      <FamilyPass
        parentName={fullName}
        relationship={relationship}
        phone={parent?.phone || ''}
        center={parent?.centerName}
        centerCode={parent?.centerCode}
        ninjas={ninjasOf(portal?.students)}
        scale={isDesktop ? 0.9 : 0.72}
      />
    </div>
  );

  const ninjaLook = (heading) => <NinjaLook students={portal?.students} onSave={portal?.saveNinjaTone} heading={heading} />;

  const form = (
    <form onSubmit={handleSave} className={`${CARD} p-6 space-y-5`}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="pa-first" className={LABEL}>First name</label>
          <input id="pa-first" value={first} onChange={(e) => setFirst(e.target.value)} autoComplete="given-name" className={FIELD} />
        </div>
        <div>
          <label htmlFor="pa-last" className={LABEL}>Last name</label>
          <input id="pa-last" value={last} onChange={(e) => setLast(e.target.value)} autoComplete="family-name" className={FIELD} />
        </div>
      </div>
      <div>
        <label htmlFor="pa-email" className={LABEL}>Email</label>
        <input id="pa-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className={FIELD} />
        <p className="mt-1.5 font-ninja text-[12px] text-ninja-muted">You sign in with this, together with your center code.</p>
      </div>
      <div>
        <p className={LABEL}>Relationship</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Relationship">
          {RELATIONSHIPS.map((r) => {
            const on = relationship === r;
            return (
              <button
                key={r}
                type="button"
                aria-pressed={on}
                onClick={() => setRelationship(on ? '' : r)}
                className={`px-4 py-2 rounded-full font-ninja font-bold text-sm border transition-colors ${
                  on ? 'bg-ninja-blue border-ninja-blue text-white' : 'border-ninja-border text-ninja-navy hover:border-ninja-blue/60'
                }`}
              >
                {r}
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <label htmlFor="pa-code" className={LABEL}>Center code</label>
        <input
          id="pa-code"
          value={parent?.centerCode || ''}
          readOnly
          aria-readonly="true"
          tabIndex={-1}
          className={`${FIELD} font-black tracking-[0.22em] uppercase text-ninja-muted cursor-default select-all`}
        />
        <p className="mt-1.5 font-ninja text-[12px] text-ninja-muted">{parent?.centerName ? `Code Ninjas ${parent.centerName}` : 'Your center'} gives you this. It cannot be changed here.</p>
      </div>

      {msg && (
        <p className={`font-ninja text-sm ${msg.ok ? 'text-green-600' : 'text-ninja-red'}`} role="status">{msg.text}</p>
      )}

      <button
        type="submit"
        disabled={saving || !dirty}
        className="w-full py-3.5 rounded-xl bg-ninja-blue text-white font-ninja font-bold text-sm hover:bg-ninja-blue/90 transition-colors disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save Changes'}
      </button>
    </form>
  );

  // Deleting the account: center code and email again, typed, since those
  // are the whole of how a parent signs in. What goes is the parent's own
  // data off the ninjas' records; the ninjas' belts and progress stay with
  // the center.
  const deleteCard = (
    <DeleteAccountCard
      intro={`This removes your name, email and phone from your ninjas' records at Code Ninjas ${parent?.centerName || ''} and deletes your parent account. Type your center code and email to confirm; this can't be undone.`}
      fields={[
        { id: 'centerCode', label: 'Center code', autoComplete: 'off', transform: (v) => v.toUpperCase() },
        { id: 'email', label: 'Email', type: 'email', autoComplete: 'email' },
      ]}
      onDelete={async ({ reason, details, centerCode, email }) => {
        await api.post('/parent/delete-account', { reason, details, centerCode, email });
        try { await logout(); } catch { /* the session is already gone */ }
        navigate('/login?tab=parent', { replace: true });
      }}
    />
  );

  const signOut = (
    <button
      type="button"
      onClick={async () => { try { await logout(); } catch { /* sign out locally anyway */ } navigate('/login?tab=parent'); }}
      className="w-full border border-ninja-red text-ninja-red font-ninja font-semibold text-sm py-2.5 rounded-xl hover:bg-red-50 transition-colors"
    >
      Sign Out
    </button>
  );

  if (isDesktop) {
    return (
      <ParentLayout>
        <div className="w-full">
          <div className="grid grid-cols-[272px_1fr]">
            <div className="pr-8 border-r border-ninja-border">
              <div className="space-y-6 sticky top-8 max-h-[calc(100dvh-5rem)] overflow-y-auto">
                <h1 className="font-ninja font-black text-2xl text-ninja-navy tracking-tight">Settings</h1>
                <nav aria-label="Settings sections">
                  <p className="px-3 mb-1.5 font-ninja text-xs font-bold uppercase tracking-wide text-ninja-muted">Your account</p>
                  <div className="space-y-0.5">
                    {[
                      { key: 'profile', label: 'Edit profile', Icon: UserRoundIcon },
                      { key: 'ninjas', label: 'Your ninjas', Icon: UsersRoundIcon },
                      { key: 'delete', label: 'Delete account', Icon: Trash2Icon },
                    ].map(({ key, label, Icon }) => {
                      const active = section === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setSection(key)}
                          aria-current={active ? 'page' : undefined}
                          className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left font-ninja text-sm font-semibold transition-colors ${
                            active ? 'bg-ninja-bg text-ninja-navy' : 'text-ninja-muted hover:text-ninja-navy hover:bg-ninja-bg/60'
                          }`}
                        >
                          <Icon className="w-[18px] h-[18px] flex-shrink-0" />
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </nav>
                <div className="pt-4 border-t border-ninja-border">{signOut}</div>
              </div>
            </div>
            <div className="pl-8">
              <div className="max-w-2xl space-y-6">
                <h2 className="font-ninja font-bold text-xl text-ninja-navy">{{ delete: 'Delete account', ninjas: 'Your ninjas' }[section] || 'Edit profile'}</h2>
                {section === 'delete' ? deleteCard : section === 'ninjas' ? ninjaLook(false) : (
                  <>
                    {pass}
                    {form}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </ParentLayout>
    );
  }

  return (
    <ParentLayout>
      <div className="mx-auto w-full max-w-md space-y-6">
        <h1 className="font-ninja font-black text-2xl text-ninja-navy tracking-tight">Settings</h1>
        {pass}
        {form}
        {ninjaLook(true)}
        {signOut}
        {deleteCard}
      </div>
    </ParentLayout>
  );
}
