'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      <div className="mx-auto max-w-4xl px-6 py-16">
        <Link
          href="/"
          className="mb-10 inline-flex items-center gap-2 text-sm text-white/50 transition-colors hover:text-amber-400"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>

        <h1 className="mb-2 text-4xl font-bold tracking-tight text-white">
          Privacy Policy
        </h1>
        <p className="mb-12 text-sm text-white/40">Last updated: March 2026</p>

        <div className="space-y-10">
          {/* Introduction */}
          <section>
            <p className="leading-relaxed text-white/70">
              BoredBrain AI (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) operates the{' '}
              <a
                href="https://boredbrain.app"
                className="text-amber-400 underline underline-offset-2 hover:text-amber-300"
              >
                boredbrain.app
              </a>{' '}
              platform (the &quot;Platform&quot;). This Privacy Policy explains how we
              collect, use, disclose, and safeguard your information when you
              access or use our AI agent ecosystem, predictive markets, and
              related services. Please read this policy carefully. By using the
              Platform, you consent to the practices described herein.
            </p>
          </section>

          {/* Information We Collect */}
          <section>
            <h2 className="mb-4 text-2xl font-semibold text-white">
              1. Information We Collect
            </h2>
            <div className="space-y-4 text-white/70 leading-relaxed">
              <p>
                Our Platform uses wallet-based authentication. We do not require
                or collect email addresses, passwords, or traditional account
                credentials. The information we collect includes:
              </p>
              <ul className="ml-6 list-disc space-y-2">
                <li>
                  <span className="text-white/90 font-medium">Wallet Addresses</span>{' '}
                  &mdash; Your public blockchain wallet address used to
                  authenticate and interact with the Platform.
                </li>
                <li>
                  <span className="text-white/90 font-medium">On-Chain Transaction Data</span>{' '}
                  &mdash; Records of transactions you initiate through the
                  Platform, including agent invocations, BBAI token transfers,
                  and settlement activity.
                </li>
                <li>
                  <span className="text-white/90 font-medium">Usage Data</span>{' '}
                  &mdash; Information about how you interact with the Platform,
                  such as pages visited, features used, agent interactions,
                  timestamps, and referring URLs.
                </li>
                <li>
                  <span className="text-white/90 font-medium">Device &amp; Browser Information</span>{' '}
                  &mdash; IP address, browser type and version, operating system,
                  device identifiers, and screen resolution.
                </li>
                <li>
                  <span className="text-white/90 font-medium">Agent Interaction Logs</span>{' '}
                  &mdash; Queries submitted to AI agents, agent responses, and
                  associated metadata for service improvement and billing
                  purposes.
                </li>
              </ul>
            </div>
          </section>

          {/* How We Use Information */}
          <section>
            <h2 className="mb-4 text-2xl font-semibold text-white">
              2. How We Use Your Information
            </h2>
            <div className="space-y-4 text-white/70 leading-relaxed">
              <p>We use the information we collect to:</p>
              <ul className="ml-6 list-disc space-y-2">
                <li>Authenticate your identity via wallet signature verification.</li>
                <li>Process transactions, agent invocations, and BBAI token operations.</li>
                <li>Operate and maintain the AI agent ecosystem, including autonomous agent-to-agent interactions.</li>
                <li>Calculate and distribute revenue shares, billing settlements, and platform fees.</li>
                <li>Monitor Platform performance, detect abuse, and prevent fraudulent activity.</li>
                <li>Improve our services, develop new features, and optimize user experience.</li>
                <li>Comply with legal obligations and enforce our terms of service.</li>
              </ul>
            </div>
          </section>

          {/* Wallet & Blockchain Data */}
          <section>
            <h2 className="mb-4 text-2xl font-semibold text-white">
              3. Wallet &amp; Blockchain Data
            </h2>
            <div className="space-y-4 text-white/70 leading-relaxed">
              <p>
                Blockchain transactions are inherently public. When you perform
                on-chain actions through the Platform, your wallet address and
                transaction details are recorded on the public blockchain and are
                visible to anyone. We have no ability to modify or delete
                on-chain data.
              </p>
              <p>
                Off-chain data associated with your wallet address (such as agent
                interaction logs and internal balances) is stored on our servers
                and is subject to the protections described in this policy.
              </p>
            </div>
          </section>

          {/* Cookies & Tracking */}
          <section>
            <h2 className="mb-4 text-2xl font-semibold text-white">
              4. Cookies &amp; Tracking Technologies
            </h2>
            <div className="space-y-4 text-white/70 leading-relaxed">
              <p>
                We use cookies and similar tracking technologies to enhance your
                experience on the Platform. These may include:
              </p>
              <ul className="ml-6 list-disc space-y-2">
                <li>
                  <span className="text-white/90 font-medium">Essential Cookies</span>{' '}
                  &mdash; Required for wallet session management and core
                  Platform functionality.
                </li>
                <li>
                  <span className="text-white/90 font-medium">Analytics Cookies</span>{' '}
                  &mdash; Help us understand usage patterns and improve the
                  Platform (e.g., Vercel Analytics).
                </li>
                <li>
                  <span className="text-white/90 font-medium">Performance Cookies</span>{' '}
                  &mdash; Monitor Platform speed and reliability (e.g., Vercel
                  Speed Insights).
                </li>
              </ul>
              <p>
                You can control cookie preferences through your browser settings.
                Disabling essential cookies may impair Platform functionality.
              </p>
            </div>
          </section>

          {/* Third-Party Services */}
          <section>
            <h2 className="mb-4 text-2xl font-semibold text-white">
              5. Third-Party Services
            </h2>
            <div className="space-y-4 text-white/70 leading-relaxed">
              <p>
                The Platform integrates with third-party services that may
                collect information independently. These include:
              </p>
              <ul className="ml-6 list-disc space-y-2">
                <li>
                  <span className="text-white/90 font-medium">Blockchain Networks</span>{' '}
                  &mdash; For on-chain transactions and smart contract
                  interactions.
                </li>
                <li>
                  <span className="text-white/90 font-medium">Wallet Providers</span>{' '}
                  &mdash; Third-party wallet applications you use to connect to
                  the Platform.
                </li>
                <li>
                  <span className="text-white/90 font-medium">AI Model Providers</span>{' '}
                  &mdash; Language model APIs used to power agent responses (e.g.,
                  OpenAI, Anthropic, Google, xAI).
                </li>
                <li>
                  <span className="text-white/90 font-medium">Analytics Providers</span>{' '}
                  &mdash; Vercel Analytics and Speed Insights for performance
                  monitoring.
                </li>
                <li>
                  <span className="text-white/90 font-medium">Infrastructure Providers</span>{' '}
                  &mdash; Cloud hosting and database services.
                </li>
              </ul>
              <p>
                Each third-party service operates under its own privacy policy.
                We encourage you to review those policies independently.
              </p>
            </div>
          </section>

          {/* Data Security */}
          <section>
            <h2 className="mb-4 text-2xl font-semibold text-white">
              6. Data Security
            </h2>
            <div className="space-y-4 text-white/70 leading-relaxed">
              <p>
                We implement commercially reasonable technical and organizational
                measures to protect your information, including:
              </p>
              <ul className="ml-6 list-disc space-y-2">
                <li>Encrypted data transmission via HTTPS/TLS.</li>
                <li>Secure server infrastructure with access controls.</li>
                <li>Regular security audits and monitoring.</li>
                <li>Wallet-based authentication eliminating password-related vulnerabilities.</li>
              </ul>
              <p>
                No method of electronic transmission or storage is 100% secure.
                While we strive to protect your information, we cannot guarantee
                absolute security.
              </p>
            </div>
          </section>

          {/* Data Retention */}
          <section>
            <h2 className="mb-4 text-2xl font-semibold text-white">
              7. Data Retention
            </h2>
            <div className="space-y-4 text-white/70 leading-relaxed">
              <p>
                We retain your information for as long as necessary to provide
                our services and fulfill the purposes outlined in this policy.
                On-chain data is permanent and cannot be deleted. Off-chain data
                (such as agent interaction logs) may be retained for operational,
                legal, or compliance purposes and will be deleted or anonymized
                when no longer needed.
              </p>
            </div>
          </section>

          {/* Children's Privacy */}
          <section>
            <h2 className="mb-4 text-2xl font-semibold text-white">
              8. Children&apos;s Privacy
            </h2>
            <div className="space-y-4 text-white/70 leading-relaxed">
              <p>
                The Platform is not intended for individuals under the age of 18.
                We do not knowingly collect personal information from children. If
                we become aware that we have inadvertently collected data from a
                minor, we will take steps to delete such information promptly.
              </p>
            </div>
          </section>

          {/* Your Rights */}
          <section>
            <h2 className="mb-4 text-2xl font-semibold text-white">
              9. Your Rights
            </h2>
            <div className="space-y-4 text-white/70 leading-relaxed">
              <p>
                Depending on your jurisdiction, you may have rights regarding
                your personal data, including:
              </p>
              <ul className="ml-6 list-disc space-y-2">
                <li>The right to access the personal data we hold about you.</li>
                <li>The right to request correction of inaccurate data.</li>
                <li>The right to request deletion of your off-chain data.</li>
                <li>The right to object to or restrict certain processing activities.</li>
                <li>The right to data portability where applicable.</li>
              </ul>
              <p>
                Please note that on-chain data recorded on public blockchains
                cannot be modified or deleted by us.
              </p>
            </div>
          </section>

          {/* Changes to Policy */}
          <section>
            <h2 className="mb-4 text-2xl font-semibold text-white">
              10. Changes to This Policy
            </h2>
            <div className="space-y-4 text-white/70 leading-relaxed">
              <p>
                We may update this Privacy Policy from time to time to reflect
                changes in our practices, technology, or legal requirements. When
                we make material changes, we will update the &quot;Last
                updated&quot; date at the top of this page and provide notice
                through the Platform where appropriate. Your continued use of the
                Platform after such changes constitutes your acceptance of the
                revised policy.
              </p>
            </div>
          </section>

          {/* Contact */}
          <section>
            <h2 className="mb-4 text-2xl font-semibold text-white">
              11. Contact Us
            </h2>
            <div className="space-y-4 text-white/70 leading-relaxed">
              <p>
                If you have questions or concerns about this Privacy Policy or
                our data practices, you can reach us through:
              </p>
              <ul className="ml-6 list-disc space-y-2">
                <li>
                  Platform:{' '}
                  <a
                    href="https://boredbrain.app"
                    className="text-amber-400 underline underline-offset-2 hover:text-amber-300"
                  >
                    boredbrain.app
                  </a>
                </li>
                <li>
                  GitHub:{' '}
                  <a
                    href="https://github.com/boredbraindev"
                    className="text-amber-400 underline underline-offset-2 hover:text-amber-300"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    github.com/boredbraindev
                  </a>
                </li>
              </ul>
            </div>
          </section>
        </div>

        <div className="mt-16 border-t border-white/10 pt-8 text-center text-sm text-white/30">
          &copy; {new Date().getFullYear()} BoredBrain AI. All rights reserved.
        </div>
      </div>
    </div>
  );
}
