"use client";

import type { ReactNode } from "react";

function formatInline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export function AiMarkdown({ content }: { content: string }) {
  const lines = content.split("\n");

  return (
    <div className="text-sm text-foreground leading-relaxed space-y-2">
      {lines.map((line, index) => {
        const trimmed = line.trim();

        if (!trimmed) return <div key={index} className="h-2" />;

        if (trimmed.startsWith("### ")) {
          return (
            <h4 key={index} className="text-base font-semibold text-foreground mt-3">
              {formatInline(trimmed.slice(4))}
            </h4>
          );
        }

        if (trimmed.startsWith("## ")) {
          return (
            <h3 key={index} className="text-lg font-semibold text-foreground mt-4">
              {formatInline(trimmed.slice(3))}
            </h3>
          );
        }

        if (trimmed.startsWith("# ")) {
          return (
            <h2 key={index} className="text-xl font-bold text-foreground mt-4">
              {formatInline(trimmed.slice(2))}
            </h2>
          );
        }

        if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          return (
            <li key={index} className="ml-4 list-disc text-foreground/90">
              {formatInline(trimmed.slice(2))}
            </li>
          );
        }

        if (trimmed.startsWith("---")) {
          return <hr key={index} className="border-border my-3" />;
        }

        if (trimmed.startsWith("*") && trimmed.endsWith("*") && !trimmed.startsWith("**")) {
          return (
            <p key={index} className="text-xs text-muted-foreground italic">
              {trimmed.slice(1, -1)}
            </p>
          );
        }

        return (
          <p key={index} className="text-foreground/90">
            {formatInline(trimmed)}
          </p>
        );
      })}
    </div>
  );
}
