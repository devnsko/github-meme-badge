import type { Archetype, Tier } from './scoring';

/**
 * All badge copy lives here as data. `{n}` is replaced with the formatted count
 * for that facet, `{lang}` with the top language.
 *
 * Titles are kept short — they are rendered inside a pill on a 480px card, so
 * anything past ~20 characters starts crowding the language tag.
 */
export const TITLES: Record<Archetype, Record<Tier, string[]>> = {
  reach: {
    low: ['Rising Signal', 'Mild Buzz', 'Locally Famous', 'Warm Start'],
    mid: ['Star Collector', 'Certified Buzz', 'Trending Adjacent', 'Front Page Energy'],
    high: ['Star Magnet', 'Main Character', 'Certified Viral', 'Algorithm Approved'],
  },
  influence: {
    low: ['Quietly Forked', 'Seed Planter', 'First Fork Era', 'Slow Spread'],
    mid: ['Fork Farmer', 'Upstream Regular', 'Branching Out', 'Copy-Paste Source'],
    high: ['Fork Overlord', 'Upstream Legend', 'The Origin Repo', 'Ctrl+C Target'],
  },
  output: {
    low: ['Slow Cooker', 'Occasional Pusher', 'Two Repo Wonder', 'Warming Up'],
    mid: ['Repo Gardener', 'Serial Starter', 'Prolific Pusher', 'Side Project Era'],
    high: ['Repo Hoarder', 'Commit Machine', 'Ships Everything', 'Monorepo Menace'],
  },
  craft: {
    low: ['Careful Builder', 'Small Batch', 'Precision Draft', 'Measured Output'],
    mid: ['Quality Control', 'Sniper Commits', 'Low Volume Hits', 'Deliberate Work'],
    high: ['Small But Deadly', 'Zero Filler', 'Artisan Committer', 'Every Repo Hits'],
  },
  diversity: {
    low: ['One Stack Wonder', 'Comfort Zone', 'Monolingual', 'Single Dialect'],
    mid: ['Stack Tourist', 'Language Sampler', 'Polyglot Curious', 'Multi-Runtime'],
    high: ['Polyglot Menace', 'Stack Nomad', 'Speaks Everything', 'Compiler Whisperer'],
  },
  activity: {
    low: ['Slow Blink', 'Weekend Warrior', 'Sporadic Pusher', 'Low Power Mode'],
    mid: ['Steady Pusher', 'Always Around', 'Consistent Streak', 'Reliably Online'],
    high: ['Never Offline', 'Touch Grass Later', 'Perpetual Motion', 'Commits At 3AM'],
  },
  tenure: {
    low: ['New Arrival', 'Fresh Timeline', 'Recent Vintage', 'Just Landed'],
    mid: ['Seasoned Account', 'Long Hauler', 'Old Enough', 'Been Around'],
    high: ['Git Elder', 'Pre-Copilot Era', 'Ancient Contributor', 'Survived jQuery'],
  },
  rookie: {
    low: ['Fresh Clone', 'Day One Energy', 'Blank Canvas', 'Init Commit'],
    mid: ['Fast Learner', 'Quick Study', 'Early Momentum', 'Ahead Of Schedule'],
    high: ['Instant Classic', 'Speedrun Account', 'No Warm-Up Needed', 'Skipped The Tutorial'],
  },
  dormant: {
    low: ['Cold Storage', 'Ghost Committer', 'Archived Vibes', 'Read-Only Mode'],
    mid: ['Sleeping Giant', 'On Sabbatical', 'Cached Legend', 'Paused Indefinitely'],
    high: ['Dormant Volcano', 'Legend In Stasis', 'Museum Piece', 'Load-Bearing Ghost'],
  },
};

/** Opening line. Kept under ~58 characters so it fits one rendered line. */
export const TAGLINES: string[] = [
  'Ships code like a meme goes viral.',
  'Every commit lands like a fresh drop.',
  'Turns coffee into commits, commits into legend.',
  'Writes code the way other people write punchlines.',
  'The repos are exclusive content and everyone knows it.',
  'Somewhere a CI pipeline is applauding.',
  'Pushes to main with the confidence of a top comment.',
  'Reviews own PR, approves it, feels nothing.',
  'Names variables like a poet, ships like a machine.',
  'Has never once read the contributing guidelines.',
  'Squashes commits and unresolved feelings alike.',
  'Rebases in public without breaking eye contact.',
  'Force-pushes with the serenity of the enlightened.',
  'Solves it at 2am, documents it never.',
  'Writes the README last, like a legend.',
  'Deletes more lines than most people write.',
  'Fixed the bug by staring at it.',
  'Commit messages read like a diary entry.',
  'Ships on Friday. Fears nothing.',
  'Refactors for fun, not for money.',
  'The linter has stopped arguing back.',
  'Has strong opinions about tabs. Correctly.',
  'Turns "quick fix" into a two-week saga.',
  'Reads the stack trace like a bedtime story.',
  'Codes first, googles the error second.',
  'Merge conflicts resolve themselves out of respect.',
  'Once fixed production from a phone. Twice.',
  'Writes tests. Actually writes tests.',
  'Explains the bug better than the docs explain the feature.',
  'Every branch name is a small confession.',
  'Reverts with dignity.',
  'Has a folder called final-final-v2 somewhere.',
  'Comments the code nobody else will ever read.',
  'Debugging is the hobby. Shipping is the side effect.',
  'Left a TODO in 2019. It is load-bearing now.',
  'Types fast enough to outrun the compiler.',
  'The repo is clean. The desk is not.',
  'Blames git. Git blames back.',
  'Closed the issue by rewriting the project.',
  'Optimises things nobody asked about.',
];

interface TierRule {
  min: number;
  lines: string[];
}

export const STAR_TIERS: TierRule[] = [
  {
    min: 5000,
    lines: [
      '{n} stars. That is basically a small country.',
      '{n} stars — the constellation is getting crowded.',
      '{n} stars and counting, like a slow-motion riot.',
      '{n} stars: certified internet infrastructure.',
    ],
  },
  {
    min: 500,
    lines: [
      '{n} stars and climbing like a trending post.',
      '{n} stars. Somebody bookmarked this at work.',
      '{n} stars — the algorithm has taken notice.',
      '{n} stars, each one a tiny act of respect.',
    ],
  },
  {
    min: 50,
    lines: [
      '{n} stars: the internet has officially noticed.',
      '{n} stars, which is {n} more than most.',
      '{n} stars and a growing fan club.',
      '{n} stars earned the old-fashioned way.',
    ],
  },
  {
    min: 1,
    lines: [
      '{n} stars, each one hard-earned.',
      '{n} stars and every single one counted.',
      '{n} stars. Quality over quantity, obviously.',
      '{n} stars, personally verified.',
    ],
  },
  {
    min: 0,
    lines: [
      'Zero stars, infinite potential.',
      'No stars yet — the best kind of underrated.',
      'Zero stars and absolutely no pressure.',
      'Starless, fearless, still shipping.',
    ],
  },
];

export const FORK_TIERS: TierRule[] = [
  {
    min: 500,
    lines: [
      '{n} forks. This is a movement now.',
      '{n} forks — half the ecosystem starts here.',
      '{n} forks spreading faster than the news.',
      '{n} forks: the upstream everyone secretly depends on.',
    ],
  },
  {
    min: 50,
    lines: [
      '{n} forks spreading like reposts.',
      '{n} forks out there, quietly compiling.',
      '{n} forks. Someone renamed it and shipped it.',
      '{n} forks doing the rounds without credit.',
    ],
  },
  {
    min: 5,
    lines: [
      '{n} forks, each one a small compliment.',
      '{n} forks in the wild and growing.',
      '{n} forks. Imitation, flattery, the usual.',
      '{n} forks living their own lives now.',
    ],
  },
  {
    min: 0,
    lines: [
      'Unforked and unbothered.',
      'Zero forks: nobody dares touch perfection.',
      'No forks yet, which keeps it exclusive.',
      'Fork count zero. Originality intact.',
    ],
  },
];

export const FOLLOWER_TIERS: TierRule[] = [
  {
    min: 2000,
    lines: [
      '{n} followers watching every push.',
      '{n} followers. That is an audience, not a network.',
      '{n} followers refreshing the profile page.',
    ],
  },
  {
    min: 200,
    lines: [
      '{n} followers along for the ride.',
      '{n} followers who clicked follow on purpose.',
      '{n} followers and a reputation to maintain.',
    ],
  },
  {
    min: 20,
    lines: [
      '{n} followers, and they all showed up early.',
      '{n} followers with excellent taste.',
      '{n} followers quietly taking notes.',
    ],
  },
  {
    min: 0,
    lines: [
      'A small following, hand-picked by fate.',
      'Followers optional. The code speaks.',
      'Not many followers. Not many needed.',
    ],
  },
];

export const REPO_TIERS: TierRule[] = [
  {
    min: 150,
    lines: [
      '{n} repos. Some of them even have READMEs.',
      '{n} repos, a personal archaeological site.',
      '{n} repos: an idea graveyard with excellent bones.',
    ],
  },
  {
    min: 40,
    lines: [
      '{n} repos and every one started at 1am.',
      '{n} repos, roughly six of which are finished.',
      '{n} repos in the vault, all fresh.',
    ],
  },
  {
    min: 8,
    lines: [
      '{n} repos, curated rather than accumulated.',
      '{n} repos, no filler in sight.',
      '{n} repos that each earned their place.',
    ],
  },
  {
    min: 0,
    lines: [
      'A short repo list and a long attention span.',
      'Few repos, strong opinions.',
      'Every repo here is a unique exclusive.',
    ],
  },
];

export const LANGUAGE_COUNT_TIERS: TierRule[] = [
  {
    min: 8,
    lines: [
      '{n} languages. Pick a lane — or do not.',
      'Fluent in {n} languages and fluent in none.',
      '{n} languages deep. The compiler fears this one.',
    ],
  },
  {
    min: 4,
    lines: [
      '{n} languages, switched mid-sentence.',
      '{n} languages and no favourites admitted.',
      '{n} languages, all used with confidence.',
    ],
  },
  {
    min: 0,
    lines: [
      'One stack, mastered completely.',
      'Sticks to what works. Respect.',
      'Monolingual by choice, not by limit.',
    ],
  },
];

export const ACTIVITY_TIERS: TierRule[] = [
  {
    min: 400,
    lines: [
      'Last push was {n} days ago. The repos wait patiently.',
      'Quiet for {n} days. The legend rests.',
      '{n} days since the last commit — a strategic pause.',
    ],
  },
  {
    min: 90,
    lines: [
      '{n} days since the last push. Plotting something.',
      'A {n}-day gap. Recharging, obviously.',
      'Quiet for {n} days, which is suspicious.',
    ],
  },
  {
    min: 7,
    lines: [
      'Last push {n} days ago — still warm.',
      'Pushed {n} days ago and already planning more.',
      'Active within the week, as one should be.',
    ],
  },
  {
    min: 0,
    lines: [
      'Pushed today. Touch grass later.',
      'The commits are still warm.',
      'Active right now, allegedly resting.',
    ],
  },
];

/** Keyed in whole years, not days — the copy talks in years. */
export const TENURE_TIERS: TierRule[] = [
  {
    min: 10,
    lines: [
      'On GitHub for {n} years. Saw things.',
      '{n} years in. Remembers when it was all forks.',
      '{n} years of account age and zero regrets.',
    ],
  },
  {
    min: 3,
    lines: [
      '{n} years in and still shipping.',
      '{n} years of account history, mostly good.',
      '{n} years deep. Knows where the bodies are.',
    ],
  },
  {
    min: 0,
    lines: [
      'New account energy, veteran output.',
      'Recently arrived, already dangerous.',
      'Fresh account. No bad habits yet.',
    ],
  },
];

export const HIT_RATE_TIERS: TierRule[] = [
  {
    min: 60,
    lines: [
      '{n}% of the repos have stars. No filler.',
      'A {n}% hit rate. That is not luck.',
      '{n}% of everything shipped actually landed.',
    ],
  },
  {
    min: 25,
    lines: [
      '{n}% of the repos found an audience.',
      'A {n}% hit rate and rising.',
      '{n}% landed, which beats the average.',
    ],
  },
  {
    min: 0,
    lines: [
      'Most of it is for the craft, not the crowd.',
      'Builds for an audience of one. Valid.',
      'The good stuff is in there somewhere.',
    ],
  },
];

/** Slotted in when the top language has a known joke. `{lang}` is the fallback. */
export const LANGUAGE_LINES: Record<string, string[]> = {
  JavaScript: ['JavaScript, where undefined is not a problem.', 'JavaScript: two equals signs, infinite consequences.'],
  TypeScript: ['TypeScript, because vibes need types.', 'TypeScript: any is right there, but no.'],
  Python: ['Python: indentation is a lifestyle.', 'Python, and the whitespace is load-bearing.'],
  Java: ['Java, one AbstractFactoryBean at a time.', 'Java: verbose, reliable, eternal.'],
  'C++': ['C++ and the segfaults that build character.', 'C++, where the footguns are a feature.'],
  C: ['C, manually managing memory and feelings.', 'C: close to the metal, far from comfort.'],
  'C#': ['C#, quietly excellent and rarely thanked.', 'C# and a solutions folder full of solutions.'],
  Go: ['Go, where errors are handled explicitly and often.', 'Go: if err != nil, as a way of life.'],
  Rust: ['Rust, and the borrow checker approves.', 'Rust: fought the compiler, won, grew stronger.'],
  Ruby: ['Ruby, still the most polite language around.', 'Ruby, where everything reads like a sentence.'],
  PHP: ['PHP, and it still pays the bills.', 'PHP: underestimated since forever.'],
  Shell: ['Shell scripts held together by sheer willpower.', 'Bash, where every line is a small dare.'],
  HTML: ['HTML: technically a language, emotionally a craft.', 'HTML, and the divs go all the way down.'],
  CSS: ['CSS, centering things against all odds.', 'CSS: !important is a personality trait.'],
  Kotlin: ['Kotlin, Java with the sharp edges filed down.', 'Kotlin: null safety and inner peace.'],
  Swift: ['Swift, and the compiler is still thinking.', 'Swift, where optionals are a state of mind.'],
  Dart: ['Dart, and everything is a widget.', 'Dart: the nesting goes deeper than expected.'],
  Lua: ['Lua, small enough to fit anywhere.', 'Lua, where tables solve everything.'],
  Haskell: ['Haskell, and the monads finally made sense.', 'Haskell: pure functions, impure obsession.'],
  Elixir: ['Elixir, and nothing has crashed in months.', 'Elixir: let it crash, then let it recover.'],
  Scala: ['Scala, where the type signature is the docs.', 'Scala: functional until the deadline.'],
  Perl: ['Perl, still running something critical somewhere.', 'Perl: write once, read never.'],
  R: ['R, and the plots look genuinely great.', 'R: statistics with strong opinions.'],
  Julia: ['Julia, fast enough to make a point.', 'Julia: scientific computing without the apology.'],
  Zig: ['Zig, and the allocator is explicit on purpose.', 'Zig: no hidden control flow, no surprises.'],
  Vim: ['Vim script, written by someone who could not leave.', 'Vim config as a lifelong project.'],
  Nix: ['Nix, and the build is reproducible on principle.', 'Nix: it works on every machine now.'],
  Assembly: ['Assembly, because abstraction is for other people.', 'Assembly: the metal itself.'],
  'Jupyter Notebook': ['Notebooks, run out of order, forever.', 'Jupyter, where cell 12 depends on cell 3.'],
  SQL: ['SQL, and the query plan is beautiful.', 'SQL: one JOIN away from greatness.'],
};
