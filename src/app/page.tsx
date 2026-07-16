"use client"

import { useState, useCallback } from "react"
import Image from "next/image"
import Link from "next/link"
import { LoadingScreen } from "@/components/ui/loading-screen"
import {
  BrainCircuit,
  BarChart3,
  Users,
  Eye,
  ArrowRight,
  Sparkles,
  MonitorPlay,
  MessageCircleQuestion,
  ImageIcon,
  UserPlus,
  Settings2,
  Zap,
} from "lucide-react"

const features = [
  {
    icon: MonitorPlay,
    title: "Live AI Teaching",
    description:
      "AI hosts your class in real time — explains topics, plays relevant videos, and keeps students engaged.",
  },
  {
    icon: MessageCircleQuestion,
    title: "Instant Doubt Solving",
    description:
      "Students ask questions and get clear, accurate AI-powered answers instantly — no waiting.",
  },
  {
    icon: ImageIcon,
    title: "Visual Generation",
    description:
      "AI generates diagrams, charts, and illustrations on the fly to make complex concepts click.",
  },
  {
    icon: BarChart3,
    title: "Session Analytics",
    description:
      "Track engagement, participation, and understanding with detailed post-session reports.",
  },
]

const steps = [
  {
    icon: Settings2,
    step: "01",
    title: "Create a Session",
    description: "Teacher creates a session and sets the topics to cover.",
  },
  {
    icon: UserPlus,
    step: "02",
    title: "Students Join",
    description: "Students join with a code — no signup or install needed.",
  },
  {
    icon: Zap,
    step: "03",
    title: "AI Takes Over",
    description:
      "AI teaches, shows visuals, plays videos, and answers doubts live.",
  },
]

export default function Home() {
  const [isLoading, setIsLoading] = useState(true)
  const [joinCode, setJoinCode] = useState("")

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault()
    if (joinCode.trim()) {
      window.location.href = `/session/${joinCode.trim().toUpperCase()}`
    }
  }

  const handleLoadingComplete = useCallback(() => {
    setIsLoading(false)
  }, [])

  return (
    <>
      {/* Loading Screen */}
      {isLoading && <LoadingScreen onComplete={handleLoadingComplete} />}

      {/* Main Content */}
      <main
        className={`flex-1 transition-opacity duration-700 ${
          isLoading ? "opacity-0" : "opacity-100"
        }`}
      >
        {/* ─── Sticky Navbar ─── */}
        <nav className="fixed top-0 left-0 right-0 z-40 border-b border-white/5 bg-background/80 backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
            {/* Left: Logo */}
            <Link
              href="/"
              className="flex items-center gap-2.5 border-l-2 border-purple-500/40 pl-3 drop-shadow-[0_0_8px_rgba(147,51,234,0.3)] transition-all hover:border-purple-500/70"
            >
              <Image src="/logo.png" alt="Class AI" width={36} height={36} />
              <span className="text-xl font-bold tracking-tight text-white">
                Class<span className="text-purple-400">AI</span>
              </span>
            </Link>

            {/* Center: Nav links */}
            <div className="hidden items-center gap-8 md:flex">
              <Link
                href="#features-section"
                className="text-sm text-white/50 transition-colors hover:text-white"
              >
                Features
              </Link>
              <Link
                href="#how-it-works"
                className="text-sm text-white/50 transition-colors hover:text-white"
              >
                How it Works
              </Link>
              <Link
                href="#pricing"
                className="text-sm text-white/50 transition-colors hover:text-white"
              >
                Pricing
              </Link>
            </div>

            {/* Right: Auth buttons */}
            <div className="flex items-center gap-3">
              <Link
                href="/auth?mode=signin"
                id="sign-in-btn"
                className="rounded-lg px-4 py-2 text-sm font-medium text-white/70 transition-colors hover:text-white"
              >
                Sign In
              </Link>
              <Link
                href="/auth?mode=signup"
                id="nav-get-started-btn"
                className="rounded-lg bg-gradient-to-r from-purple-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-purple-500/20 transition-all hover:shadow-purple-500/30 hover:brightness-110"
              >
                Get Started
              </Link>
            </div>
          </div>
        </nav>

        {/* ─── Hero Section ─── */}
        <section className="relative flex min-h-[70vh] items-center justify-center bg-background pt-28 pb-16">
          {/* Hero content */}
          <div className="relative z-10 mx-auto max-w-4xl px-6 text-center">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-purple-500/20 bg-purple-500/10 px-4 py-1.5 text-sm text-purple-300">
              <Sparkles className="h-3.5 w-3.5" />
              AI-Powered Classroom Intelligence
            </div>

            <h1 className="mb-6 text-5xl font-bold leading-[1.1] tracking-tight text-white md:text-7xl">
              Teach Smarter
              <br />
              <span className="bg-gradient-to-r from-purple-400 via-violet-400 to-indigo-400 bg-clip-text text-transparent">
                with AI
              </span>
            </h1>

            <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-muted-foreground md:text-xl">
              AI hosts your live class, answers student doubts, plays videos and
              generates visuals — in real time.
            </p>

            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/auth?mode=signup"
                id="get-started-btn"
                className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-violet-600 px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-purple-500/25 transition-all hover:shadow-purple-500/40 hover:brightness-110"
              >
                Get Started
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="#features-section"
                id="learn-more-btn"
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-8 py-3.5 text-sm font-semibold text-white/80 backdrop-blur-sm transition-all hover:bg-white/10 hover:text-white"
              >
                Learn More
              </Link>
            </div>

            <div className="mt-12 flex flex-col items-center justify-center">
              <p className="text-sm text-white/50 mb-3">Are you a student?</p>
              <form onSubmit={handleJoin} className="flex items-center gap-2 max-w-sm w-full relative">
                <input
                  type="text"
                  placeholder="Enter Session Code (e.g. CLASS-XXXX)"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  suppressHydrationWarning={true}
                  className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 transition-all uppercase"
                />
                <button
                  type="submit"
                  disabled={!joinCode.trim()}
                  className="absolute right-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Join
                </button>
              </form>
            </div>
          </div>
        </section>

        <div className="border-t border-[#1a1a1a]" />

        {/* ─── Features Section ─── */}
        <section className="relative py-12" id="features-section">
          <div className="mx-auto max-w-6xl px-6">
            <div className="mb-14 text-center">
              <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-purple-400">
                Features
              </p>
              <h2 className="text-3xl font-bold text-white md:text-4xl">
                Everything you need to{" "}
                <span className="bg-gradient-to-r from-purple-400 to-violet-400 bg-clip-text text-transparent">
                  transform your classroom
                </span>
              </h2>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {features.map((feature) => (
                <div
                  key={feature.title}
                  className="group relative overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02] p-6 transition-all duration-300 hover:border-purple-500/20 hover:bg-white/[0.04]"
                >
                  <div className="absolute -inset-px rounded-2xl bg-gradient-to-b from-purple-500/10 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                  <div className="relative">
                    <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400 transition-colors group-hover:bg-purple-500/20">
                      <feature.icon className="h-5 w-5" />
                    </div>
                    <h3 className="mb-2 text-lg font-semibold text-white">
                      {feature.title}
                    </h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {feature.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="border-t border-[#1a1a1a]" />

        {/* ─── How it Works Section ─── */}
        <section className="relative py-12" id="how-it-works">
          <div className="mx-auto max-w-5xl px-6">
            <div className="mb-14 text-center">
              <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-purple-400">
                How it Works
              </p>
              <h2 className="text-3xl font-bold text-white md:text-4xl">
                Up and running in{" "}
                <span className="bg-gradient-to-r from-purple-400 to-violet-400 bg-clip-text text-transparent">
                  3 simple steps
                </span>
              </h2>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {steps.map((step, i) => (
                <div key={step.step} className="relative">
                  {/* Connector line */}
                  {i < steps.length - 1 && (
                    <div className="absolute right-0 top-12 hidden h-[2px] w-6 translate-x-full bg-gradient-to-r from-purple-500/40 to-transparent md:block" />
                  )}
                  <div className="group rounded-2xl border border-white/5 bg-white/[0.02] p-8 text-center transition-all duration-300 hover:border-purple-500/15 hover:bg-white/[0.04]">
                    {/* Step number */}
                    <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-400 transition-colors group-hover:bg-purple-500/20">
                      <step.icon className="h-6 w-6" />
                    </div>
                    <span className="mb-2 block text-xs font-bold uppercase tracking-[0.2em] text-purple-400/60">
                      Step {step.step}
                    </span>
                    <h3 className="mb-2 text-lg font-semibold text-white">
                      {step.title}
                    </h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {step.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="border-t border-[#1a1a1a]" />

        {/* ─── CTA Section ─── */}
        <section className="relative py-10">
          <div className="mx-auto max-w-4xl px-6 text-center">
            <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-gradient-to-b from-purple-500/10 to-transparent p-12 md:p-16">
              <div className="relative z-10">
                <h2 className="mb-4 text-3xl font-bold text-white md:text-4xl">
                  Ready to transform your classroom?
                </h2>
                <p className="mx-auto mb-8 max-w-xl text-muted-foreground">
                  Join educators worldwide who are using AI to create more
                  engaging and effective learning environments.
                </p>
                <Link
                  href="/auth?mode=signup"
                  id="cta-start-btn"
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-violet-600 px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-purple-500/25 transition-all hover:shadow-purple-500/40 hover:brightness-110"
                >
                  Start Free Trial
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        <div className="border-t border-[#1a1a1a]" />

        {/* ─── Footer ─── */}
        <footer className="py-5">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 sm:flex-row">
            {/* Left: Logo */}
            <div className="flex items-center gap-2.5">
              <Image src="/logo.png" alt="Class AI" width={24} height={24} />
              <span className="text-sm font-semibold text-white/50">
                Class<span className="text-purple-400/60">AI</span>
              </span>
            </div>

            {/* Center: Links */}
            <div className="flex items-center gap-6">
              <Link
                href="#"
                className="text-xs text-white/30 transition-colors hover:text-white/60"
              >
                Privacy
              </Link>
              <Link
                href="#"
                className="text-xs text-white/30 transition-colors hover:text-white/60"
              >
                Terms
              </Link>
              <Link
                href="#"
                className="text-xs text-white/30 transition-colors hover:text-white/60"
              >
                Contact
              </Link>
            </div>

            {/* Right: Copyright */}
            <p className="text-xs text-white/20">
              © 2025 Class AI. All rights reserved.
            </p>
          </div>
        </footer>
      </main>
    </>
  )
}
