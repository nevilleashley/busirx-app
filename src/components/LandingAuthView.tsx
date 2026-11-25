import React, { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { ArrowRight, CheckCircle2, FileCheck2, Lock, ShieldCheck, RefreshCw } from 'lucide-react';
import { auth, googleAuthProvider } from '../lib/firebase.ts';
import { BLUEPRINT_CATEGORIES, SUBSCRIPTION_PLANS } from '../lib/domain.ts';

interface LandingAuthViewProps {
  unverifiedUser: User | null;
  onRefreshVerification: () => Promise<void>;
}

export function LandingAuthView({
  unverifiedUser,
  onRefreshVerification,
}: LandingAuthViewProps) {
  const [authMode, setAuthMode] = useState<'google' | 'email_signin' | 'email_signup'>('google');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  const handleGoogleSignIn = async () => {
    setErrorMsg('');
    setInfoMsg('');
    setBusy(true);
    try {
      await signInWithPopup(auth, googleAuthProvider);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Google sign-in could not be completed. Please try again.'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');
    setBusy(true);
    try {
      if (authMode === 'email_signup') {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await sendEmailVerification(cred.user);
        setInfoMsg(
          'Account created. Please click the verification link sent to your email address, then click "I Verified My Email".'
        );
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Authentication failed.';
      if (msg.includes('auth/operation-not-allowed')) {
        setErrorMsg(
          'Email/Password sign-in is not enabled in Firebase Console yet. Use "Continue with Google" below (instant verified login), or enable Email/Password under Firebase Console > Authentication > Sign-in method.'
        );
      } else {
        setErrorMsg(msg);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleResendVerification = async () => {
    if (!unverifiedUser) return;
    setErrorMsg('');
    setBusy(true);
    try {
      await sendEmailVerification(unverifiedUser);
      setInfoMsg('Verification email resent. Check your inbox and spam folder.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to resend verification email.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F7FB] text-[#1C1B22]">
      {/* Strict 3-zone Top Bar Contract */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-[#E6E2F0]">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-8">
          <a
            href="#top"
            className="font-display text-lg font-bold tracking-tight text-[#4C1D95] whitespace-nowrap shrink-0"
          >
            Busi Rx
          </a>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-[#4A4756]">
            <a href="#workflow" className="hover:text-[#1C1B22] transition-colors whitespace-nowrap shrink-0">
              Workflow
            </a>
            <a href="#blueprint" className="hover:text-[#1C1B22] transition-colors whitespace-nowrap shrink-0">
              Blueprint
            </a>
            <a href="#automation" className="hover:text-[#1C1B22] transition-colors whitespace-nowrap shrink-0">
              Automation
            </a>
            <a href="#pricing" className="hover:text-[#1C1B22] transition-colors whitespace-nowrap shrink-0">
              Pricing
            </a>
          </nav>

          <div className="shrink-0">
            <a
              href="#auth-panel"
              className="px-4 py-2 text-xs font-semibold bg-[#4C1D95] text-white rounded-lg hover:bg-[#3B1478] transition-colors whitespace-nowrap shrink-0 inline-block"
            >
              Get Started
            </a>
          </div>
        </div>
      </header>

      <main id="top">
        {/* Hero Split */}
        <section className="max-w-6xl mx-auto px-6 py-16 lg:py-20 grid grid-cols-1 lg:grid-cols-12 gap-12 items-stretch">
          <div className="lg:col-span-7 flex flex-col justify-center">
            <p className="text-sm font-medium text-[#4C1D95] mb-3">
              The Prescription for a Healthier Business
            </p>
            <h1
              className="font-display text-4xl lg:text-5xl font-bold tracking-tight text-[#1C1B22] leading-[1.12] mb-5"
              style={{ textWrap: 'balance' }}
            >
              Turn business requirements into an approved operating plan.
            </h1>
            <p className="text-base text-[#4A4756] leading-relaxed max-w-2xl mb-8">
              Busi Rx interviews you about your industry, jurisdiction, legal structure, and team,
              generates a structured 10-category operating blueprint with Gemini, and converts only
              what you approve into tracked tasks, renewal reminders, and recurring schedules.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-6 border-t border-[#E6E2F0]">
              <div>
                <p className="font-mono-tabular text-2xl font-semibold text-[#1C1B22]">10</p>
                <p className="text-xs text-[#6E6A7C] mt-1">
                  Operational &amp; compliance blueprint categories
                </p>
              </div>
              <div>
                <p className="font-mono-tabular text-2xl font-semibold text-[#059669]">3 Tiers</p>
                <p className="text-xs text-[#6E6A7C] mt-1">
                  Verified rules, recommendations &amp; confirmation flags
                </p>
              </div>
              <div>
                <p className="font-mono-tabular text-2xl font-semibold text-[#4C1D95]">100%</p>
                <p className="text-xs text-[#6E6A7C] mt-1">
                  Owner approval gate before filings or payments
                </p>
              </div>
            </div>
          </div>

          {/* Auth / Verification Card */}
          <div id="auth-panel" className="lg:col-span-5 flex flex-col justify-center">
            <div className="bg-white border border-[#E6E2F0] rounded-xl p-7">
              {unverifiedUser ? (
                <div>
                  <div className="flex items-center gap-2 text-[#4C1D95] mb-3">
                    <ShieldCheck className="w-5 h-5" />
                    <h2 className="font-display text-lg font-semibold text-[#1C1B22]">
                      Verify your email address
                    </h2>
                  </div>
                  <p className="text-sm text-[#4A4756] leading-relaxed mb-4">
                    Signed in as <span className="font-medium text-[#1C1B22]">{unverifiedUser.email}</span>.
                    Busi Rx requires a verified email before creating or accessing private business records.
                  </p>
                  {errorMsg && (
                    <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                      {errorMsg}
                    </div>
                  )}
                  {infoMsg && (
                    <div className="mb-4 p-3 rounded-lg bg-[#ECFDF5] border border-[#A7F3D0] text-xs text-[#065F46]">
                      {infoMsg}
                    </div>
                  )}
                  <div className="space-y-3">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={onRefreshVerification}
                      className="w-full py-2.5 px-4 text-sm font-semibold bg-[#4C1D95] text-white rounded-lg hover:bg-[#3B1478] transition-colors flex items-center justify-center gap-2"
                    >
                      <RefreshCw className="w-4 h-4" />
                      I Verified My Email
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={handleResendVerification}
                      className="w-full py-2.5 px-4 text-sm font-medium bg-[#F3EFFC] text-[#4C1D95] rounded-lg hover:bg-[#E8E0FA] transition-colors"
                    >
                      Resend Verification Email
                    </button>
                    <button
                      type="button"
                      onClick={() => signOut(auth)}
                      className="w-full py-2 text-xs text-[#6E6A7C] hover:text-[#1C1B22]"
                    >
                      Sign out and use another account
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <h2 className="font-display text-xl font-semibold text-[#1C1B22] mb-1">
                    Access your Busi Rx workspace
                  </h2>
                  <p className="text-sm text-[#6E6A7C] mb-6">
                    Start your business assessment or resume your saved operating dashboard.
                  </p>

                  {errorMsg && (
                    <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 leading-relaxed">
                      {errorMsg}
                    </div>
                  )}
                  {infoMsg && (
                    <div className="mb-4 p-3 rounded-lg bg-[#ECFDF5] border border-[#A7F3D0] text-xs text-[#065F46] leading-relaxed">
                      {infoMsg}
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleGoogleSignIn}
                    className="w-full py-3 px-4 text-sm font-semibold bg-[#4C1D95] text-white rounded-lg hover:bg-[#3B1478] transition-colors flex items-center justify-center gap-2 mb-5"
                  >
                    <span>Continue with Google</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <div className="flex items-center gap-1 p-1 bg-[#F3EFFC] rounded-lg mb-5">
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('email_signin');
                        setErrorMsg('');
                      }}
                      className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                        authMode === 'email_signin'
                          ? 'bg-white text-[#1C1B22]'
                          : 'text-[#4A4756] hover:text-[#1C1B22]'
                      }`}
                    >
                      Email Sign In
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('email_signup');
                        setErrorMsg('');
                      }}
                      className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                        authMode === 'email_signup'
                          ? 'bg-white text-[#1C1B22]'
                          : 'text-[#4A4756] hover:text-[#1C1B22]'
                      }`}
                    >
                      Create Account
                    </button>
                  </div>

                  {authMode !== 'google' && (
                    <form onSubmit={handleEmailAuth} className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-[#4A4756] mb-1">
                          Work Email
                        </label>
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="founder@company.com"
                          className="w-full px-3 py-2 text-sm border border-[#E6E2F0] rounded-lg focus:outline-none focus:border-[#4C1D95]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[#4A4756] mb-1">
                          Password
                        </label>
                        <input
                          type="password"
                          required
                          minLength={6}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Minimum 6 characters"
                          className="w-full px-3 py-2 text-sm border border-[#E6E2F0] rounded-lg focus:outline-none focus:border-[#4C1D95]"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={busy}
                        className="w-full py-2.5 px-4 text-sm font-semibold bg-[#1C1B22] text-white rounded-lg hover:bg-[#2B2933] transition-colors"
                      >
                        {authMode === 'email_signup' ? 'Create Account & Send Verification' : 'Sign In'}
                      </button>
                    </form>
                  )}

                  <div className="mt-5 pt-4 border-t border-[#E6E2F0] flex items-center gap-2 text-xs text-[#6E6A7C]">
                    <Lock className="w-3.5 h-3.5 text-[#059669] shrink-0" />
                    <span>
                      Isolated per-owner Firestore security rules &amp; explicit approval safeguards.
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Workflow Section */}
        <section id="workflow" className="bg-white border-y border-[#E6E2F0] py-16">
          <div className="max-w-6xl mx-auto px-6">
            <div className="max-w-2xl mb-10">
              <p className="text-xs font-semibold text-[#4C1D95] mb-2">How Busi Rx Works</p>
              <h2 className="font-display text-2xl lg:text-3xl font-bold text-[#1C1B22] tracking-tight">
                From diagnostic interview to continuous compliance.
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div>
                <p className="font-mono-tabular text-xs font-semibold text-[#4C1D95] mb-2">01. Diagnose</p>
                <h3 className="font-display text-base font-semibold text-[#1C1B22] mb-2">
                  Conditional Business Assessment
                </h3>
                <p className="text-sm text-[#4A4756] leading-relaxed">
                  Share your legal structure, operating model, jurisdiction, registrations, banking,
                  and workforce setup. Conditional prompts keep onboarding concise.
                </p>
              </div>
              <div>
                <p className="font-mono-tabular text-xs font-semibold text-[#4C1D95] mb-2">02. Prescribe</p>
                <h3 className="font-display text-base font-semibold text-[#1C1B22] mb-2">
                  Transparent 10-Category Blueprint
                </h3>
                <p className="text-sm text-[#4A4756] leading-relaxed">
                  Gemini structures responsibilities without inventing statutory obligations—marking
                  verified requirements, best-practice recommendations, and items needing confirmation.
                </p>
              </div>
              <div>
                <p className="font-mono-tabular text-xs font-semibold text-[#4C1D95] mb-2">03. Maintain</p>
                <h3 className="font-display text-base font-semibold text-[#1C1B22] mb-2">
                  Approved Tasks &amp; Recurrence Engine
                </h3>
                <p className="text-sm text-[#4A4756] leading-relaxed">
                  Approve selected items to generate deduplicated one-time and recurring schedules,
                  bill and license trackers, certification alerts, and audit logs.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 10 Blueprint Categories */}
        <section id="blueprint" className="max-w-6xl mx-auto px-6 py-16">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
            <div>
              <p className="text-xs font-semibold text-[#4C1D95] mb-2">Blueprint Architecture</p>
              <h2 className="font-display text-2xl lg:text-3xl font-bold text-[#1C1B22] tracking-tight">
                Ten operating pillars tailored to your business.
              </h2>
            </div>
            <p className="text-sm text-[#6E6A7C] max-w-md">
              Every generated item includes priority, cadence, owner, jurisdiction, verification
              status, and official source links when verified.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-5 bg-white border border-[#E6E2F0] rounded-xl p-8">
            {BLUEPRINT_CATEGORIES.map((cat) => (
              <div
                key={cat.id}
                className="flex items-start gap-4 pb-4 border-b border-[#F1EEF7] last:border-b-0"
              >
                <span className="font-mono-tabular text-xs font-semibold text-[#4C1D95] pt-0.5 shrink-0">
                  {String(cat.number).padStart(2, '0')}.
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-[#1C1B22]">{cat.name}</h3>
                  <p className="text-xs text-[#6E6A7C] mt-1 leading-relaxed">{cat.summary}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Automation Safeguards */}
        <section id="automation" className="bg-[#1C1B22] text-white py-16">
          <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-6">
              <p className="text-xs font-semibold text-[#A78BFA] mb-2">Human-in-the-Loop Safeguards</p>
              <h2 className="font-display text-2xl lg:text-3xl font-bold tracking-tight mb-4">
                Automation that never acts behind your back.
              </h2>
              <p className="text-sm text-[#D4D0DF] leading-relaxed mb-6">
                Busi Rx automates deadline tracking, recurrence recalculation, and duplicate-free
                reminders—while enforcing explicit owner sign-off before any payment, tax or legal
                filing, or external customer communication.
              </p>
              <ul className="space-y-3 text-sm text-[#E9E6F2]">
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#34D399] shrink-0" />
                  <span>Deduplicated tasks and reminder delivery logs</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#34D399] shrink-0" />
                  <span>Automatic future due-date calculation upon recurring completion</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <FileCheck2 className="w-4 h-4 text-[#34D399] shrink-0" />
                  <span>Immutable audit trail &amp; one-click JSON account data export</span>
                </li>
              </ul>
            </div>

            <div className="lg:col-span-6">
              <div className="bg-[#272530] border border-[#3B3848] rounded-xl p-6 space-y-4">
                <div className="flex items-center justify-between text-xs text-[#A78BFA] pb-3 border-b border-[#3B3848]">
                  <span>Sample Approval Checkpoint</span>
                  <span className="font-mono-tabular text-[#34D399]">Explicit Approval Required</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">
                    File State Annual Report &amp; Franchise Renewal
                  </p>
                  <p className="text-xs text-[#B9B4C9] mt-1">
                    Category: Business formation and registration · Type: Legal Filing · Verification:
                    Needs Confirmation with Secretary of State
                  </p>
                </div>
                <div className="pt-2 flex items-center justify-between text-xs text-[#D4D0DF]">
                  <span>Status: Awaiting Owner Approval</span>
                  <span className="font-mono-tabular">Recurrence: 365 days</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="max-w-6xl mx-auto px-6 py-16">
          <div className="max-w-2xl mb-10">
            <p className="text-xs font-semibold text-[#4C1D95] mb-2">Subscription Plans</p>
            <h2 className="font-display text-2xl lg:text-3xl font-bold text-[#1C1B22] tracking-tight">
              Clear pricing built for every stage of business health.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {SUBSCRIPTION_PLANS.map((plan) => (
              <div
                key={plan.id}
                className={`bg-white rounded-xl p-7 flex flex-col justify-between border ${
                  plan.id === 'business_rx' ? 'border-[#4C1D95]' : 'border-[#E6E2F0]'
                }`}
              >
                <div>
                  <p className="text-xs font-medium text-[#4C1D95] mb-1">{plan.audience}</p>
                  <h3 className="font-display text-xl font-bold text-[#1C1B22]">{plan.name}</h3>
                  <div className="mt-4 mb-6 flex items-baseline gap-1">
                    <span className="font-mono-tabular text-3xl font-bold text-[#1C1B22]">
                      ${plan.priceMonthlyUsd}
                    </span>
                    <span className="text-xs text-[#6E6A7C]">/ month</span>
                  </div>
                  <ul className="space-y-2.5 text-sm text-[#4A4756] mb-8">
                    {plan.features.map((feat) => (
                      <li key={feat} className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-[#059669] mt-0.5 shrink-0" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <a
                  href="#auth-panel"
                  className={`w-full py-2.5 px-4 text-center text-sm font-semibold rounded-lg transition-colors ${
                    plan.id === 'business_rx'
                      ? 'bg-[#4C1D95] text-white hover:bg-[#3B1478]'
                      : 'bg-[#F3EFFC] text-[#4C1D95] hover:bg-[#E8E0FA]'
                  }`}
                >
                  Choose {plan.name}
                </a>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-[#E6E2F0] bg-white py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#6E6A7C]">
          <span>Busi Rx — The Prescription for a Healthier Business.</span>
          <span>Advisory blueprints require owner confirmation for local statutory deadlines.</span>
        </div>
      </footer>
    </div>
  );
}
