export type StackGroup = {
  name: string;
  items: string[];
  note: string;
};

export const stack: StackGroup[] = [
  {
    name: "AI and LLMs",
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
    items: ["Next.js", "React", "TypeScript", "Tailwind CSS", "Vite"],
    note: "Most of my apps run on Next.js. I write everything in TypeScript now.",
  },
  {
    name: "Backend",
    items: ["Laravel", "PHP", "Node.js", "Python", "FastAPI", "Hono", "Midtrans"],
    note: "Laravel for APIs, queues and auth. Python and FastAPI on the AI side. Midtrans for payments on Indonesian projects.",
  },
  {
    name: "Data",
    items: ["PostgreSQL", "pgvector", "MySQL", "MongoDB", "Drizzle"],
    note: "Postgres is my default, and pgvector keeps the embeddings in the same database as everything else.",
  },
  {
    name: "Shipping",
    items: ["Docker", "GitHub Actions", "Coolify", "Git", "PHPUnit"],
    note: "Docker so the app behaves the same on my laptop as on the server. Coolify deploys it to my own VPS.",
  },
];
