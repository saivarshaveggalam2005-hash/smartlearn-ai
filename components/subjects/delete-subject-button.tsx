"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DeleteSubjectButtonProps {
  slug: string;
  subjectName: string;
  redirectTo?: string;
  compact?: boolean;
  className?: string;
}

export function DeleteSubjectButton({
  slug,
  subjectName,
  redirectTo = "/subjects",
  compact = false,
  className,
}: DeleteSubjectButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleDelete = async (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    const confirmed = window.confirm(
      `Delete "${subjectName}"?\n\nThis removes all topics and study progress for this subject. This cannot be undone.`
    );
    if (!confirmed) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/subjects/${encodeURIComponent(slug)}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Failed to delete subject");
      }

      toast.success(`"${subjectName}" deleted`);
      router.push(redirectTo);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete subject"
      );
    } finally {
      setLoading(false);
    }
  };

  if (compact) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(
          "h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10",
          className
        )}
        onClick={handleDelete}
        disabled={loading}
        aria-label={`Delete ${subjectName}`}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="destructive"
      size="sm"
      className={className}
      onClick={handleDelete}
      disabled={loading}
    >
      <Trash2 className="h-4 w-4" />
      {loading ? "Deleting..." : "Delete Subject"}
    </Button>
  );
}
