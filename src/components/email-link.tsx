"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { CapStamp } from "@/components/art/stamp";
import { emailLinkCopy } from "@/content/copy";
import { site } from "@/content/site";

type EmailLinkProps = {
  className?: string;
  children: ReactNode;
  /** Shown in place of children for a moment after the address is copied. */
  copiedLabel?: ReactNode;
  /** Press a soga cap stamp next to the link when copied, instead of a plain tag from CSS. */
  stamp?: ReactNode;
};

/**
 * A mailto link that also copies the address. On a computer with no mail app set up, mailto
 * does nothing at all, so the copy is what makes the click useful there.
 */
export function EmailLink({ className, children, copiedLabel, stamp }: EmailLinkProps) {
  const [copied, setCopied] = useState(false);
  const [presses, setPresses] = useState(0);
  const timer = useRef(0);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  function copy() {
    navigator.clipboard
      ?.writeText(site.email)
      .then(() => {
        setCopied(true);
        setPresses((n) => n + 1);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setCopied(false), 2400);
      })
      .catch(() => {
        // Clipboard can be blocked; the mailto still goes through.
      });
  }

  const link = (
    <a
      href={`mailto:${site.email}`}
      onClick={copy}
      className={className}
      data-copied={copied || undefined}
      data-stamp={stamp ? "" : undefined}
    >
      {copied && copiedLabel ? copiedLabel : children}
    </a>
  );

  return (
    <>
      {stamp ? (
        <span className="email-stamped">
          {link}
          {copied && (
            <span className="email-stamp" aria-hidden="true">
              {/* New key each copy, so a second click presses again. */}
              <CapStamp key={presses} ink="soga" state="pressed" seed="copied">
                {stamp}
              </CapStamp>
            </span>
          )}
        </span>
      ) : (
        link
      )}
      <span className="sr-only" role="status">
        {copied ? emailLinkCopy.copiedStatus : ""}
      </span>
    </>
  );
}
