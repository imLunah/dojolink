import { Link } from 'react-router-dom';
import { CARD } from '../lib/surfaces';
import { useLightOnly } from '../context/ThemeContext';
import Logo from '../components/ui/Logo';

export default function TermsPage() {
  useLightOnly();
  return (
    <div className="theme-locked min-h-[100dvh] bg-ninja-bg py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <Logo variant="lockup" className="h-8 text-ninja-navy mb-6" />
          <h1 className="text-3xl font-bold font-ninja text-ninja-navy">Terms and Conditions</h1>
          <p className="text-ninja-muted font-ninja text-sm mt-1">Last Updated: September 22, 2026</p>
        </div>

        <div className={`${CARD} p-8 space-y-6 font-ninja text-ninja-navy`}>

          <section>
            <h2 className="text-lg font-bold mb-2">About DojoLink</h2>
            <p className="text-sm text-ninja-muted leading-relaxed mb-2">
              DojoLink is an independently developed studio management platform created by a staff member of a Code Ninjas franchise location. DojoLink is not affiliated with, endorsed by, sponsored by, or operated by Code Ninjas or any of its corporate entities.
            </p>
            <p className="text-sm text-ninja-muted leading-relaxed">
              "Code Ninjas" and related marks are registered trademarks of their respective owners.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-2">Acceptance of Terms</h2>
            <p className="text-sm text-ninja-muted leading-relaxed mb-2">
              By accessing or using DojoLink, you agree to be bound by these Terms and Conditions and all applicable laws and regulations. If you do not agree to these terms, you may not access or use the platform.
            </p>
            <p className="text-sm text-ninja-muted leading-relaxed">
              Staff accounts are created by authorized franchise staff. Parent and guardian access is only available to an email address a participating center already has on file, and parents and guardians are asked to agree to these terms the first time they sign in. Public self-registration is not available.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3">Eligibility and Authorized Users</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-ninja-navy mb-1">Staff Users</h3>
                <p className="text-sm text-ninja-muted leading-relaxed">
                  Authorized employees and contractors of participating franchise locations, including Center Directors and Senseis, may access DojoLink using credentials issued by authorized management personnel.
                </p>
              </div>
              <div>
                <h3 className="text-sm font-bold text-ninja-navy mb-1">Parents and Guardians</h3>
                <p className="text-sm text-ninja-muted leading-relaxed">
                  Parents or legal guardians whose information is maintained by the participating franchise location may sign in using their center's code and the email address the center has on file, for the purpose of viewing student-related information.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-2">Permitted Use</h2>
            <p className="text-sm text-ninja-muted leading-relaxed mb-3">
              DojoLink is intended solely for internal operational use by participating franchise locations, including student management, attendance tracking, curriculum progress, club participation, center events, staff tasks, communication, and parent visibility.
            </p>
            <p className="text-sm text-ninja-muted leading-relaxed mb-2">You agree not to:</p>
            <div className="text-sm text-ninja-muted leading-relaxed space-y-2">
              <p>Access information or accounts that do not belong to you.</p>
              <p>Share login credentials, or your center's code, with unauthorized individuals.</p>
              <p>Connect a third-party account you are not authorized to use.</p>
              <p>Attempt to copy, modify, reverse-engineer, scrape, or redistribute any portion of the platform.</p>
              <p>Use the platform in violation of any applicable law or regulation.</p>
              <p>Interfere with the operation, security, or integrity of the platform.</p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-2">Account Security</h2>
            <p className="text-sm text-ninja-muted leading-relaxed mb-2">
              You are responsible for maintaining the confidentiality of your login credentials and for all activity occurring under your account.
            </p>
            <p className="text-sm text-ninja-muted leading-relaxed mb-2">
              If you suspect unauthorized access or compromise of your account, you must notify your Center Director immediately.
            </p>
            <p className="text-sm text-ninja-muted leading-relaxed mb-2">
              "Keep me signed in on this device" keeps you signed in for up to 30 days. Do not use it on a shared or public device.
            </p>
            <p className="text-sm text-ninja-muted leading-relaxed">
              DojoLink does not currently provide self-service password recovery. Password assistance must be handled directly through authorized center staff.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-2">Content You Enter</h2>
            <p className="text-sm text-ninja-muted leading-relaxed mb-2">
              You are responsible for what you enter into DojoLink, including progress notes, special instructions, task comments, and bug reports. Keep it accurate and appropriate, and include only the personal information that is needed.
            </p>
            <p className="text-sm text-ninja-muted leading-relaxed">
              A screenshot attached to a bug report can show whatever is on screen, including student information. Check a screenshot before you send it.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-2">Third-Party Integrations</h2>
            <p className="text-sm text-ninja-muted leading-relaxed mb-2">
              A Center Director may connect their center's MyStudio account to DojoLink. By connecting it, you confirm that you are authorized to use that account on behalf of your center, and that your use complies with MyStudio's own terms.
            </p>
            <p className="text-sm text-ninja-muted leading-relaxed">
              MyStudio is a separate service. DojoLink is not affiliated with it and is not responsible for its availability, or for the accuracy of information retrieved from it. Features that rely on it may stop working at any time.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-2">Ownership and Copyright</h2>
            <p className="text-sm text-ninja-muted leading-relaxed mb-2">
              The DojoLink software, its source code, its design and layout, and the DojoLink name and logo are &copy; 2026 John Dang. All rights reserved.
            </p>
            <p className="text-sm text-ninja-muted leading-relaxed mb-2">
              Code Ninjas names, logos, belt and program artwork, characters, and curriculum content belong to Code Ninjas and remain its property. They appear in DojoLink only for the internal use of participating franchise locations, and no rights in them are granted by these terms.
            </p>
            <p className="text-sm text-ninja-muted leading-relaxed">
              Using DojoLink does not give you any ownership of it. You may not copy, reproduce, republish, or create derivative works from any part of the platform, its design, or its logo without prior written permission.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-2">Data and Privacy</h2>
            <p className="text-sm text-ninja-muted leading-relaxed">
              Use of DojoLink is also governed by the{' '}
              <Link to="/privacy" className="text-ninja-blue hover:underline">Privacy Policy</Link>{' '}
              applicable to your participating franchise location. By using the platform, you consent to the collection, storage, and use of information as described in the applicable privacy practices.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-2">Platform Availability</h2>
            <p className="text-sm text-ninja-muted leading-relaxed mb-2">
              DojoLink is provided on an "as-is" and "as-available" basis for internal franchise operations. While reasonable efforts may be made to maintain uptime and reliability, no guarantees are made regarding uninterrupted access, error-free functionality, or data accuracy.
            </p>
            <p className="text-sm text-ninja-muted leading-relaxed">
              Features, functionality, and access may be modified, suspended, or discontinued at any time without prior notice.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-2">Limitation of Liability</h2>
            <p className="text-sm text-ninja-muted leading-relaxed mb-3">
              To the fullest extent permitted by applicable law, the operators, developers, and administrators of DojoLink shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising out of or related to:
            </p>
            <div className="text-sm text-ninja-muted leading-relaxed space-y-2 mb-3">
              <p>Use or inability to use the platform.</p>
              <p>Data loss or service interruption.</p>
              <p>Unauthorized account access.</p>
              <p>Reliance on information displayed within the platform.</p>
            </div>
            <p className="text-sm text-ninja-muted leading-relaxed">
              This limitation applies regardless of the legal theory asserted.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-2">Deleting Your Account</h2>
            <p className="text-sm text-ninja-muted leading-relaxed">
              You can delete your own account at any time from your account settings. Deletion cannot be undone. Student records belong to the participating center and are not removed when a parent, guardian, or staff account is deleted. What is removed is described in the{' '}
              <Link to="/privacy" className="text-ninja-blue hover:underline">Privacy Policy</Link>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-2">Termination of Access</h2>
            <p className="text-sm text-ninja-muted leading-relaxed">
              Participating franchise staff may suspend or terminate access to DojoLink at any time for violations of these terms, security concerns, employment termination, or operational reasons.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-2">Changes to These Terms</h2>
            <p className="text-sm text-ninja-muted leading-relaxed mb-2">
              These Terms and Conditions may be updated periodically. Continued use of DojoLink after updated terms are posted constitutes acceptance of the revised terms.
            </p>
            <p className="text-sm text-ninja-muted leading-relaxed">
              The "Last Updated" date at the top of this page indicates the effective date of the current version.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-2">Contact</h2>
            <p className="text-sm text-ninja-muted leading-relaxed">
              For questions regarding these Terms and Conditions, please contact your participating franchise location directly through its Center Director or management staff.
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
