import { describe, it, expect } from 'vitest';
import ms from '../lib/mystudio.js';

// Pure unit tests: no database and no network. Everything here is the part of
// the MyStudio integration that can be wrong quietly. The two that matter most
// are the PII strip and the program mapping, because a mistake in either is
// invisible in the UI and lands in the database or a log.

describe('cookie handling', () => {
  const full =
    'PHPSESSID=abc123; ms_u_em=director%40example.invalid; companyId=480; ' +
    'keepCache=true; kc_access=tok-a; kc_refresh=tok-r';

  it('reads the identity values out of a pasted cookie', () => {
    expect(ms.readCookieIdentity(full)).toEqual({
      companyId: '480',
      sessionId: 'abc123',
      email: 'director@example.invalid',
    });
  });

  it('requires companyId', () => {
    expect(() => ms.readCookieIdentity('kc_access=a; kc_refresh=b')).toThrow(
      ms.MyStudioAuthError
    );
    expect(() => ms.readCookieIdentity('')).toThrow(ms.MyStudioAuthError);
  });

  // The mistake this feature invites. kc_access and kc_refresh are httpOnly, so
  // a cookie copied from the console omits them silently and upstream answers
  // no_refresh_token. The error has to name the fix.
  it('explains a paste that is missing the httpOnly tokens', () => {
    expect(() => ms.readCookieIdentity('PHPSESSID=a; ms_u_em=b; companyId=480')).toThrow(
      /kc_access and kc_refresh/
    );
  });

  // The legacy PHP session expires on its own schedule while the Keycloak
  // tokens stay valid, so demanding it would reject working cookies.
  it('accepts a cookie with the tokens but no legacy session', () => {
    expect(ms.readCookieIdentity('companyId=480; kc_access=a; kc_refresh=b')).toEqual({
      companyId: '480',
      sessionId: null,
      email: null,
    });
  });

  it('strips CR and LF so a pasted value cannot inject a header', () => {
    const out = ms.sanitizeCookie('PHPSESSID=a\r\nX-User-Info: {"companyId":"999"}');
    expect(out).not.toMatch(/[\r\n]/);
  });

  it('keeps a value containing an equals sign intact', () => {
    expect(ms.parseCookie('a=b=c; d=e').a).toBe('b=c');
  });
});

// The connect screen asks for "Copy as cURL" because the credential is httpOnly
// and the header-row instruction it replaced was one a director could not follow.
// That only works if the paste is accepted in whatever shape it arrives.
describe('accepting what people actually paste', () => {
  const COOKIE = 'companyId=480; kc_access=tok-a; kc_refresh=tok-r';

  it('takes a Chrome Copy as cURL, where the cookie is a -H header', () => {
    const pasted =
      `curl 'https://codeninjas.mystudio.io/api/features/attendance/class-list?selected_date=2026-08-13' \\\n` +
      `  -H 'accept: application/json' \\\n` +
      `  -H 'cookie: ${COOKIE}' \\\n` +
      `  -H 'user-agent: Mozilla/5.0'`;
    expect(ms.extractCookie(pasted)).toBe(COOKIE);
    expect(ms.readCookieIdentity(pasted).companyId).toBe('480');
  });

  it('takes a cURL that uses -b or --cookie instead', () => {
    expect(ms.extractCookie(`curl 'https://x.test' -b '${COOKIE}'`)).toBe(COOKIE);
    expect(ms.extractCookie(`curl 'https://x.test' --cookie "${COOKIE}"`)).toBe(COOKIE);
  });

  it('takes a bare header line, whatever its capitalisation', () => {
    expect(ms.extractCookie(`Cookie: ${COOKIE}`)).toBe(COOKIE);
    expect(ms.extractCookie(`cookie: ${COOKIE}`)).toBe(COOKIE);
  });

  it('still takes the plain cookie string', () => {
    expect(ms.extractCookie(COOKIE)).toBe(COOKIE);
  });

  it('does not mistake another header for the cookie', () => {
    // A cURL with no cookie at all must not hand back the user-agent.
    const noCookie = `curl 'https://x.test' -H 'user-agent: Mozilla/5.0'`;
    expect(ms.extractCookie(noCookie)).not.toMatch(/Mozilla/);
  });

  it('never lets a pasted newline into the outbound header', () => {
    // Multi-line cURL is the normal case, so this is the shape most likely to
    // carry a newline into a header value if extraction were sloppy.
    const pasted = `curl 'https://x.test' \\\n  -H 'cookie: ${COOKIE}' \\\n`;
    expect(ms.extractCookie(pasted)).not.toMatch(/[\r\n]/);
  });

  it('returns empty for an empty paste rather than guessing', () => {
    expect(ms.extractCookie('')).toBe('');
    expect(ms.extractCookie(null)).toBe('');
  });
});

// A MyStudio page also loads the support chat, Stripe and analytics, so "copy
// any request" is not good enough advice: the first real attempt copied the
// embedded HubSpot chat widget and got HubSpot's cookies. The paste parses
// perfectly and is simply the wrong site, which is the one failure the error
// text has to explain rather than blame on MyStudio.
describe('a request copied from the wrong site', () => {
  // Same shape as the real mis-paste, with invented token values.
  const hubspotCurl =
    `curl --url 'https://app.hubspot.com/api/livechat-public/v1/feedback/survey/CSAT/4?hs_static_app=conversations-visitor-ui' \\\n` +
    `  -H 'accept: application/json' \\\n` +
    `  -b 'hubspotapi-prefs=1; hubspotapi=FAKE-TOKEN; csrf.app=FAKE-CSRF' \\\n` +
    `  -H 'referer: https://app.hubspot.com/conversations-visitor/22638569/threads/utk/abc'`;

  it('reads the host out of the pasted command', () => {
    expect(ms.extractRequestHost(hubspotCurl)).toBe('app.hubspot.com');
    expect(ms.isMyStudioHost('app.hubspot.com')).toBe(false);
    expect(ms.isMyStudioHost('codeninjas.mystudio.io')).toBe(true);
  });

  it('names the wrong site and points at the row that works', () => {
    let message = '';
    try {
      ms.readCookieIdentity(hubspotCurl);
    } catch (e) {
      message = e.message;
    }
    expect(message).toContain('app.hubspot.com');
    // Names one row rather than describing a filter, because two rounds of
    // filter advice both failed for different reasons.
    expect(message).toMatch(/home/i);
    // Must not read as a MyStudio fault, which is what "missing companyId" did.
    expect(message).not.toMatch(/missing companyId/i);
  });

  it('is not fooled by a mystudio.io referer on another host', () => {
    // The chat widget's referer mentions codeninjas.mystudio.io, so matching the
    // first mystudio string anywhere in the paste would call this the right site.
    const withMyStudioReferer =
      `curl --url 'https://app.hubspot.com/api/x' \\\n` +
      `  -H 'referer: https://app.hubspot.com/c?domain=codeninjas.mystudio.io&url=https%3A%2F%2Fcodeninjas.mystudio.io%2Fhome' \\\n` +
      `  -b 'hubspotapi=FAKE'`;
    expect(ms.extractRequestHost(withMyStudioReferer)).toBe('app.hubspot.com');
    expect(() => ms.readCookieIdentity(withMyStudioReferer)).toThrow(/app\.hubspot\.com/);
  });

  it('accepts the real thing on a mystudio.io host', () => {
    const good =
      `curl 'https://codeninjas.mystudio.io/api/features/attendance/class-list?selected_date=2026-08-13' \\\n` +
      `  -H 'cookie: companyId=480; kc_refresh=tok-r'`;
    expect(ms.readCookieIdentity(good).companyId).toBe('480');
  });

  // cn.mystudio.io serves uploaded images. It is a real mystudio.io host, so a
  // domain check waves it through, and it never receives the sign-in cookies, so
  // what gets waved through is useless. The studio logo sits in the network list
  // looking exactly as copyable as anything else.
  it('tells apart the image host from the signed-in one', () => {
    expect(ms.isMyStudioHost('codeninjas.mystudio.io')).toBe(true);
    expect(ms.isMyStudioHost('cn.mystudio.io')).toBe(false);
    expect(ms.isMyStudioAssetHost('cn.mystudio.io')).toBe(true);
    expect(ms.isMyStudioAssetHost('codeninjas.mystudio.io')).toBe(false);
    expect(ms.isMyStudioAssetHost('app.hubspot.com')).toBe(false);
  });

  it('explains the image host instead of calling it a missing companyId', () => {
    const logoCurl = `curl 'https://cn.mystudio.io/uploads/Default/your_logo.png' -H 'accept: image/png'`;
    let message = '';
    try {
      ms.readCookieIdentity(logoCurl);
    } catch (e) {
      message = e.message;
    }
    expect(message).toContain('cn.mystudio.io');
    expect(message).toMatch(/home/i);
    expect(message).not.toMatch(/missing companyId/i);
  });
});

describe('credential encryption', () => {
  const raw = 'PHPSESSID=abc123; ms_u_em=a%40b.com; companyId=480';

  it('round-trips', () => {
    expect(ms.decryptCookie(ms.encryptCookie(raw))).toBe(raw);
  });

  it('does not store the plaintext', () => {
    expect(ms.encryptCookie(raw)).not.toContain('PHPSESSID');
  });

  it('produces a different blob each time', () => {
    // Random IV per encrypt, so two connects with the same cookie do not
    // produce the same column value.
    expect(ms.encryptCookie(raw)).not.toBe(ms.encryptCookie(raw));
  });

  it('refuses a tampered blob rather than returning garbage', () => {
    const blob = ms.encryptCookie(raw);
    expect(() => ms.decryptCookie(`${blob.slice(0, -4)}AAAA`)).toThrow(ms.MyStudioError);
    expect(() => ms.decryptCookie('nonsense')).toThrow(ms.MyStudioError);
    expect(() => ms.decryptCookie('')).toThrow(ms.MyStudioError);
  });
});

// MyStudio refreshes the Keycloak tokens for us and returns them in Set-Cookie.
// Throwing those away is why a connection used to die within hours of being
// pasted, so this is the part that keeps one alive.
describe('rotating the session cookie', () => {
  const stored =
    'PHPSESSID=abc123; ms_u_em=director%40example.invalid; companyId=480; ' +
    'kc_access=tok-a; kc_refresh=tok-r';

  it('replaces a refreshed value and leaves the rest alone', () => {
    const jar = ms.parseJar(stored);
    expect(ms.mergeSetCookie(jar, ['kc_access=tok-a2; Path=/; HttpOnly'])).toBe(true);
    expect(jar.kc_access).toBe('tok-a2');
    expect(jar.kc_refresh).toBe('tok-r');
    expect(jar.companyId).toBe('480');
  });

  it('reports no change when the response repeats what we already hold', () => {
    // The difference between a pull that writes to the database and one that
    // does not.
    const jar = ms.parseJar(stored);
    expect(ms.mergeSetCookie(jar, ['kc_access=tok-a; Path=/'])).toBe(false);
  });

  it('keeps values the response never mentions', () => {
    const jar = ms.parseJar(stored);
    ms.mergeSetCookie(jar, ['kc_access=tok-a2']);
    // companyId is ours, chosen when the center was picked. Nothing upstream
    // resends it, and losing it makes every later request unaddressable.
    expect(ms.serializeJar(jar)).toContain('companyId=480');
  });

  it('ignores a deletion instead of emptying the credential', () => {
    // A cleared cookie means the session is ending. The next request fails with
    // an auth error and the connection flips to expired, which is legible.
    // Erasing the stored value here would instead look like a corrupt paste.
    const jar = ms.parseJar(stored);
    expect(ms.mergeSetCookie(jar, ['kc_refresh=; Max-Age=0; Path=/'])).toBe(false);
    expect(jar.kc_refresh).toBe('tok-r');
  });

  it('skips malformed lines', () => {
    const jar = ms.parseJar(stored);
    expect(ms.mergeSetCookie(jar, ['', 'nonsense', '=novalue', null])).toBe(false);
    expect(ms.serializeJar(jar)).toBe(stored);
  });

  it('round-trips an untouched jar byte for byte', () => {
    // parseCookie decodes percent-encoding because it reads identity; this path
    // must not, or ms_u_em goes back out re-encoded.
    expect(ms.serializeJar(ms.parseJar(stored))).toBe(stored);
  });

  it('starts a session from any shape a person pasted', () => {
    const session = ms.createSession(`curl 'https://codeninjas.mystudio.io/home' -H 'cookie: ${stored}'`);
    expect(session.cookie).toBe(stored);
    expect(session.rotated).toBe(false);
  });
});

// Reading a successful sign-in as a failure is not a cosmetic mistake. The
// failure path asks the resend endpoint what went wrong, and asking issues a new
// code, so a misread success cancels the code already sitting in the inbox.
describe('judging a sign-in response', () => {
  it('accepts a success that carries only a message', () => {
    // The shape that caused the bug: no status field at all.
    expect(
      ms.actionRejected({ message: 'One time passcode has been send to a@b.invalid' })
    ).toBe(false);
  });

  it('accepts an explicit success status', () => {
    expect(ms.actionRejected({ status: 'Success' })).toBe(false);
    expect(ms.actionRejected({ status: 'ok', message: 'anything' })).toBe(false);
  });

  it('rejects an explicit failure status', () => {
    expect(ms.actionRejected({ status: 'error', message: 'Something went wrong.' })).toBe(true);
    expect(ms.actionRejected({ status: 'Login Failed' })).toBe(true);
  });

  it('does not read failure out of the message text', () => {
    // This is the trap. "One time passcode has been send to a@b.invalid" is a
    // success whose message contains the word invalid, inside the address the
    // code was just sent to. Only an explicit status counts.
    expect(ms.actionRejected({ message: 'sent to someone@example.invalid' })).toBe(false);
  });

  it('rejects nothing at all', () => {
    expect(ms.actionRejected(null)).toBe(true);
    expect(ms.actionRejected('not an object')).toBe(true);
  });
});

// Both of these were measured against the live login page. Getting either wrong
// produces the same generic "Something went wrong" a malformed request does, so
// a mistake here is indistinguishable from a wrong password.
describe('encoding a server action call', () => {
  const entries = () => [...ms.encodeActionForm({ email: 'a@b.invalid', otpCode: '123456' })];

  it('sends two arguments, because useActionState passes the previous state first', () => {
    const args = entries().find(([k]) => k === '0');
    expect(args[1]).toBe('[null,"$K1"]');
  });

  it('puts the entries before the argument list', () => {
    // The body is read as a stream: a reference met before its entries resolves
    // to an empty FormData and every field comes back "Required".
    const keys = entries().map(([k]) => k);
    expect(keys[keys.length - 1]).toBe('0');
    expect(keys.indexOf('1_email')).toBeLessThan(keys.indexOf('0'));
  });

  it('prefixes each field with the reference id', () => {
    const keys = entries().map(([k]) => k);
    expect(keys).toContain('1_email');
    expect(keys).toContain('1_otpCode');
  });
});

describe('reading an action response', () => {
  it('follows the pointer on line 0 rather than assuming line 1', () => {
    const stream =
      '0:{"a":"$@2","f":"","b":"abc"}\n' +
      '1:{"not":"the answer"}\n' +
      '2:{"status":"error","message":"nope"}\n';
    expect(ms.parseFlightResult(stream)).toEqual({ status: 'error', message: 'nope' });
  });

  it('falls back to the last JSON row when there is no pointer', () => {
    expect(ms.parseFlightResult('0:{"f":""}\n1:{"message":"hello"}\n')).toEqual({
      message: 'hello',
    });
  });

  it('survives a body that is not a flight stream', () => {
    expect(ms.parseFlightResult('<!DOCTYPE html><html></html>')).toBe(null);
    expect(ms.parseFlightResult('')).toBe(null);
  });
});

describe('program mapping', () => {
  it('maps the titles that are unambiguous', () => {
    expect(ms.programForClass('CREATE')).toBe('CREATE');
    expect(ms.programForClass('JR')).toBe('JR');
    expect(ms.programForClass('create')).toBe('CREATE');
  });

  // The load-bearing one. "Academies" covers both Robotics Academy and AI
  // Academy upstream, and guessing either would file a session under a program
  // the ninja may not be enrolled in. NULL means the sensei picks at log time.
  it('refuses to guess for Academies', () => {
    expect(ms.programForClass('Academies')).toBeNull();
  });

  it('returns null for anything unrecognised', () => {
    expect(ms.programForClass('Birthday Party')).toBeNull();
    expect(ms.programForClass('')).toBeNull();
    expect(ms.programForClass(undefined)).toBeNull();
  });
});

// A club booking is worth showing and must never be offered as a check-in.
// DojoLink tracks clubs as their own sessions, so filing one as a daily
// assignment puts the wrong kind of attendance against a ninja.
// The roster import reads `all[]`, which every other path in this file is
// forbidden to touch, so its boundary gets checked as carefully as the board's.
describe('roster members', () => {
  // Every value invented, and deliberately distinctive from every other value:
  // an earlier version used '00000' for the postal code and '5550000000' for the
  // phone, so the assertion that the postal code never crosses passed and failed
  // on the phone number containing it. A leak check that cannot tell two fields
  // apart is not a leak check.
  const upstream = {
    participant_id: 'PID-9',
    participant_first_name: 'Testy',
    participant_last_name: 'McExample',
    rank_name: 'White Belt 3',
    membership_title: 'CREATE Monthly',
    category_title: 'Member',
    real_pin: 'PIN-4417',
    date_of_birth: '1999-01-01',
    student_email: 'nobody@example.test',
    student_mobile: '5551234567',
    buyer_first_name: 'Guardian',
    buyer_last_name: 'McExample',
    buyer_postal_code: '90210',
  };

  // Unlike the board's participants, a roster member DOES carry a birthday and
  // parent contact: the import creates the DojoLink record those fields live in,
  // and the CSV import has always carried the same ones. The line is drawn at
  // what has nowhere to land here.
  it('carries the details a new ninja record is made of', () => {
    const member = ms.normalizeMember(upstream);
    expect(member.birthday).toBe('1999-01-01');
    expect(member.parentName).toBe('Guardian McExample');
    expect(member.parentEmail).toBe('nobody@example.test');
    expect(member.parentPhone).toBe('5551234567');
  });

  it('never carries the check-in PIN or the postal code', () => {
    // The PIN is a child's code for somebody else's system and the postal code
    // has no field here. Neither has any business crossing.
    const json = JSON.stringify(ms.normalizeMember(upstream));
    expect(json).not.toContain('PIN-4417');
    expect(json).not.toContain('90210');
  });

  it('keeps all of it away from the check-in board', () => {
    // The board matches a booking to a ninja who already exists, so it needs a
    // name and nothing else. Widening THIS is what the standing rule forbids.
    const json = JSON.stringify(
      ms.normalizeParticipant(upstream, { class_appointment_title: 'CREATE' })
    );
    for (const secret of [
      'PIN-4417',
      '1999-01-01',
      'nobody@example.test',
      '5551234567',
      'Guardian',
      '90210',
    ]) {
      expect(json).not.toContain(secret);
    }
  });

  it('normalises whatever shape a date of birth arrives in', () => {
    expect(ms.normalizeMember({ ...upstream, date_of_birth: '1999-01-01 00:00:00' }).birthday)
      .toBe('1999-01-01');
    expect(ms.normalizeMember({ ...upstream, date_of_birth: '' }).birthday).toBe(null);
    expect(ms.normalizeMember({ ...upstream, date_of_birth: 'not a date' }).birthday).toBe(null);
  });

  it('builds a name that can match a DojoLink full_name', () => {
    expect(ms.normalizeMember(upstream).fullName).toBe('Testy McExample');
  });
});

describe('reading a program off a membership', () => {
  it('resolves a membership naming exactly one program', () => {
    expect(ms.programForMembership('CREATE Monthly')).toBe('CREATE');
    expect(ms.programForMembership('Robotics Academy 1x/week')).toBe('Robotics Academy');
  });

  it('refuses a membership naming two', () => {
    // Guessing here enrols a child in something they do not attend, and the
    // wrong program is worse than none: a director fixes none in ten seconds.
    expect(ms.programForMembership('CREATE and JR bundle')).toBe(null);
  });

  it('refuses a membership naming none', () => {
    expect(ms.programForMembership('Academies')).toBe(null);
    expect(ms.programForMembership('')).toBe(null);
    expect(ms.programForMembership(null, undefined)).toBe(null);
  });

  it('falls back to the category when the membership says nothing', () => {
    expect(ms.programForMembership('Unlimited', 'JR')).toBe('JR');
  });
});

describe('telling a club apart', () => {
  it('recognises the club classes', () => {
    expect(ms.isClubClass('Roblox Club')).toBe(true);
    expect(ms.isClubClass('Minecraft Clubs')).toBe(true);
    expect(ms.isClubClass('club')).toBe(true);
  });

  it('leaves the curriculum classes alone', () => {
    expect(ms.isClubClass('CREATE')).toBe(false);
    expect(ms.isClubClass('Academies')).toBe(false);
    expect(ms.isClubClass('Robotics Academy')).toBe(false);
    expect(ms.isClubClass('')).toBe(false);
  });

  it('does not match a word that merely contains club', () => {
    expect(ms.isClubClass('Clubhouse')).toBe(false);
  });

  it('marks the flag on the participant the strip renders', () => {
    const cls = { class_appointment_title: 'Roblox Club', start_time: '05:00 PM' };
    const row = ms.normalizeParticipant({ participant_id: 'PID-2' }, cls);
    expect(row.isClub).toBe(true);
    // Clubs are not in PROGRAMS either, so nothing tries to file one.
    expect(row.program).toBe(null);
  });
});

describe('participant normalisation', () => {
  // Shaped like an upstream row, including the fields that must not survive.
  // Every value is invented: this repo is public, and a fixture copied from the
  // live roster would publish a child's name, PIN and date of birth.
  const upstream = {
    participant_id: 'PID-1',
    student_id: 'SID-1',
    participant_first_name: 'Testy',
    participant_last_name: 'McExample',
    participant_full_name: 'Testy, McExample',
    rank_name: 'ScratchJR',
    checkin_status: '',
    att_checkin_datetime: null,
    real_pin: 'PIN-0000',
    date_of_birth: '1999-01-01',
    student_email: 'nobody@example.invalid',
    student_mobile: '5550000000',
    buyer_first_name: 'Guardian',
    buyer_last_name: 'McExample',
    buyer_postal_code: '00000',
  };
  const cls = { class_appointment_title: 'JR', start_time: '04:00 PM' };

  it('drops every sensitive field', () => {
    const json = JSON.stringify(ms.normalizeParticipant(upstream, cls));
    for (const secret of [
      'PIN-0000',
      '1999-01-01',
      'nobody@example.invalid',
      '5550000000',
      'Guardian',
      '00000',
    ]) {
      expect(json).not.toContain(secret);
    }
  });

  it('builds a name that can match a DojoLink full_name', () => {
    // Upstream sends "First, Last" in participant_full_name, which would never
    // match, so the name is rebuilt from the parts.
    expect(ms.normalizeParticipant(upstream, cls).fullName).toBe('Testy McExample');
  });

  it('reads the upstream check-in state from either field', () => {
    expect(ms.normalizeParticipant(upstream, cls).checkedInUpstream).toBe(false);
    expect(
      ms.normalizeParticipant({ ...upstream, checkin_status: 'Y' }, cls).checkedInUpstream
    ).toBe(true);
    expect(
      ms.normalizeParticipant(
        { ...upstream, att_checkin_datetime: '2026-08-13 15:03:00' },
        cls
      ).checkedInUpstream
    ).toBe(true);
  });
});

describe('class time ordering', () => {
  it('sorts 12-hour times correctly across noon and midnight', () => {
    expect(ms.toMinutes('12:00 AM')).toBe(0);
    expect(ms.toMinutes('09:30 AM')).toBe(570);
    expect(ms.toMinutes('12:00 PM')).toBe(720);
    expect(ms.toMinutes('04:00 PM')).toBe(960);
    expect(ms.toMinutes('09:30 AM')).toBeLessThan(ms.toMinutes('04:00 PM'));
  });

  it('sends an unparseable time to the end rather than to the front', () => {
    expect(ms.toMinutes('Drop-in')).toBeGreaterThan(ms.toMinutes('11:59 PM'));
  });
});

// The credential states its own expiry, and that is now the only warning a
// director gets before the connection stops. A parse that quietly returns the
// wrong answer either nags every day or never warns at all, so the shapes that
// are NOT a usable expiry matter as much as the one that is.
describe('credential expiry', () => {
  const jwt = (payload) =>
    'hdr.' + Buffer.from(JSON.stringify(payload)).toString('base64url') + '.sig';
  const withRefresh = (token) => `companyId=480; kc_access=a; kc_refresh=${token}`;

  it('reads the expiry off kc_refresh', () => {
    const at = ms.readCookieExpiry(withRefresh(jwt({ exp: 1800000000, typ: 'Refresh' })));
    expect(at).toBeInstanceOf(Date);
    expect(at.toISOString()).toBe('2027-01-15T08:00:00.000Z');
  });

  it('reads the twenty four hour lifespan the live tokens actually carry', () => {
    const iat = 1755545461;
    const at = ms.readCookieExpiry(withRefresh(jwt({ iat, exp: iat + 24 * 3600 })));
    expect((at.getTime() / 1000 - iat) / 60).toBe(1440);
  });

  it('ignores kc_access, which expires in half an hour and is refreshed upstream', () => {
    const short = jwt({ exp: 1000 });
    const real = jwt({ exp: 1800000000 });
    expect(ms.readCookieExpiry(`kc_access=${short}; kc_refresh=${real}`).toISOString())
      .toBe('2027-01-15T08:00:00.000Z');
  });

  // Unknown, never "expired". Refusing to pull because a token did not parse
  // would turn a cosmetic problem into an outage.
  it('returns null rather than a date for anything it cannot read', () => {
    expect(ms.readCookieExpiry(null)).toBeNull();
    expect(ms.readCookieExpiry('')).toBeNull();
    expect(ms.readCookieExpiry('companyId=480')).toBeNull();
    expect(ms.readCookieExpiry('kc_refresh=not-a-jwt')).toBeNull();
    expect(ms.readCookieExpiry('kc_refresh=hdr.%%%.sig')).toBeNull();
    expect(ms.readCookieExpiry(withRefresh(jwt({ typ: 'Refresh' })))).toBeNull();
    expect(ms.readCookieExpiry(withRefresh(jwt({ exp: 'soon' })))).toBeNull();
  });

  it('reads a cookie that arrived as a pasted cURL, the same as a bare one', () => {
    const token = jwt({ exp: 1800000000 });
    const curl = `curl 'https://codeninjas.mystudio.io/home' -H 'cookie: companyId=480; kc_refresh=${token}'`;
    expect(ms.readCookieExpiry(curl)?.toISOString()).toBe('2027-01-15T08:00:00.000Z');
  });
});

describe('check-in kiosk', () => {
  // Invented, like every fixture here. Shaped like a portal member row,
  // including the fields that must never leave the boundary.
  const cls = {
    class_appointment_id: '11',
    class_appointment_title: 'CREATE',
    class_appointment_times_id: '22',
    class_appointment_occurrence_id: '33',
    class_appointment_date: '2026-01-05',
    start_time: '04:00 PM',
    end_time: '05:00 PM',
  };
  const row = {
    participant_id: '9001',
    participant_first_name: 'Testy',
    participant_last_name: 'McExample',
    membership_registration_id: '777',
    type: 'membership',
    category_title: 'CODE NINJAS: CREATE',
    membership_title: 'Monthly (2x/Week)',
    more_reg: 'N',
    real_pin: '1234',
    date_of_birth: '2015-01-01',
    student_email: 'kid@example.invalid',
    student_mobile: '5550000000',
    buyer_first_name: 'Parent',
    buyer_postal_code: '90000',
  };

  it('keeps nothing personal on a member', () => {
    const m = ms.normalizeKioskMember(row);
    expect(m).toMatchObject({
      participantId: '9001',
      fullName: 'Testy McExample',
      membershipRegistrationId: '777',
      moreReg: false,
    });
    const text = JSON.stringify(m);
    for (const leak of ['1234', '2015-01-01', 'kid@example', '5550000000', 'Parent', '90000']) {
      expect(text).not.toContain(leak);
    }
  });

  it('offers a class until it ends', () => {
    const at = (h, m) => h * 60 + m;
    expect(ms.classOpen(cls, at(9, 0))).toBe(true);
    expect(ms.classOpen(cls, at(17, 0))).toBe(true);
    expect(ms.classOpen(cls, at(17, 1))).toBe(false);
  });

  it('never offers a drop-in', () => {
    const dropIn = { ...cls, class_appointment_occurrence_id: '', start_time: 'Drop-in', end_time: '' };
    expect(ms.classOpen(dropIn, 16 * 60)).toBe(false);
  });

  // The only guard between a mistaken tap and a wrong attendance on a
  // family's membership, since the center lets the portal past its limits.
  it('registers a membership only into the classes it covers', () => {
    expect(ms.classFitsMembership('CREATE', 'CREATE')).toBe(true);
    expect(ms.classFitsMembership('Academies', 'CREATE')).toBe(true);
    expect(ms.classFitsMembership('Robotics Academy', 'CREATE')).toBe(true);
    expect(ms.classFitsMembership('JR', 'CREATE')).toBe(false);
    expect(ms.classFitsMembership('Minecraft Club', 'CREATE')).toBe(false);
    expect(ms.classFitsMembership('JR', 'JR')).toBe(true);
    expect(ms.classFitsMembership('CREATE', 'JR')).toBe(false);
    expect(ms.classFitsMembership('CREATE', null)).toBe(false);
  });

  it('escapes strings React would read as references', () => {
    const body = ms.encodeActionArgs([{ a: '$K1', b: 'plain', c: { d: '$$x' } }]);
    expect(JSON.parse(body)).toEqual([{ a: '$$K1', b: 'plain', c: { d: '$$$x' } }]);
  });

  it('refuses a token that could break out of the cookie header', () => {
    expect(() => ms.cleanPortalToken('abc; other=1')).toThrow(ms.MyStudioAuthError);
    expect(() => ms.cleanPortalToken('short')).toThrow(ms.MyStudioAuthError);
    expect(ms.cleanPortalToken('A1b2C3d4E5f6G7h8/+==')).toBe('A1b2C3d4E5f6G7h8/+==');
  });
});
