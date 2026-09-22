import { Link } from 'react-router-dom';
import { CARD } from '../lib/surfaces';
import { useLightOnly } from '../context/ThemeContext';
import Logo from '../components/ui/Logo';

export default function PrivacyPage() {
  useLightOnly();
  return (
    <div className="theme-locked min-h-[100dvh] bg-ninja-bg py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <Logo variant="lockup" className="h-8 text-ninja-navy mb-6" />
          <h1 className="text-3xl font-bold font-ninja text-ninja-navy">Privacy Policy</h1>
          <p className="text-ninja-muted font-ninja text-sm mt-1">Last Updated: September 22, 2026</p>
        </div>

        <div className={`${CARD} p-8 space-y-6 font-ninja text-ninja-navy`}>

          <section>
            <h2 className="text-lg font-bold mb-2">About DojoLink</h2>
            <p className="text-sm text-ninja-muted leading-relaxed mb-2">
              DojoLink is an independently developed studio management platform created by a staff member of a Code Ninjas franchise location. DojoLink is not affiliated with, endorsed by, sponsored by, or operated by Code Ninjas Inc. or any related corporate entity.
            </p>
            <p className="text-sm text-ninja-muted leading-relaxed mb-2">
              DojoLink is used by participating franchise staff to manage student check-ins, attendance, curriculum progress, club participation, center events, and staff tasks. Parents and guardians may also use the platform to view their child's progress and activity within the center.
            </p>
            <p className="text-sm text-ninja-muted leading-relaxed">
              This Privacy Policy explains what information is collected, how it is used, and how it is protected.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3">Information We Collect</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-ninja-navy mb-1">Student Information</h3>
                <p className="text-sm text-ninja-muted leading-relaxed mb-2">We may collect and store:</p>
                <div className="text-sm text-ninja-muted leading-relaxed space-y-1">
                  <p>Student names</p>
                  <p>Belt level and curriculum progression</p>
                  <p>Program enrollment information</p>
                  <p>Attendance and check-in records</p>
                  <p>Progress notes and logs entered by center staff</p>
                  <p>Birthdays</p>
                  <p>Which participating centers a student attends</p>
                  <p>Special instructions written by a parent or guardian</p>
                  <p>Avatar appearance chosen for the student's profile, such as the character's skin tone</p>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-bold text-ninja-navy mb-1">Parent and Guardian Information</h3>
                <p className="text-sm text-ninja-muted leading-relaxed mb-2">We may collect and store:</p>
                <div className="text-sm text-ninja-muted leading-relaxed space-y-1">
                  <p>Parent or guardian names</p>
                  <p>Email addresses</p>
                  <p>Phone numbers</p>
                  <p>Relationship to the student</p>
                  <p>When they agreed to the Terms and this Privacy Policy, and which version they agreed to</p>
                </div>
                <p className="text-sm text-ninja-muted leading-relaxed mt-2">
                  Parents and guardians sign in with their center's code and the email address the center has on file for them. At first sign-in they confirm their name, phone number, and relationship to the student. Public self-registration is not available.
                </p>
              </div>
              <div>
                <h3 className="text-sm font-bold text-ninja-navy mb-1">Staff Information</h3>
                <p className="text-sm text-ninja-muted leading-relaxed mb-2">We may collect and store:</p>
                <div className="text-sm text-ninja-muted leading-relaxed space-y-1">
                  <p>Usernames</p>
                  <p>Encrypted passwords</p>
                  <p>Display names</p>
                  <p>Optional profile photos</p>
                  <p>The centers a staff member works at</p>
                  <p>Tasks, comments, and notes written in the platform</p>
                  <p>Display preferences, such as light or dark mode</p>
                  <p>Account activity related to platform usage</p>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-bold text-ninja-navy mb-1">Information From MyStudio</h3>
                <p className="text-sm text-ninja-muted leading-relaxed mb-2">
                  A Center Director may connect their center's MyStudio account to DojoLink. When connected, DojoLink retrieves the day's class bookings so staff can see which students are expected. If a director chooses to import their roster, DojoLink also retrieves student names, birthdays, and parent or guardian names, email addresses, and phone numbers, and uses them to create or fill in student records the director has approved.
                </p>
                <p className="text-sm text-ninja-muted leading-relaxed">
                  To keep the connection working, DojoLink stores the MyStudio sign-in session and, if the director chooses to save it, the MyStudio email and password. These are encrypted, used only to maintain the connection, and never displayed back. A director can remove the saved password or disconnect MyStudio at any time.
                </p>
              </div>
              <div>
                <h3 className="text-sm font-bold text-ninja-navy mb-1">Bug Reports and Suggestions</h3>
                <p className="text-sm text-ninja-muted leading-relaxed">
                  Staff, parents, and guardians can report a bug or suggest a feature from inside DojoLink. A report is emailed to the developer and includes the description written, the page it was sent from, browser and screen details, recent technical error messages, and any screenshot the sender chooses to attach. A screenshot can show whatever was on screen at the time, including student information.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-2">How Information Is Used</h2>
            <p className="text-sm text-ninja-muted leading-relaxed mb-3">
              Information collected through DojoLink is used solely for operational and educational purposes within participating franchise locations, including:
            </p>
            <div className="text-sm text-ninja-muted leading-relaxed space-y-2 mb-3">
              <p>Tracking and displaying student progress</p>
              <p>Managing attendance and student check-ins</p>
              <p>Allowing parents and guardians to view their own child's progress</p>
              <p>Showing staff which students are booked for the day</p>
              <p>Sharing center events with families</p>
              <p>Investigating reported bugs and suggestions</p>
              <p>Authenticating authorized staff access</p>
              <p>Maintaining platform functionality and security</p>
            </div>
            <p className="text-sm text-ninja-muted leading-relaxed mb-2">
              Parents and guardians may only access information associated with their own child.
            </p>
            <p className="text-sm text-ninja-muted leading-relaxed">
              We do not sell, rent, license, or share personal information with third parties for advertising or marketing purposes.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3">Access and Visibility</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-ninja-navy mb-1">Center Staff</h3>
                <p className="text-sm text-ninja-muted leading-relaxed">
                  Authorized Center Directors and Senseis may access student information for students enrolled at their franchise location. A student who attends more than one participating center is visible to staff at each of those centers, and a staff member assigned to more than one center can see the students at each center they are assigned to.
                </p>
              </div>
              <div>
                <h3 className="text-sm font-bold text-ninja-navy mb-1">Parents and Guardians</h3>
                <p className="text-sm text-ninja-muted leading-relaxed">
                  Parents and guardians may only access information associated with their own child or children.
                </p>
              </div>
              <div>
                <h3 className="text-sm font-bold text-ninja-navy mb-1">Children</h3>
                <p className="text-sm text-ninja-muted leading-relaxed">
                  Children do not create accounts and do not directly log into DojoLink.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-2">Data Storage and Security</h2>
            <p className="text-sm text-ninja-muted leading-relaxed mb-3">
              Data is stored using Supabase infrastructure hosted in the United States with PostgreSQL database services.
            </p>
            <p className="text-sm text-ninja-muted leading-relaxed mb-2">Security measures include:</p>
            <div className="text-sm text-ninja-muted leading-relaxed space-y-2 mb-3">
              <p>HTTPS-encrypted connections</p>
              <p>Password hashing using bcrypt</p>
              <p>Encryption of stored MyStudio sign-in details (AES-256-GCM)</p>
              <p>Limits on repeated sign-in attempts</p>
              <p>Restricted staff access controls</p>
              <p>Authentication protections for parent and staff accounts</p>
            </div>
            <p className="text-sm text-ninja-muted leading-relaxed mb-2">
              Passwords are never stored in plain text.
            </p>
            <p className="text-sm text-ninja-muted leading-relaxed">
              While reasonable security measures are implemented, no online platform can guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-2">Data Retention</h2>
            <p className="text-sm text-ninja-muted leading-relaxed mb-2">
              Student and parent information is retained while the student remains actively enrolled at a participating franchise location.
            </p>
            <p className="text-sm text-ninja-muted leading-relaxed mb-2">
              Parents, guardians, and staff can delete their own account from their account settings. Deleting a parent account removes the parent's profile and clears their name, email, phone number, and special instructions from their child's record. The child's progress and attendance records stay with the center. Deleting a staff account removes the account.
            </p>
            <p className="text-sm text-ninja-muted leading-relaxed mb-2">
              When an account is deleted, DojoLink keeps only the reason given for leaving, the role, and the center. This record contains no name, email address, or other detail that identifies the person.
            </p>
            <p className="text-sm text-ninja-muted leading-relaxed mb-2">
              Other requests for data deletion, including deletion of a student's records, should be directed to the Center Director of the participating location.
            </p>
            <p className="text-sm text-ninja-muted leading-relaxed">
              Certain records may be retained where reasonably necessary for operational, legal, or security purposes.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-2">Analytics, Cookies, and Local Storage</h2>
            <p className="text-sm text-ninja-muted leading-relaxed mb-2">
              DojoLink uses <strong>Vercel Analytics</strong> to collect anonymized, aggregated page-view data (such as page visited and general geographic region). No personally identifiable information is included in these analytics reports.
            </p>
            <p className="text-sm text-ninja-muted leading-relaxed mb-2">
              DojoLink uses a single sign-in cookie to keep you signed in. It ends when you close your browser, unless you choose "Keep me signed in on this device," in which case it lasts up to 30 days.
            </p>
            <p className="text-sm text-ninja-muted leading-relaxed mb-2">
              DojoLink stores a small amount of data in your browser's local storage and session storage for functional purposes only:
            </p>
            <div className="text-sm text-ninja-muted leading-relaxed space-y-1 mb-2">
              <p><strong>Display preferences</strong> (localStorage): remembers your light or dark mode, accent color, navigation layout, and whether side menus are collapsed.</p>
              <p><strong>Experimental features</strong> (localStorage): remembers whether you turned on features that are still being tested.</p>
              <p><strong>Announcement dismissal</strong> (sessionStorage): remembers that you dismissed a system announcement banner during your current session. This data is cleared when you close your browser tab.</p>
            </div>
            <p className="text-sm text-ninja-muted leading-relaxed">
              No advertising cookies or cross-site tracking technologies are used.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-2">Children's Privacy (COPPA)</h2>
            <p className="text-sm text-ninja-muted leading-relaxed mb-2">
              DojoLink stores information <em>about</em> children enrolled at participating franchise locations (such as names, belt levels, and attendance records). This information is entered and managed by authorized center staff, either directly or by importing it from the center's MyStudio account. A parent or guardian may add special instructions and choose how their child's avatar looks. Children do not create accounts, submit personal information, or directly interact with the platform.
            </p>
            <p className="text-sm text-ninja-muted leading-relaxed mb-2">
              Student records are collected for internal educational and operational purposes only, consistent with the Children's Online Privacy Protection Act (COPPA). We do not use or disclose children's information for any commercial, advertising, or marketing purpose.
            </p>
            <p className="text-sm text-ninja-muted leading-relaxed">
              Parents or guardians who wish to review, correct, or request deletion of their child's information should contact the Center Director of their participating franchise location.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-2">California Privacy Rights</h2>
            <p className="text-sm text-ninja-muted leading-relaxed mb-2">
              California residents may have rights under the California Consumer Privacy Act (CCPA) regarding personal information collected about them. DojoLink is an internal operational platform used by franchise staff; it does not sell personal information to third parties.
            </p>
            <p className="text-sm text-ninja-muted leading-relaxed">
              California residents can update their own profile and delete their own account from their account settings, and may contact the Center Director of their participating franchise location to request access to, correction of, or deletion of any other personal information held about them, subject to applicable legal limitations.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-2">Third-Party Services</h2>
            <p className="text-sm text-ninja-muted leading-relaxed mb-2">
              DojoLink uses the following third-party services solely for platform functionality, storage, and security operations:
            </p>
            <div className="text-sm text-ninja-muted leading-relaxed space-y-1 mb-2">
              <p><strong>Supabase:</strong> database and file storage</p>
              <p><strong>Vercel:</strong> hosting and anonymized page-view analytics</p>
              <p><strong>Google (Gmail):</strong> delivery of bug reports and suggestions to the developer</p>
              <p><strong>MyStudio:</strong> class bookings and roster details, only for centers whose director has connected it</p>
            </div>
            <p className="text-sm text-ninja-muted leading-relaxed">
              These providers do not receive permission to use personal information for independent marketing purposes. MyStudio is a separate service with its own privacy policy, and DojoLink is not affiliated with it.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-2">Changes to This Privacy Policy</h2>
            <p className="text-sm text-ninja-muted leading-relaxed mb-2">
              This Privacy Policy may be updated periodically. Continued use of DojoLink after updates are posted constitutes acceptance of the revised policy.
            </p>
            <p className="text-sm text-ninja-muted leading-relaxed">
              The "Last Updated" date above reflects the effective date of the current version.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-2">Contact</h2>
            <p className="text-sm text-ninja-muted leading-relaxed">
              For privacy-related questions, account concerns, or data deletion requests, please contact the Center Director at your participating franchise location.
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
