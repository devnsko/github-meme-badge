// app/page.tsx
'use client';
import { useState } from 'react';

export default function Home() {
  const [username, setUsername] = useState('');
  const [badgeUrl, setBadgeUrl] = useState('');

  const generateBadge = () => {
    if (username.trim()) {
      setBadgeUrl(`/api/badge/${username.trim()}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center px-4">
      <h1 className="text-4xl font-bold mb-6">Генератор мемного GitHub бейджа</h1>
      <div className="flex flex-col items-center w-full max-w-md">
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Введите GitHub username"
          className="w-full p-3 rounded mb-4 bg-gray-800 border border-gray-700 focus:outline-none focus:border-green-500"
        />
        <button
          onClick={generateBadge}
          className="w-full p-3 bg-green-600 rounded hover:bg-green-500 transition"
        >
          Сгенерировать бейдж
        </button>
      </div>
      {badgeUrl && (
        <div className="mt-8 flex flex-col items-center">
          <img src={badgeUrl} alt="GitHub Badge" className="rounded shadow-md" />
          <p className="mt-4 text-sm">Markdown для вставки в README.md:</p>
          <code className="bg-gray-800 p-2 rounded mt-2 text-xs">
            {`![GitHub Status](${typeof window !== 'undefined' ? window.location.origin : ''}${badgeUrl})`}
          </code>
        </div>
      )}
    </div>
  );
}
