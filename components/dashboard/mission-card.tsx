'use client';

import Link from 'next/link';
import type { Mission } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Rocket, Lock, CheckCircle2, Loader2 } from 'lucide-react';

interface MissionCardProps {
  mission: Mission | null;
  isLoading: boolean;
  completedMissions: number[];
}

export function MissionCard({ mission, isLoading, completedMissions }: MissionCardProps) {
  if (isLoading) {
    return (
      <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
        <CardContent className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  // All missions completed
  if (!mission) {
    return (
      <Card className="border-primary/30 bg-card/80 backdrop-blur-sm shadow-[0_0_30px_rgba(0,212,255,0.1)]">
        <CardContent className="py-12 text-center">
          <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mb-6">
            <CheckCircle2 className="w-10 h-10 text-primary" />
          </div>
          <h2 className="font-[var(--font-orbitron)] text-2xl font-bold text-foreground mb-2">
            MISSION COMPLETE
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            Congratulations, Agent! You have successfully completed all missions. 
            The world is safe thanks to your team&apos;s efforts.
          </p>
        </CardContent>
      </Card>
    );
  }

  const isUnlocked = !completedMissions.includes(mission.id) || mission.id === 1;

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur-sm overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-primary/50 to-transparent" />
      
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="border-primary/50 text-primary">
                Mission {mission.id}
              </Badge>
              {isUnlocked ? (
                <Badge className="bg-primary/20 text-primary border-0">Active</Badge>
              ) : (
                <Badge variant="secondary">
                  <Lock className="w-3 h-3 mr-1" />
                  Locked
                </Badge>
              )}
            </div>
            <CardTitle className="font-[var(--font-orbitron)] text-xl md:text-2xl tracking-wide">
              {mission.title}
            </CardTitle>
            <CardDescription className="mt-2 text-base">
              {mission.description}
            </CardDescription>
          </div>
          <div className="w-14 h-14 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
            <Rocket className="w-7 h-7 text-primary" />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Story Context */}
        <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
          <p className="text-sm text-muted-foreground italic leading-relaxed">
            &quot;{mission.storyContext}&quot;
          </p>
        </div>

        {/* Action Button */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button 
            asChild
            size="lg"
            className="flex-1 h-12 text-base font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_0_20px_rgba(0,212,255,0.3)] hover:shadow-[0_0_30px_rgba(0,212,255,0.5)] transition-all"
            disabled={!isUnlocked}
          >
            <Link href={`/mission/${mission.id}`}>
              <Rocket className="mr-2 h-5 w-5" />
              Launch Mission Room
            </Link>
          </Button>
          
        </div>
      </CardContent>
    </Card>
  );
}
