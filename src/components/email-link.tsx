"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { emailLinkCopy } from "@/content/copy";
import { site } from "@/content/site";

type EmailLinkProps = {
  className?: string;
  children: ReactNode;
  /** Shown in place of children for a moment after the address is copied. */
  copiedLabel?: ReactNode;
};

/**
 * A mailto link that also copies the address. On a computer with no mail app set up, mailto
 * does nothing at all, so the copy is what makes the click useful there.
 */
export function EmailLink({ className, children, copiedLabel }: EmailLinkProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef(0);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  function copy() {
    navigator.clipboard
      ?.writeText(site.email)
      .then(() => {
        setCopied(true);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setCopied(false), 2400);
      })
      .catch(() => {
        // Clipboard can be blocked; the mailto still goes through.
      });
  }

  return (
    <>
      <a href={`mailto:${site.email}`} onClick={copy} className={className} data-copied={copied || undefined}>
        {copied && copiedLabel ? copiedLabel : children}
      </a>
      <span className="sr-only" role="status">
        {copied ? emailLinkCopy.copiedStatus : ""}
      </span>
    </>
  );
}
