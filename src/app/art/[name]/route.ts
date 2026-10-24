import { ART_FILES } from "@/components/art/files";

/*
  The art that's too big to carry in the page twice (as HTML and again in the payload it
  hydrates from), written to out/art/*.svg at build time. A route handler for the same reason
  og.png is one: the export keeps the .svg in the file name, so GitHub Pages serves it as
  image/svg+xml. The drawings are the art kit's own, so the files can't drift from the code.
*/

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(ART_FILES).map((name) => ({ name }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const draw = Object.hasOwn(ART_FILES, name) ? ART_FILES[name] : undefined;
  if (!draw) return new Response("Not found", { status: 404 });
  return new Response(draw(), { headers: { "Content-Type": "image/svg+xml" } });
}
