import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, BookOpen, ChevronDown, GraduationCap, LifeBuoy,
  Lightbulb, Rocket, Search, Store, UserRound, Users,
} from 'lucide-react';
import { useLightOnly } from '../context/ThemeContext';
import Logo from '../components/ui/Logo';
import { DOCS, DOC_GROUPS, docBySlug, docText, sectionId } from '../lib/docs';

// The public Help Center: /docs is the front page, /docs/:slug one article.
// Public on purpose, like Privacy and Terms, so a parent who cannot sign in
// can still read how to.

const GROUP_ICONS = {
  start: Rocket,
  senseis: GraduationCap,
  directors: Store,
  families: Users,
  account: UserRound,
  help: LifeBuoy,
};

const GROUP_BLURBS = {
  start: 'What DojoLink is, signing in, and who can do what.',
  senseis: 'Checking ninjas in, logging sessions, clubs and the curriculum.',
  directors: 'Roster, staff, tasks, events, reports and the kiosk.',
  families: 'Following your ninja in the Parent Portal.',
  account: 'Your profile, password and display settings.',
  help: 'Answers, fixes, and how to reach us.',
};

// **bold** and [label](href). Internal links route; anything else opens out.
function Inline({ text }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g);
  return parts.map((part, i) => {
    if (part.startsWith('**')) return <strong key={i} className="font-bold text-ninja-navy">{part.slice(2, -2)}</strong>;
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) {
      const [, label, href] = link;
      return href.startsWith('/')
        ? <Link key={i} to={href} className="text-ninja-blue font-semibold hover:underline">{label}</Link>
        : <a key={i} href={href} target="_blank" rel="noopener noreferrer" className="text-ninja-blue font-semibold hover:underline">{label}</a>;
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

function Shot({ src, alt, caption, narrow, eager }) {
  return (
    <figure className={narrow ? 'max-w-md' : ''}>
      <div className="rounded-2xl border border-ninja-border bg-white overflow-hidden shadow-sm">
        <img src={src} alt={alt} loading={eager ? 'eager' : 'lazy'} decoding="async" className="block w-full h-auto" />
      </div>
      {caption && <figcaption className="mt-2 text-sm text-ninja-muted">{caption}</figcaption>}
    </figure>
  );
}

function Block({ block }) {
  if (block.p) return <p className="text-[15px] leading-7 text-ninja-muted"><Inline text={block.p} /></p>;
  if (block.list) {
    return (
      <ul className="space-y-2.5">
        {block.list.map((item) => (
          <li key={item} className="flex gap-3 text-[15px] leading-7 text-ninja-muted">
            <span aria-hidden className="mt-[11px] w-1.5 h-1.5 rounded-full bg-ninja-blue/60 flex-shrink-0" />
            <span><Inline text={item} /></span>
          </li>
        ))}
      </ul>
    );
  }
  if (block.steps) {
    return (
      <ol className="space-y-3">
        {block.steps.map((item, i) => (
          <li key={item} className="flex gap-3.5 text-[15px] leading-7 text-ninja-muted">
            <span aria-hidden className="mt-0.5 w-6 h-6 rounded-full bg-ninja-blue/10 text-ninja-blue text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
            <span><Inline text={item} /></span>
          </li>
        ))}
      </ol>
    );
  }
  if (block.img) return <Shot src={block.img} alt={block.alt} caption={block.caption} narrow={block.narrow} />;
  if (block.tip) {
    return (
      <div className="flex gap-3 rounded-xl bg-ninja-blue/[0.06] px-4 py-3.5">
        <Lightbulb aria-hidden className="w-5 h-5 text-ninja-blue flex-shrink-0 mt-1" />
        <p className="text-[15px] leading-7 text-ninja-navy"><Inline text={block.tip} /></p>
      </div>
    );
  }
  if (block.qa) {
    return (
      <div className="divide-y divide-ninja-border border-y border-ninja-border">
        {block.qa.map(({ q, a }) => (
          <details key={q} className="group py-1">
            <summary className="flex items-center justify-between gap-4 py-3 cursor-pointer list-none text-[15px] font-bold text-ninja-navy [&::-webkit-details-marker]:hidden">
              {q}
              <ChevronDown aria-hidden className="w-4 h-4 text-ninja-muted transition-transform group-open:rotate-180 flex-shrink-0" />
            </summary>
            <p className="pb-4 text-[15px] leading-7 text-ninja-muted"><Inline text={a} /></p>
          </details>
        ))}
      </div>
    );
  }
  if (block.table) {
    const { head, rows } = block.table;
    return (
      <div className="overflow-x-auto rounded-xl border border-ninja-border">
        <table className="w-full text-sm">
          <thead className="bg-ninja-bg">
            <tr>
              {head.map((h, i) => (
                <th key={i} scope="col" className="text-left font-bold text-ninja-navy px-4 py-2.5 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-ninja-border bg-white">
            {rows.map((row) => (
              <tr key={row.join('|')}>
                {row.map((cell, i) => (
                  <td key={i} className={`px-4 py-2.5 align-top ${i === 0 ? 'font-semibold text-ninja-navy' : 'text-ninja-muted'}`}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return null;
}

function SearchBox({ query, setQuery, inputRef }) {
  return (
    <label className="relative block">
      <span className="sr-only">Search the Help Center</span>
      <Search aria-hidden className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ninja-muted" />
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search..."
        className="w-full rounded-xl border border-ninja-border bg-white pl-10 pr-3 py-2.5 text-sm text-ninja-navy placeholder:text-ninja-muted"
      />
    </label>
  );
}

function NavList({ activeSlug, query, onPick }) {
  const q = query.trim().toLowerCase();
  const results = useMemo(() => {
    if (!q) return null;
    const words = q.split(/\s+/);
    return DOCS.filter((d) => { const t = docText(d); return words.every((w) => t.includes(w)); });
  }, [q]);

  const item = (doc) => {
    const active = doc.slug === activeSlug;
    return (
      <li key={doc.slug}>
        <Link
          to={`/docs/${doc.slug}`}
          onClick={onPick}
          aria-current={active ? 'page' : undefined}
          className={`block rounded-lg px-3 py-2 text-[15px] transition-colors ${active ? 'bg-ninja-blue/10 text-ninja-blue font-bold' : 'text-ninja-muted hover:text-ninja-navy hover:bg-ninja-bg'}`}
        >
          {doc.title}
        </Link>
      </li>
    );
  };

  if (results) {
    return results.length
      ? <ul className="space-y-0.5">{results.map(item)}</ul>
      : <p className="px-3 py-2 text-sm text-ninja-muted">Nothing matches "{query.trim()}".</p>;
  }

  return (
    <div className="space-y-6">
      {DOC_GROUPS.map((g) => {
        const Icon = GROUP_ICONS[g.id];
        return (
          <section key={g.id}>
            <h2 className="flex items-center gap-2.5 px-3 mb-1.5 text-[15px] font-bold text-ninja-navy">
              <Icon aria-hidden className="w-[18px] h-[18px]" />
              {g.label}
            </h2>
            <ul className="space-y-0.5">{DOCS.filter((d) => d.group === g.id).map(item)}</ul>
          </section>
        );
      })}
    </div>
  );
}

// Which section heading is in view, for "On this page".
function useActiveSection(ids) {
  const [active, setActive] = useState(ids[0]);
  useEffect(() => {
    setActive(ids[0]);
    const els = ids.map((id) => document.getElementById(id)).filter(Boolean);
    if (!els.length) return undefined;
    const io = new IntersectionObserver((entries) => {
      const seen = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (seen[0]) setActive(seen[0].target.id);
    }, { rootMargin: '-80px 0px -65% 0px' });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [ids.join('|')]); // eslint-disable-line react-hooks/exhaustive-deps
  return active;
}

function Article({ doc }) {
  const group = DOC_GROUPS.find((g) => g.id === doc.group);
  const ids = doc.sections.map((s) => sectionId(s.title));
  const active = useActiveSection(ids);
  const index = DOCS.indexOf(doc);
  const prev = DOCS[index - 1];
  const next = DOCS[index + 1];

  return (
    <div className="flex gap-12">
      <article className="min-w-0 flex-1 max-w-3xl">
        <p className="text-ninja-blue font-semibold text-[15px]">{group.label}</p>
        <h1 className="mt-2 text-3xl sm:text-[40px] sm:leading-[1.15] font-extrabold text-ninja-navy tracking-tight">{doc.title}</h1>
        <p className="mt-3 text-lg leading-8 text-ninja-muted">{doc.lede}</p>

        {doc.image && <div className="mt-8"><Shot {...doc.image} eager /></div>}

        <div className="mt-10 space-y-12">
          {doc.sections.map((s, i) => (
            <section key={s.title} aria-labelledby={ids[i]}>
              <h2 id={ids[i]} className="scroll-mt-24 text-2xl font-extrabold text-ninja-navy tracking-tight mb-4">{s.title}</h2>
              <div className="space-y-5">
                {s.blocks.map((b, j) => <Block key={j} block={b} />)}
              </div>
            </section>
          ))}
        </div>

        <nav aria-label="More articles" className="mt-16 grid sm:grid-cols-2 gap-4">
          {prev ? (
            <Link to={`/docs/${prev.slug}`} className="group rounded-xl border border-ninja-border bg-white px-5 py-4 hover:bg-ninja-bg transition-colors">
              <span className="flex items-center gap-1.5 text-sm text-ninja-muted"><ArrowLeft aria-hidden className="w-4 h-4" />Previous</span>
              <span className="mt-1 block font-bold text-ninja-navy group-hover:text-ninja-blue">{prev.title}</span>
            </Link>
          ) : <span />}
          {next && (
            <Link to={`/docs/${next.slug}`} className="group rounded-xl border border-ninja-border bg-white px-5 py-4 text-right hover:bg-ninja-bg transition-colors">
              <span className="flex items-center justify-end gap-1.5 text-sm text-ninja-muted">Next<ArrowRight aria-hidden className="w-4 h-4" /></span>
              <span className="mt-1 block font-bold text-ninja-navy group-hover:text-ninja-blue">{next.title}</span>
            </Link>
          )}
        </nav>
      </article>

      <aside aria-label="On this page" className="hidden xl:block w-52 flex-shrink-0">
        <div className="sticky top-24">
          <p className="flex items-center gap-2 text-[15px] font-bold text-ninja-navy mb-3">
            <BookOpen aria-hidden className="w-4 h-4" />
            On this page
          </p>
          <ul className="space-y-2">
            {doc.sections.map((s, i) => (
              <li key={s.title}>
                <a
                  href={`#${ids[i]}`}
                  className={`block text-[15px] leading-6 transition-colors ${active === ids[i] ? 'text-ninja-blue font-semibold' : 'text-ninja-muted hover:text-ninja-navy'}`}
                >
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}

function Home() {
  return (
    <div className="max-w-4xl">
      <p className="text-ninja-blue font-semibold text-[15px]">Help Center</p>
      <h1 className="mt-2 text-3xl sm:text-[40px] sm:leading-[1.15] font-extrabold text-ninja-navy tracking-tight">Get help with DojoLink</h1>
      <p className="mt-3 text-lg leading-8 text-ninja-muted">Guides for senseis, Center Directors and families: checking in, logging progress, running your center and following your ninja.</p>

      <div className="mt-8"><Shot src="/docs/todays-board.jpg" alt="Today's Board with checked-in ninjas" eager /></div>

      <h2 className="mt-14 text-2xl font-extrabold text-ninja-navy tracking-tight">Start here</h2>
      <div className="mt-5 grid sm:grid-cols-2 gap-4">
        {DOC_GROUPS.map((g) => {
          const Icon = GROUP_ICONS[g.id];
          const docs = DOCS.filter((d) => d.group === g.id);
          return (
            <section key={g.id} className="rounded-2xl border border-ninja-border bg-white p-5">
              <Link to={`/docs/${docs[0].slug}`} className="group flex items-start gap-3">
                <span className="w-10 h-10 rounded-xl bg-ninja-blue/10 text-ninja-blue flex items-center justify-center flex-shrink-0">
                  <Icon aria-hidden className="w-5 h-5" />
                </span>
                <span>
                  <span className="block font-bold text-ninja-navy group-hover:text-ninja-blue">{g.label}</span>
                  <span className="block text-sm text-ninja-muted mt-0.5">{GROUP_BLURBS[g.id]}</span>
                </span>
              </Link>
              <ul className="mt-4 space-y-1.5 pl-[52px]">
                {docs.slice(0, 4).map((d) => (
                  <li key={d.slug}>
                    <Link to={`/docs/${d.slug}`} className="text-[15px] text-ninja-muted hover:text-ninja-blue">{d.title}</Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}

export default function DocsPage() {
  useLightOnly();
  const { slug } = useParams();
  const doc = slug ? docBySlug(slug) : null;
  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const desktopSearch = useRef(null);

  useEffect(() => {
    document.title = doc ? `${doc.title} · DojoLink Help` : 'DojoLink Help Center';
    window.scrollTo(0, 0);
    setMenuOpen(false);
    return () => { document.title = 'DojoLink'; };
  }, [doc]);

  // Cmd/Ctrl+K or "/" jumps to search, as in most help centers.
  useEffect(() => {
    const onKey = (e) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName);
      if (((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') || (e.key === '/' && !typing)) {
        const el = desktopSearch.current;
        if (el && el.offsetParent) { e.preventDefault(); el.focus(); }
        else if (!typing) { e.preventDefault(); setMenuOpen(true); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (slug && !doc) return <Navigate to="/docs" replace />;

  return (
    <div className="theme-locked min-h-[100dvh] bg-ninja-bg font-ninja">
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-ninja-border">
        <div className="max-w-[1400px] mx-auto h-16 px-4 sm:px-6 flex items-center justify-between gap-4">
          <Link to="/docs" className="flex items-center" aria-label="DojoLink Help Center">
            <Logo variant="lockup" className="h-7 text-ninja-navy" />
          </Link>
          <Link to="/login" className="rounded-xl bg-ninja-blue text-white font-bold text-sm px-4 py-2.5 hover:opacity-90 transition-opacity">
            Sign in
          </Link>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:flex lg:gap-10">
        <aside className="hidden lg:block w-72 flex-shrink-0">
          <div className="sticky top-16 h-[calc(100dvh-4rem)] overflow-y-auto py-8 pr-2">
            <SearchBox query={query} setQuery={setQuery} inputRef={desktopSearch} />
            <nav aria-label="Help topics" className="mt-6">
              <NavList activeSlug={slug} query={query} />
            </nav>
          </div>
        </aside>

        {/* Below lg the topics fold into one button over the article. */}
        <div className="lg:hidden pt-5">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-expanded={menuOpen}
            className="w-full flex items-center justify-between rounded-xl border border-ninja-border bg-white px-4 py-3 text-[15px] font-bold text-ninja-navy"
          >
            {doc ? doc.title : 'Browse topics'}
            <ChevronDown aria-hidden className={`w-4 h-4 text-ninja-muted transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
          </button>
          {menuOpen && (
            <div className="mt-2 rounded-xl border border-ninja-border bg-white p-3">
              <SearchBox query={query} setQuery={setQuery} />
              <nav aria-label="Help topics" className="mt-4">
                <NavList activeSlug={slug} query={query} onPick={() => setMenuOpen(false)} />
              </nav>
            </div>
          )}
        </div>

        <main className="min-w-0 flex-1 py-8 lg:py-12">
          {doc ? <Article doc={doc} /> : <Home />}

          <footer className="mt-20 pt-6 border-t border-ninja-border flex flex-wrap items-center gap-3 text-xs text-ninja-muted">
            <Link to="/" className="hover:text-ninja-blue transition-colors">DojoLink</Link>
            <span className="opacity-40">·</span>
            <Link to="/privacy" className="hover:text-ninja-blue transition-colors">Privacy Policy</Link>
            <span className="opacity-40">·</span>
            <Link to="/terms" className="hover:text-ninja-blue transition-colors">Terms</Link>
            <span className="opacity-40">·</span>
            <Link to="/accessibility" className="hover:text-ninja-blue transition-colors">Accessibility</Link>
          </footer>
        </main>
      </div>
    </div>
  );
}
