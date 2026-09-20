"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const categories = [
  ["🍔", "Food & Dining", "Save More", "bg-[#fff9df]"],
  ["🛍️", "Shopping", "Best Deals", "bg-[#fff0f5]"],
  ["✈️", "Travel", "Explore More", "bg-[#eef7ff]"],
  ["❤️", "Health & Wellness", "Stay Healthy", "bg-[#edfff5]"],
  ["🎓", "Education", "Learn More", "bg-[#f6efff]"],
  ["🎬", "Entertainment", "Have Fun", "bg-[#fff3e5]"],
  ["🏋️", "Fitness", "Stay Fit", "bg-[#effff5]"],
  ["💇", "Salon & Beauty", "Look Great", "bg-[#fff0f8]"],
];

const slides = [
  {
    eyebrow: "STUDENT DISCOUNTS",
    title: "Big Discounts",
    highlight: "Just for You!",
    text: "Show your SBC Card and enjoy exclusive discounts at shops, restaurants, travel, education and more.",
    primary: "Get Your SBC Card",
    primaryPath: "/student/register",
    secondary: "Student Login",
    secondaryPath: "/student/login",
    image: "/images/sbc01.png",
    sideTitle: "Save More",
    sideText: "Every Visit\nEvery Day",
  },
  {
    eyebrow: "USE • SAVE • REWARD",
    title: "Use Discounts",
    highlight: "& Get Gifts!",
    text: "Use your SBC benefits at partner businesses, collect rewards and unlock exciting gifts.",
    primary: "Explore Offers",
    primaryPath: "/student/login",
    secondary: "Student Login",
    secondaryPath: "/student/login",
    image: "/images/sbc02.png",
    sideTitle: "More You Use",
    sideText: "More Rewards\nMore Gifts",
  },
  {
    eyebrow: "REFER • GROW • EARN",
    title: "Refer SBC",
    highlight: "& Earn Money!",
    text: "Invite your friends to join SBC, help them save and earn referral rewards.",
    primary: "Get Your SBC Card",
    primaryPath: "/student/register",
    secondary: "Student Login",
    secondaryPath: "/student/login",
    image: "/images/sbc03.png",
    sideTitle: "Refer More",
    sideText: "Grow Together\nEarn More",
  },
];

export default function Home() {
  const router = useRouter();
  const [slide, setSlide] = useState(0);
  const [portalRole, setPortalRole] = useState<"student" | "business">("student");

  const go = (path: string) => {
    if (path.startsWith("#")) {
      document.querySelector(path)?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    router.push(path);
  };

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSlide((current) => (current + 1) % slides.length);
    }, 5500);

    return () => window.clearInterval(timer);
  }, []);

  const active = slides[slide];

  return (
    <main className="min-h-screen overflow-x-hidden bg-white pb-20 pt-[74px] text-[#07111f] sm:pb-0 sm:pt-[76px]">
      {/* HEADER */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#07111f]/95 text-white backdrop-blur-xl sm:border-black/[.06] sm:bg-white/95 sm:text-[#07111f]">
        <div className="mx-auto max-w-[1440px] px-3 py-2.5 sm:px-6 sm:py-0 lg:px-10">
          <div className="flex min-h-[54px] items-center justify-between gap-2 sm:h-[76px]">
            <button type="button" onClick={() => go("/")} className="flex min-w-0 items-center gap-2.5 sm:gap-3">
              <span className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#d4af37] text-[11px] font-black text-[#07111f] shadow-lg sm:h-12 sm:w-12 sm:rounded-2xl sm:bg-[#07111f] sm:text-white sm:text-sm">
                <span className="absolute -right-2 -top-2 h-7 w-7 rounded-full bg-[#d4af37] blur-md" />
                <span className="relative">SBC</span>
              </span>
              <span className="min-w-0 text-left">
                <span className="block truncate text-[11px] font-black tracking-[.10em] text-white sm:text-[#07111f] sm:text-[14px] sm:tracking-[.12em]">
                  STUDENT BENEFIT CARD
                </span>
                <span className="mt-0.5 block text-[7px] font-semibold uppercase tracking-[.16em] text-white/55 sm:text-slate-500 sm:text-[9px] sm:tracking-[.2em]">
                  More Benefits. More Savings.
                </span>
              </span>
            </button>

            <nav className="hidden items-center gap-7 lg:flex">
              {[
                ["Home", "/"],
                ["For Students", "/student/login"],
                ["For Businesses", "/business/login"],
                ["Offers", "/student/login"],
                ["How It Works", "#how-it-works"],
                ["About", "#about"],
              ].map(([label, path], index) => (
                <button key={label} type="button" onClick={() => go(path)} className={`text-[13px] font-bold transition ${index === 0 ? "text-[#1557d6]" : "text-slate-600 hover:text-[#07111f]"}`}>
                  {label}
                </button>
              ))}
            </nav>

            <div className="hidden items-center justify-end gap-2 sm:flex sm:flex-nowrap">
              <button type="button" onClick={() => go("/student/register")} className="rounded-xl bg-[#1557d6] px-4 py-2.5 text-[10px] font-black text-white shadow-[0_12px_28px_rgba(21,87,214,.22)] transition hover:-translate-y-0.5 sm:px-5 sm:py-3 sm:text-xs">Get Your SBC Card</button>
              <button type="button" onClick={() => go("/admin/login")} className="rounded-xl border border-[#07111f]/15 bg-[#07111f] px-4 py-2.5 text-[10px] font-black text-white transition hover:bg-[#111d2d] sm:px-5 sm:py-3 sm:text-xs">Admin Login</button>
            </div>

            <button type="button" onClick={() => go("/student/register")} className="shrink-0 rounded-xl bg-[#1557d6] px-3 py-2.5 text-[9px] font-black text-white shadow-[0_8px_20px_rgba(21,87,214,.20)] sm:hidden">Get Your SBC Card</button>
          </div>

        </div>
      </header>

      {/* HERO SLIDER — COMPLETE IMAGE PER SLIDE */}
      <section className="relative overflow-hidden bg-[#07111f]">
        <div className="relative flex w-full items-center justify-center bg-white sm:min-h-[520px] lg:min-h-[650px]">
          <div className="relative w-full overflow-hidden bg-white">
            {slides.map((item, index) => (
              <img
                key={item.image}
                src={item.image}
                alt={`${item.title} ${item.highlight} - Student Benefit Card`}
                className={`block h-auto w-full max-w-none object-contain transition-opacity duration-500 ease-in-out ${
                  index === slide
                    ? "relative opacity-100"
                    : "absolute inset-0 opacity-0"
                }`}
              />
            ))}
          </div>

          <div className="absolute bottom-5 left-1/2 z-40 flex -translate-x-1/2 gap-2.5">
            {slides.map((item, index) => (
              <button
                key={item.image}
                type="button"
                aria-label={`Go to slide ${index + 1}`}
                onClick={() => setSlide(index)}
                className={`h-2.5 rounded-full shadow ${
                  slide === index
                    ? "w-9 bg-[#f6c934]"
                    : "w-2.5 bg-white/70"
                }`}
              />
            ))}
          </div>
        </div>
      </section>
      {/* CATEGORIES */}
      <section className="border-b border-black/[.05] bg-white px-4 py-8 sm:px-6">
        <div className="mx-auto grid max-w-[1400px] grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {categories.map(([icon, name, sub, background]) => (
            <button
              key={name}
              type="button"
              onClick={() => go("/student/login")}
              className={`group relative overflow-hidden rounded-2xl border border-black/[.06] ${background} p-4 text-center shadow-[0_8px_25px_rgba(7,17,31,.05)] transition hover:-translate-y-1 hover:shadow-lg`}
            >
              <span className="pointer-events-none absolute -right-2 -top-3 text-[72px] leading-none opacity-[0.07]">
                {icon}
              </span>
              <div className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/75 text-2xl shadow-sm backdrop-blur-sm transition group-hover:scale-105">
                {icon}
              </div>
              <p className="relative mt-3 text-xs font-black">{name}</p>
              <p className="relative mt-1 text-[9px] font-medium text-slate-500">{sub}</p>
            </button>
          ))}
        </div>
      </section>

      {/* STATS */}
      <section className="px-4 py-8 sm:px-6">
        <div className="mx-auto grid max-w-[1400px] grid-cols-2 overflow-hidden rounded-3xl border border-[#dce7f7] bg-[#f7faff] sm:grid-cols-4">
          {[
            ["10,000+", "Students Registered", "👥"],
            ["500+", "Partner Businesses", "🏪"],
            ["50+", "Colleges Onboard", "🎓"],
            ["1000+", "Exclusive Offers", "🏷️"],
          ].map(([number, label, icon]) => (
            <div key={label} className="flex items-center justify-center gap-3 border-black/[.06] px-4 py-6 sm:border-r last:border-r-0">
              <span className="text-2xl">{icon}</span>
              <div>
                <p className="text-2xl font-black">{number}</p>
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURED OFFERS */}
      <section className="border-b border-black/[.05] bg-white px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-[1400px] text-center">
          <p className="text-[10px] font-black uppercase tracking-[.22em] text-[#1557d6]">
            FEATURED OFFERS
          </p>
          <h2 className="mt-2 text-3xl font-black sm:text-4xl">Popular Student Deals</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">
            Save more at brands and businesses loved by students.
          </p>
          <button
            type="button"
            onClick={() => go("/student/login")}
            className="mt-6 rounded-xl border-2 border-[#1557d6] px-6 py-3 text-sm font-black text-[#1557d6] transition hover:bg-blue-50"
          >
            View All Offers →
          </button>
        </div>
      </section>

      {/* PARTNER WITH SBC */}
      <section className="overflow-hidden bg-[#eef6ff] px-4 py-10 sm:px-6 sm:py-14">
        <div className="mx-auto max-w-[1400px]">
          <div className="relative overflow-hidden rounded-[2rem] border border-[#d7e7ff] bg-white/55 p-6 shadow-[0_12px_40px_rgba(21,87,214,.08)] sm:p-10">
            <div className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full bg-[#1557d6]/[.06]" />
            <div className="pointer-events-none absolute -bottom-20 right-24 h-44 w-44 rounded-full bg-[#f6c934]/[.10]" />

            <div className="relative">
              <p className="text-[10px] font-black uppercase tracking-[.25em] text-[#1557d6]">
                PARTNER WITH SBC
              </p>
              <div className="mt-2 max-w-2xl">
                <h2 className="text-3xl font-black leading-tight text-[#07111f] sm:text-4xl">
                  Grow Your Business with Students
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-slate-500 sm:text-base">
                  Join SBC and connect with students. Increase your visibility, reach and sales with exclusive student benefits.
                </p>
              </div>

              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => go("/business/register")}
                  className="rounded-2xl bg-[#1557d6] px-5 py-4 text-left text-white shadow-[0_12px_30px_rgba(21,87,214,.18)] transition hover:-translate-y-0.5"
                >
                  <span className="flex items-center gap-3 text-sm font-black sm:text-base">
                    <span className="text-2xl">🏪</span>
                    Business Register
                  </span>
                  <span className="mt-1 block pl-9 text-xs font-medium text-white/75 sm:text-sm">
                    List your business on SBC →
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => go("/business/login")}
                  className="rounded-2xl bg-[#07111f] px-5 py-4 text-left text-white shadow-[0_12px_30px_rgba(7,17,31,.12)] transition hover:-translate-y-0.5"
                >
                  <span className="flex items-center gap-3 text-sm font-black sm:text-base">
                    <span className="text-2xl">🔐</span>
                    Business Login
                  </span>
                  <span className="mt-1 block pl-9 text-xs font-medium text-white/65 sm:text-sm">
                    Access your dashboard →
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="bg-[#f7faff] px-4 py-14 sm:px-6">
        <div className="mx-auto max-w-[1200px] text-center">
          <p className="text-[10px] font-black uppercase tracking-[.22em] text-[#1557d6]">SIMPLE & SECURE</p>
          <h2 className="mt-2 text-3xl font-black sm:text-4xl">How SBC Works</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-500">
            One simple flow from discovering a deal to enjoying your student benefit.
          </p>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["01", "Find an Offer", "Browse exclusive student offers from partner businesses.", "🔎"],
              ["02", "Tap Redeem", "Choose the offer you want and send a redemption request.", "🎁"],
              ["03", "Business Approves", "Get real-time approval from the partner business.", "✅"],
              ["04", "Enjoy & Save", "Show your approved redemption and enjoy the benefit.", "⭐"],
            ].map(([number, title, text, icon]) => (
              <div key={number} className="rounded-3xl bg-white p-7 shadow-[0_10px_30px_rgba(7,17,31,.06)]">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#eaf2ff] text-2xl">
                  {icon}
                </div>
                <p className="mt-5 text-[9px] font-black tracking-widest text-[#1557d6]">{number}</p>
                <h3 className="mt-1 text-base font-black">{title}</h3>
                <p className="mt-2 text-xs leading-5 text-slate-500">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ABOUT / STUDENT VALUE */}
      <section id="about" className="px-4 py-14 sm:px-6">
        <div className="mx-auto grid max-w-[1400px] items-center gap-10 lg:grid-cols-[1fr_1fr]">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.22em] text-[#1557d6]">
              ONE CARD. MANY BENEFITS.
            </p>
            <h2 className="mt-3 text-3xl font-black sm:text-5xl">
              Built around the way students live.
            </h2>
            <p className="mt-5 max-w-xl text-sm leading-7 text-slate-600">
              Student Benefit Card helps students discover exclusive discounts,
              offers, rewards and savings from partner businesses — all through
              one simple digital platform.
            </p>

            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              {[
                ["💰", "Real Savings", "Exclusive benefits made for students."],
                ["⚡", "Simple Redemption", "Request and get approval digitally."],
                ["🎁", "Reward Points", "Get more value from eligible activity."],
                ["🛡️", "Trusted Partners", "A growing network of businesses."],
              ].map(([icon, title, text]) => (
                <div key={title} className="rounded-2xl border border-black/[.06] p-4">
                  <span className="text-xl">{icon}</span>
                  <p className="mt-2 text-xs font-black">{title}</p>
                  <p className="mt-1 text-[10px] leading-4 text-slate-500">{text}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-[#eef6ff] via-[#f7fbff] to-[#e9f1ff] p-5 shadow-[0_20px_60px_rgba(21,87,214,.10)] sm:p-7">
            <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full border-[32px] border-[#1557d6]/[.08]" />
            <div className="pointer-events-none absolute -bottom-20 -left-16 h-52 w-52 rounded-full border-[30px] border-[#d4af37]/[.10]" />

            <div className="relative z-10">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[.22em] text-[#1557d6]">
                    DIGITAL MEMBERSHIP CARD
                  </p>
                  <h3 className="mt-1 text-xl font-black text-[#07111f] sm:text-2xl">
                    Your SBC Digital Card
                  </h3>
                </div>
                <div className="rounded-full bg-emerald-50 px-3 py-2 text-[9px] font-black uppercase tracking-wider text-emerald-700 shadow-sm">
                  ✓ Secure
                </div>
              </div>

              <div className="mx-auto w-full max-w-[560px] overflow-hidden rounded-[1.5rem] border border-white/20 bg-gradient-to-br from-[#101b2d] via-[#07111f] to-[#020812] p-5 text-white shadow-[0_25px_55px_rgba(7,17,31,.28)] sm:p-7">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#f4d35e] to-[#b18a16] text-[10px] font-black text-[#07111f] shadow-md">
                        SBC
                      </span>
                      <div>
                        <p className="text-[10px] font-black tracking-[.12em]">STUDENT BENEFIT CARD</p>
                        <p className="text-[7px] font-semibold tracking-[.16em] text-white/50">MORE BENEFITS. MORE SAVINGS.</p>
                      </div>
                    </div>
                  </div>
                  <span className="rounded-lg border border-[#d4af37]/30 bg-[#d4af37]/10 px-2.5 py-1.5 text-[8px] font-black uppercase tracking-wider text-[#f4d35e]">
                    STUDENT
                  </span>
                </div>

                <div className="mt-6 grid grid-cols-[1fr_auto] items-end gap-4">
                  <div>
                    <p className="text-[8px] font-bold uppercase tracking-[.18em] text-white/40">Card Holder</p>
                    <p className="mt-1 text-base font-black sm:text-lg">Your Name</p>
                    <p className="mt-3 text-[8px] font-bold uppercase tracking-[.18em] text-white/40">SBC Number</p>
                    <p className="mt-1 text-xs font-bold tracking-[.12em] text-white/85">SBCSTU100234</p>
                    <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
                      <div>
                        <p className="text-[7px] font-bold uppercase tracking-wider text-white/40">Course</p>
                        <p className="mt-0.5 text-[9px] font-semibold text-white/80">B.Tech</p>
                      </div>
                      <div>
                        <p className="text-[7px] font-bold uppercase tracking-wider text-white/40">College</p>
                        <p className="mt-0.5 text-[9px] font-semibold text-white/80">Your College</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl bg-white p-2.5 shadow-lg">
                    <div className="grid h-20 w-20 grid-cols-5 gap-1 sm:h-24 sm:w-24">
                      {[1,0,1,1,0,0,1,0,1,0,1,1,1,0,1,1,0,0,1,1,0,1,1,0,1].map((bit, i) => (
                        <span key={i} className={bit ? "bg-[#07111f]" : "bg-white"} />
                      ))}
                    </div>
                    <p className="mt-1 text-center text-[6px] font-black uppercase tracking-wider text-slate-500">Verify</p>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1.5 text-[8px] font-black text-emerald-300">
                    <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-400 text-[8px] text-[#07111f]">✓</span>
                    VERIFIED STUDENT
                  </span>
                  <span className="text-[8px] font-bold uppercase tracking-[.16em] text-[#f4d35e]">DIGITAL • SECURE</span>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {[
                  ["🛡️", "Secure", "Protected student access"],
                  ["✓", "Verified", "Student membership verified"],
                  ["🤝", "Trusted", "Accepted by SBC partners"],
                ].map(([icon, title, text]) => (
                  <div key={title} className="rounded-2xl border border-white bg-white/80 p-3 shadow-sm backdrop-blur-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{icon}</span>
                      <p className="text-[10px] font-black text-[#07111f]">{title}</p>
                    </div>
                    <p className="mt-1 text-[8px] leading-4 text-slate-500">{text}</p>
                  </div>
                ))}
              </div>

              <p className="mt-4 text-center text-[9px] font-semibold text-slate-500">
                Your digital SBC card is secure, verified and available inside your student account.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* BUSINESS CTA */}
      <section className="px-4 pb-14 sm:px-6">
        <div className="mx-auto max-w-[1400px] overflow-hidden rounded-[2.5rem] bg-[#07111f] px-6 py-10 text-white sm:px-10 lg:px-14 lg:py-12">
          <div className="grid items-center gap-8 lg:grid-cols-[1.2fr_1fr]">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.22em] text-[#e1c04e]">FOR BUSINESSES</p>
              <h2 className="mt-3 text-3xl font-black sm:text-4xl">Partner with SBC.</h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-white/60">
                Connect with students, promote exclusive offers and grow your
                business through a simple digital student benefits platform.
              </p>
              <button
                type="button"
                onClick={() => go("/business/register")}
                className="mt-6 rounded-2xl bg-[#d4af37] px-6 py-4 text-sm font-black text-[#07111f] transition hover:-translate-y-1"
              >
                Register Your Business →
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                ["👥", "More Customers"],
                ["📣", "Brand Visibility"],
                ["⚡", "Easy Redemption"],
                ["🤝", "Partner Support"],
              ].map(([icon, text]) => (
                <div key={text} className="rounded-2xl border border-white/10 bg-white/[.05] p-5 text-center">
                  <div className="text-2xl">{icon}</div>
                  <p className="mt-3 text-[10px] font-black">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* SEO */}
      <section className="border-t border-black/[.05] px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <p className="text-[10px] font-black uppercase tracking-[.2em] text-[#1557d6]">
            STUDENT DISCOUNTS • OFFERS • BENEFITS
          </p>
          <h2 className="mt-3 text-3xl font-black sm:text-4xl">
            Student Discounts and Exclusive Offers
          </h2>
          <div className="mt-5 grid gap-5 text-sm leading-7 text-slate-600 sm:grid-cols-2">
            <p>
              Student Benefit Card (SBC) is a student benefits platform that
              helps students discover exclusive discounts, offers, rewards and
              savings from partner businesses.
            </p>
            <p>
              Students can explore offers from restaurants, cafes, salons,
              shopping stores and other student-friendly businesses, then use
              their SBC account to access eligible benefits.
            </p>
          </div>
          <div className="mt-6 rounded-3xl border border-blue-100 bg-[#f5f9ff] p-6">
            <h3 className="font-black">Student Offers in Nellore</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              SBC is building a growing network of student offers in Nellore,
              connecting college students with local restaurants, cafes, salons,
              shops and other partner businesses.
            </p>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-black/[.06] px-4 py-8 sm:px-6">
        <div className="mx-auto flex max-w-[1400px] flex-col items-center justify-between gap-4 sm:flex-row">
          <button type="button" onClick={() => go("/")} className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#07111f] text-[10px] font-black text-white">
              SBC
            </span>
            <span className="text-left">
              <span className="block text-xs font-black tracking-[.12em]">STUDENT BENEFIT CARD</span>
              <span className="block text-[9px] text-slate-400">More Benefits. More Savings.</span>
            </span>
          </button>

          <div className="flex flex-wrap justify-center gap-5 text-[10px] font-bold text-slate-500">
            <button type="button" onClick={() => go("/")}>Home</button>
            <button type="button" onClick={() => go("/student/login")}>Students</button>
            <button type="button" onClick={() => go("/business/login")}>Businesses</button>
            <button type="button" onClick={() => go("/student/login")}>Offers</button>
            <button type="button" onClick={() => go("#about")}>About</button>
          </div>

          <p className="text-[10px] text-slate-400">© 2026 SBC. All rights reserved.</p>
        </div>
      </footer>

      {/* MOBILE APP NAV — SAME FLOATING STYLE AS STUDENT DASHBOARD / OFFERS */}
      <div className="fixed bottom-3 left-1/2 z-50 w-[calc(100%-18px)] max-w-md -translate-x-1/2 rounded-[1.5rem] border border-white/15 bg-[#07111f]/95 px-2 py-2 shadow-[0_20px_55px_rgba(7,17,31,.35)] backdrop-blur-xl sm:hidden">
        <div className="grid grid-cols-4 gap-1">
          {[
            { icon: "⌂", label: "Home", path: "/", active: true },
            { icon: "♙", label: "Student Login", path: "/student/login", active: false },
            { icon: "▣", label: "Business Login", path: "/business/login", active: false },
            { icon: "⚙", label: "Admin Login", path: "/admin/login", active: false },
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => go(item.path)}
              className={`relative flex min-w-0 flex-col items-center justify-center rounded-[1.15rem] px-1 py-2.5 transition active:scale-95 ${
                item.active
                  ? "border border-[#d4af37]/80 bg-[#07111f] text-[#f4d35e] shadow-[inset_0_0_0_1px_rgba(212,175,55,.20)]"
                  : "text-white/85 hover:bg-white/[.05] hover:text-white"
              }`}
            >
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-xl text-[20px] leading-none ${
                  item.active
                    ? "bg-[#d4af37] text-[#07111f] shadow-[0_7px_16px_rgba(212,175,55,.24)]"
                    : "bg-white/[.06] text-white"
                }`}
              >
                {item.icon}
              </span>
              <span className="mt-1 text-[8px] font-black leading-tight sm:text-[9px]">
                {item.label}
              </span>
              {item.active && (
                <span className="absolute bottom-0.5 h-1 w-10 rounded-full bg-[#f4d35e]" />
              )}
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
