import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | Artrium Space",
  description:
    "How Artrium collects, uses, stores, and protects your information when you use the Artrium mobile application.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <header className="border-b border-black/10 px-6 py-6 dark:border-white/10">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link
            href="/"
            className="text-sm font-medium text-[var(--foreground)] underline-offset-4 hover:underline"
          >
            ← Back to Artrium Space
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="mb-2 text-3xl font-semibold tracking-tight">
          Privacy Policy
        </h1>
        <p className="mb-10 text-sm text-black/60 dark:text-white/60">
          Last updated: April 18, 2026
        </p>

        <div className="space-y-10 text-[15px] leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-lg font-semibold tracking-tight">
              1. Introduction
            </h2>
            <p>
              Artrium (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;)
              operates the Artrium mobile application. This Privacy Policy
              explains how we collect, use, and protect your information when
              you use our app.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold tracking-tight">
              2. Information We Collect
            </h2>
            <p>When you create an account, we collect:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <span className="font-medium">Email address</span> — used for
                account authentication and verification
              </li>
              <li>
                <span className="font-medium">Username</span> — your public
                display name on the platform
              </li>
              <li>
                <span className="font-medium">Phone number (optional)</span> —
                if provided during sign-up
              </li>
              <li>
                <span className="font-medium">Google account information</span>{" "}
                — if you choose to sign in with Google, we receive your name and
                email address from Google
              </li>
            </ul>
            <p>When you use the app, we may collect:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>Profile information you choose to provide</li>
              <li>
                Content you post or interact with (events, opportunities,
                community posts)
              </li>
              <li>Usage data and app activity</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold tracking-tight">
              3. How We Use Your Information
            </h2>
            <p>We use your information to:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>Create and manage your account</li>
              <li>Send account verification and password reset emails</li>
              <li>Display your profile and content to other users</li>
              <li>Improve and operate the Artrium platform</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold tracking-tight">
              4. Data Storage
            </h2>
            <p>
              Your data is stored securely using Amazon Web Services (AWS),
              including AWS Cognito for authentication and DynamoDB for
              application data. We do not sell your personal information to
              third parties.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold tracking-tight">
              5. Third-Party Services
            </h2>
            <p>We use the following third-party services:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <span className="font-medium">AWS Cognito</span> —
                authentication and user management
              </li>
              <li>
                <span className="font-medium">Google Sign-In</span> — optional
                third-party authentication
              </li>
              <li>
                <span className="font-medium">Amazon SES</span> — transactional
                email delivery
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold tracking-tight">
              6. Data Retention
            </h2>
            <p>
              We retain your data for as long as your account is active. You may
              request account deletion by contacting us, after which we will
              delete your personal data within 30 days.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold tracking-tight">
              7. Children&apos;s Privacy
            </h2>
            <p>
              Artrium is not directed at children under 13. We do not knowingly
              collect personal information from children under 13.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold tracking-tight">
              8. Your Rights
            </h2>
            <p>You have the right to:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>Access the personal data we hold about you</li>
              <li>Request correction or deletion of your data</li>
              <li>
                Withdraw consent at any time by deleting your account
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold tracking-tight">
              9. Contact Us
            </h2>
            <p>
              If you have any questions about this Privacy Policy, please
              contact us at:{" "}
              <a
                href="mailto:allen.wang831@gmail.com"
                className="font-medium underline underline-offset-2"
              >
                allen.wang831@gmail.com
              </a>
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold tracking-tight">
              10. Changes to This Policy
            </h2>
            <p>
              We may update this Privacy Policy from time to time. We will
              notify you of significant changes via email or in-app notification.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
