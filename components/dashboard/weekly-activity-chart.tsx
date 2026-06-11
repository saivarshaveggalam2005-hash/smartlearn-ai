"use client";

import {
  BarChart,
  Bar,
  XAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface WeeklyActivityChartProps {
  data: { date: string; minutes: number }[];
}

export function WeeklyActivityChart({ data }: WeeklyActivityChartProps) {
  const formatted = data.map((d) => ({
    ...d,
    day: new Date(d.date).toLocaleDateString("en-US", { weekday: "short" }),
  }));

  return (
    <Card className="glass border-border/60">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Weekly Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[120px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={formatted}>
              <XAxis
                dataKey="day"
                stroke="hsl(240 5% 55%)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: "hsl(240 10% 8%)",
                  border: "1px solid hsl(240 6% 18%)",
                  borderRadius: "8px",
                  fontSize: 12,
                }}
              />
              <Bar
                dataKey="minutes"
                fill="hsl(262 83% 58%)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
