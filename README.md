# portfolio

My personal site. One page that says who I am, what I work with and what I've built, with the AI projects first because that's what I'm spending my time on now.

<p>
  <img src="docs/desktop.png" alt="The site on a desktop browser, light theme" width="620" />
  <img src="docs/mobile.png" alt="The site on a phone, light theme" width="170" />
</p>

## How it works

- One page, prerendered at build time. No database, no API routes, no client-side fetching.
- All the text lives in `src/content/`. Adding a project means adding one object to `projects.ts`, nothing else.
- Dark mode follows the system until you pick one with the toggle. A small inline script sets the class before first paint, so the page never flashes the wrong theme.
- Motion is CSS only. The hero rises in on load and project cards fade in as they scroll into view. Both switch off with `prefers-reduced-motion`, and browsers without scroll-driven animations just show the cards.
- The Open Graph card is generated at build time from my photo with `next/og`.

## Stack

- Next.js 16 (App Router), React 19, TypeScript
- Tailwind CSS 4
- `next/font` with Archivo, Instrument Sans and Geist Mono

## Run it

Needs Node 20.9 or newer (I use 24).

```bash
npm ci
npm run dev
```

Then open http://localhost:3000.

For a production build:

```bash
npm run build
npm start
```

| Variable   | What it's for                                                        | Default                 |
| ---------- | -------------------------------------------------------------------- | ----------------------- |
| `SITE_URL` | Public URL, used for the Open Graph tags, canonical link and sitemap | `http://localhost:3000` |

## Checks

```bash
npm run lint && npm run build
```

There's no test suite, it's static content. The build type-checks everything, and CI runs the same two commands on every push.

## Deploy

It's a plain Next.js app, so any host that runs Node works. On Coolify: add the repo as an application, keep the Nixpacks build pack, set `SITE_URL` to the real domain and expose port 3000.

## Notes

- No CMS on purpose. The content changes a few times a year, and a TypeScript file is easier to review than a dashboard.
- The project list is hand-written, not pulled from the GitHub API. Repo descriptions are often too short to explain what a project does, and I'd rather not hit a rate limit on build.
- Next I'd like to add a short write-up per AI project (what broke, what I'd do differently) and a Bahasa Indonesia version of the page.

## License

MIT
