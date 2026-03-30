"use client";

import { useEffect, useCallback, useRef } from "react";

interface Shortcut {
  /** Key combo: "ctrl+s", "alt+1", "escape", "alt+arrowup" */
  key: string;
  /** Handler to fire */
  handler: () => void;
  /** Description for tooltip display */
  description?: string;
}

function parseCombo(combo: string) {
  const parts = combo.toLowerCase().split("+");
  return {
    ctrl: parts.includes("ctrl") || parts.includes("control"),
    alt: parts.includes("alt"),
    shift: parts.includes("shift"),
    meta: parts.includes("meta") || parts.includes("cmd"),
    key: parts.filter(
      (p) => !["ctrl", "control", "alt", "shift", "meta", "cmd"].includes(p)
    )[0] ?? "",
  };
}

function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  if ((el as HTMLElement).isContentEditable) return true;
  return false;
}

/**
 * Global keyboard shortcut manager.
 * Shortcuts are disabled when focus is on an input, textarea, or contenteditable element.
 *
 * @example
 * useKeyboardShortcuts([
 *   { key: "ctrl+s", handler: handleSave, description: "Save transcript" },
 *   { key: "alt+1", handler: () => setTab("summary"), description: "Summary tab" },
 *   { key: "escape", handler: closeModal, description: "Close modal" },
 * ]);
 */
export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  const shortcutsRef = useRef(shortcuts);
  useEffect(() => {
    shortcutsRef.current = shortcuts;
  });

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Allow Escape even in inputs (for closing modals)
    const inInput = isInputFocused();

    for (const shortcut of shortcutsRef.current) {
      const combo = parseCombo(shortcut.key);

      // Skip non-escape shortcuts when in an input
      if (inInput && combo.key !== "escape") continue;

      const keyMatch = e.key.toLowerCase() === combo.key;
      const ctrlMatch = combo.ctrl === (e.ctrlKey || e.metaKey);
      const altMatch = combo.alt === e.altKey;
      const shiftMatch = combo.shift === e.shiftKey;

      if (keyMatch && ctrlMatch && altMatch && shiftMatch) {
        e.preventDefault();
        shortcut.handler();
        return;
      }
    }
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
