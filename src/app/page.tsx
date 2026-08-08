import type { Metadata } from 'next';
import { BadgeStudio } from '@/components/BadgeStudio';
import { site } from '@/lib/site';
import { parseUsername } from '@/lib/username';

interface PageProps {
  searchParams: Promise<{ u?: string }>;
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const username = parseUsername((await searchParams).u ?? '');
  if (!username) return {};

  return {
    title: `${username}'s meme GitHub badge`,
    description: `A README badge for @${username}: real GitHub stats with a punchline attached.`,
  };
}

const FEATURES = [
  {
    title: 'You get a title',
    body: 'Eleven signals across seven axes decide your archetype and rank — Fork Overlord, Polyglot Menace, Touch Grass Later.',
  },
  {
    title: 'One self-contained file',
    body: 'The avatar is inlined as a data URI, so the badge renders through README image proxies with no external requests.',
  },
  {
    title: 'Stable punchlines',
    body: 'Title and joke are seeded from your username, so the badge reads the same every time someone loads your README.',
  },
];

const PARAMS = [
  ['/api/badges/:username', 'Any GitHub username. An @handle or profile URL works too.'],
  ['?theme=dark', 'Default. Tuned to match GitHub dark.'],
  ['?theme=light', 'Tuned to match GitHub light.'],
  ['?theme=auto', "Follows the viewer's system colour scheme."],
];

export default async function Home({ searchParams }: PageProps) {
  const initialUsername = parseUsername((await searchParams).u ?? '') ?? '';

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col px-5 py-16 sm:py-24">
      <header className="aurora relative">
        <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs text-ink-muted">
          <span className="size-1.5 rounded-full bg-brand" aria-hidden />
          SVG badges for your README
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">
          Your GitHub stats,{' '}
          <span className="bg-gradient-to-r from-brand to-sky-400 bg-clip-text text-transparent">
            with a punchline
          </span>
        </h1>
        <p className="mt-4 max-w-xl text-lg text-ink-muted text-pretty">{site.description}</p>
      </header>

      <section className="mt-10" aria-label="Badge generator">
        <BadgeStudio initialUsername={initialUsername} />
      </section>

      <section className="mt-20 grid gap-4 sm:grid-cols-3" aria-label="How it works">
        {FEATURES.map((feature) => (
          <article key={feature.title} className="rounded-2xl border border-line bg-surface p-5">
            <h2 className="font-semibold">{feature.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">{feature.body}</p>
          </article>
        ))}
      </section>

      <section className="mt-12" aria-label="API reference">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-muted">Endpoint</h2>
        <dl className="mt-4 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {PARAMS.map(([name, description]) => (
            <div key={name} className="grid gap-1 px-5 py-4 sm:grid-cols-[15rem_1fr] sm:gap-4">
              <dt className="font-mono text-sm text-brand">{name}</dt>
              <dd className="text-sm text-ink-muted">{description}</dd>
            </div>
          ))}
        </dl>
      </section>

      <footer className="mt-16 border-t border-line pt-6 text-sm text-ink-muted">
        <p>
          Built with Next.js and the GitHub REST API.{' '}
          <a
            href="https://github.com/devnsko/github-meme-badge"
            className="text-ink underline decoration-line underline-offset-4 transition hover:text-brand"
          >
            Source on GitHub
          </a>
          .
        </p>
      </footer>
    </main>
  );
}
