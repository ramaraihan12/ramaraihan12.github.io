import { Contact } from "@/components/contact";
import { Hero } from "@/components/hero";
import { OtherProjects } from "@/components/other-projects";
import { Projects } from "@/components/projects";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Stack } from "@/components/stack";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main id="main">
        <Hero />
        <Stack />
        <Projects />
        <OtherProjects />
        <Contact />
      </main>
      <SiteFooter />
    </>
  );
}
