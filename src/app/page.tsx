import type { Metadata } from 'next';
import { BadgeStudio } from '@/components/BadgeStudio';
import { site } from '@/lib/site';
import { publicBaseUrl } from '@/lib/storage/r2';
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
    colour: 'bg-lemon',
    tilt: '-rotate-1',
    body: 'Eleven signals across seven axes decide your archetype and rank — Fork Overlord, Polyglot Menace, Touch Grass Later.',
  },
  {
    title: 'One sticker, no strings',
    colour: 'bg-sky',
    tilt: 'rotate-1',
    body: 'The avatar is inlined as a data URI, so the badge renders through README image proxies with no external requests.',
  },
  {
    title: 'Stable punchlines',
    colour: 'bg-mint',
    tilt: '-rotate-1',
    body: 'Title and joke are seeded from your username, so the badge reads the same every time someone loads your README.',
  },
];

const PARAMS = [
  ['/api/badges/:username', 'Any GitHub username. An @handle or profile URL works too.'],
  ['?theme=light', 'Default. Cream paper, ink outlines.'],
  ['?theme=dark', 'The same stickers on a dark card.'],
  ['?theme=auto', "Follows the viewer's system colour scheme."],
];

export default async function Home({ searchParams }: PageProps) {
  const initialUsername = parseUsername((await searchParams).u ?? '') ?? '';
  // Validated public bucket URL, when there is one. Safe to hand to the
  // browser: it is the address READMEs are meant to point at.
  const publicBase = publicBaseUrl();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col px-5 py-14 sm:py-20">
      <header>
        <p className="sticker-sm mb-6 inline-flex -rotate-2 items-center gap-2 bg-bubble px-4 py-1.5 text-sm font-extrabold uppercase tracking-wide">
          Stickers for your README
        </p>
        <h1 className="text-5xl font-extrabold leading-[1.05] tracking-tight text-balance sm:text-6xl">
          Your GitHub stats,{' '}
          <span className="relative inline-block">
            <span className="absolute inset-x-0 bottom-1 h-4 -rotate-1 bg-lemon" aria-hidden />
            <span className="relative">with a punchline</span>
          </span>
        </h1>
        <p className="mt-5 max-w-xl text-lg font-medium text-ink-soft text-pretty">
          {site.description}
        </p>
      </header>

      <section className="mt-10" aria-label="Badge generator">
        <BadgeStudio initialUsername={initialUsername} publicBaseUrl={publicBase} />
      </section>

      <section className="mt-20 grid gap-6 sm:grid-cols-3" aria-label="How it works">
        {FEATURES.map((feature) => (
          <article
            key={feature.title}
            className={`sticker p-5 ${feature.colour} ${feature.tilt}`}
          >
            <h2 className="text-lg font-extrabold">{feature.title}</h2>
            <p className="mt-2 text-sm font-medium leading-relaxed">{feature.body}</p>
          </article>
        ))}
      </section>

      <section className="mt-16" aria-label="API reference">
        <h2 className="sticker-sm inline-block -rotate-1 bg-sky px-4 py-1.5 text-sm font-extrabold uppercase tracking-wide">
          Endpoint
        </h2>
        <dl className="sticker mt-5 divide-y-[3px] divide-ink overflow-hidden bg-card">
          {PARAMS.map(([name, description]) => (
            <div key={name} className="grid gap-1 px-5 py-4 sm:grid-cols-[15rem_1fr] sm:gap-4">
              <dt className="font-mono text-sm font-bold">{name}</dt>
              <dd className="text-sm font-medium text-ink-soft">{description}</dd>
            </div>
          ))}
        </dl>
      </section>

      <footer className="mt-16 border-t-[3px] border-dashed border-ink pt-6 text-sm font-medium text-ink-soft">
        <p>
          Built with Next.js and the GitHub REST API.{' '}
          <a
            href="https://github.com/devnsko/github-meme-badge"
            className="font-extrabold text-ink decoration-lemon decoration-4 underline-offset-4 hover:underline"
          >
            Source on GitHub
          </a>
          .
        </p>
      </footer>
    </main>
  );
}
