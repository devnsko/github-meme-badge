import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-5 text-center">
      <p className="font-mono text-sm text-brand">404</p>
      <h1 className="mt-3 text-3xl font-bold">This page never compiled</h1>
      <p className="mt-3 text-ink-muted">
        Nothing lives at that URL. The badge generator is back on the home page.
      </p>
      <Link
        href="/"
        className="mt-8 rounded-xl bg-brand px-5 py-3 font-semibold text-canvas transition hover:bg-brand-strong"
      >
        Generate a badge
      </Link>
    </main>
  );
}
