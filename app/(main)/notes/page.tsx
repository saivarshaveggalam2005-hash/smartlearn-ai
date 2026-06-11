import { PageHeader } from "@/components/layout/page-header";
import { NotesGenerator } from "@/components/notes/notes-generator";

export default function NotesPage() {
  return (
    <div>
      <PageHeader
        title="AI Notes Generator"
        description="Generate summaries, key points, revision notes, and quiz questions"
      />
      <NotesGenerator />
    </div>
  );
}
