export type StackGroup = {
  name: string;
  /** Written like a tool name an agent would call. */
  key: string;
  items: string[];
  note: string;
};

export const stack: StackGroup[] = [
  {
    name: "AI and LLMs",
    key: "llms",
    items: [
      "OpenAI",
      "Gemini",
      "Claude",
      "Ollama",
      "LangChain",
      "LangGraph",
      "LlamaIndex",
      "Vercel AI SDK",
      "Prism",
      "MCP",
    ],
    note: "RAG, agents with tool calling, chatbots and workflow automation. Ollama when it should run locally and cost nothing.",
  },
  {
    name: "Frontend",
    key: "frontend",
    items: ["Next.js", "React", "TypeScript", "Tailwind CSS", "Vite"],
    note: "Most of my apps run on Next.js. I write everything in TypeScript now.",
  },
  {
    name: "Backend",
    key: "backend",
    items: ["Laravel", "PHP", "Node.js", "Python", "FastAPI", "Hono", "Go", "Rust", "Midtrans"],
    note: "Laravel for APIs, queues and auth. Python and FastAPI on the AI side. Go or Rust when a small tool should ship as one binary. Midtrans for payments on Indonesian projects.",
  },
  {
    name: "Data",
    key: "data",
    items: ["PostgreSQL", "pgvector", "MySQL", "MongoDB", "Drizzle"],
    note: "Postgres is my default, and pgvector keeps the embeddings in the same database as everything else.",
  },
  {
    name: "Shipping",
    key: "shipping",
    items: ["Docker", "GitHub Actions", "Coolify", "Git", "PHPUnit"],
    note: "Docker so the app behaves the same on my laptop as on the server. Coolify deploys it to my own VPS.",
  },
];
