"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface MasteryTrendChartProps {
  data: { name: string; mastery: number }[];
}

export function MasteryTrendChart({ data }: MasteryTrendChartProps) {
  const chartData = data.slice(0, 12);

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="text-lg">Topic Mastery</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[240px] w-full">
          {chartData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-16">
              Complete topics and quizzes to see mastery scores.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(240 6% 18%)" />
                <XAxis type="number" domain={[0, 100]} stroke="hsl(240 5% 65%)" fontSize={11} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={100}
                  stroke="hsl(240 5% 65%)"
                  fontSize={10}
                  tickFormatter={(v) => (v.length > 14 ? `${v.slice(0, 12)}…` : v)}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(240 10% 8%)",
                    border: "1px solid hsl(240 6% 18%)",
                    borderRadius: "8px",
                  }}
                />
                <Bar dataKey="mastery" fill="hsl(262 83% 58%)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
