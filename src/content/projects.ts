export type Project = {
  name: string;
  summary: string;
  /** Short steps showing how a request moves through the app. */
  flow?: string[];
  stack: string[];
  href: string;
};

/** No href means the code isn't public, so the name is shown without a link. */
export type OtherProject = Omit<Project, "flow" | "href"> & { href?: string };

const repo = (name: string) => `https://github.com/ramaraihan12/${name}`;

export const aiProjects: Project[] = [
  {
    name: "docs-rag-assistant",
    summary: "Chat with your own PDFs and docs. Every answer cites the page it came from.",
    flow: ["upload pdf", "chunk + embed", "pgvector search", "answer with page cite"],
    stack: ["Python", "FastAPI", "LlamaIndex", "pgvector"],
    href: repo("docs-rag-assistant"),
  },
  {
    name: "research-agent",
    summary:
      "A LangGraph agent that plans the research, waits for you to approve the plan, then searches the web and writes a cited report.",
    flow: ["plan", "you approve", "web search", "cited report"],
    stack: ["Python", "LangGraph", "Postgres"],
    href: repo("research-agent"),
  },
  {
    name: "shop-support-bot",
    summary:
      "Support chatbot for a small coffee bean shop. It answers FAQ and checks orders through tool calls, on the web and in Telegram.",
    flow: ["web or telegram", "faq search / order lookup", "answer"],
    stack: ["Next.js", "Vercel AI SDK", "Drizzle", "pgvector"],
    href: repo("shop-support-bot"),
  },
  {
    name: "llm-gateway",
    summary:
      "One OpenAI-compatible endpoint in front of OpenAI, Gemini, Anthropic and Ollama, with fallback, retries, rate limits and cost logs.",
    flow: ["request", "rate limit", "provider", "retry / fallback", "cost log"],
    stack: ["TypeScript", "Hono", "Postgres"],
    href: repo("llm-gateway"),
  },
  {
    name: "invoice-flow",
    summary:
      "Laravel app that pulls invoice data out with an LLM, checks the math, and holds it for review and approval before export.",
    flow: ["upload", "llm extract", "math check", "review + approve", "export / webhook"],
    stack: ["Laravel 12", "Prism", "Queues", "Postgres"],
    href: repo("invoice-flow"),
  },
  {
    name: "text-to-sql-chat",
    summary:
      "Ask a sales database questions in English or Bahasa Indonesia, with guardrails on the generated SQL. Also ships an MCP server.",
    flow: ["question", "generate sql", "guardrails", "run + answer"],
    stack: ["Python", "LangChain", "Streamlit", "MCP"],
    href: repo("text-to-sql-chat"),
  },
  {
    name: "issue-triage-action",
    summary:
      "GitHub Action that labels new issues, flags likely duplicates (TF-IDF) and leaves one comment. Defaults to Gemini's free tier, and any OpenAI-compatible endpoint works too, Ollama included.",
    flow: ["new issue", "labels", "duplicate check", "comment"],
    stack: ["TypeScript", "GitHub Actions", "Gemini", "zod"],
    href: repo("issue-triage-action"),
  },
  {
    name: "local-ai-coding-setup",
    summary:
      "My free, fully local AI coding setup on a laptop with a 6 GB RTX 3060: a coding agent in the terminal and autocomplete in VS Code. No subscription and no API bill.",
    flow: ["llama-server + ollama", "moe experts split gpu / ram", "pi agent behind a permission gate"],
    stack: ["llama.cpp", "Ollama", "Pi", "PowerShell"],
    href: repo("local-ai-coding-setup"),
  },
];

export const otherProjects: OtherProject[] = [
  {
    name: "project-clipper",
    summary:
      "Python pipeline I run for my own channel. It turns a long video into vertical 9:16 clips: faster-whisper transcribes, Gemini picks the highlights, OpenCV tracks faces for the crop and ffmpeg burns in subtitles. The code is private for now.",
    stack: ["Python", "faster-whisper", "Gemini", "OpenCV", "ffmpeg"],
  },
  {
    name: "ralaex",
    summary:
      "Household finance PWA my wife and I log our spending in from our phones. Budgets with alerts, receipt photos, charts, and PDF and Excel export.",
    stack: ["Next.js", "TypeScript", "Supabase", "Recharts"],
    href: repo("ralaex"),
  },
  {
    name: "chaBubbleTwitch",
    summary:
      "Free Twitch chat overlay for OBS that shows chat as bubbles, with emotes and username colors. Connects to Twitch IRC anonymously, so no login or token.",
    stack: ["HTML", "JavaScript", "tmi.js"],
    href: repo("chaBubbleTwitch"),
  },
];
