// The Help Center's content. Every article is data, rendered by DocsPage, so
// adding a page is adding an entry here and nothing else.
//
// Blocks: { p }, { list }, { steps }, { img, alt, caption }, { tip },
// { qa: [{ q, a }] }, { table: { head, rows } }. Text accepts **bold** and
// [label](/docs/slug) links, nothing more.
//
// Screenshots live in /public/docs. The repo is public, so every one was taken
// with made-up names and sample data in place of real ninjas, parents and
// staff. Keep it that way when retaking them.

export const DOC_GROUPS = [
  { id: 'start', label: 'Get started' },
  { id: 'senseis', label: 'Teaching a class' },
  { id: 'directors', label: 'Running a center' },
  { id: 'families', label: 'For families' },
  { id: 'account', label: 'Your account' },
  { id: 'help', label: 'Help' },
];

export const DOCS = [
  // ── Get started ────────────────────────────────────────────────
  {
    slug: 'what-is-dojolink',
    group: 'start',
    title: 'What is DojoLink',
    lede: 'The studio app for Code Ninjas centers: check ninjas in, log what they worked on, and keep families up to date.',
    image: { src: '/docs/dashboard.jpg', alt: 'The Center Director dashboard with quick links, the daily schedule and the center calendar' },
    sections: [
      {
        title: 'Who it is for',
        blocks: [
          { list: [
            '**Senseis** check ninjas in on Today\'s Board and log each session.',
            '**Center Directors** do everything a sensei does, plus run the roster, staff, tasks, events and reports for their center.',
            '**Families** sign in to the Parent Portal to follow their ninja\'s belts, levels and badges.',
          ] },
        ],
      },
      {
        title: 'A day in DojoLink',
        blocks: [
          { steps: [
            'A ninja arrives and gets checked in on [Today\'s Board](/docs/todays-board), by a sensei or at the [check-in kiosk](/docs/kiosk).',
            'During class the sensei opens the ninja and [logs the session](/docs/logging-progress): notes, belt, level and project.',
            'The ninja\'s belt journey moves forward, and their family sees it in the [Parent Portal](/docs/parent-portal).',
            'At the end of the week the director checks [Reports](/docs/reports) to see who came, who moved up and who has not been in for a while.',
          ] },
        ],
      },
      {
        title: 'Where to go next',
        blocks: [
          { p: 'New here? Start with [Signing in](/docs/signing-in), then read the guide for your role: [Today\'s Board](/docs/todays-board) for senseis, [The dashboard](/docs/dashboard) for directors, or [The Parent Portal](/docs/parent-portal) for families.' },
        ],
      },
    ],
  },
  {
    slug: 'signing-in',
    group: 'start',
    title: 'Signing in',
    lede: 'Staff sign in with a username and password. Families sign in with their center code and the email the center has on file.',
    image: { src: '/docs/get-started.jpg', alt: 'The Get Started screen asking whether you are a parent or work at a center', narrow: true },
    sections: [
      {
        title: 'Senseis and Center Directors',
        blocks: [
          { steps: [
            'Go to the sign-in page and keep **Sensei / Center Director** selected.',
            'Enter the username and password your Center Director gave you.',
            'The first time you sign in you will be asked to choose your own password, confirm your name and pick an avatar.',
          ] },
          { tip: 'Forgot your username or password? Your Center Director can look it up and reset it for you from the Staff page. There is no self-service reset for staff accounts.' },
        ],
      },
      {
        title: 'Families',
        blocks: [
          { img: '/docs/login-parent.jpg', alt: 'The parent sign-in form with a center code field and an email field', narrow: true },
          { steps: [
            'Choose **Parent** on the sign-in page.',
            'Type your center\'s code. It is a short code like ABC123 from the front desk, the welcome email or a center flyer.',
            'Type the email address your center has on file for your family.',
            'Tick **Keep me signed in on this device** if it is your own phone or computer.',
          ] },
          { p: 'There is no password for the Parent Portal. The center code and your email together are what sign you in. Read more in [Center codes](/docs/center-codes).' },
        ],
      },
      {
        title: 'Not sure where to start?',
        blocks: [
          { p: 'The **Get Started** button on the home page walks you through signing in one question at a time. On the sign-in page, **Need help signing in?** answers the most common questions.' },
        ],
      },
    ],
  },
  {
    slug: 'roles',
    group: 'start',
    title: 'Roles and permissions',
    lede: 'What a sensei, a Center Director and an administrator can each see and change.',
    sections: [
      {
        title: 'At a glance',
        blocks: [
          { table: {
            head: ['', 'Sensei', 'Center Director', 'Admin'],
            rows: [
              ['Today\'s Board and check-in', 'Yes', 'Yes', 'Yes'],
              ['Log sessions and club sessions', 'Yes', 'Yes', 'Yes'],
              ['Ninja roster and profiles', 'View', 'Full', 'Full'],
              ['Mark a ninja as needing extra support', 'Yes', 'Yes', 'Yes'],
              ['Curriculum and passcodes', 'Yes', 'Yes', 'Yes'],
              ['Center calendar', 'View', 'Edit', 'Edit'],
              ['Tasks', 'Their own', 'Whole center', 'Whole center'],
              ['Staff accounts', 'View', 'Their center', 'Every center'],
              ['Reports, events, kiosk', 'No', 'Yes', 'Yes'],
              ['Create or delete a location', 'No', 'No', 'Yes'],
            ],
          } },
        ],
      },
      {
        title: 'More than one center',
        blocks: [
          { p: 'Staff who work at more than one center switch between them with the center picker at the top of the sidebar. Everything you see and change is scoped to the center you have picked.' },
          { p: 'A Center Director can look at any active center, but can only make changes at the centers they belong to.' },
        ],
      },
    ],
  },

  // ── Teaching a class ───────────────────────────────────────────
  {
    slug: 'todays-board',
    group: 'senseis',
    title: 'Today\'s Board',
    lede: 'Everyone checked in today, in one place. Check a ninja in, then log their session from their card.',
    image: { src: '/docs/todays-board.jpg', alt: 'Today\'s Board showing checked-in ninjas with a Log Progress button on each card' },
    sections: [
      {
        title: 'Checking a ninja in',
        blocks: [
          { steps: [
            'Select **+ Check In Ninja** at the top right.',
            'Search for the ninja by name.',
            'Select **Add** next to the class they are here for. If you are not sure, use **Add without class** and pick when you log.',
          ] },
          { img: '/docs/check-in.jpg', alt: 'The Check In Ninja dialog listing ninjas with an Add button for each of their classes' },
          { tip: 'A ninja booked in more than one class today can be added once per class. Each one gets its own card and its own log.' },
        ],
      },
      {
        title: 'Reading the board',
        blocks: [
          { list: [
            '**Logged today**, **Pending** and **Overdue** at the top count where every card stands. Overdue is a check-in from an earlier day that was never logged.',
            'The program chips filter the board to one program.',
            'The color around a card shows where it stands: **yellow** still needs a log, **red** is overdue from an earlier day, and **green** is logged.',
            'A note icon beside a name means there is a pinned note or a note from the parent. Hover or tap it to read.',
            'A **rose hand-and-heart icon** means the ninja needs extra support. See below.',
            'The board refreshes itself every 30 seconds, so check-ins from the kiosk or another sensei appear without reloading.',
          ] },
        ],
      },
      {
        title: 'Booked in MyStudio',
        blocks: [
          { p: 'If your center has connected MyStudio, the people icon beside **Check In Ninja** shows who is booked today. Tap a name to check them in. See [MyStudio](/docs/mystudio).' },
        ],
      },
      {
        title: 'Changing the class',
        blocks: [
          { p: 'Checked a ninja in under the wrong program? Hover over the program icon on their card until the pencil appears, select it, and pick the right class. Only classes the ninja is enrolled in are listed, and a class that is already logged cannot be changed.' },
        ],
      },
      {
        title: 'Marking a ninja who needs extra support',
        blocks: [
          { p: 'Some ninjas need a sensei beside them more than most. Marking them lets every sensei on the floor see it at a glance, and lets your Center Director show when the room needs more hands.' },
          { steps: [
            'On the ninja\'s card, select the **hand-and-heart icon** next to the ×. It is grey when the ninja is not marked.',
            'Pick the reason: **Needs one-to-one help**, **New, still settling in**, **Focus or behaviour** or **Learning support**.',
          ] },
          { p: 'The icon turns rose. To change the reason or clear it, select the icon again and pick another reason or **Remove the mark**. You can do the same from the ninja\'s [profile](/docs/ninja-profiles).' },
          { tip: 'The mark is for staff only. Families never see it in the Parent Portal. Remove it once a ninja no longer needs the extra help.' },
        ],
      },
      {
        title: 'Removing a check-in',
        blocks: [
          { p: 'Use the × on a card to take a ninja off today\'s board, for example if they were checked in by mistake.' },
        ],
      },
    ],
  },
  {
    slug: 'logging-progress',
    group: 'senseis',
    title: 'Logging a session',
    lede: 'Write down what a ninja worked on, where they are on the belt ladder, and how far they got.',
    image: { src: '/docs/log-progress.jpg', alt: 'The Log Today\'s Session form with session notes, belt, level, project and status' },
    sections: [
      {
        title: 'Writing the log',
        blocks: [
          { steps: [
            'On Today\'s Board, select **Log Progress** on the ninja\'s card.',
            'Write **session notes**. They are required: what the ninja worked on, and any wins or struggles.',
            'For CREATE, check the **belt** and **level**, then pick the **project** and its status: Started, Working On or Completed.',
            'Worked on more than one project? Select **+ Add Another Project**. Each project can sit on its own belt and level.',
            'Select **Log Progress**.',
          ] },
          { p: 'Once the ninja has nothing left to log today, you are taken back to Today\'s Board. If they are in another class too, the form moves on to that class instead.' },
        ],
      },
      {
        title: 'Formatting notes',
        blocks: [
          { p: 'Notes support bold, italics, links and lists from the toolbar above the box. Links you type are saved but do not open while you are writing, so a stray click will not take you off the page.' },
        ],
      },
      {
        title: 'Fixing a log',
        blocks: [
          { p: 'Open the ninja\'s profile and find the session under their progress history. Point at the log and open the **...** menu to edit or delete it. You can fix a log you wrote. Center Directors can fix anyone\'s. Deleting asks you to confirm first.' },
        ],
      },
      {
        title: 'Talking about a log',
        blocks: [
          { p: 'Any sensei can reply to a log, react to it, and @mention a colleague. See [Replies and notifications](/docs/replies).' },
        ],
      },
    ],
  },
  {
    slug: 'ninja-profiles',
    group: 'senseis',
    title: 'Ninja profiles',
    lede: 'A ninja\'s belt journey, activity, notes and family contact on one page.',
    image: { src: '/docs/student-profile.jpg', alt: 'A ninja profile with a pinned note, the belt journey and an activity chart' },
    sections: [
      {
        title: 'What is on a profile',
        blocks: [
          { list: [
            '**Pinned note**: anything every sensei should know before working with this ninja. It also shows on their card on Today\'s Board. A long note scrolls inside its card.',
            '**Needs extra support**: the button beside Edit and Log Session. It shows the reason when the ninja is marked.',
            '**Note from parent**: written by the family in the Parent Portal. It appears inside the pinned note card.',
            '**Belt journey**: every belt on the ladder, with how far the ninja is toward the next one.',
            '**Activity**: sessions over the last six months, including club sessions.',
            '**Progress history**: every logged session, newest first, with its [replies](/docs/replies).',
            '**Code.AI sticker**: JR ninjas can have a sticker in place of their initials. Select the avatar to pick one. A **+** on it means none is set yet, and a pencil appears when you point at it to change it.',
          ] },
        ],
      },
      {
        title: 'Pinning a note',
        blocks: [
          { p: 'Select **Add note** on the pinned note card, write the note and save. Keep it short and useful to the next sensei. Pinned notes can use bold, lists and links. A long note, or a long note from the parent, scrolls inside the card rather than stretching the page.' },
        ],
      },
      {
        title: 'Needs extra support',
        blocks: [
          { p: 'Select **Needs extra support** at the top of the profile and pick a reason. The button then reads, for example, **Extra support: Settling in**. Select it again to change the reason or **Remove the mark**. It works the same as the icon on [Today\'s Board](/docs/todays-board), and only staff can see it.' },
        ],
      },
    ],
  },
  {
    slug: 'clubs',
    group: 'senseis',
    title: 'Clubs',
    lede: 'Weekly optional clubs like Minecraft or 3D printing, and the sessions logged for them.',
    image: { src: '/docs/clubs.jpg', alt: 'The Clubs page with a card for each club and the day it meets' },
    sections: [
      {
        title: 'Running a club session',
        blocks: [
          { steps: [
            'On Today\'s Board, select **+ Check In Club** and pick the club.',
            'After the session, open it and log who came and what the group worked on.',
          ] },
          { p: 'Club sessions count as a visit for every ninja who came, so they show up in the ninja\'s activity and in [Reports](/docs/reports).' },
          { p: 'Select a session on the club\'s page to read it, react to it and reply. The reply bar sits under the session\'s thread. See [Replies and notifications](/docs/replies).' },
        ],
      },
      {
        title: 'Creating a club',
        blocks: [
          { p: 'Center Directors create clubs from **+ Create Club** on the Clubs page, with a name, the day it meets, a description and an optional cover photo.' },
        ],
      },
    ],
  },
  {
    slug: 'replies',
    group: 'senseis',
    title: 'Replies and notifications',
    lede: 'Reply to a log or a club session, react, @mention a colleague, and see where you were mentioned.',
    sections: [
      {
        title: 'Replying',
        blocks: [
          { steps: [
            'Point at a log on a ninja\'s profile and select the **reply** arrow. On a club\'s page, select a session to open it.',
            'Type in the reply bar and press **Enter**, or select the send arrow.',
          ] },
          { p: 'The bar stays open after you send, so you can keep going. Once a log has replies, its bar stays under the thread. Press **Escape** to leave the bar.' },
          { p: 'To answer one reply in particular, point at it and select its **reply** arrow. The bar fills in that person\'s @username for you.' },
          { tip: 'The smiley in the reply bar adds an emoji where your cursor is.' },
        ],
      },
      {
        title: 'Mentioning someone',
        blocks: [
          { p: 'Type **@** in a reply or a task comment. A list of the staff at your center appears. Type part of a name or username to narrow it, then pick someone with the arrow keys and **Enter**, or a click. The mention is written as their username, for example **@jmdang**, and shows as a blue name tag.' },
          { p: 'Only people picked from the list are mentioned. Typing an @ by hand does not notify anyone. A reply that mentions you is tinted so it stands out in a long thread.' },
        ],
      },
      {
        title: 'Reacting',
        blocks: [
          { p: 'Point at a log or a reply to show its toolbar, then pick a quick reaction or the smiley for any emoji. Select a reaction under the message to add yours or take it back. Hover a reaction to see who left it.' },
        ],
      },
      {
        title: 'Editing and deleting',
        blocks: [
          { p: 'Point at a reply and open its **...** menu. You can edit your own replies. Replies that were changed say **(edited)**. You can delete your own replies, and Center Directors can delete any reply at their center. Deleting asks you to confirm first.' },
        ],
      },
      {
        title: 'Notifications',
        blocks: [
          { p: 'The bell collects everything that needs you: someone mentioned you in a reply or a task comment, or added you to a task. A red number shows how many you have not opened.' },
          { list: [
            'On a computer, the bell is next to your name at the bottom of the sidebar, or in the top bar if you use that layout.',
            'On a phone, it is at the top of the dashboard.',
          ] },
          { p: 'Select a notification to go straight to it: the task opens, the ninja\'s profile scrolls to the log, or the club session opens. It is marked read when you open it. **Mark all as read** clears the rest. The bell shows the center you have selected, so switch centers to see mentions from another one.' },
        ],
      },
    ],
  },
  {
    slug: 'curriculum',
    group: 'senseis',
    title: 'Curriculum and passcodes',
    lede: 'Every program\'s modules, lessons and projects, plus the lesson passcodes senseis need in class.',
    image: { src: '/docs/curriculum.jpg', alt: 'The curriculum page showing the CREATE belt road and the White belt levels' },
    sections: [
      {
        title: 'Finding a lesson',
        blocks: [
          { steps: [
            'Open **Curriculum** from the sidebar, or from the button on Today\'s Board.',
            'Pick a program from the tabs: CREATE, JR, AI Academy, Robotics Academy or VR Coding.',
            'For CREATE, tap a belt on the belt road, then a level, to see its projects.',
          ] },
        ],
      },
      {
        title: 'Passcodes',
        blocks: [
          { p: 'Switch from **Course** to **Resources** to find the AI Academy and Robotics Academy lesson completion passcodes. They are only visible to signed-in staff.' },
        ],
      },
    ],
  },

  // ── Running a center ───────────────────────────────────────────
  {
    slug: 'dashboard',
    group: 'directors',
    title: 'The dashboard',
    lede: 'Where Center Directors land after signing in: quick links, today\'s schedule, the center calendar and check-ins.',
    image: { src: '/docs/dashboard.jpg', alt: 'The dashboard with quick links, the daily schedule, the calendar and a check-ins chart' },
    sections: [
      {
        title: 'What is on it',
        blocks: [
          { list: [
            '**Quick links** to Tasks, Today\'s Board, Events, Reports, Curriculum and What\'s New.',
            '**Daily schedule**: today\'s classes and who is booked, when MyStudio is connected.',
            '**Calendar**: center events and ninja birthdays. Select **+ New event** or any day to add one.',
            '**Check-ins**: how many ninjas came this week, from the board or a club, with **View all** for longer ranges. It counts the same way as Reports, so the two always agree.',
          ] },
          { tip: 'Hover over **Dashboard** in the sidebar to jump straight to Events, Tasks, Reports, Curriculum or What\'s New.' },
          { p: 'On a phone, the [notification bell](/docs/replies) sits beside the greeting at the top of the dashboard.' },
        ],
      },
    ],
  },
  {
    slug: 'roster',
    group: 'directors',
    title: 'Managing the roster',
    lede: 'Add ninjas one at a time, import a whole roster, and archive ninjas who have left.',
    image: { src: '/docs/roster.jpg', alt: 'The Ninjas roster with program filters, belts and last session dates' },
    sections: [
      {
        title: 'Adding a ninja',
        blocks: [
          { p: 'Select **+ Add Ninja**, fill in their name, birthday, parent contact and programs, and save. The parent email is what the family signs in to the Parent Portal with, so get it right.' },
        ],
      },
      {
        title: 'Importing a CSV',
        blocks: [
          { steps: [
            'Select **Import CSV** and choose your export file.',
            'Review the preview. It lists who will be added, who is already here, and any belt changes found.',
            'Tick the belt changes you want applied. They are off by default.',
            'Select **Apply Changes** to confirm.',
          ] },
          { tip: 'A CSV import treats the file as the full roster. Active ninjas missing from the file are offered for archiving, so always import a complete export, never a partial one.' },
        ],
      },
      {
        title: 'Pulling from MyStudio',
        blocks: [
          { p: '**Pull from MyStudio** adds members MyStudio has and DojoLink does not. It never archives anyone and only changes an existing ninja if you tick the change. See [MyStudio](/docs/mystudio).' },
        ],
      },
      {
        title: 'Archiving',
        blocks: [
          { p: 'Archive a ninja from their profile when they leave. Their history is kept and **Archived** on the roster lets you restore them. **Delete Permanently** removes the ninja and every log, and cannot be undone.' },
        ],
      },
    ],
  },
  {
    slug: 'staff',
    group: 'directors',
    title: 'Managing staff',
    lede: 'Create sensei accounts, reset logins, and archive staff who have moved on.',
    image: { src: '/docs/staff.jpg', alt: 'The Center Staff page listing senseis and directors with their progress log counts' },
    sections: [
      {
        title: 'Adding a sensei',
        blocks: [
          { steps: [
            'Select **+ Add Staff** and enter their name and a username.',
            'DojoLink creates a temporary password and shows it once. Copy both and give them to the sensei.',
            'On their first sign-in they choose their own password.',
          ] },
        ],
      },
      {
        title: 'Resetting a login',
        blocks: [
          { p: 'Select a staff member to open their ID card, then **Reset Login**. They get a new temporary password and choose a new one when they next sign in.' },
        ],
      },
      {
        title: 'Archiving staff',
        blocks: [
          { p: 'Archived staff can no longer sign in, but the sessions they logged stay on every ninja\'s history. Find them again under **Archived**.' },
        ],
      },
    ],
  },
  {
    slug: 'tasks',
    group: 'directors',
    title: 'Tasks',
    lede: 'A shared to-do board for the center, with assignees, due dates, checklists and comments.',
    image: { src: '/docs/tasks.jpg', alt: 'The Tasks board with To do, In progress and Done columns' },
    sections: [
      {
        title: 'Two ways to add a task',
        blocks: [
          { list: [
            '**Quick add** (the + on a column, or Quick add under it) is for a one-line task. Type it and press Enter. Quick tasks go to the whole center, so every staff member can see them.',
            '**Add task** at the top opens the full editor for a due date, named assignees, a checklist and notes.',
          ] },
        ],
      },
      {
        title: 'Moving tasks along',
        blocks: [
          { list: [
            'Use the arrows on a card to move it to the previous or next column.',
            'On a wide screen, drag a card to reorder it or move it between columns.',
            'On a phone, swipe a card right for the next column and left for the previous one.',
            '**Board** and **List** switch between the columns and a table of every task.',
          ] },
        ],
      },
      {
        title: 'Comments and mentions',
        blocks: [
          { p: 'Open a task to comment on it. Type @ and pick someone from the list to mention them. The mention is written as their username, for example **@jmdang**. They see a red count on their Tasks link, on the task, and on their [notification bell](/docs/replies) until they open it.' },
          { p: 'Adding someone to a task by name also notifies them in the bell. Adding yourself does not, and neither do tasks that go to the whole center, such as quick adds.' },
        ],
      },
      {
        title: 'Deleting',
        blocks: [
          { p: 'Deleted tasks go to **Recently deleted** for 14 days, where you can restore them. On a phone, hold a card until it jiggles, then swipe it to delete. On a desktop, drag it past the last column.' },
        ],
      },
    ],
  },
  {
    slug: 'events',
    group: 'directors',
    title: 'Event listings',
    lede: 'Promote camps, parent nights and other events to families on the Parent Portal home page.',
    image: { src: '/docs/event-editor.jpg', alt: 'The New listing form with title, subtitle, sign-up link, date, times, banner image and description' },
    sections: [
      {
        title: 'Creating a listing',
        blocks: [
          { steps: [
            'Open **Events** from the dashboard and select **+ New listing**.',
            'Add a title, a short subtitle and a sign-up link, such as a MyStudio event page or a form.',
            'Add a date and times if the event has them, a wide banner image (about 1600 × 800), and a description.',
            'Select **Publish** to show it to families, or **Save draft** to finish later.',
          ] },
        ],
      },
      {
        title: 'What families see',
        blocks: [
          { img: '/docs/events.jpg', alt: 'The Events page with a listing card, its status dot, and Edit and Delete' },
          { p: 'Published listings rotate as a slideshow at the top of the Parent Portal. **Learn more** opens the full details and the sign-up button.' },
          { p: 'A listing with a date comes down by itself once the day has passed. One without a date stays up until you unpublish it. The dot on each card shows its state: green is live, amber is a draft, grey has ended.' },
          { tip: 'Listings are separate from the staff calendar on purpose. Nothing you write on the calendar is ever shown to families.' },
        ],
      },
    ],
  },
  {
    slug: 'reports',
    group: 'directors',
    title: 'Reports',
    lede: 'Who came, when the room is busiest, who moved up a belt, and who has not been in for 30 days or more.',
    image: { src: '/docs/reports-overview.jpg', alt: 'The Reports overview with ninjas who came, visits, belt-ups and ninjas not seen in 30+ days, and a daily chart' },
    sections: [
      {
        title: 'Filters',
        blocks: [
          { p: 'Pick a **center** (or All centers), a **period** and a **program** at the top. Every tab uses the same filters, and they stay in the page link, so you can bookmark or share a view.' },
          { p: 'The periods are **Last 4 weeks**, **Last 12 weeks**, **Last 6 months**, **This month**, **Last month** and **All time**. Rolling periods end yesterday, so a half-finished today does not drag the numbers down. This month includes today.' },
        ],
      },
      {
        title: 'The five tabs',
        blocks: [
          { list: [
            '**Overview**: ninjas who came, visits, belt-ups and ninjas not seen in 30+ days, each against the period before, plus ninjas each day and a usual weekday. With All centers picked, the centers are shown side by side.',
            '**Attendance**: how many ninjas are in the room at once, by weekday and hour, then an hour-by-hour view of a usual day or one date, including how many of them need extra support. Useful for staffing.',
            '**Classes**: which programs and clubs the visits go to. For each program, how many are enrolled, how many came, and how often. For each club, sessions run, ninjas a session and when it last ran.',
            '**Students**: roster size, how often ninjas come, who has not been seen in 30+ days, every ninja marked as needing extra support, and enrollment by program and belt.',
            '**Progress**: belt-ups, sessions logged each week, and sessions by sensei.',
          ] },
          { img: '/docs/reports-attendance.jpg', alt: 'The Attendance tab heatmap of ninjas in the room at once by weekday and hour' },
        ],
      },
      {
        title: 'Classes',
        blocks: [
          { img: '/docs/reports-classes.jpg', alt: 'The Classes tab with class visits, the busiest program, club visits and a table of programs' },
          { p: 'A visit on this tab is a ninja in one class on one day, so a ninja who did CREATE and Robotics Academy on the same afternoon counts once in each. That is why these totals can run higher than Visits on the Overview.' },
          { p: '**Share who came** is how many of the ninjas enrolled in a program came at least once in the period. A low number is worth a look.' },
          { p: '**Need extra support** is how many of the ninjas who came to that program are marked as needing extra support.' },
        ],
      },
      {
        title: 'Ninjas who need extra support',
        blocks: [
          { p: 'When senseis mark ninjas as needing extra support (on [Today\'s Board](/docs/todays-board) or a [profile](/docs/ninja-profiles)), Reports shows when those ninjas are in the room. This is the way to show how much help the floor needs, not just how many ninjas are on it.' },
          { list: [
            '**Attendance heatmap**: each square shows the usual number of ninjas in the room at once, with the number needing extra support underneath beside a hand-and-heart icon. Hover a square for the usual and the most.',
            '**Hour by hour**: each hour says how many need extra support, and on a usual day, up to how many.',
            '**Classes**: a column for how many support ninjas came to each program.',
            '**Students**: a list of every marked ninja, with the reason, who marked them and when, and when they last came. Use it to review marks and remove any that no longer apply.',
          ] },
          { tip: 'Reports uses each ninja\'s mark as it is today, so a ninja marked this week also counts on their earlier visits. Nothing shows until someone is marked.' },
        ],
      },
      {
        title: 'Sessions by sensei',
        blocks: [
          { img: '/docs/reports-progress.jpg', alt: 'The Progress tab with belt-ups, sessions logged each week and the ranked sessions by sensei table' },
          { p: 'On the Progress tab, senseis are ranked by sessions logged, with clubs run breaking a tie. The top three get a gold, silver and bronze medal. Senseis level on both numbers share a place.' },
        ],
      },
      {
        title: 'How the numbers are counted',
        blocks: [
          { list: [
            'A **visit** is a ninja at a center on a day, from the board or a club.',
            'A **belt-up** is the first log at a new belt, when the ninja already had logs at a lower one.',
            '**Not seen in 30+ days** lists ninjas on the roster with no visit or club in the last 30 days, counted from today, most recently seen first.',
            'A comparison is only shown when there is data for the whole previous period.',
            'Clubs have no time of day, so the hour-by-hour views count check-ins only and say how many ninjas came just for a club.',
          ] },
          { img: '/docs/reports-students.jpg', alt: 'The Students tab with roster counts, the not seen list and how often ninjas come' },
        ],
      },
    ],
  },
  {
    slug: 'kiosk',
    group: 'directors',
    title: 'Check-in kiosk',
    lede: 'Let families check their ninja in on a tablet at the front desk.',
    image: { src: '/docs/kiosk-setup.jpg', alt: 'The Kiosk setup page with start with, names, classes shown and color options' },
    sections: [
      {
        title: 'Setting it up',
        blocks: [
          { steps: [
            'Open **Check-in kiosk** from the dashboard.',
            'Choose whether families **start with** their ninja\'s name or with the class.',
            'Choose whether every name is listed, or only names that match what a family types.',
            'Choose which classes show: all day, or only those starting near now.',
            'Pick a color, then select **Open the kiosk** on the tablet you will leave at the counter.',
          ] },
          { p: 'Each kiosk check-in is sent to MyStudio and appears on Today\'s Board. The kiosk needs your center\'s MyStudio check-in portal to be signed in.' },
        ],
      },
    ],
  },
  {
    slug: 'mystudio',
    group: 'directors',
    title: 'MyStudio',
    lede: 'Connect your center\'s MyStudio account to see who is booked today and import your roster.',
    sections: [
      {
        title: 'Before you start',
        blocks: [
          { p: 'The MyStudio connection is an **experimental** feature. MyStudio can change without notice, and when it does, check-in simply falls back to the manual way. Turn it on under **Account → Experimental**.' },
        ],
      },
      {
        title: 'How it works',
        blocks: [
          { p: 'The MyStudio connection is not a wrapper. MyStudio has no public API, so there was nothing official to build on. It was reverse engineered from how MyStudio\'s own website talks to its servers.' },
          { p: 'That is possible because of how web apps work:' },
          { list: [
            '**The website\'s code runs in your browser.** MyStudio sends its code to everyone who signs in, and that code has to say where it fetches its data from.',
            '**Its servers answer requests, not browsers.** A request with the right address and a valid sign-in gets the same answer whether it comes from Chrome or from DojoLink.',
            '**A sign-in is a set of cookies.** Once you sign in, MyStudio hands out cookies that prove who you are, and DojoLink sends them with its requests the same way your browser does.',
            '**It uses your real account.** DojoLink signs in as you, including the code MyStudio emails you, and sees only what you already see in MyStudio.',
          ] },
          { p: 'On top of that, DojoLink matches each booked member to the right ninja, removes private details like check-in PINs and birthdays as soon as they arrive, and keeps your saved sign-in encrypted. Today\'s Board and the roster import only read from MyStudio. The [kiosk](/docs/kiosk) is the one place that sends check-ins to it.' },
        ],
      },
      {
        title: 'Connecting',
        blocks: [
          { steps: [
            'Go to **Account → Experimental** and open the MyStudio panel.',
            'Sign in with your MyStudio email and password.',
            'Enter the six-digit code MyStudio emails you.',
          ] },
          { p: 'Each center connects its own account. If signing in does not work, **Paste a cookie instead** is a backup: in MyStudio, open developer tools, reload the home page, and copy the first request (named **home**) as cURL.' },
        ],
      },
      {
        title: 'When it runs out',
        blocks: [
          { p: 'MyStudio asks for a new code about once a month. In between, DojoLink signs itself back in with your saved password each day, so there is nothing to do.' },
          { p: 'When a code is needed, Today\'s Board says so and links straight to the panel. Sign in again and enter the new code. If you choose **Forget saved password**, DojoLink can no longer sign itself in, and you will be asked for a code every day.' },
        ],
      },
      {
        title: 'Why the code is only needed once a month',
        blocks: [
          { p: 'A MyStudio sign-in lasts exactly 24 hours, and nothing can make it last longer. Signing in involves two separate things, and only one of them runs out after a day:' },
          { list: [
            '**The sign-in itself.** After you enter the code, MyStudio hands out a sign-in that is good for 24 hours. This is what used to run out every day.',
            '**A remembered device.** Because DojoLink ticks **Remember for 30 days** on the code step, MyStudio also hands out two cookies that last 30 days. They tell MyStudio that this device entered a code recently.',
          ] },
          { p: 'Your own browser works the same way. When you sign in to MyStudio again, it sends those cookies along, and MyStudio skips the code.' },
          { p: 'DojoLink now does what your browser does. It keeps the two cookies, and whenever the day\'s sign-in has run out or is about to, it signs in again with your saved password and those cookies. MyStudio recognises the device and lets it in without emailing a code. Today\'s Board, the roster import and the [kiosk](/docs/kiosk) all stay connected this way.' },
          { p: 'A few things follow from this:' },
          { list: [
            '**The 30 days count from the last code you typed.** Signing in without a code does not restart them, so a code is needed about once a month.',
            '**The date on the board is when the next code is due.** It is when the 30 days end, not when today\'s sign-in does.',
            '**If MyStudio asks for a code anyway, DojoLink stops trying.** That happens when the 30 days are up or your MyStudio password has changed. DojoLink waits for you to sign in again rather than sending you a stream of code emails.',
          ] },
        ],
      },
    ],
  },
  {
    slug: 'admin-settings',
    group: 'directors',
    title: 'Admin settings',
    lede: 'Center details, center codes, staff accounts across the center, and the shared curriculum.',
    sections: [
      {
        title: 'Getting there',
        blocks: [
          { p: 'Open **Account**, then **Admin settings**. Directors see only the centers they belong to.' },
        ],
      },
      {
        title: 'Your center code',
        blocks: [
          { p: 'Every center has a short code that families type when they sign in. Set it under Locations, then put it on your welcome email and front desk flyer. See [Center codes](/docs/center-codes).' },
        ],
      },
      {
        title: 'Shared settings',
        blocks: [
          { tip: 'Curriculum and app settings are shared by every center. A change you make there shows up at the other centers too.' },
        ],
      },
    ],
  },

  // ── For families ───────────────────────────────────────────────
  {
    slug: 'parent-portal',
    group: 'families',
    title: 'The Parent Portal',
    lede: 'Follow your ninja\'s belts, levels, badges and recent sessions, and hear about events at your center.',
    image: { src: '/docs/parent-home.jpg', alt: 'The Parent Portal home with an event banner, how busy the center is, and a card for each ninja' },
    sections: [
      {
        title: 'Home',
        blocks: [
          { list: [
            '**Events** from your center rotate across the top. Select **Learn more** for the details and the sign-up link.',
            '**Live at your center** shows how busy the dojo is right now, hour by hour, and when it closes today.',
            '**A card for each ninja** in your family, with their most recent sessions. Select **Full profile** to open it.',
          ] },
        ],
      },
      {
        title: 'Your ninja\'s profile',
        blocks: [
          { img: '/docs/parent-profile.jpg', alt: 'A ninja profile banner with sessions, programs and belt, an activity chart, and the CREATE course' },
          { list: [
            'The banner shows how many sessions they have logged, how many programs they are in, and their belt.',
            '**Activity** charts their sessions over the last six months.',
            '**Courses** has a card for each program they are in. Select one to open it.',
          ] },
        ],
      },
      {
        title: 'Courses and the belt road',
        blocks: [
          { img: '/docs/parent-course.jpg', alt: 'The CREATE course page with the belt road, the current level and its stickers' },
          { p: 'In CREATE, the **belt road** across the top shows every belt, with the one your ninja is on lit up. Tap any belt to see what it covers. Below it you will find the level they are on now, the projects in it, and every level of the belt.' },
          { p: 'Other programs, like JR and Robotics Academy, list their tracks and modules, with the ones your ninja has finished marked done.' },
        ],
      },
      {
        title: 'The sticker book',
        blocks: [
          { img: '/docs/parent-stickers.jpg', alt: 'The sticker book with personal records and the full collection' },
          { p: 'Your ninja earns a sticker for every CREATE level and every module in their other programs. The sticker book shows their records, their most recent sticker, and the whole collection. Locked stickers show what it takes to earn them.' },
        ],
      },
      {
        title: 'Leaving a note for the senseis',
        blocks: [
          { steps: [
            'Open your ninja\'s profile.',
            'Select the **pin** at the top right of the banner.',
            'Write anything the senseis should know, like allergies, pickup notes or how your ninja learns best, then select **Save note**.',
          ] },
          { img: '/docs/parent-note.jpg', alt: 'The Note for Senseis dialog with a text box and a Save note button' },
          { p: 'Senseis see your note when they check your ninja in and when they log their session.' },
        ],
      },
      {
        title: 'Events',
        blocks: [
          { img: '/docs/parent-events.jpg', alt: 'The Events page listing upcoming events by month' },
          { p: '**Events** in the sidebar lists everything coming up at your center, by month. Select **Details** for the date, time, description and sign-up link.' },
        ],
      },
      {
        title: 'Settings',
        blocks: [
          { img: '/docs/parent-settings.jpg', alt: 'Parent settings on Your ninjas, with three ninja characters to pick from for each child' },
          { p: 'Select your name at the bottom of the sidebar to open **Settings**. **Your ninjas** lets each of your kids pick the ninja character that shows on their profile. See [Family settings](/docs/family-settings) for everything else there.' },
        ],
      },
    ],
  },
  {
    slug: 'center-codes',
    group: 'families',
    title: 'Center codes',
    lede: 'The short code that tells DojoLink which center your family belongs to.',
    sections: [
      {
        title: 'What it is',
        blocks: [
          { p: 'Each Code Ninjas center has its own code, like ABC123. You type it with your email when you sign in to the Parent Portal. It makes sure you only ever see your own center.' },
        ],
      },
      {
        title: 'Where to find it',
        blocks: [
          { list: [
            'Ask at the front desk.',
            'Check the welcome email or flyer from your center.',
          ] },
        ],
      },
    ],
  },

  {
    slug: 'family-settings',
    group: 'families',
    title: 'Family settings',
    lede: 'Change your name and email, pick each ninja\'s character, sign out, or delete your account.',
    image: { src: '/docs/parent-settings.jpg', alt: 'Parent settings with Edit profile, Your ninjas and Delete account', narrow: false },
    sections: [
      {
        title: 'Opening settings',
        blocks: [
          { p: 'Select your name at the bottom of the sidebar. On a phone, tap **Account** in the bar at the bottom of the screen.' },
        ],
      },
      {
        title: 'Edit profile',
        blocks: [
          { list: [
            '**First and last name**, shown to the senseis beside your ninja.',
            '**Email**. You sign in with this and your center code, so if you change it, use the new email next time.',
            '**Relationship**, such as Mom, Dad or Guardian, for the front desk.',
            '**Center code** is shown for reference. Only your center can change it.',
          ] },
          { p: 'Select **Save Changes** when you are done.' },
        ],
      },
      {
        title: 'Your ninjas',
        blocks: [
          { p: 'Each of your kids can pick one of three ninja characters. The one you pick shows on their profile and on their card on the home page, dressed in their current belt.' },
        ],
      },
      {
        title: 'Signing out',
        blocks: [
          { p: 'Use **Sign Out** in Settings, or the sign-out icon beside your name in the sidebar. If you ticked **Keep me signed in on this device**, sign out before handing the device to someone else.' },
        ],
      },
      {
        title: 'Deleting your account',
        blocks: [
          { p: 'Choose **Delete account** in Settings. See [Deleting your account](/docs/delete-account) for exactly what is removed and what stays.' },
        ],
      },
    ],
  },

  // ── Your account ───────────────────────────────────────────────
  {
    slug: 'account',
    group: 'account',
    title: 'Profile and password',
    lede: 'Change your name, username, avatar and password.',
    image: { src: '/docs/account.jpg', alt: 'The Edit profile page with the staff ID card', narrow: false },
    sections: [
      {
        title: 'Editing your profile',
        blocks: [
          { list: [
            'Tap your **name** on the ID card to retype it. Press Enter to save.',
            'Tap the **photo** to step through the avatars.',
            'Tap anywhere else on the card to turn it over. Your **username** is on the back, and you can tap it to change it.',
          ] },
        ],
      },
      {
        title: 'Changing your password',
        blocks: [
          { p: 'Open **Account → Password**, enter your current password and the new one twice.' },
        ],
      },
      {
        title: 'The account menu',
        blocks: [
          { p: 'Select your avatar at the bottom of the sidebar, or at the right of the top bar, to open a small menu with **Account**, **Help Center** and **Send feedback**.' },
        ],
      },
      {
        title: 'Signing out',
        blocks: [
          { p: 'Use the sign-out icon beside your name at the bottom of the sidebar. With the top bar, choose **Log out** from the account menu. On a phone, open **Account** and select **Sign Out**. Always sign out on a shared computer or tablet.' },
        ],
      },
    ],
  },
  {
    slug: 'delete-account',
    group: 'account',
    title: 'Deleting your account',
    lede: 'How staff and families delete their own DojoLink account, and what happens to their data.',
    sections: [
      {
        title: 'Staff accounts',
        blocks: [
          { steps: [
            'Open **Account** and choose **Delete account**.',
            'Pick the reason you are leaving. You can add a note if you like.',
            'Type your **username** and **password**.',
            'Select **Delete my account**, then **Yes, delete my account** to confirm.',
          ] },
          { p: 'Your account is removed and you are signed out straight away. The sessions you logged stay on each ninja\'s history, with no name on them, so their progress is not lost.' },
          { tip: 'Just leaving one center, or taking a break? Ask your Center Director to archive your account instead. Archiving can be undone; deleting cannot.' },
        ],
      },
      {
        title: 'Family accounts',
        blocks: [
          { img: '/docs/parent-delete.jpg', alt: 'Parent settings on Delete account, asking for a reason, the center code and the email' },
          { steps: [
            'In the Parent Portal, select your name at the bottom of the sidebar to open **Settings**.',
            'Choose **Delete account** and pick a reason.',
            'Type your **center code** and **email**.',
            'Select **Delete my account**, then confirm.',
          ] },
          { p: 'This deletes your parent account and removes your name, email, phone number and any note for the senseis from your ninjas\' records. Your ninjas\' belts and progress stay with the center, because they belong to their classes.' },
          { tip: 'To stop your ninjas\' records being kept at all, ask your Center Director. Only the center can remove a ninja from its roster.' },
        ],
      },
      {
        title: 'Things to know',
        blocks: [
          { list: [
            'Deleting cannot be undone. To use DojoLink again, a staff member needs a new account from their Center Director. A family can sign in again only once the center adds their email back to a ninja.',
            'The reason you choose is kept without your name, so we can learn why people leave.',
            'Administrator accounts cannot be deleted from the Account page.',
          ] },
        ],
      },
    ],
  },
  {
    slug: 'appearance',
    group: 'account',
    title: 'Appearance and display',
    lede: 'Dark mode, accent colors and the navigation layout.',
    sections: [
      {
        title: 'Light and dark',
        blocks: [
          { p: 'Use the sun icon at the bottom of the sidebar to switch between light and dark. On a phone, open **Account** and use the **Dark mode** switch.' },
        ],
      },
      {
        title: 'Navigation layout',
        blocks: [
          { p: 'Under **Account → Display**, choose **Tokyo** for a sidebar down the left or **Hokkaido** for a bar across the top.' },
        ],
      },
      {
        title: 'Accent color',
        blocks: [
          { p: 'Turn on **Account → Experimental**, then open **Theme & color** to pick an accent color for buttons and highlights. It only changes DojoLink on this device.' },
        ],
      },
      {
        title: 'Reduced motion',
        blocks: [
          { p: 'If your device is set to reduce motion, DojoLink turns off its animations to match.' },
        ],
      },
    ],
  },

  {
    slug: 'install',
    group: 'account',
    title: 'Adding DojoLink to your home screen',
    lede: 'Open DojoLink like an app, full screen, from your phone, tablet or computer.',
    sections: [
      {
        title: 'iPhone and iPad',
        blocks: [
          { steps: [
            'Open DojoLink in **Safari**.',
            'Tap the **Share** button.',
            'Tap **Add to Home Screen**, then **Add**.',
          ] },
        ],
      },
      {
        title: 'Android',
        blocks: [
          { steps: [
            'Open DojoLink in **Chrome**.',
            'Tap the **⋮** menu.',
            'Tap **Add to Home screen** or **Install app**.',
          ] },
        ],
      },
      {
        title: 'Computer',
        blocks: [
          { p: 'In Chrome or Edge, select the install icon at the right of the address bar, or open the browser menu and choose **Install DojoLink**.' },
        ],
      },
      {
        title: 'Getting updates',
        blocks: [
          { p: 'DojoLink updates itself. If something new is not showing yet, close the app fully and open it again.' },
        ],
      },
    ],
  },
  {
    slug: 'whats-new',
    group: 'account',
    title: 'What\'s New',
    lede: 'Release notes for every DojoLink update.',
    sections: [
      {
        title: 'Seeing what changed',
        blocks: [
          { p: 'When DojoLink is updated, the release notes pop up the next time you sign in. You only see each one once.' },
          { p: 'To read them again, or catch up on older updates, open **What\'s New** from the dashboard\'s quick links or by hovering over **Dashboard** in the sidebar.' },
        ],
      },
    ],
  },

  // ── Help ───────────────────────────────────────────────────────
  {
    slug: 'faq',
    group: 'help',
    title: 'Frequently asked questions',
    lede: 'Quick answers to the questions we hear most.',
    sections: [
      {
        title: 'Staff',
        blocks: [
          { qa: [
            { q: 'I checked in the wrong ninja.', a: 'Use the × on their card on Today\'s Board to remove the check-in.' },
            { q: 'A ninja did two classes today.', a: 'Check them in once per class. Each class gets its own card and its own log.' },
            { q: 'The board still shows a ninja from yesterday.', a: 'That check-in was never logged, so it counts as overdue. Log it, or remove it if they did not come.' },
            { q: 'Can I log a project from a different belt?', a: 'Yes. Add another project to the log and choose its own belt and level.' },
            { q: 'I checked a ninja in under the wrong class.', a: 'Hover over the program icon on their card, select the pencil and pick the right class. See [Today\'s Board](/docs/todays-board).' },
            { q: 'How do I delete my account?', a: 'Open **Account → Delete account**. See [Deleting your account](/docs/delete-account).' },
          ] },
        ],
      },
      {
        title: 'Families',
        blocks: [
          { qa: [
            { q: 'Do I need a password?', a: 'No. You sign in with your center code and the email your center has on file.' },
            { q: 'It says my code and email do not match.', a: 'Check the code for typos, then try any other email you might have given the center. If it still does not work, ask your Center Director which email is on file.' },
            { q: 'Why has my ninja\'s belt not changed?', a: 'The portal updates when a sensei logs a session. If something looks wrong, ask at the front desk.' },
            { q: 'I changed my email. How do I sign in now?', a: 'Use your center code and the new email.' },
            { q: 'How do I delete my account?', a: 'Open **Settings → Delete account**. Your ninjas\' progress stays with the center. See [Deleting your account](/docs/delete-account).' },
          ] },
        ],
      },
    ],
  },
  {
    slug: 'troubleshooting',
    group: 'help',
    title: 'Troubleshooting',
    lede: 'What to try when something is not working.',
    sections: [
      {
        title: 'Common fixes',
        blocks: [
          { qa: [
            { q: 'I was signed out suddenly.', a: 'Sessions end after a while for safety. Sign in again and you will be back where you were.' },
            { q: 'A new feature is not showing.', a: 'Refresh the page. If DojoLink is installed on your home screen, close it fully and open it again.' },
            { q: 'I cannot switch to another center.', a: 'Sign out and back in once so DojoLink picks up the centers you were added to.' },
            { q: 'Booked ninjas are not showing on Today\'s Board.', a: 'Your MyStudio sign-in has probably run out. Follow the link on the board to sign in again.' },
            { q: 'A photo or cover image will not upload.', a: 'Try a smaller JPG or PNG. If it keeps failing, report it with the steps below.' },
          ] },
        ],
      },
    ],
  },
  {
    slug: 'privacy-data',
    group: 'help',
    title: 'Privacy and your data',
    lede: 'What DojoLink keeps, who can see it, and how to have it removed.',
    sections: [
      {
        title: 'What is kept',
        blocks: [
          { list: [
            '**Ninjas**: name, birthday, programs, belts, check-ins and the sessions logged for them.',
            '**Families**: parent name, email, phone number, relationship and any note for the senseis.',
            '**Staff**: name, username, avatar, the centers they work at, and the sessions they logged.',
          ] },
        ],
      },
      {
        title: 'Who can see it',
        blocks: [
          { list: [
            'Staff see the ninjas at the centers they work at. Each center is kept separate.',
            'Families see only their own ninjas, and only at the center their code belongs to.',
            'Families never see staff notes on the center calendar, and a parent\'s note is only shown to staff.',
          ] },
        ],
      },
      {
        title: 'Removing your data',
        blocks: [
          { p: 'Staff and families can delete their own accounts. See [Deleting your account](/docs/delete-account). To have a ninja removed from a center\'s records, ask that center\'s director.' },
        ],
      },
      {
        title: 'The fine print',
        blocks: [
          { p: 'The full [Privacy Policy](/privacy), [Terms of Use](/terms) and [Accessibility statement](/accessibility) are linked at the bottom of the home page.' },
        ],
      },
    ],
  },
  {
    slug: 'glossary',
    group: 'help',
    title: 'Glossary',
    lede: 'The words you will see around DojoLink and the dojo.',
    sections: [
      {
        title: 'People',
        blocks: [
          { table: {
            head: ['Term', 'Meaning'],
            rows: [
              ['Ninja', 'A student.'],
              ['Sensei', 'An instructor who works with ninjas in class.'],
              ['Center Director (CD)', 'The person who runs a center.'],
            ],
          } },
        ],
      },
      {
        title: 'Programs',
        blocks: [
          { table: {
            head: ['Program', 'What it is'],
            rows: [
              ['CREATE', 'The core game-building program, organized as a ladder of belts and levels.'],
              ['JR', 'The program for younger ninjas.'],
              ['Robotics Academy', 'Robotics kits, organized as kits and modules.'],
              ['AI Academy', 'Artificial intelligence lessons.'],
              ['VR Coding', 'Coding in virtual reality.'],
            ],
          } },
        ],
      },
      {
        title: 'Belts',
        blocks: [
          { p: 'CREATE belts go White, Yellow, Orange, Green, Blue, Purple, Brown, Red and Black, then Bronze, Silver, Platinum and Gold. Each belt has its own levels, and each level has its own projects.' },
        ],
      },
      {
        title: 'In the app',
        blocks: [
          { table: {
            head: ['Term', 'Meaning'],
            rows: [
              ['Check-in', 'Adding a ninja to Today\'s Board for a class.'],
              ['Log', 'The record of what a ninja did in a session.'],
              ['Visit', 'A ninja at a center on a given day.'],
              ['Belt-up', 'Moving up to the next belt.'],
              ['Overdue', 'A check-in from an earlier day that was never logged.'],
              ['Archive', 'Taking a ninja or sensei off the active list without losing their history. It can be undone.'],
              ['Center code', 'The short code families use to sign in.'],
            ],
          } },
        ],
      },
    ],
  },
  {
    slug: 'contact',
    group: 'help',
    title: 'Send feedback',
    lede: 'Tell us about a bug or suggest something new.',
    sections: [
      {
        title: 'Staff',
        blocks: [
          { p: 'Open the menu under your name and select **Send feedback**. Choose **Report a bug** or **Suggest a feature**, describe it, and send. Say what you were doing and what you expected to happen.' },
        ],
      },
      {
        title: 'Families',
        blocks: [
          { p: 'Use the rocket icon in the Parent Portal, or ask your Center Director. For anything about your ninja\'s classes, the front desk is the fastest way.' },
        ],
      },
    ],
  },
];

export const docBySlug = (slug) => DOCS.find((d) => d.slug === slug);

// A slug for a section heading, used for the "On this page" anchors.
export const sectionId = (title) =>
  title.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Plain text of an article for search: title, lede, headings and body.
export function docText(doc) {
  const parts = [doc.title, doc.lede];
  for (const s of doc.sections) {
    parts.push(s.title);
    for (const b of s.blocks) {
      if (b.p) parts.push(b.p);
      if (b.tip) parts.push(b.tip);
      if (b.list) parts.push(...b.list);
      if (b.steps) parts.push(...b.steps);
      if (b.qa) b.qa.forEach(({ q, a }) => parts.push(q, a));
      if (b.table) b.table.rows.forEach((r) => parts.push(...r));
    }
  }
  return parts.join(' ').replace(/\*\*|\[|\]\([^)]*\)/g, '').toLowerCase();
}
