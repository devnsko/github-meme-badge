import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Record<string, string> }
) {
  try {
    const username = params.username;

    const res = await fetch(`https://api.github.com/users/${username}/repos`);
    if (!res.ok) {
      return new NextResponse(
        JSON.stringify({ error: 'Не удалось получить данные с GitHub' }),
        { status: res.status }
      );
    }
    const repos = await res.json();

    let stars = 0;
    let forks = 0;
    const totalRepos = repos.length;
    const languages: Record<string, number> = {};

    for (const repo of repos) {
      stars += repo.stargazers_count;
      forks += repo.forks_count;
      if (repo.language) {
        languages[repo.language] = (languages[repo.language] || 0) + 1;
      }
    }

    const topLanguage = Object.keys(languages).length
      ? Object.keys(languages).reduce((a, b) =>
          languages[a] > languages[b] ? a : b
        )
      : 'N/A';

    const baseMessages = [
      "Твой код – как вирусный мем, никто не может устоять!",
      "GitHub вспыхнул от твоих коммитов, как трендовый мем!",
      "Каждый коммит – новый хит, настоящий мемный калейдоскоп!",
      "Твои репозитории – эксклюзивный мем-контент, за которым охотятся все!",
      "Ты творишь код, как художник создает шедевры мемов!"
    ];
    let funnyMessage =
      baseMessages[Math.floor(Math.random() * baseMessages.length)];

    if (stars >= 50) {
      funnyMessage += " Звёзды сияют, как лайки под топовыми мемами!";
    } else {
      funnyMessage += " Твои коммиты набирают обороты, как эпичный мем-заряд!";
    }

    if (forks >= 10) {
      funnyMessage += " Форки множатся, как репосты любимых мемов!";
    } else {
      funnyMessage += " Каждый форк – секретное оружие для твоих мемных планов!";
    }

    if (totalRepos >= 10) {
      funnyMessage += " Репозитории у тебя – как коллекция мемов: в избытке и всегда актуальны!";
    } else {
      funnyMessage += " Каждый репозиторий – уникальный мем, настоящий эксклюзив!";
    }

    if (topLanguage !== 'N/A') {
      if (topLanguage === "JavaScript") {
        funnyMessage += " JavaScript вибрирует под твоим кодом, как мем на миллион лайков!";
      } else if (topLanguage === "Python") {
        funnyMessage += " Python превращается в комедийное шоу под твоим пером!";
      } else if (topLanguage === "Java") {
        funnyMessage += " Java гоняет твой код, как мега-мем с перчиком!";
      } else if (topLanguage === "C++") {
        funnyMessage += " C++ – твой секретный ингредиент для создания мемов высшей пробы!";
      } else {
        funnyMessage += ` ${topLanguage} превращается в эпичный мем под твоим кодом!`;
      }
    }

    const svg = `
      <svg width="500" height="180" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#111827"/>
        <text x="50%" y="30%" fill="#fff" font-size="24" font-family="Arial" text-anchor="middle">
          ${username}'s GitHub Status
        </text>
        <text x="50%" y="65%" fill="#00ff99" font-size="16" font-family="Arial" text-anchor="middle">
          ${funnyMessage}
        </text>
        <text x="50%" y="90%" fill="#9ca3af" font-size="14" font-family="Arial" text-anchor="middle">
          ${totalRepos} репо · Любит ${topLanguage}
        </text>
      </svg>
    `;

    return new NextResponse(svg, {
      headers: { 'Content-Type': 'image/svg+xml' },
    });
  } catch (error: unknown) {
    let errorMessage = 'Unknown error';
    if (error instanceof Error) {
      errorMessage = error.message;
    } else {
      errorMessage = String(error);
    }
    return new NextResponse(
      JSON.stringify({ error: errorMessage }),
      { status: 500 }
    );
  }
}
