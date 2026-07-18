import Link from "next/link";

export const metadata = {
  title: "Privacy Policy | Sask News Feed",
  description: "Read the Sask News Feed privacy policy covering account data, comments, votes, and third-party services.",
};

export default function PrivacyPolicy() {
  return (
    <div className="max-w-2xl mx-auto py-10 px-4 text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-900 min-h-screen">
      <h1 className="text-2xl font-bold mb-2 text-gray-900 dark:text-gray-100">Privacy Policy</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">Last updated: July 17, 2026</p>

      <div className="flex flex-col gap-6 text-sm leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Who we are</h2>
          <p>
            Sask News Feed (&quot;we&quot;, &quot;us&quot;) is an independent Saskatchewan news aggregator.
            This site collects and links to headlines from third-party news sources and
            allows registered users to vote on and comment about them.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Information we collect</h2>
          <ul className="list-disc pl-5 flex flex-col gap-1">
            <li><strong>Email address</strong> — collected when you sign in, used only to send you a one-time sign-in link and to identify your account.</li>
            <li><strong>Display name</strong> — the username you choose, shown publicly next to your comments.</li>
            <li><strong>Comments</strong> — content you post while signed in, displayed publicly (alongside your display name) on the relevant article. You can view your own full comment history in one place by clicking your name at the top of the page; this history is private and only visible to you. Comments are automatically deleted after 30 days, along with the article they were posted on.</li>
            <li><strong>Votes</strong> — your upvote or downvote on an article is recorded against your account so we can prevent duplicate voting, but your individual vote is not shown publicly; only the combined total for each article is visible to others.</li>
            <li><strong>Basic technical data</strong> — our hosting provider (Vercel) automatically logs standard technical information such as IP address and browser type for security and performance purposes.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">How we use your information</h2>
          <p>
            We use your email solely to authenticate you (via a one-time sign-in link) and
            do not sell, rent, or share it with third parties for marketing purposes. Your
            display name, votes, and comments are visible to other visitors of the site as
            part of its normal functioning.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Third-party services</h2>
          <p>
            We use the following third-party services to operate this site:
          </p>
          <ul className="list-disc pl-5 flex flex-col gap-1 mt-1">
            <li><strong>Supabase</strong> — stores account, comment, and vote data.</li>
            <li><strong>Vercel</strong> — hosts this website.</li>
            <li>
              <strong>Google AdSense</strong> — may display advertising on this site. Google
              may use cookies to serve ads based on your prior visits to this or other
              websites. You can opt out of personalized advertising by visiting{" "}
              <a
                href="https://www.google.com/settings/ads"
                className="text-blue-600 dark:text-blue-400 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Google&apos;s Ads Settings
              </a>.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Cookies</h2>
          <p>
            We use cookies necessary to keep you signed in. If advertising is enabled on
            this site, Google and its partners may also use cookies to serve relevant ads.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Your choices</h2>
          <p>
            You can sign out at any time using the link at the top of the page. To
            permanently delete your account — including your profile and every comment
            you&apos;ve made — go to <strong>Settings</strong> (available once signed in) and
            select <strong>Delete account</strong>. This takes effect immediately and
            cannot be undone. If you&apos;re unable to access your account, you can also{" "}
            <Link href="/contact" className="text-blue-600 dark:text-blue-400 hover:underline">contact us</Link>{" "}
            to request deletion.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Changes to this policy</h2>
          <p>
            We may update this policy from time to time. Continued use of the site after
            changes are posted constitutes acceptance of the revised policy.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Contact us</h2>
          <p>
            Questions about this policy? Reach out via our{" "}
            <Link href="/contact" className="text-blue-600 dark:text-blue-400 hover:underline">Contact page</Link>.
          </p>
        </section>

        <Link href="/" className="text-sm text-gray-500 dark:text-gray-400 hover:underline">
          &larr; Back to news feed
        </Link>
      </div>
    </div>
  );
}