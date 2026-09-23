// What we tell someone who is stuck signing in. One copy, read by the guided
// start (/start) and by the help dialog on the login page, so the two can
// never give a family or a sensei different answers.
//
// Neither path can be self-served: staff accounts are made by a director, and
// a parent's account is the email the center has on file. So every answer
// ends at a person, and says which one.

export const STAFF_HELP = [
  {
    q: "I don't know my username or password",
    a: 'Contact your Center Director or administrator. They can look up your username and reset your password for you.',
  },
  {
    q: "It's my first time signing in",
    a: 'Use the username and temporary password your Center Director gave you. You will choose your own password right after.',
  },
];

export const PARENT_HELP = [
  {
    q: 'Where do I find my center code?',
    a: 'Your Center Director gives each center a short code. Ask at the front desk or check the welcome email or flyer from your center.',
  },
  {
    q: 'Which email do I use?',
    a: 'The one you gave the center when you signed your ninja up. It has to match the email they have on file.',
  },
  {
    q: 'It says my code and email do not match',
    a: 'Check the code for typos, then try any other email you might have used. If it still will not work, ask your center to confirm the email on file.',
  },
];
