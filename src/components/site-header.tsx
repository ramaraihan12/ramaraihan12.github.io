import { site } from "@/content/site";
import { ThemeToggle } from "./theme-toggle";

// Stack is the first link to go on very narrow phones; the section is right below the hero anyway.
const links = [
  { href: "#stack", label: "Stack", className: "max-[22rem]:hidden" },
  { href: "#projects", label: "Projects" },
  { href: "#contact", label: "Contact" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-paper/85 backdrop-blur-md">
      <div className="container-page flex h-14 items-center justify-between gap-3">
        <a href="#top" className="type-display shrink-0 text-[0.9rem] tracking-normal whitespace-nowrap text-ink sm:text-[0.95rem]">
          {site.name}
        </a>
        <nav aria-label="Main">
          <ul className="flex items-center gap-0.5 text-[0.8125rem] sm:gap-1 sm:text-sm">
            {links.map((link) => (
              <li key={link.href} className={link.className}>
                <a
                  href={link.href}
                  className="rounded-md px-1 py-1.5 text-muted transition-colors hover:text-ink sm:px-3"
                >
                  {link.label}
                </a>
              </li>
            ))}
            <li className="sm:ml-1">
              <ThemeToggle />
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
