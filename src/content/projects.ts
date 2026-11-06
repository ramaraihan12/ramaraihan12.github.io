export type ProjectImage = {
  /** A screenshot from the repo's docs, resized to 1280 px wide at most and saved as WebP. */
  src: string;
  alt: string;
  width: number;
  height: number;
};

export type Project = {
  name: string;
  /** What kind of thing it is, shown as a tag on the panel. */
  kind: string;
  summary: string;
  /** Short steps showing how a request moves through the app. One line each, no repeats. */
  flow?: string[];
  stack: string[];
  href: string;
  image?: ProjectImage;
  /** Where you can try it: a live page, or a download for something with no page. */
  demo?: string;
  /** The link's words when "Try it" doesn't fit, like a download. */
  demoLabel?: string;
  /**
   * One short line for someone about to try the demo: the shared login, a sample to use, or what's
   * off in it. Short phones cut the summary off, so anything they need to see goes here, not there.
   * The logins are public on purpose.
   */
  demoNote?: string;
};

/**
 * No href means there's nothing public to link to, so the name is shown without a link.
 * Has `image` and the `demo` fields from Project too.
 */
export type OtherProject = Omit<Project, "flow" | "href" | "kind"> & { href?: string };

const repo = (name: string) => `https://github.com/ramaraihan12/${name}`;
const shot = (name: string, alt: string, width: number, height: number): ProjectImage => ({
  src: `/images/projects/${name}.webp`,
  alt,
  width,
  height,
});

export const aiProjects: Project[] = [
  {
    name: "docs-rag-assistant",
    kind: "RAG",
    summary:
      "Ask questions about your own PDFs, Word files and Markdown notes, in English or Indonesian. Every answer cites the file and page it came from. In a small eval the right page came first for 16 of 16 questions, and it refused all 3 off-topic ones instead of guessing.",
    flow: ["upload docs", "chunk + embed", "pgvector search", "score cutoff", "cited answer"],
    stack: ["Python", "FastAPI", "LlamaIndex", "pgvector"],
    href: repo("docs-rag-assistant"),
    demo: "https://docs-rag-assistant-psi.vercel.app",
    demoNote: "Uploads are off in the demo, so you ask about the loaded samples.",
    image: shot(
      "docs-rag-assistant",
      "The docs assistant answering a question about hotel limits with two numbered sources. Above it, an off-topic question it declined to answer.",
      1280,
      900,
    ),
  },
  {
    name: "research-agent",
    kind: "Agent",
    summary:
      "A LangGraph agent that plans the research and waits for you to approve the plan. Then it searches the web, looks for gaps in its notes, runs another round if it finds some, and writes a report with numbered sources. Postgres is optional, for picking up a paused run later.",
    flow: ["plan", "you approve", "web search", "reflect", "cited report"],
    stack: ["Python", "LangGraph", "Postgres"],
    href: repo("research-agent"),
    demo: "https://research-agent-mauve-eight.vercel.app",
  },
  {
    name: "shop-support-bot",
    kind: "Chatbot",
    summary:
      "Support chatbot for a small coffee bean shop, on the web and in Telegram. It answers from the shop's policies, checks orders and stock, opens tickets, and hands the chat to a person when the customer asks or is upset.",
    flow: ["web or telegram", "handoff check", "policy search", "tool calls", "reply"],
    stack: ["Next.js", "Vercel AI SDK", "Drizzle", "pgvector"],
    href: repo("shop-support-bot"),
    demo: "https://shop-support-bot-ivory.vercel.app",
    demoNote: "Try order KN-10231 with rina.wulandari@example.com",
    image: shot(
      "shop-support-bot",
      "A support chat in Indonesian and English. The bot finds one order, answers a shipping question, and won't show an order placed with a different email.",
      1280,
      1288,
    ),
  },
  {
    name: "llm-gateway",
    kind: "Gateway",
    summary:
      "One OpenAI-compatible endpoint in front of OpenAI, Gemini, Anthropic and Ollama. It retries, falls back to the next provider, rate-limits each hashed API key, caches exact repeats and logs what every request cost.",
    flow: ["key check", "rate limit", "cache", "retry / fallback", "cost log"],
    stack: ["TypeScript", "Hono", "Postgres"],
    href: repo("llm-gateway"),
    demo: "https://llm-gateway-red.vercel.app",
    demoNote: "The demo is one locked alias on Gemini, so fallback won't show.",
  },
  {
    name: "invoice-flow",
    kind: "Extraction",
    summary:
      "Laravel app for Indonesian supplier invoices. An LLM reads the PDF or photo, then plain code checks the math, the PPN and the NPWP. Nothing is exported until a person approves it, and the export webhook is HMAC-signed.",
    flow: ["upload", "llm extract", "math + ppn check", "review + approve", "signed webhook"],
    stack: ["Laravel 12", "Prism", "Queues", "Postgres"],
    href: repo("invoice-flow"),
    demo: "https://invoice-flow-three-henna.vercel.app",
    demoNote: "Uploads are off in the demo, so you start from a sample invoice.",
    image: shot(
      "invoice-flow",
      "The review screen: the original invoice on the left, the extracted fields on the right, and one line item flagged because 3 times the unit price doesn't match its amount.",
      1280,
      782,
    ),
  },
  {
    name: "text-to-sql-chat",
    kind: "Text to SQL",
    summary:
      "Ask a sales database questions in English or Bahasa Indonesia and get the SQL, the rows, a one-line answer, and a chart when there's something to plot. The SQL has to pass guardrails before it runs, and the same tools ship as an MCP server.",
    flow: ["question", "generate sql", "guardrails", "run read-only", "answer + chart"],
    stack: ["Python", "LangChain", "Streamlit", "MCP"],
    href: repo("text-to-sql-chat"),
    demo: "https://text-to-sql-chat.streamlit.app",
    image: shot(
      "text-to-sql-chat",
      "The chat answering “Revenue per city in September 2026” with one sentence and a bar chart of ten cities.",
      1280,
      760,
    ),
  },
  {
    name: "issue-triage-action",
    kind: "Automation",
    summary:
      "GitHub Action that labels new issues, flags likely duplicates (TF-IDF) and asks for missing details in one short comment. When the model isn't sure, it does nothing. Defaults to Gemini's free tier, and any OpenAI-compatible endpoint works too, Ollama included.",
    flow: ["new issue", "duplicate check", "labels", "ask for details"],
    stack: ["TypeScript", "GitHub Actions", "Gemini", "zod"],
    href: repo("issue-triage-action"),
    demo: "https://github.com/ramaraihan12/issue-triage-demo",
  },
  {
    name: "local-ai-coding-setup",
    kind: "Local models",
    summary:
      "My fully local AI coding setup on a PC with a 6 GB RTX 3060: a coding agent in the terminal and autocomplete in VS Code. It asks before risky commands like git push. No subscription and no API bill.",
    flow: ["pi in terminal", "permission gate", "llama-server", "gpu + ram split"],
    stack: ["llama.cpp", "Ollama", "Pi", "PowerShell"],
    href: repo("local-ai-coding-setup"),
    demo: "https://ramaraihan.is-a.dev/local-ai-coding-setup/",
    demoLabel: "Project page",
  },
];

/** Web apps and tools with no model in them. */
export const webProjects: Project[] = [
  {
    name: "antre",
    kind: "Queue + booking",
    summary:
      "Queue and booking for small clinics and barbershops. Book a slot with a deposit or take a walk-in ticket, and the TV in the waiting room calls your number out loud in Indonesian. Two counters never get the same ticket. 180 Pest tests, but the real Midtrans sandbox path isn't tested yet.",
    flow: ["book or walk in", "midtrans deposit", "priority queue", "call next", "tv reads it out"],
    stack: ["Laravel 12", "React + Inertia", "Reverb", "PostgreSQL", "Midtrans"],
    href: repo("antre"),
    demo: "https://antre-eight.vercel.app",
    demoNote: "Staff dimas@senyum.test, owner owner@senyum.test, password: password",
    image: shot(
      "antre",
      "The waiting-room TV: the number each counter is serving in large type, and the last five calls on the right.",
      1280,
      720,
    ),
  },
  {
    name: "warung-pos",
    kind: "Offline POS",
    summary:
      "A point of sale for a small shop that keeps selling when the internet drops. Each sale is saved on the device first and synced later, and a retry can never count it twice. 1,000 queued sales sync in about 3 seconds on my PC. Tested in Chromium only.",
    flow: ["ring up sale", "local outbox", "batch sync", "insert once", "owner reports"],
    stack: ["Next.js 16", "Dexie", "Drizzle", "PostgreSQL", "Service worker", "Playwright"],
    href: repo("warung-pos"),
    demo: "https://warung-pos-ashen.vercel.app",
    demoNote: "Login kasir1@warungbusri.test or owner@warungbusri.test, password warung123",
    image: shot(
      "warung-pos",
      "The till with the network off. A yellow banner says sales are still saved on this device, and two are waiting to sync.",
      1280,
      800,
    ),
  },
  {
    name: "webhook-inbox",
    kind: "Webhooks",
    summary:
      "Catches webhooks from Midtrans, Xendit, GitHub or any HMAC signer, so a payment callback isn't lost while your app is down. Every delivery is stored and forwarded with retries, and after 8 failed tries you can replay it by hand. The Midtrans and Xendit checks follow the docs and haven't met a live callback yet.",
    flow: ["check signature", "store", "ack", "retry + backoff", "replay from /ui"],
    stack: ["Rust", "axum + tokio", "sqlx + PostgreSQL", "askama + htmx", "Prometheus"],
    href: repo("webhook-inbox"),
    demo: "https://webhook-inbox-zeta.vercel.app",
    demoNote: "At /ui: any user name, password demo-admin-token",
    image: shot(
      "webhook-inbox",
      "The delivery list: GitHub, Midtrans, Xendit and partner webhooks marked done, rejected or dead, with how many tries each took.",
      1200,
      760,
    ),
  },
  {
    name: "pg-backup",
    kind: "Backups",
    summary:
      "Go CLI that streams Postgres backups to S3-compatible storage, compressed and encrypted on the way. A backup you haven't restored isn't a backup, so verify restores it into a scratch database, compares row counts, runs your SQL checks and drops it. Tested on MinIO and Postgres 17 only.",
    flow: ["pg_dump", "zstd", "age encrypt", "s3 upload", "restore drill"],
    stack: ["Go", "PostgreSQL", "zstd", "age", "MinIO"],
    href: repo("pg-backup"),
    demo: "https://github.com/ramaraihan12/pg-backup/releases/tag/v0.1.0",
    demoLabel: "Download",
  },
];

export const otherProjects: OtherProject[] = [
  {
    name: "project-clipper",
    summary:
      "Python pipeline I run for my own YouTube channel. It turns a long video into vertical 9:16 clips: faster-whisper transcribes, Gemini picks the highlights, OpenCV tracks faces for the crop and ffmpeg burns in subtitles. Then it uploads the clips to my channel through the YouTube Data API. The pipeline code isn't public.",
    stack: ["Python", "faster-whisper", "Gemini", "OpenCV", "ffmpeg"],
    href: "https://ramaraihan.is-a.dev/project-clipper/",
    demo: "https://ramaraihan.is-a.dev/project-clipper/",
    demoLabel: "Project page",
  },
  {
    name: "ralaex",
    summary:
      "Household finance PWA my wife and I log our spending in from our phones. Budgets that warn at 80% and 100%, receipt photos, charts, and PDF and Excel export. Recurring bills don't post on their own yet.",
    stack: ["Next.js", "TypeScript", "Supabase", "Recharts"],
    href: repo("ralaex"),
    demo: "https://ralaex-app.vercel.app",
    demoNote: "Receipt upload is off in the demo. Login demo@example.com, password demo-ralaex-2026",
  },
  {
    name: "chaBubbleTwitch",
    summary:
      "Free Twitch chat overlay for OBS that shows chat as wooden speech bubbles, with Twitch emotes. It joins Twitch chat anonymously, so there's no login or token.",
    stack: ["HTML", "JavaScript", "tmi.js"],
    href: repo("chaBubbleTwitch"),
    demo: "https://ramaraihan.is-a.dev/chaBubbleTwitch/",
  },
];
