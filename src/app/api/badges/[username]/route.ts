import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { NextResponse } from 'next/server';

// Разбиение строки на строки длиной не более maxChars
function splitText(text: string, maxChars = 55): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    if ((current + word).length > maxChars) {
      lines.push(current.trim());
      current = word + ' ';
    } else {
      current += word + ' ';
    }
  }

  if (current.trim()) lines.push(current.trim());
  return lines;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const filePath = path.join(process.cwd(), 'public', 'badges', `${username}.svg`);

  if (existsSync(filePath)) {
    const content = await fs.readFile(filePath, 'utf-8');
    return new NextResponse(content, {
      headers: { 'Content-Type': 'image/svg+xml' },
    });
  }

  try {
    const res = await fetch(`https://api.github.com/users/${username}/repos`);
    if (!res.ok) {
      return new NextResponse(
        JSON.stringify({ error: "Error: can't get info from your GitHub" }),
        { status: res.status }
      );
    }

    const repos = await res.json();
    let stars = 0;
    let forks = 0;
    const totalRepos = repos.length;
    const languages: Record<string, number> = {};

    for (const repo of repos) {
      stars += repo.stargazers_count ?? 0;
      forks += repo.forks_count ?? 0;
      if (repo.language) {
        languages[repo.language] = (languages[repo.language] || 0) + 1;
      }
    }

    const topLanguage = Object.keys(languages).length
      ? Object.keys(languages).reduce((a, b) => languages[a] > languages[b] ? a : b)
      : 'N/A';

    const baseMessages = [
      "Your code is like a viral meme - no one can resist!",
      "GitHub lights up with your commits like a trending meme!",
      "Each commit is a new hit - pure meme magic!",
      "Your repos are exclusive meme content - everyone’s chasing them!",
      "You write code like an artist crafting meme masterpieces!"
    ];

    let funnyMessage = baseMessages[Math.floor(Math.random() * baseMessages.length)];

    funnyMessage += stars >= 50
      ? " Stars sparkle like likes on top-tier memes!"
      : " Your commits are gaining steam like an epic meme blast!";

    funnyMessage += forks >= 10
      ? " Forks spread like meme reposts!"
      : " Each fork is a secret weapon in your meme arsenal!";

    funnyMessage += totalRepos >= 10
      ? " Your repo collection is like a meme vault: abundant and always fresh!"
      : " Each repo is a unique meme—a true exclusive!";

    if (topLanguage !== 'N/A') {
      const languageLines: Record<string, string> = {
        JavaScript: " JavaScript buzzes under your fingers like a million-like meme!",
        Python: " Python becomes a comedy show in your hands!",
        Java: " Java drives your code like a spicy mega-meme!",
        "C++": " C++ is your secret sauce for crafting high-tier memes!"
      };
      funnyMessage += languageLines[topLanguage] || ` ${topLanguage} turns into meme gold in your code!`;
    }

    const wrappedLines = splitText(funnyMessage);

    const tspans = wrappedLines
      .map((line, i) =>
        `<tspan x="50%" dy="${i === 0 ? '0' : '1.2em'}">${line}</tspan>`
      )
      .join('\n');

    const textBlockY = 80;
    const finalHeight = textBlockY + wrappedLines.length * 20 + 60;

    const svg = `
<svg width="500" height="${finalHeight}" viewBox="0 0 500 ${finalHeight}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#111827"/>
  <text x="50%" y="40" fill="#ffffff" font-size="22" font-family="Arial" text-anchor="middle">
    ${username}'s GitHub Status
  </text>
  <text x="50%" y="${textBlockY}" fill="#00ff99" font-size="14" font-family="Arial" text-anchor="middle">
    ${tspans}
  </text>
  <text x="50%" y="${finalHeight - 20}" fill="#9ca3af" font-size="14" font-family="Arial" text-anchor="middle">
    ${totalRepos} repos · Loves ${topLanguage}
  </text>
</svg>
    `.trim();

    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, svg, 'utf-8');

    return new NextResponse(svg, {
      headers: { 'Content-Type': 'image/svg+xml' },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return new NextResponse(JSON.stringify({ error: message }), { status: 500 });
  }
}
