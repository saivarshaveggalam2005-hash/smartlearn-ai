"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileText, ImageIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  ACCEPT_ATTRIBUTE,
  isAllowedUpload,
  UPLOAD_FORMATS_LABEL,
} from "@/lib/upload-config";

function FilePreviewIcon({ file }: { file: File }) {
  if (file.type.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name)) {
    return <ImageIcon className="h-12 w-12 text-primary mx-auto mb-4" />;
  }
  return <FileText className="h-12 w-12 text-primary mx-auto mb-4" />;
}

export function UploadForm() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [subjectName, setSubjectName] = useState("");
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const pickFile = useCallback((picked: File | undefined) => {
    if (!picked) return;
    if (isAllowedUpload(picked)) setFile(picked);
    else toast.error(`Unsupported file. Allowed: ${UPLOAD_FORMATS_LABEL}`);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      pickFile(e.dataTransfer.files[0]);
    },
    [pickFile]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !subjectName.trim()) {
      toast.error("Please provide subject name and a syllabus file");
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("subjectName", subjectName.trim());

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error ?? "Upload failed");

      toast.success(
        `Extracted ${data.subject.topicCount} topics from ${data.subject.name}!`
      );
      setFile(null);
      setSubjectName("");
      router.push(`/subjects/${data.subject.slug}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-xl">
      <div className="space-y-2">
        <Label htmlFor="subject">Subject Name</Label>
        <Input
          id="subject"
          placeholder="e.g. Mathematics, Data Structures"
          value={subjectName}
          onChange={(e) => setSubjectName(e.target.value)}
          required
        />
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <Card
          className={`glass border-dashed border-2 transition-colors cursor-pointer ${
            dragOver ? "border-primary bg-primary/5" : "border-border"
          }`}
        >
          <CardContent className="p-12 text-center">
            <input
              type="file"
              accept={ACCEPT_ATTRIBUTE}
              className="hidden"
              id="syllabus-upload"
              onChange={(e) => pickFile(e.target.files?.[0])}
            />
            <label htmlFor="syllabus-upload" className="cursor-pointer">
              {file ? (
                <>
                  <FilePreviewIcon file={file} />
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Click to change file
                  </p>
                </>
              ) : (
                <>
                  <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="font-medium">Drop your syllabus file here</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {UPLOAD_FORMATS_LABEL}
                  </p>
                </>
              )}
            </label>
          </CardContent>
        </Card>
      </div>

      <Button type="submit" variant="gradient" disabled={loading} className="w-full">
        {loading ? (
          <>
            <Loader2 className="animate-spin" />
            Extracting topics with AI...
          </>
        ) : (
          <>
            <Upload className="h-4 w-4" />
            Upload & Extract Topics
          </>
        )}
      </Button>
    </form>
  );
}
