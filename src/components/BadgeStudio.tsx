'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { THEMES, type Theme } from '@/lib/badge';
import { parseUsername } from '@/lib/username';
import { CopyField } from './CopyField';

const EXAMPLES = ['torvalds', 'sindresorhus', 'devnsko'];

const STATUS_MESSAGES: Record<number, string> = {
  400: 'That does not look like a GitHub username.',
  404: 'GitHub has no user by that name.',
  429: 'Rate limited — give it a minute and try again.',
  504: 'GitHub is being slow right now. Try again shortly.',
};

/** Each example gets its own sticker colour, cycled by position. */
const EXAMPLE_COLOURS = ['bg-sky', 'bg-mint', 'bg-bubble'];

type Status = 'idle' | 'loading' | 'ready' | 'error';

interface Generated {
  username: string;
  theme: Theme;
  path: string;
}

export function BadgeStudio({ initialUsername = '' }: { initialUsername?: string }) {
  const [input, setInput] = useState(initialUsername);
  const [theme, setTheme] = useState<Theme>('light');
  const [generated, setGenerated] = useState<Generated | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [origin, setOrigin] = useState('');

  // Snippets need an absolute URL, which only exists in the browser.
  useEffect(() => setOrigin(window.location.origin), []);

  const requestId = useRef(0);

  const generate = useCallback(async (rawInput: string, nextTheme: Theme) => {
    const username = parseUsername(rawInput);

    if (!username) {
      setStatus('error');
      setError('Enter a GitHub username, @handle, or profile URL.');
      setGenerated(null);
      return;
    }

    const path = `/api/badges/${username}${nextTheme === 'light' ? '' : `?theme=${nextTheme}`}`;
    const id = ++requestId.current;

    setStatus('loading');
    setError(null);

    let failure: string | null = null;
    try {
      // Warm the cache and learn the real status before swapping the preview —
      // the endpoint answers errors with an SVG, which an <img> would happily
      // render without telling us anything went wrong.
      const res = await fetch(path);
      if (!res.ok) {
        failure = STATUS_MESSAGES[res.status] ?? 'Could not generate that badge.';
      }
    } catch {
      failure = 'Network error — check your connection and try again.';
    }

    if (id !== requestId.current) return;

    setGenerated({ username, theme: nextTheme, path });
    setStatus(failure ? 'error' : 'ready');
    setError(failure);

    // Only make the link shareable once there is something worth sharing.
    if (!failure) {
      window.history.replaceState(null, '', `?u=${encodeURIComponent(username)}`);
    }
  }, []);

  // Honour a shared ?u= link on first paint.
  useEffect(() => {
    if (initialUsername) void generate(initialUsername, 'light');
  }, [initialUsername, generate]);

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void generate(input, theme);
  };

  const onThemeChange = (next: Theme) => {
    setTheme(next);
    if (generated) void generate(generated.username, next);
  };

  const badgeUrl = generated ? `${origin}${generated.path}` : '';

  return (
    <div className="w-full">
      <form onSubmit={onSubmit} className="flex flex-col gap-4 sm:flex-row">
        <label htmlFor="username" className="sr-only">
          GitHub username
        </label>
        <input
          id="username"
          name="username"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="octocat"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          className="sticker flex-1 bg-card px-5 py-3.5 text-lg font-bold placeholder:font-medium placeholder:text-ink-soft/60 focus:outline-none"
        />
        <button
          type="submit"
          disabled={status === 'loading'}
          className="sticker sticker-press bg-lemon px-7 py-3.5 text-lg font-extrabold disabled:cursor-not-allowed"
        >
          {status === 'loading' ? 'Generating…' : 'Generate badge'}
        </button>
      </form>

      <div className="mt-5 flex flex-wrap items-center gap-x-7 gap-y-4">
        <div role="group" aria-label="Theme" className="flex items-center gap-2.5">
          <span className="text-sm font-extrabold uppercase tracking-wide" aria-hidden>
            Theme
          </span>
          <div className="sticker-sm flex gap-1 bg-card p-1">
            {THEMES.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={theme === option}
                onClick={() => onThemeChange(option)}
                className={`rounded-lg px-3 py-1 text-sm font-bold capitalize transition ${
                  theme === option
                    ? 'border-2 border-ink bg-lemon'
                    : 'border-2 border-transparent hover:bg-paper'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-sm font-extrabold uppercase tracking-wide">Try</span>
          {EXAMPLES.map((example, i) => (
            <button
              key={example}
              type="button"
              onClick={() => {
                setInput(example);
                void generate(example, theme);
              }}
              className={`sticker-sm sticker-press px-3 py-1 font-mono text-sm font-bold ${EXAMPLE_COLOURS[i % EXAMPLE_COLOURS.length]}`}
            >
              {example}
            </button>
          ))}
        </div>
      </div>

      <div aria-live="polite" className="mt-6">
        {error && (
          <p className="sticker bg-bubble px-5 py-3.5 font-bold">{error}</p>
        )}
      </div>

      {generated && (
        <section className="mt-7 flex flex-col gap-7">
          <div className="sticker flex justify-center bg-card p-6">
            {/* A plain <img> on purpose: the badge is a dynamic SVG endpoint of
                unknown height, which next/image cannot optimise anyway. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={generated.path}
              src={generated.path}
              alt={`GitHub meme badge for ${generated.username}`}
              width={480}
              className="max-w-full"
            />
          </div>

          {status === 'ready' && (
            <div className="grid gap-4">
              <CopyField
                label="Markdown"
                value={`[![${generated.username}'s GitHub meme badge](${badgeUrl})](https://github.com/${generated.username})`}
              />
              <CopyField
                label="HTML"
                value={`<a href="https://github.com/${generated.username}"><img src="${badgeUrl}" alt="${generated.username}'s GitHub meme badge" width="480" /></a>`}
              />
              <CopyField label="Direct URL" value={badgeUrl} />
            </div>
          )}
        </section>
      )}
    </div>
  );
}
