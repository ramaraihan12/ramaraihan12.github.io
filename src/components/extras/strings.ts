/**
 * Words for the easter eggs that copy.ts doesn't have. The toast titles and bodies, the
 * console greeting and the "Batik mode" title come from copy.ts; these fill the gaps.
 */
export const extrasCopy = {
  /** The banner on top of the console greeting. */
  consoleTitle: "Who is Rama Raihan?",
  /** Printed after consoleGreeting. */
  consoleHint: "Say hi back: type rama.hello()",
  /** What rama.hello() prints. */
  hello: "Hi back! Two developers in one console. That counts as a meetup.",

  /** Above each toast's title: "achievement · 2 of 5". */
  toastLabel: "achievement",
  toastCount: (n: number, total: number) => `${n} of ${total}`,
  close: "Close",
  /** Read out by screen readers with each toast. */
  announce: (title: string, body: string) => `Achievement: ${title}. ${body}`,

  /** Under the "Batik mode" title while the page is dyed. */
  dipLine: "Hold still, the dye is setting.",
  /** Read out when batik mode starts. The dye itself is hidden from screen readers. */
  dipAnnounce: "Batik mode. The page is dyed for a few seconds, then it rinses off. Press any key to rinse it now.",
} as const;
