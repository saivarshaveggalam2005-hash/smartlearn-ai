export const ACCEPTED_EXTENSIONS = [
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".bmp",
  ".txt",
  ".md",
  ".csv",
  ".docx",
] as const;

export const ACCEPT_ATTRIBUTE = ACCEPTED_EXTENSIONS.join(",");

export const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/bmp",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const EXTENSION_MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".bmp": "image/bmp",
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".csv": "text/csv",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export function getFileExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot >= 0 ? filename.slice(dot).toLowerCase() : "";
}

export function resolveUploadMimeType(
  filename: string,
  reportedMime: string
): string | null {
  const ext = getFileExtension(filename);
  if (ext && EXTENSION_MIME[ext]) return EXTENSION_MIME[ext];
  if (reportedMime && ALLOWED_MIME_TYPES.has(reportedMime)) return reportedMime;
  return null;
}

export function isAllowedUpload(file: File): boolean {
  return resolveUploadMimeType(file.name, file.type) !== null;
}

export const UPLOAD_FORMATS_LABEL =
  "PDF, images (PNG, JPG, WEBP, GIF), text (TXT, MD, CSV), and DOCX";
