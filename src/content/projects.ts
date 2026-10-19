export type Project = {
  name: string;
  summary: string;
  /** Short steps showing how a request moves through the app. */
  flow?: string[];
  stack: string[];
  href: string;
};

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
    name: "ai-lokal",
    summary:
      "My free, fully local AI coding setup on a laptop with a 6 GB RTX 3060. No subscription and no API bill.",
    flow: ["llama.cpp + ollama", "model on a 6 GB gpu", "agent in the terminal"],
    stack: ["llama.cpp", "Ollama", "PowerShell"],
    href: repo("ai-lokal"),
  },
];

export const otherProjects: Project[] = [
  {
    name: "project-clipper",
    summary:
      "Desktop app I use for my own channel. It turns a long video into vertical short clips: transcribes, picks segments, crops to 9:16 and burns in subtitles.",
    stack: ["CLI", "YouTube Data API"],
    href: repo("project-clipper"),
  },
  {
    name: "ralaexV2.0",
    summary: "Household finance PWA with charts and PDF and Excel export.",
    stack: ["Next.js", "TypeScript", "Supabase", "Recharts"],
    href: repo("ralaexV2.0"),
  },
  {
    name: "chaBubbleTwitch",
    summary:
      "Free Twitch chat overlay for OBS that shows chat as bubbles, with emotes and username colors. Connects to Twitch IRC anonymously, so no login or token.",
    stack: ["HTML", "JavaScript", "tmi.js"],
    href: repo("chaBubbleTwitch"),
  },
];
