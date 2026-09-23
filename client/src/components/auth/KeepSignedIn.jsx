import { motion, AnimatePresence } from 'framer-motion';

// The "keep me signed in" box, shared by the login page and the guided
// start so the two sign-ins offer the same choice the same way.
export default function KeepSignedIn({ checked, onChange }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer group">
      <div className="relative flex-shrink-0">
        <input
          id="keep-signed-in"
          name="keepSignedIn"
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        <motion.div
          className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
            checked ? 'bg-ninja-blue border-ninja-blue' : 'border-ninja-border bg-white'
          }`}
          whileTap={{ scale: 0.85 }}
        >
          <AnimatePresence>
            {checked && (
              <motion.svg
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{   scale: 0, opacity: 0 }}
                transition={{ type: 'spring', damping: 16, stiffness: 400 }}
                className="w-3 h-3 text-white"
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/>
              </motion.svg>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
      <span className="font-ninja text-sm text-ninja-navy group-hover:text-ninja-blue transition-colors">
        Keep me signed in on this device
      </span>
    </label>
  );
}
