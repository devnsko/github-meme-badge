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

type Status = 'idle' | 'loading' | 'ready' | 'error';

interface Generated {
  username: string;
  theme: Theme;
  path: string;
}

export function BadgeStudio({ initialUsername = '' }: { initialUsername?: string }) {
  const [input, setInput] = useState(initialUsername);
  const [theme, setTheme] = useState<Theme>('dark');
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

    const path = `/api/badges/${username}${nextTheme === 'dark' ? '' : `?theme=${nextTheme}`}`;
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
    if (initialUsername) void generate(initialUsername, 'dark');
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
      <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
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
          className="flex-1 rounded-xl border border-line bg-surface px-4 py-3 text-ink placeholder:text-ink-muted/70 focus:border-brand focus:outline-none"
        />
        <button
          type="submit"
          disabled={status === 'loading'}
          className="rounded-xl bg-brand px-6 py-3 font-semibold text-canvas transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          {status === 'loading' ? 'Generating…' : 'Generate badge'}
        </button>
      </form>

      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
        <div role="group" aria-label="Theme" className="flex items-center gap-2">
          <span className="text-ink-muted" aria-hidden>
            Theme
          </span>
          <div className="flex rounded-lg border border-line bg-surface p-0.5">
            {THEMES.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={theme === option}
                onClick={() => onThemeChange(option)}
                className={`rounded-md px-3 py-1 capitalize transition ${
                  theme === option ? 'bg-line text-ink' : 'text-ink-muted hover:text-ink'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 text-ink-muted">
          <span>Try</span>
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => {
                setInput(example);
                void generate(example, theme);
              }}
              className="rounded-md px-2 py-1 font-mono text-xs text-ink-muted underline decoration-line underline-offset-4 transition hover:text-brand"
            >
              {example}
            </button>
          ))}
        </div>
      </div>

      <div aria-live="polite" className="mt-6">
        {error && (
          <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </p>
        )}
      </div>

      {generated && (
        <section className="mt-6 flex flex-col gap-6">
          <div className="flex justify-center rounded-2xl border border-line bg-surface p-6">
            {/* A plain <img> on purpose: the badge is a dynamic SVG endpoint of
                unknown height, which next/image cannot optimise anyway. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={generated.path}
              src={generated.path}
              alt={`GitHub meme badge for ${generated.username}`}
              width={480}
              className="max-w-full rounded-xl"
            />
          </div>

          {status === 'ready' && (
            <div className="grid gap-3">
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
