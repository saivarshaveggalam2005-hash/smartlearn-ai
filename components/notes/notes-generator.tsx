"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AiMarkdown } from "@/components/ai/ai-markdown";

export function NotesGenerator() {
  const [topicName, setTopicName] = useState("");
  const [type, setType] = useState("summary");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    if (!topicName.trim()) {
      toast.error("Enter a topic name");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/ai/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicName, type }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      const text = data.notes?.trim();
      if (!text) throw new Error("No notes returned");
      setNotes(text);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <Card className="glass">
        <CardContent className="p-6 space-y-4">
          <div className="space-y-2">
            <Label>Topic Name</Label>
            <Input
              placeholder="e.g. Binary Search Trees"
              value={topicName}
              onChange={(e) => setTopicName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Note Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="summary">Short Summary</SelectItem>
                <SelectItem value="keyPoints">Key Points</SelectItem>
                <SelectItem value="revision">Revision Notes</SelectItem>
                <SelectItem value="interview">Interview Q&A</SelectItem>
                <SelectItem value="quiz">Quiz Questions</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="gradient" onClick={generate} disabled={loading} className="w-full">
            {loading ? (
              <Loader2 className="animate-spin h-4 w-4" />
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generate Notes
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {notes && (
        <Card className="glass">
          <CardContent className="p-6">
            <AiMarkdown content={notes} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
