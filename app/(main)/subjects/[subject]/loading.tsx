import { Skeleton } from "@/components/ui/skeleton";

export default function SubjectLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-24 rounded-xl" />
      {[...Array(5)].map((_, i) => (
        <Skeleton key={i} className="h-20 rounded-xl" />
      ))}
    </div>
  );
}
