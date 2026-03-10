import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: "Privacy Policy — Poopin' Papers",
  description: "Privacy policy for Poopin' Papers, the weekly family bathroom newsletter.",
}

export default function PrivacyPolicy() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-12 text-gray-800">
      <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
      <p className="text-sm text-gray-500 mb-8">Last updated: March 10, 2026</p>

      <div className="space-y-6 text-sm leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold mb-2">What We Collect</h2>
          <p>
            When you sign up for Poopin&apos; Papers, we collect your email address and any household
            information you choose to provide (family name, member names, preferences). We use this
            to generate and deliver your weekly newsletter.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">How We Use Your Information</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Generate your personalized weekly Poopin&apos; Papers newsletter</li>
            <li>Send you preview and final edition emails</li>
            <li>Improve the product and your experience</li>
            <li>Communicate important updates about the service</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">Cookies &amp; Tracking</h2>
          <p>
            We use cookies and similar technologies to understand how visitors interact with our site.
            This includes:
          </p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li><strong>Google Tag Manager / Google Analytics</strong> — for website analytics and understanding traffic patterns</li>
            <li><strong>Meta Pixel (Facebook)</strong> — for measuring the effectiveness of our advertising and delivering relevant ads</li>
          </ul>
          <p className="mt-2">
            These tools may collect information such as your IP address, browser type, pages visited,
            and interactions with our site. You can opt out of interest-based advertising through your
            browser settings or through the{' '}
            <a href="https://optout.aboutads.info/" className="underline text-blue-600" target="_blank" rel="noopener noreferrer">
              Digital Advertising Alliance opt-out page
            </a>.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">Third-Party Services</h2>
          <p>We use the following third-party services to operate Poopin&apos; Papers:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li><strong>Supabase</strong> — database and authentication</li>
            <li><strong>OpenAI</strong> — AI-generated content (jokes, coaching, brain teasers)</li>
            <li><strong>Resend</strong> — email delivery</li>
            <li><strong>Vercel</strong> — hosting</li>
          </ul>
          <p className="mt-2">
            These services have their own privacy policies. We do not sell your personal information
            to any third party.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">Data Retention</h2>
          <p>
            We retain your account data for as long as your account is active. If you delete your
            account, we will remove your personal data within 30 days. Generated newsletters may be
            retained in anonymized form for product improvement.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">Your Rights</h2>
          <p>You can:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Request a copy of your data</li>
            <li>Request deletion of your account and data</li>
            <li>Opt out of marketing emails at any time</li>
            <li>Disable cookies through your browser settings</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">Children&apos;s Privacy</h2>
          <p>
            Poopin&apos; Papers is designed for families, but accounts are managed by adults.
            We do not knowingly collect personal information from children under 13. Family member
            names provided during setup are used solely for newsletter personalization and are
            controlled by the account holder.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">Contact</h2>
          <p>
            Questions about this policy? Email us at{' '}
            <a href="mailto:hello@poopinpapers.com" className="underline text-blue-600">
              hello@poopinpapers.com
            </a>.
          </p>
        </section>

        <section className="border-t pt-4 text-xs text-gray-400">
          <p>
            This policy may be updated from time to time. We&apos;ll notify you of significant
            changes via email.
          </p>
        </section>
      </div>
    </main>
  )
}
