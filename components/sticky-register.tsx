"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// Slim bar that slides up once the hero (and its own Register button) has
// scrolled out of view, so the call to action is never more than a thumb
// away. Hidden again whenever the hero or the final CTA is on screen.
export function StickyRegister({
  heroId,
  ctaId,
  colours,
}: {
  heroId: string;
  ctaId: string;
  colours: { navy: string; yellow: string };
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const hero = document.getElementById(heroId);
    const cta = document.getElementById(ctaId);
    if (!hero || !("IntersectionObserver" in window)) return;
    const seen = new Map<Element, boolean>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) seen.set(e.target, e.isIntersecting);
        const anyVisible = [...seen.values()].some(Boolean);
        setShow(!anyVisible);
      },
      { threshold: 0.05 }
    );
    io.observe(hero);
    if (cta) io.observe(cta);
    return () => io.disconnect();
  }, [heroId, ctaId]);

  return (
    <div
      aria-hidden={!show}
      style={{ background: colours.navy }}
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-white/10 text-white shadow-[0_-8px_30px_rgba(0,0,0,0.18)] transition-transform duration-300 ease-out ${
        show ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-3">
        <p className="hidden text-sm sm:block">
          <strong>Free to register</strong> · no obligation · we’ll call you within a few days
        </p>
        <p className="text-sm sm:hidden">
          <strong>Free to register</strong> · no obligation
        </p>
        <Link
          href="/list-your-school"
          tabIndex={show ? 0 : -1}
          style={{ background: colours.yellow, color: colours.navy }}
          className="group inline-flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-opacity hover:opacity-90"
        >
          Register your school
          <span aria-hidden className="transition-transform duration-200 group-hover:translate-x-0.5">→</span>
        </Link>
      </div>
    </div>
  );
}
