import { site } from "@/content/site";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container-page site-footer-inner">
        <p>
          © {new Date().getFullYear()} {site.name} · {site.location}
        </p>
        <p>
          The colors are nila and kunyit, indigo and turmeric, both natural dyes used in Javanese
          batik.{" "}
          <a href={site.source}>Source</a>
        </p>
      </div>
    </footer>
  );
}
