"use client";

import { ArrowDown, GitBranch, Lock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface GraphNodeView {
  slug: string;
  name: string;
  completed: boolean;
  isCurrent: boolean;
  unlocked: boolean;
}

interface KnowledgeGraphStripProps {
  nodes: GraphNodeView[];
  prerequisites: string[];
}

export function KnowledgeGraphStrip({
  nodes,
  prerequisites,
}: KnowledgeGraphStripProps) {
  if (nodes.length <= 1 && prerequisites.length === 0) return null;

  return (
    <Card className="glass border-border/60 mb-0">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-primary" />
          Learning Path Position
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {prerequisites.length > 0 && (
          <div className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Prerequisites: </span>
            {prerequisites.join(" · ")}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {nodes.map((node, i) => (
            <div key={node.slug} className="flex items-center gap-2">
              <Badge
                variant={
                  node.isCurrent
                    ? "default"
                    : node.completed
                      ? "success"
                      : node.unlocked
                        ? "outline"
                        : "secondary"
                }
                className="gap-1 max-w-[160px] truncate"
              >
                {!node.unlocked && !node.completed && !node.isCurrent && (
                  <Lock className="h-3 w-3 shrink-0" />
                )}
                {node.name}
              </Badge>
              {i < nodes.length - 1 && (
                <ArrowDown className="h-3 w-3 text-muted-foreground rotate-[-90deg] hidden sm:block" />
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
