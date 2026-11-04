"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { Avatar } from "@/components/ui/avatar";

interface UserMenuProps {
  name: string;
  githubLogin: string | null;
}

// A disclosure (button + panel), not an ARIA menu: it holds one action, so
// arrow-key menu semantics would add nothing. Role pill comes with team pages (#7).
export function UserMenu({ name, githubLogin }: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const panelId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }
    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isOpen]);

  function handleSignOut() {
    setIsSigningOut(true);
    signOut({ redirectTo: "/signin" }).catch(() => setIsSigningOut(false));
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => setIsOpen((open) => !open)}
        className="inline-flex h-9 items-center gap-2 rounded-md px-2 text-sm transition-colors duration-150 ease-out hover:bg-text/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
      >
        <Avatar name={name} />
        <span className="sr-only sm:not-sr-only">{name}</span>
        <ChevronDown size={16} aria-hidden="true" className="text-text-muted" />
      </button>
      {isOpen && (
        <div
          id={panelId}
          className="absolute right-0 z-10 mt-2 flex w-56 flex-col gap-3 rounded-lg border border-border bg-surface p-3 shadow-lg"
        >
          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold">{name}</p>
            {githubLogin && (
              <p className="font-mono text-xs text-text-muted">
                @{githubLogin}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="inline-flex h-9 items-center gap-2 rounded-md px-2 text-sm transition-colors duration-150 ease-out hover:bg-text/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-60"
          >
            <LogOut size={16} aria-hidden="true" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
