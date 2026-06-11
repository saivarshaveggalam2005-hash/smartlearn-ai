"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

interface DonutProgressProps {
  value: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
}

export function DonutProgress({
  value,
  size = 140,
  strokeWidth = 14,
  label,
}: DonutProgressProps) {
  const pct = Math.max(0, Math.min(100, value));
  const data = [
    { name: "done", value: pct },
    { name: "rest", value: 100 - pct },
  ];

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={size / 2 - strokeWidth - 8}
            outerRadius={size / 2 - 8}
            startAngle={90}
            endAngle={-270}
            dataKey="value"
            stroke="none"
          >
            <Cell fill="hsl(262 83% 58%)" />
            <Cell fill="hsl(240 6% 16%)" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold">{pct}%</span>
        {label && (
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
            {label}
          </span>
        )}
      </div>
    </div>
  );
}
