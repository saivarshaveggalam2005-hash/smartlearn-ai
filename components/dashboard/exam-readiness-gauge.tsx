"use client";

interface ExamReadinessGaugeProps {
  score: number;
}

export function ExamReadinessGauge({ score }: ExamReadinessGaugeProps) {
  const pct = Math.max(0, Math.min(100, score));
  const rotation = -90 + (pct / 100) * 180;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-36 h-20 overflow-hidden">
        <div
          className="absolute inset-x-0 bottom-0 h-36 rounded-full border-[10px] border-muted/30"
          style={{ clipPath: "inset(50% 0 0 0)" }}
        />
        <div
          className="absolute inset-x-0 bottom-0 h-36 rounded-full border-[10px] border-primary origin-bottom transition-transform duration-700"
          style={{
            clipPath: "inset(50% 0 0 0)",
            transform: `rotate(${rotation}deg)`,
          }}
        />
        <div className="absolute inset-x-0 bottom-1 text-center">
          <span className="text-xl font-bold">{pct}%</span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        {pct >= 70 ? "Exam Ready" : pct >= 40 ? "Getting There" : "Not Ready Yet"}
      </p>
    </div>
  );
}
