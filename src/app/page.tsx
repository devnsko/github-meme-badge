'use client';
import Image from 'next/image';
import { useState } from 'react';

export default function Home() {
  const [username, setUsername] = useState('');
  const [svgUrl, setSvgUrl] = useState('');
  
  const generateSvg = async () => {
    if (username.trim()) {
      const reponse = await fetch(`/api/badges/${username.trim()}`);
      if (!reponse.ok) {
        return '';
      }
      const urlsvg = `/badges/${username.trim()}.svg`;
      setSvgUrl(urlsvg);
      return urlsvg;
    }
    
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center px-4">
      <h1 className="text-4xl font-bold mb-6">Meme GitHub Badge Generator</h1>
      <div className="flex flex-col items-center w-full max-w-md">
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Enter GitHub username"
          className="w-full p-3 rounded mb-4 bg-gray-800 border border-gray-700 focus:outline-none focus:border-green-500"
        />
        <button
          onClick={generateSvg}
          className="w-full p-3 bg-green-600 rounded hover:bg-green-500 transition"
        >
          Generate Badge
        </button>
      </div>
      {svgUrl && (
        <div className="mt-8 flex flex-col items-center">
          <Image src={svgUrl} height={220} width={500} alt="GitHub Badge" className="rounded shadow-md" />
          <p className="mt-4 text-sm">Markdown to embed in your README.md:</p>
          <code className="bg-gray-800 p-2 rounded mt-2 text-xs">
            {`![GitHub Status](${typeof window !== 'undefined' ? window.location.origin : ''}${svgUrl})`}
          </code>
        </div>
      )}
    </div>
  );
}
