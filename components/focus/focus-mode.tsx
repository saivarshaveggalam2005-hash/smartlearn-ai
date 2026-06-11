"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Maximize2, Volume2, VolumeX, Focus } from "lucide-react";
import { usePomodoro } from "@/hooks/use-pomodoro";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export function FocusMode() {
  const pomodoro = usePomodoro();
  const [ambientOn, setAmbientOn] = useState(false);
  const [audio] = useState<HTMLAudioElement | null>(null);

  const toggleAmbient = () => {
    if (ambientOn) {
      audio?.pause();
      setAmbientOn(false);
    } else {
      setAmbientOn(true);
    }
  };

  const enterFullscreen = () => {
    document.documentElement.requestFullscreen?.();
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="glass border-primary/30 glow">
        <CardContent className="p-12 text-center">
          <motion.div
            animate={{ scale: pomodoro.isRunning ? [1, 1.02, 1] : 1 }}
            transition={{ repeat: pomodoro.isRunning ? Infinity : 0, duration: 2 }}
          >
            <Focus className="h-16 w-16 text-primary mx-auto mb-6" />
            <p className="text-7xl font-mono font-bold gradient-text mb-2">
              {pomodoro.formatted}
            </p>
            <p className="text-muted-foreground mb-8">
              {pomodoro.isBreak ? "Take a break" : "Stay focused"}
            </p>
          </motion.div>

          <Progress value={pomodoro.progress * 100} className="mb-8 max-w-xs mx-auto" />

          <div className="flex justify-center gap-3 flex-wrap">
            <Button
              size="lg"
              variant="gradient"
              onClick={pomodoro.toggle}
            >
              {pomodoro.isRunning ? "Pause" : "Start Focus"}
            </Button>
            <Button size="lg" variant="outline" onClick={pomodoro.reset}>
              Reset
            </Button>
            <Button size="lg" variant="outline" onClick={toggleAmbient}>
              {ambientOn ? (
                <VolumeX className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
              Ambient
            </Button>
            <Button size="lg" variant="outline" onClick={enterFullscreen}>
              <Maximize2 className="h-4 w-4" />
              Fullscreen
            </Button>
          </div>

          <div className="mt-12 rounded-xl border border-dashed border-border p-6 text-left">
            <h3 className="font-semibold mb-3 text-sm">Distraction Blocker</h3>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li>• Put your phone in another room</li>
              <li>• Close unnecessary browser tabs</li>
              <li>• Use fullscreen for immersive focus</li>
              <li>• Complete one Pomodoro before checking messages</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
