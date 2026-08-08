/**
 * GitHub username rules: alphanumeric or single hyphens, cannot start or end
 * with a hyphen, 1-39 characters. Anything else never resolves to a real user,
 * so we reject it before it reaches the GitHub API or any path building.
 */
const GITHUB_USERNAME = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/;

export function isValidUsername(value: string): boolean {
  return GITHUB_USERNAME.test(value);
}

/**
 * Normalises user input into a username: strips a pasted profile URL, an "@"
 * prefix and surrounding whitespace. Returns null when the result is not a
 * syntactically valid GitHub username.
 */
export function parseUsername(input: string): string | null {
  let value = input.trim();

  if (!value) return null;

  // Accept a pasted profile URL such as https://github.com/octocat
  const url = value.match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/?#]+)/i);
  if (url) value = url[1];

  if (value.startsWith('@')) value = value.slice(1);

  value = value.replace(/\/+$/, '');

  return isValidUsername(value) ? value : null;
}
