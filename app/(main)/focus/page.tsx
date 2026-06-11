import { PageHeader } from "@/components/layout/page-header";
import { FocusMode } from "@/components/focus/focus-mode";

export default function FocusPage() {
  return (
    <div>
      <PageHeader
        title="Focus Mode"
        description="Distraction-free study with Pomodoro timer and ambient focus"
      />
      <FocusMode />
    </div>
  );
}
