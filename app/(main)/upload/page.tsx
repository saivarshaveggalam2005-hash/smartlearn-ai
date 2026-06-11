import { PageHeader } from "@/components/layout/page-header";
import { UploadForm } from "@/components/upload/upload-form";

export default function UploadPage() {
  return (
    <div>
      <PageHeader
        title="Upload Syllabus"
        description="Upload PDF, images, text, or DOCX — we'll extract study topics automatically"
      />
      <UploadForm />
    </div>
  );
}
