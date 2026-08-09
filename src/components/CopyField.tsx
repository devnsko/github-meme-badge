'use client';

import { useEffect, useRef, useState } from 'react';

interface CopyFieldProps {
  label: string;
  value: string;
}

export function CopyField({ label, value }: CopyFieldProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Clipboard access can be blocked (insecure context, denied permission);
      // the snippet is selectable on screen either way.
      return;
    }

    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
  };

  return (
    // min-w-0 keeps the scrolling <pre> from widening the grid track it sits in,
    // which would otherwise make the whole page scroll sideways on mobile.
    <div className="sticker min-w-0 overflow-hidden bg-card">
      <div className="flex items-center justify-between gap-3 border-b-[3px] border-ink bg-lemon px-4 py-2">
        <span className="text-xs font-extrabold uppercase tracking-wider">{label}</span>
        <button
          type="button"
          onClick={copy}
          className="sticker-sm sticker-press bg-card px-3 py-1 text-xs font-extrabold"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre className="overflow-x-auto px-4 py-3 text-xs leading-relaxed">
        <code className="font-mono">{value}</code>
      </pre>
      <span aria-live="polite" className="sr-only">
        {copied ? `${label} copied to clipboard` : ''}
      </span>
    </div>
  );
}
