import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-5 text-center">
      <p className="sticker-sm -rotate-3 bg-bubble px-4 py-1.5 font-mono text-sm font-extrabold">
        404
      </p>
      <h1 className="mt-6 text-4xl font-extrabold tracking-tight">This page never compiled</h1>
      <p className="mt-3 font-medium text-ink-soft">
        Nothing lives at that URL. The badge generator is back on the home page.
      </p>
      <Link
        href="/"
        className="sticker sticker-press mt-9 bg-lemon px-6 py-3 text-lg font-extrabold"
      >
        Generate a badge
      </Link>
    </main>
  );
}
