import Image from "next/image";
import Link from "next/link";
import { Montserrat } from "next/font/google";
import { StickyRegister } from "@/components/sticky-register";

// "Become a host school" landing page — Heather's brief + mock-ups
// (GSA Hosting Network sign up landing page.pdf, 2 Nov 2026). Served at /
// while the public directory is switched off (lib/features.ts). Copy is
// Heather's verbatim; GSA brand colours from the mock-ups.

const display = Montserrat({ subsets: ["latin"], weight: ["700", "800"] });

const NAVY = "#111a45";
const PINK = "#e60063";
const YELLOW = "#f8c400";
const CYAN = "#2cb8da";

const REGISTER = "/list-your-school";
const BOOK_A_CALL = "https://meetings-eu1.hubspot.com/jakejones/school";
const CONTACT = "mailto:contact@globalschoolalliance.com?subject=GSA%20Hosting%20Enquiry";

const WHY = [
  {
    colour: PINK,
    title: "Global experiences on your doorstep",
    body: "Give your students the chance to meet peers from another country, share lessons, compare cultures and build connections, all without leaving school.",
    icon: (
      <path d="M16 11c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 3-1.34 3-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
    ),
  },
  {
    colour: CYAN,
    title: "Enrichment that involves more students",
    body: "Hosting includes buddies, assemblies, classroom activities, after-school clubs and cultural exchange, allowing more of your school community to take part.",
    icon: (
      <path d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7z" />
    ),
  },
  {
    colour: YELLOW,
    title: "Funding and future opportunities",
    body: "Schools receive funding for participating in the programme, ranging from 3 - 5 days, whilst also opening the door to future visits, partnerships and wider international activity.",
    icon: <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />,
  },
];

const STEPS = [
  { when: "Today", title: "Register", body: "Tell us about your school, location and availability.", colour: NAVY },
  { when: "Within a few days", title: "We’ll call you", body: "A short call to understand your school, help you understand the programme and the type of group you could host.", colour: NAVY },
  { when: "When a match is found", title: "We match", body: "We contact you when a suitable visiting group is looking for a host school.", colour: PINK },
  { when: "Host and enjoy", title: "Welcome students", body: "Host students, share school life and create a memorable cultural exchange without leaving your school.", colour: NAVY },
];

// Quotes with the phrases Heather's mock-up picks out in pink.
const STORIES: { school: string; colour: string; parts: (string | { hl: string })[] }[] = [
  {
    school: "Villiers High School",
    colour: PINK,
    parts: [
      "In just two days, our students created ", { hl: "strong bonds" }, " with the visiting students. Some were quite shy at the start, but by the closing ceremony they were ",
      { hl: "beaming with pride" }, " and communicating really well with their buddies. Students are now ", { hl: "wanting to know more about China" }, " and how it differs from the UK.",
    ],
  },
  {
    school: "Bower Park Academy",
    colour: CYAN,
    parts: ["Cultural experiences like this are an ", { hl: "integral part of our school’s vision" }, " and GSA made it all possible. Thank you!"],
  },
  {
    school: "Royal Docks Academy",
    colour: PINK,
    parts: [
      "The Global School Alliance provided our school with ", { hl: "non-stop support" }, ". From the planning stages to the execution, we knew what we were in for. It was a ",
      { hl: "culturally and socially enriching experience" }, " for our students and really made their summer term special.",
    ],
  },
  {
    school: "Wapping High School",
    colour: CYAN,
    parts: [
      "Young people have an extraordinary capacity to ", { hl: "make friends instantly" }, " and a curiosity that this programme really promotes. On day 2, so many of our students asked if they could also be buddies. ",
      { hl: "I would wholeheartedly recommend any school to take part." },
    ],
  },
];

const FAQ = [
  ["What does hosting an international school group involve?", "Your school welcomes a visiting group into everyday school life, usually for 3-5 days. Students join lessons, take part in activities, share lunch and spend time with student buddies. We help you plan the experience so it fits around your normal school timetable."],
  ["How many students would we host?", "Most groups include around 20–30 visiting students, accompanied by their own group leaders. Exact numbers, ages and requirements are confirmed with your school before any hosting arrangement is agreed. Their ages will be matched according to whether your school is a Primary, Secondary or All-through school."],
  ["Does our school receive funding for hosting?", "Yes! The amount depends on the group size and length of programme, and will be confirmed once a group is accepted."],
  ["Do we need to arrange accommodation or transport?", "No. GSA coordinates the visiting group's accommodation and transport arrangements. Your school's role is to welcome the students and involve them in school life."],
  ["What would our school need to organise?", "We ask schools to identify student buddies, welcome visitors into suitable lessons, provide school lunches and arrange a few activities. Programmes also include a welcome assembly, farewell celebration and sometimes after-school activities. We'll help you plan everything."],
  ["What support does GSA provide?", "You'll have guidance from the GSA team throughout the process, including programme planning, preparation resources, cultural activities and coordination with the visiting group. We also provide GSA Global Ambassador certificates for participating student buddies."],
  ["How are safeguarding and supervision managed?", "Safeguarding arrangements are agreed with your school before the visit. Visiting groups travel with their own group leaders, and GSA coordinates relevant documentation, supervision expectations and safeguarding checks with the host school. Your school's safeguarding procedures remain in place throughout the experience."],
  ["When do hosting opportunities take place?", "We regularly arrange hosting opportunities during term time in schools around the world. Many groups currently come from China, Spain, Peru and the UK and our international hosting network continues to grow."],
  ["What happens after we register?", "Your school joins the GSA Host School Network. We’ll give you a quick call to discuss and explain the programme, answering any of your questions. When a suitable international group is ready we’ll be in touch. You can review the opportunity before deciding whether to participate."],
  ["Is there a cost or commitment to register?", "Registration is free, with no obligation to accept a hosting opportunity. Joining the network simply means your school can be considered for suitable international visits."],
] as const;

// Full-width band inside the layout's max-w-5xl main.
function Band({ children, className = "", style, id }: { children: React.ReactNode; className?: string; style?: React.CSSProperties; id?: string }) {
  return (
    <section id={id} style={style} className={`ml-[calc(50%-50vw)] w-screen ${className}`}>
      <div className="mx-auto max-w-5xl px-6">{children}</div>
    </section>
  );
}

function YellowButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      style={{ background: YELLOW, color: NAVY }}
      className="group inline-flex items-center gap-2 rounded-lg px-5 py-3 text-sm font-bold shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:shadow-sm"
    >
      {children} <span aria-hidden className="transition-transform duration-200 group-hover:translate-x-0.5">→</span>
    </Link>
  );
}

function Circle({ colour, children, size = "h-14 w-14" }: { colour: string; children: React.ReactNode; size?: string }) {
  return (
    <span style={{ background: colour }} className={`flex ${size} items-center justify-center rounded-full text-white`}>
      {children}
    </span>
  );
}

export function HostingLanding() {
  return (
    <div className="-mt-10 -mb-16">
      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <Band id="hero" style={{ background: NAVY }} className="relative overflow-hidden text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: `radial-gradient(60% 70% at 85% 20%, ${PINK}33 0%, transparent 60%), radial-gradient(40% 50% at 10% 90%, ${CYAN}26 0%, transparent 60%)` }}
        />
        <div className="relative grid items-center gap-10 py-16 md:grid-cols-[1.05fr_1fr] md:py-20">
          <div className="hero-in">
            <h1 className={`${display.className} text-4xl font-extrabold leading-[1.05] sm:text-5xl lg:text-6xl`}>
              Welcome the <span style={{ color: PINK }}>world</span> into your school
            </h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-white/85">
              Join the GSA Host School Network and give your students an international experience without leaving school. Welcome visiting groups, build global citizenship and earn funds for your school.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <YellowButton href={REGISTER}>Register your school</YellowButton>
              <a href="#how-it-works" className="group inline-flex items-center gap-2 rounded-lg border border-white/70 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10">
                How hosting works <span aria-hidden className="transition-transform duration-200 group-hover:translate-y-0.5">↓</span>
              </a>
            </div>
            <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-xs text-white/90">
              {[
                { c: PINK, label: "Free to register", d: "M20 6L9 17l-5-5" },
                { c: CYAN, label: "No obligation", d: "M16 11c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 3-1.34 3-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" },
                { c: YELLOW, label: "Support and guidance provided", d: "M12 1a9 9 0 00-9 9v7a3 3 0 003 3h3v-8H5v-2a7 7 0 0114 0v2h-4v8h3a3 3 0 003-3v-7a9 9 0 00-9-9z" },
              ].map((b) => (
                <li key={b.label} className="flex items-center gap-2">
                  <Circle colour={b.c} size="h-7 w-7">
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill={b.d.startsWith("M20") ? "none" : "currentColor"} stroke="currentColor" strokeWidth={b.d.startsWith("M20") ? 3 : 0} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={b.d} /></svg>
                  </Circle>
                  {b.label}
                </li>
              ))}
            </ul>
          </div>
          <div className="hero-in-late">
            <Image src="/hosting/hero.png" alt="Visiting students and host-school staff together in a school hall, at lunch and in class" width={800} height={700} priority className="float-slow w-full drop-shadow-[0_24px_40px_rgba(0,0,0,0.35)]" />
          </div>
        </div>
      </Band>

      {/* ── Why schools host ──────────────────────────────────────────── */}
      <Band className="bg-stone-100">
        <div className="grid gap-10 py-16 md:grid-cols-[1fr_1.4fr] md:py-20">
          <div className="reveal">
            <p style={{ color: PINK }} className="text-xs font-bold uppercase tracking-[0.2em]">Why schools host</p>
            <h2 className={`${display.className} mt-3 text-3xl font-extrabold leading-tight sm:text-4xl`} style={{ color: NAVY }}>
              Why schools <span style={{ color: PINK }}>choose</span> to host.
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-stone-600">
              Hosting brings international students into your school, gives your own students a meaningful global experience, and creates a simple way to broaden horizons, intercultural competence, and strengthen your enrichment offer.
            </p>
            <div className="mt-6">
              <YellowButton href={REGISTER}>Register your school</YellowButton>
            </div>
          </div>
          <div>
            <div className="reveal-stagger grid gap-4 sm:grid-cols-3">
              {WHY.map((w) => (
                <div key={w.title} className="group rounded-2xl border border-stone-200/70 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-stone-300 hover:shadow-lg">
                  <Circle colour={w.colour} size="h-14 w-14 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6">
                    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor" aria-hidden>{w.icon}</svg>
                  </Circle>
                  <h3 className={`${display.className} mt-4 text-sm font-bold leading-snug`} style={{ color: NAVY }}>{w.title}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-stone-600">{w.body}</p>
                </div>
              ))}
            </div>
            <dl className="reveal mt-4 grid grid-cols-1 divide-y divide-sky-100 rounded-2xl border border-sky-100 bg-sky-50 px-5 py-3 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              {[
                { c: PINK, big: "20 - 30", small: "visiting students" },
                { c: CYAN, big: "3 - 5", small: "day programme" },
                { c: YELLOW, big: "GSA Support", small: "throughout" },
              ].map((s) => (
                <div key={s.big} className="flex items-center gap-3 py-2 sm:justify-center">
                  <span style={{ background: s.c }} className="h-2.5 w-2.5 shrink-0 rounded-full" />
                  <div>
                    <dt className={`${display.className} text-sm font-extrabold`} style={{ color: NAVY }}>{s.big}</dt>
                    <dd className="text-xs text-stone-600">{s.small}</dd>
                  </div>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </Band>

      {/* ── How hosting works ─────────────────────────────────────────── */}
      <Band id="how-it-works" className="bg-white">
        <div className="py-16 md:py-20">
          <h2 className={`${display.className} reveal max-w-md text-3xl font-extrabold leading-tight sm:text-4xl`} style={{ color: NAVY }}>
            From registration to hosting in <span style={{ color: PINK }}>four steps.</span>
          </h2>
          <ol className="reveal-stagger mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className="group relative">
                <div className="flex items-center">
                  <Circle colour={s.colour} size="h-11 w-11 shadow-md transition-transform duration-300 group-hover:scale-110">
                    <span className={`${display.className} text-sm font-extrabold`}>{i + 1}</span>
                  </Circle>
                  {i < STEPS.length - 1 && (
                    <span aria-hidden className="draw-line ml-3 hidden flex-1 border-t-2 border-dashed lg:block" style={{ borderColor: CYAN }} />
                  )}
                </div>
                <p style={{ color: PINK }} className="mt-5 text-[11px] font-bold uppercase tracking-[0.15em]">{s.when}</p>
                <h3 className={`${display.className} mt-1 text-lg font-bold`} style={{ color: NAVY }}>{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-stone-600">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </Band>

      {/* ── School stories ────────────────────────────────────────────── */}
      <Band className="bg-stone-100">
        <div className="py-16 md:py-20">
          <div className="grid items-center gap-10 md:grid-cols-[1fr_1.3fr]">
            <div className="reveal">
              <p style={{ color: PINK }} className="text-xs font-bold uppercase tracking-[0.2em]">School stories</p>
              <h2 className={`${display.className} mt-3 text-3xl font-extrabold leading-tight sm:text-4xl`} style={{ color: NAVY }}>
                Real connections.<br /><span style={{ color: PINK }}>Lasting impact.</span>
              </h2>
              <p className="mt-4 max-w-sm text-sm leading-relaxed text-stone-600">
                Hear from schools that have welcomed international students through our hosting programme and seen the positive impact on their students, staff and wider school community.
              </p>
            </div>
            <div className="reveal">
              <Image src="/hosting/stories.png" alt="Host and visiting students drawing together, in the playground and sharing afternoon tea" width={800} height={500} className="w-full transition-transform duration-500 hover:scale-[1.02]" />
            </div>
          </div>
          <div className="reveal-stagger mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STORIES.map((s) => (
              <figure key={s.school} className="flex flex-col rounded-2xl border border-stone-200/70 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
                <Circle colour={s.colour} size="h-8 w-8">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden><path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z" /></svg>
                </Circle>
                <blockquote className="mt-4 flex-1 text-xs leading-relaxed text-stone-600">
                  “{s.parts.map((p, i) => typeof p === "string" ? p : <strong key={i} style={{ color: PINK }}>{p.hl}</strong>)}”
                </blockquote>
                <figcaption className={`${display.className} mt-4 border-t border-stone-100 pt-3 text-xs font-bold`} style={{ color: NAVY }}>
                  {s.school}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </Band>

      {/* ── Final CTA ─────────────────────────────────────────────────── */}
      <Band id="final-cta" className="bg-stone-100 pb-16">
        <div style={{ background: NAVY }} className="reveal group grid overflow-hidden rounded-3xl text-white shadow-xl md:grid-cols-[1.1fr_1fr]">
          <div className="p-8 sm:p-12">
            <h2 className={`${display.className} text-3xl font-extrabold leading-tight sm:text-4xl`}>
              Ready to be part of <span style={{ color: PINK }}>something bigger?</span>
            </h2>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/85">
              Join the <strong className="text-white">Global School Alliance Hosting Network</strong> and give your students a meaningful international experience.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <YellowButton href={REGISTER}>Register your school</YellowButton>
              <a href={BOOK_A_CALL} target="_blank" rel="noopener" className="inline-flex items-center gap-2 rounded-lg border border-white/70 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10">
                Speak to our team <span aria-hidden className="text-xs">↗</span>
              </a>
            </div>
          </div>
          <div className="relative min-h-64">
            <Image src="/hosting/cta.png" alt="A teacher shows visiting students a nature display in an art classroom" fill sizes="(min-width: 768px) 40vw, 100vw" className="object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
          </div>
        </div>
      </Band>

      {/* ── FAQ ───────────────────────────────────────────────────────── */}
      <Band className="bg-white">
        <div className="mx-auto max-w-3xl py-16 md:py-20">
          <h2 className={`${display.className} reveal text-3xl font-extrabold leading-tight sm:text-4xl`} style={{ color: NAVY }}>
            Your questions,<br /><span style={{ color: PINK }}>answered.</span>
          </h2>
          <p className="mt-3 text-sm text-stone-600">
            Here are some of the most common questions about hosting an international school group. If you can’t find what you’re looking for, just get in touch.
          </p>
          <div className="mt-8 divide-y divide-stone-200">
            {FAQ.map(([q, a], i) => (
              <details key={q} open={i < 2} className="faq group py-3">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-bold transition-colors hover:text-[#e60063]" style={{ color: NAVY }}>
                  <span>{i + 1}. {q}</span>
                  <span
                    aria-hidden
                    style={{ color: PINK }}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-current text-base leading-none transition-transform duration-300 group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="faq-answer mt-2 pr-8 text-sm leading-relaxed text-stone-600">{a}</p>
              </details>
            ))}
          </div>
          <div className="reveal mt-10 flex flex-wrap items-center justify-between gap-4">
            <p className={`${display.className} text-lg font-bold`} style={{ color: NAVY }}>Still have questions?</p>
            <YellowButton href={CONTACT}>Contact our team</YellowButton>
          </div>
        </div>
      </Band>

      <StickyRegister heroId="hero" ctaId="final-cta" colours={{ navy: NAVY, yellow: YELLOW }} />
    </div>
  );
}
