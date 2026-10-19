import { Hero } from "@/components/hero";
import { SiteHeader } from "@/components/site-header";
import { Stack } from "@/components/stack";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main id="main">
        <Hero />
        <Stack />
      </main>
    </>
  );
}
