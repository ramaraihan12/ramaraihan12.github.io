import { site } from "@/content/site";

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="container-page flex flex-col gap-2 py-8 font-mono text-xs text-muted sm:flex-row sm:justify-between">
        <p>
          © {new Date().getFullYear()} {site.name} · {site.location}
        </p>
        <p>
          Built with Next.js and Tailwind CSS.{" "}
          <a href={site.source} className="text-ink underline decoration-line underline-offset-4 hover:decoration-indigo">
            Source
          </a>
        </p>
      </div>
    </footer>
  );
}
