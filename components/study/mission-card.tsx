"use client";

import { CheckCircle2, Circle, Target, Trophy } from "lucide-react";
import type { TopicMission } from "@/lib/mission-engine";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface MissionCardProps {
  mission: TopicMission;
}

export function MissionCard({ mission }: MissionCardProps) {
  return (
    <Card className="glass border-violet-500/20 mb-0">
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Target className="h-5 w-5 text-violet-400" />
            Mission: {mission.title}
          </CardTitle>
          <Badge variant="secondary" className="gap-1 w-fit">
            <Trophy className="h-3 w-3" />
            +{mission.rewardPoints} mastery pts
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{mission.subtitle}</p>
        <Progress value={mission.progressPercent} className="mt-2" />
      </CardHeader>
      <CardContent className="space-y-2">
        {mission.tasks.map((task) => (
          <div
            key={task.id}
            className={`flex items-start gap-3 rounded-lg border p-3 text-sm ${
              task.completed
                ? "border-emerald-500/30 bg-emerald-500/5"
                : "border-border/50"
            }`}
          >
            {task.completed ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <Circle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            )}
            <div>
              <p className="font-medium">{task.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{task.description}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
