import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UsersIcon,
  CheckIcon,
  Loader2Icon,
  TriangleAlertIcon,
  UserRoundPlusIcon,
  SparklesIcon,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { CARD } from '../../lib/surfaces';
import BouncingDots from '../ui/BouncingDots';
import { useAuth } from '../../context/AuthContext';
import useExpectedToday, {
  groupByClass,
  prettyTime,
  countNinjas,
  formatExpiry,
  hoursUntil,
} from '../../lib/useExpectedToday';

// Who MyStudio says is booked in today, offered as suggestions above the board.
//
// Suggestions, not check-ins. The upstream roster is a booking, and a booking is
// a plan rather than an attendance: kids no-show, swap classes and turn up on the
// wrong day. So this proposes and a human accepts. Accepting posts to the same
// /daily endpoint the manual check-in uses, so the overdue-reuse rule and the
// enrollment check stay in one place.
//
// It renders nothing at all when the center has no connection. A center that
// never opts in should not see an empty shelf explaining a feature it does not
// have.

export default function ExpectedToday({
  date,
  onAdded,
  existingStudentIds,
  readOnly,
  // A parent that already asked for this feed passes it in rather than starting
  // a second one. The sensei panel does, because it has to know whether there is
  // anything to show before it offers to show it.
  feed,
  // Inside a dialog the surrounding card is the dialog.
  bare,
}) {
  const own = useExpectedToday(date, { enabled: !feed });
  const state = feed || own;
  const { user } = useAuth();
  const canRenew = ['manager', 'admin'].includes(user?.role);
  // Renewing is a director's job: it needs their MyStudio password and a code
  // from their email. Senseis see this panel now that it follows the center
  // rather than a per-device flag, so the difference has to be said out loud
  // instead of offering all of them a link that goes nowhere for most.
  const [adding, setAdding] = useState(() => new Set());
  const [accepted, setAccepted] = useState(() => new Set());

  const data = state.data;

  const checkIn = useCallback(
    async (row) => {
      if (!row.studentId || adding.has(row.studentId)) return null;
      setAdding((prev) => new Set(prev).add(row.studentId));
      try {
        const created = await api.post('/daily', {
          student_id: row.studentId,
          program: row.program || undefined,
          session_date: date,
        });
        onAdded?.(created);
        setAccepted((prev) => new Set(prev).add(row.studentId));
        // Remember the match so the next pull does not have to guess from the
        // name again. Best effort: the check-in already happened, and a failed
        // link is only a slower match tomorrow.
        if (row.match === 'name' && canRenew) {
          api
            .post('/mystudio/link', {
              participant_id: row.participantId,
              student_id: row.studentId,
            })
            .catch(() => {});
        }
        return created;
      } catch {
        return null;
      } finally {
        setAdding((prev) => {
          const next = new Set(prev);
          next.delete(row.studentId);
          return next;
        });
      }
    },
    [adding, canRenew, date, onAdded]
  );

  // Inside a dialog somebody opened on purpose, silence is an empty box. The
  // icon is deliberately there before the answer is, so pressing it early has to
  // land on something that says "working" rather than on nothing at all.
  if (state.loading) return bare ? <BouncingDots label="Loading today's bookings" className="py-6" /> : null;

  if (state.error) {
    return bare ? (
      <p className="font-ninja text-sm text-ninja-muted py-2">
        Could not reach MyStudio just now. It will try again shortly.
      </p>
    ) : null;
  }

  if (!data || !data.connected) {
    return bare ? (
      <p className="font-ninja text-sm text-ninja-muted py-2">
        This center is not connected to MyStudio.
      </p>
    ) : null;
  }

  if (data.status === 'expired') {
    return (
      <div className="py-2">
        <div className="flex items-start gap-2.5">
          <span aria-hidden className="mt-0.5 text-amber-600 dark:text-amber-400 flex-shrink-0">
            <TriangleAlertIcon size={17} />
          </span>
          <div className="min-w-0">
            <p className="font-ninja text-sm text-ninja-navy">
              The MyStudio connection ran out, so today's classes are not being
              pulled.
            </p>
            {/* Was a dead end that described where to go. Signing in again is
                a code from an email now, so it is worth one tap from here. */}
            {canRenew ? (
              <Link
                to="/account?mystudio=1"
                className="inline-block mt-1.5 font-ninja text-sm font-semibold text-ninja-blue hover:underline"
              >
                Sign in again
              </Link>
            ) : (
              <p className="mt-1.5 font-ninja text-sm text-ninja-muted">
                A center director can sign in again to restore it.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  const expected = data.expected || [];
  if (expected.length === 0) {
    return bare ? (
      <p className="font-ninja text-sm text-ninja-muted py-2">
        Nobody is booked in today.
      </p>
    ) : null;
  }

  // A ninja can be booked into two classes on one day, so the same person
  // appears twice. Checking them in once settles both rows, which is why this
  // asks about the student rather than the booking.
  const onBoard = (row) =>
    (row.studentId && accepted.has(row.studentId)) ||
    row.alreadyOnBoard ||
    (row.studentId && existingStudentIds?.has(row.studentId));

  const unmatched = expected.filter((r) => !r.studentId);
  const ninjaCount = countNinjas(expected);
  const classCount = groupByClass(expected).length;
  const summary =
    `${ninjaCount} ${ninjaCount === 1 ? 'ninja' : 'ninjas'} across ` +
    `${classCount} ${classCount === 1 ? 'class' : 'classes'}` +
    (unmatched.length > 0 && !readOnly ? `, ${unmatched.length} not matched yet` : '');

  const groups = groupByClass(expected);

  // The credential dies twenty four hours after it was made, and the moment is
  // knowable in advance because the token says so. Six hours is the window that
  // makes a warning useful rather than nagging: long enough to act on before the
  // afternoon classes, short enough that it is not on screen most of the day.
  //
  // Directors only. A sensei cannot renew it, and a warning you cannot act on is
  // just an amber box you learn to stop reading.
  const hoursLeft = hoursUntil(data.expiresAt);
  const runningOut = canRenew && hoursLeft !== null && hoursLeft > 0 && hoursLeft <= 6;

  const expiryNotice = runningOut ? (
    <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-2.5">
      <span aria-hidden className="mt-0.5 text-amber-600 dark:text-amber-400 flex-shrink-0">
        <TriangleAlertIcon size={15} />
      </span>
      <p className="font-ninja text-xs text-ninja-navy min-w-0">
        The MyStudio sign-in runs out {formatExpiry(data.expiresAt)}. It lasts a
        day at a time, so this is normal.{' '}
        <Link to="/account?mystudio=1" className="font-semibold text-ninja-blue hover:underline">
          Renew it now
        </Link>
      </p>
    </div>
  ) : null;

  return (
    <div className={bare ? '' : `${CARD} p-4`}>
      {!bare && (
        <div className="flex items-center gap-2.5 mb-4">
          <span
            aria-hidden
            className="w-8 h-8 rounded-xl flex items-center justify-center text-ninja-blue-ink bg-ninja-blue/10 flex-shrink-0"
          >
            <UsersIcon size={16} />
          </span>
          <div className="min-w-0">
            <p className="font-ninja text-sm font-semibold text-ninja-navy">
              Booked in MyStudio
            </p>
            <p className="font-ninja text-xs text-ninja-muted">{summary}</p>
          </div>
        </div>
      )}

      {bare && <p className="font-ninja text-xs text-ninja-muted mb-3">{summary}</p>}

      {expiryNotice}

      {/* One block per class, so the day reads as a timetable rather than as a
          column of names with headings floating in it. */}
      <div className="space-y-2.5 max-h-[60vh] overflow-y-auto -mx-1 px-1">
        {groups.map((group) => (
          <div
            key={group.key}
            className="rounded-xl border border-ninja-border overflow-hidden"
          >
            <div className="flex items-center gap-2 px-3 py-2 bg-ninja-bg">
              <span className="font-ninja text-sm font-bold text-ninja-navy tabular-nums flex-shrink-0">
                {prettyTime(group.startTime)}
              </span>
              <span className="font-ninja text-xs text-ninja-muted truncate">
                {group.className}
              </span>
              {group.isClub && (
                <span className="font-ninja text-[10px] uppercase tracking-wide text-ninja-muted border border-ninja-border rounded-full px-1.5 py-0.5 flex-shrink-0">
                  Club
                </span>
              )}
              <span className="ml-auto font-ninja text-xs text-ninja-muted tabular-nums flex-shrink-0">
                {group.rows.length}
              </span>
            </div>

            <ul className="divide-y divide-ninja-border">
              <AnimatePresence initial={false}>
                {group.rows.map((row) => {
                  const done = onBoard(row);
                  const busy = Boolean(row.studentId) && adding.has(row.studentId);
                  const canAdd =
                    Boolean(row.studentId) && !done && !readOnly && !row.isClub;
                  const needsMatch = !row.studentId && !readOnly;

                  return (
                    <motion.li
                      key={`${group.key}|${row.participantId}`}
                      layout
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
                    >
                      <button
                        type="button"
                        onClick={canAdd ? () => checkIn(row) : undefined}
                        disabled={!canAdd}
                        aria-label={
                          canAdd ? `Check in ${row.studentName || row.fullName}` : undefined
                        }
                        title={
                          row.isClub
                            ? 'Clubs are logged from the Clubs page, not checked in here'
                            : needsMatch
                              ? 'No matching ninja in DojoLink yet'
                              : undefined
                        }
                        className={[
                          'group w-full flex items-center gap-2.5 px-3 py-2 font-ninja text-sm text-left transition-colors duration-150',
                          canAdd
                            ? 'text-ninja-navy hover:bg-ninja-blue/10 hover:text-ninja-blue'
                            : 'text-ninja-navy cursor-default',
                        ].join(' ')}
                      >
                        <span className="truncate">{row.studentName || row.fullName}</span>

                        {row.rankName && (
                          <span className="text-xs text-ninja-muted truncate flex-shrink-0 ml-auto">
                            {row.rankName}
                          </span>
                        )}

                        {/* Status sits last and quiet. Everyone in this list is
                            expected; the only news is who has not arrived, and
                            a tick against all eight said nothing at all. */}
                        <span aria-hidden className="flex-shrink-0 w-4 flex justify-center">
                          {busy ? (
                            <Loader2Icon size={13} className="animate-spin" />
                          ) : done ? (
                            <CheckIcon
                              size={13}
                              className="text-emerald-600/60 dark:text-emerald-400/60"
                            />
                          ) : canAdd ? (
                            <UserRoundPlusIcon
                              size={13}
                              className="text-ninja-muted group-hover:text-ninja-blue"
                            />
                          ) : needsMatch ? (
                            <TriangleAlertIcon size={12} className="text-amber-500" />
                          ) : null}
                        </span>
                      </button>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
          </div>
        ))}
      </div>

      {!readOnly && unmatched.length > 0 && (
        <p className="font-ninja text-xs text-ninja-muted mt-3">
          Ninjas marked with a warning have no match on this center's roster yet.
          Add them to DojoLink and they will line up on the next pull.
        </p>
      )}
    </div>
  );
}
