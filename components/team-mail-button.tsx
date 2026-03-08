"use client";

import { useCallback, useRef, useState } from "react";
import { withBasePath } from "@/lib/base-path";

type EmailMap = Record<string, string>;

async function fetchEmails(password: string): Promise<{ emails: EmailMap | null; error?: string }> {
  try {
    const res = await fetch(withBasePath("/api/team/emails"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.status === 401) {
      return { emails: null, error: "Invalid password" };
    }
    if (!res.ok) {
      return { emails: null, error: "Request failed" };
    }
    const data = (await res.json()) as { emails: EmailMap };
    return { emails: data.emails };
  } catch {
    return { emails: null, error: "Network error" };
  }
}

const MAIL_ICON = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ verticalAlign: "middle" }}
  >
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </svg>
);

/* ── Shared password dialog state ── */

type PendingAction = { type: "single"; name: string } | { type: "all"; names: string[] };

let globalShowDialog: ((action: PendingAction) => void) | null = null;
let globalCachedEmails: EmailMap | null = null;

function requestEmails(action: PendingAction) {
  // If we already have cached emails, use them directly
  if (globalCachedEmails) {
    openMailto(globalCachedEmails, action);
    return;
  }
  // Otherwise show the password dialog
  if (globalShowDialog) {
    globalShowDialog(action);
  }
}

function openMailto(emails: EmailMap, action: PendingAction) {
  if (action.type === "single") {
    const email = emails[action.name];
    if (email) window.location.href = `mailto:${email}`;
  } else {
    const all = action.names
      .map((n) => emails[n])
      .filter((e): e is string => !!e);
    if (all.length > 0) window.location.href = `mailto:${all.join(",")}`;
  }
}

export function TeamPasswordDialog() {
  const [visible, setVisible] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const pendingRef = useRef<PendingAction | null>(null);

  globalShowDialog = useCallback((action: PendingAction) => {
    pendingRef.current = action;
    setError(null);
    setPassword("");
    setVisible(true);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim()) return;
    setLoading(true);
    setError(null);
    const result = await fetchEmails(password.trim());
    setLoading(false);
    if (!result.emails) {
      setError(result.error ?? "Invalid password");
      return;
    }
    globalCachedEmails = result.emails;
    setVisible(false);
    if (pendingRef.current) {
      openMailto(result.emails, pendingRef.current);
    }
  }

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 999,
        background: "rgba(0,0,0,0.35)", display: "flex",
        alignItems: "center", justifyContent: "center",
      }}
      onClick={() => setVisible(false)}
    >
      <form
        onSubmit={(e) => void handleSubmit(e)}
        onClick={(e) => e.stopPropagation()}
        className="card"
        style={{
          width: "340px", maxWidth: "90vw",
          display: "flex", flexDirection: "column", gap: "0.6rem",
        }}
      >
        <strong>Enter portal password to access emails</strong>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoFocus
          required
        />
        {error && <p style={{ color: "#b44", margin: 0, fontSize: "0.85rem" }}>{error}</p>}
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button type="submit" disabled={loading}>
            {loading ? "Verifying…" : "Confirm"}
          </button>
          <button type="button" className="secondary" onClick={() => setVisible(false)}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

export function TeamMailIcon({ name }: { name: string }) {
  return (
    <button
      type="button"
      onClick={() => requestEmails({ type: "single", name })}
      title={`Email ${name}`}
      aria-label={`Email ${name}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0.2rem 0.35rem",
        background: "transparent",
        border: "1px solid #b7ddd1",
        borderRadius: "6px",
        color: "#0f8f6f",
        cursor: "pointer",
        lineHeight: 1,
      }}
    >
      {MAIL_ICON}
    </button>
  );
}

export function MailAllButton({ names }: { names: string[] }) {
  return (
    <button
      type="button"
      onClick={() => requestEmails({ type: "all", names })}
      className="secondary"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.35rem",
        fontSize: "0.9rem",
      }}
    >
      {MAIL_ICON}
      <span>Mail All Members</span>
    </button>
  );
}
