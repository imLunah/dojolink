import { Link } from 'react-router-dom';
import { CARD } from '../lib/surfaces';
import { useLightOnly } from '../context/ThemeContext';
import Logo from '../components/ui/Logo';

export default function AccessibilityPage() {
  useLightOnly();
  return (
    <div className="theme-locked min-h-[100dvh] bg-ninja-bg py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <Logo variant="lockup" className="h-8 text-ninja-navy mb-6" />
          <h1 className="text-3xl font-bold font-ninja text-ninja-navy">Accessibility Statement</h1>
          <p className="text-ninja-muted font-ninja text-sm mt-1">Last Updated: September 22, 2026</p>
        </div>

        <div className={`${CARD} p-8 space-y-6 font-ninja text-ninja-navy`}>

          <section>
            <h2 className="text-lg font-bold mb-2">Our Commitment</h2>
            <p className="text-sm text-ninja-muted leading-relaxed">
              DojoLink is committed to ensuring digital accessibility for all users, including people with disabilities. We continually work to improve the usability of our platform and apply relevant accessibility standards.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-2">Conformance Status</h2>
            <p className="text-sm text-ninja-muted leading-relaxed mb-2">
              DojoLink aims to conform to the{' '}
              <a
                href="https://www.w3.org/TR/WCAG21/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-ninja-blue hover:underline"
              >
                Web Content Accessibility Guidelines (WCAG) 2.1
              </a>{' '}
              at Level AA. These guidelines explain how to make web content more accessible to people with disabilities.
            </p>
            <p className="text-sm text-ninja-muted leading-relaxed">
              DojoLink is <strong>partially conformant</strong> with WCAG 2.1 Level AA. Partial conformance means that some parts of the content do not fully conform to the standard, and we are actively working to address known gaps.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3">Measures Taken</h2>
            <p className="text-sm text-ninja-muted leading-relaxed mb-2">We have taken the following steps to support accessibility:</p>
            <div className="text-sm text-ninja-muted leading-relaxed space-y-2">
              <p><strong>Reduced motion:</strong> All animations automatically disable when your operating system's "Reduce Motion" setting is enabled.</p>
              <p><strong>Keyboard navigation:</strong> Core platform interactions are operable via keyboard.</p>
              <p><strong>Color contrast:</strong> Text and interactive elements are designed to meet or exceed minimum contrast ratios.</p>
              <p><strong>Semantic HTML:</strong> Pages use semantic markup to support assistive technologies such as screen readers.</p>
              <p><strong>Text resizing:</strong> The interface supports browser-level text resizing without loss of content or functionality.</p>
              <p><strong>Focus indicators:</strong> Interactive elements display visible focus indicators for keyboard users.</p>
              <p><strong>Dialogs:</strong> Dialogs keep keyboard focus inside them while open, close with the Escape key, and return focus to where you were when they close.</p>
              <p><strong>Increased contrast:</strong> When your operating system asks for more contrast, translucent panels become solid and gain stronger outlines.</p>
              <p><strong>Dark mode:</strong> Signed-in users can switch to a dark theme from Appearance settings.</p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-2">Known Limitations</h2>
            <p className="text-sm text-ninja-muted leading-relaxed mb-2">
              We are aware of the following areas where accessibility may be incomplete:
            </p>
            <div className="text-sm text-ninja-muted leading-relaxed space-y-2">
              <p>Panels that open beside the calendar are not modal: they take focus when they open and close with Escape, but Tab can move back out to the page behind them.</p>
              <p>Some lists laid out in columns, such as the ninja roster, are built from layout grids rather than table markup, so screen readers may not announce their column headers.</p>
              <p>Image content (such as profile photos) may not always include descriptive alternative text.</p>
              <p>Some form validation error messages may not be announced automatically by all screen readers.</p>
            </div>
            <p className="text-sm text-ninja-muted leading-relaxed mt-3">
              We are actively working to address these limitations.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-2">Assistive Technologies Supported</h2>
            <p className="text-sm text-ninja-muted leading-relaxed mb-2">DojoLink is designed to be compatible with:</p>
            <div className="text-sm text-ninja-muted leading-relaxed space-y-1">
              <p>Screen readers (VoiceOver on macOS/iOS, NVDA and JAWS on Windows)</p>
              <p>Keyboard-only navigation</p>
              <p>Browser zoom up to 200%</p>
              <p>High contrast display modes</p>
              <p>OS-level reduced motion preferences</p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-2">Technical Specifications</h2>
            <p className="text-sm text-ninja-muted leading-relaxed mb-2">
              DojoLink relies on the following technologies for conformance:
            </p>
            <div className="text-sm text-ninja-muted leading-relaxed space-y-1">
              <p>HTML5</p>
              <p>CSS (including media queries for prefers-reduced-motion and prefers-contrast)</p>
              <p>JavaScript (React 18)</p>
              <p>WAI-ARIA where applicable</p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-2">Feedback and Contact</h2>
            <p className="text-sm text-ninja-muted leading-relaxed mb-2">
              We welcome feedback on the accessibility of DojoLink. If you experience any barriers or have suggestions for improvement, please contact the Center Director at your participating franchise location.
            </p>
            <p className="text-sm text-ninja-muted leading-relaxed">
              We aim to respond to accessibility feedback within a reasonable timeframe and will work to resolve identified issues promptly.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-2">Formal Complaints</h2>
            <p className="text-sm text-ninja-muted leading-relaxed">
              If you are not satisfied with our response to your accessibility concern, you may contact the relevant government authority responsible for digital accessibility enforcement in your jurisdiction. In the United States, this includes the{' '}
              <a
                href="https://www.ada.gov"
                target="_blank"
                rel="noopener noreferrer"
                className="text-ninja-blue hover:underline"
              >
                U.S. Department of Justice (ADA.gov)
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-2">Assessment Approach</h2>
            <p className="text-sm text-ninja-muted leading-relaxed">
              DojoLink assesses accessibility through self-evaluation and automated tooling during development. We review new features for accessibility compliance before release and address reported issues on an ongoing basis.
            </p>
          </section>

        </div>

        <div className="mt-6 text-center">
          <Link to="/" className="text-ninja-blue font-ninja text-sm font-semibold hover:underline">
            ← Back
          </Link>
        </div>
      </div>
    </div>
  );
}
