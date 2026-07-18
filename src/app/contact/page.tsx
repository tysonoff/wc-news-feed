import Link from "next/link";

export const metadata = {
  title: "Contact | Sask News Feed",
  description: "Get in touch with Sask News Feed with feedback, source suggestions, or bug reports.",
};

export default function Contact() {
  return (
    <div className="max-w-2xl mx-auto py-10 px-4 text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-900 min-h-screen">
      <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">Contact Us</h1>

      <div className="flex flex-col gap-4 text-sm leading-relaxed">
        <p>
          Questions, feedback, a source we should add, a bug to report, or a privacy
          request? Reach out anytime:
        </p>
        <p>
          <a
            href="mailto:admin@sasknewsfeed.com"
            className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
          >
            admin@sasknewsfeed.com
          </a>
        </p>
        <p className="text-gray-500 dark:text-gray-400">
          We aim to respond to all messages within a few business days.
        </p>

        <Link href="/" className="text-sm text-gray-500 dark:text-gray-400 hover:underline mt-4">
          &larr; Back to news feed
        </Link>
      </div>
    </div>
  );
}