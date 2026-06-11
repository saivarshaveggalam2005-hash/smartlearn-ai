"use client";

import { motion } from "framer-motion";
import {
  Flame,
  Target,
  CheckCircle2,
  Clock,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const iconMap: Record<string, LucideIcon> = {
  flame: Flame,
  target: Target,
  check: CheckCircle2,
  clock: Clock,
  trending: TrendingUp,
};

export type StatIconName = keyof typeof iconMap;

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  iconName: StatIconName;
  trend?: string;
  className?: string;
  delay?: number;
}

export function StatCard({
  title,
  value,
  subtitle,
  iconName,
  trend,
  className,
  delay = 0,
}: StatCardProps) {
  const Icon = iconMap[iconName] ?? Target;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay * 0.1 }}
    >
      <Card
        className={cn(
          "glass hover:border-primary/30 transition-all duration-300 hover:glow group",
          className
        )}
      >
        <CardContent className="p-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: delay * 0.1 }}
            className="flex items-start justify-between"
          >
            <div>
              <p className="text-sm text-muted-foreground">{title}</p>
              <p className="mt-2 text-3xl font-bold">{value}</p>
              {subtitle && (
                <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
              )}
              {trend && (
                <p className="mt-2 text-xs text-emerald-400">{trend}</p>
              )}
            </div>
            <div className="rounded-lg bg-primary/10 p-3 group-hover:bg-primary/20 transition-colors">
              <Icon className="h-5 w-5 text-primary" />
            </div>
          </motion.div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
