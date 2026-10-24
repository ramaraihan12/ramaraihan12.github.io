import { AlsoBuilt } from "@/components/also-built";
import { AnswerScene } from "@/components/answer-scene";
import { Contact } from "@/components/contact";
import { PlaySection } from "@/components/game/play-section";
import { QueryScene } from "@/components/query-scene";
import { RunSection } from "@/components/run-section";
import { ScrollEngine } from "@/components/scroll-engine";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ToolsSection } from "@/components/tools-section";

// Order matters: each scene sets up its scroll triggers after the ones above it, so the
// pinned scenes measure the space taken by the pins before them.
export default function Home() {
  return (
    <>
      <ScrollEngine />
      <SiteHeader />
      <main id="main">
        <QueryScene />
        <PlaySection />
        <ToolsSection />
        <RunSection />
        <AlsoBuilt />
        <AnswerScene />
        <Contact />
      </main>
      <SiteFooter />
    </>
  );
}
