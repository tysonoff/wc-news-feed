import Link from "next/link";

export const metadata = {
  title: "About | Sask News Feed",
  description: "Learn about Sask News Feed, an independent aggregator bringing together Saskatchewan news headlines from across the province.",
};

export default function About() {
  return (
    <div className="max-w-2xl mx-auto py-10 px-4 text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-900 min-h-screen">
      <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">About Sask News Feed</h1>

      <div className="flex flex-col gap-4 text-sm leading-relaxed">
        <p>
          Sask News Feed pulls together news headlines from across Saskatchewan into one
          place — CBC, Global News, community papers, Indigenous broadcasters, and official
          provincial announcements — so you can see what&apos;s happening across the province
          without checking a dozen different sites.
        </p>
        <p>
          Every headline links directly back to the original publisher&apos;s full article. We
          don&apos;t republish or rewrite anyone&apos;s reporting — we just make it easier to find.
        </p>
        <p>
          Registered users can upvote or downvote stories and leave comments, helping surface
          what the community actually finds interesting or important.
        </p>
        <p>
          This site is independently run and not affiliated with any of the news
          organizations whose headlines appear here.
        </p>
        <p>
          Have a source we should add, or something not working right? Get in touch on our{" "}
          <Link href="/contact" className="text-blue-600 dark:text-blue-400 hover:underline">Contact page</Link>.
        </p>

        <Link href="/" className="text-sm text-gray-500 dark:text-gray-400 hover:underline mt-4">
          &larr; Back to news feed
        </Link>
      </div>
    </div>
  );
}