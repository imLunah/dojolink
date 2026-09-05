import { ClockIcon } from 'lucide-react';
import ModalPortal from './ModalPortal';

// What a signed-out session looks like from inside the app.
//
// It is shared by the staff shell and the parent portal deliberately. Both had
// the same problem and only one had an answer: a session that expires does not
// announce itself, so the next thing the person taps just fails, and a page
// that half-loads with an error in it reads as the app being broken rather
// than as being signed out. This says which it is, and its one button is the
// way back.
//
// No backdrop click, no Escape, no close cross. There is nothing behind it to
// go back to — every request from here is a 401 — so an exit that leaves the
// person on a dead page is not an exit.
export default function SessionTimeoutModal({ onDismiss }) {
  return (
    <ModalPortal>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-timeout-title"
        className="fixed inset-0 z-[9999] flex items-start sm:items-center justify-center p-4 overflow-y-auto bg-black/50 backdrop-blur-sm"
      >
        <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 text-center">
          {/* A drawn icon, not an emoji: an emoji is rendered by the operating
              system, so it arrives flat and grey on one platform and glossy on
              another, and it never matches the icons the rest of the app uses. */}
          <ClockIcon size={30} strokeWidth={2} aria-hidden className="mx-auto mb-3 text-ninja-muted" />
          <h2 id="session-timeout-title" className="text-lg font-bold font-ninja text-ninja-navy mb-2">Session Timed Out</h2>
          <p className="text-ninja-muted font-ninja text-sm leading-relaxed mb-5">
            Your session has expired. Please sign in again to continue.
          </p>
          <button
            type="button"
            autoFocus
            onClick={onDismiss}
            className="w-full bg-ninja-blue hover:opacity-90 text-white font-ninja font-bold py-2.5 rounded-xl transition-opacity"
          >
            Sign In Again
          </button>
        </div>
      </div>
    </ModalPortal>
  );
}
