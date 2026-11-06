import { Fragment } from "react";

/**
 * The line under a summary with what you need for the demo. Each word stays whole, so a password
 * like demo-admin-token can't break at a hyphen. The text itself stays exactly as written.
 */
export function DemoNote({ text }: { text: string }) {
  return (
    <p className="demo-note">
      {text.split(" ").map((word, i) => (
        <Fragment key={i}>
          {i > 0 ? " " : null}
          <span>{word}</span>
        </Fragment>
      ))}
    </p>
  );
}
