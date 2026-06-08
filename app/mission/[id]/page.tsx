'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, Loader2, Lock, Send, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useTeam } from '@/lib/team-context';
import { claimMissionBonusCode, completeTeamMissionFromRoleProgress, getMission, startTeamMission, subscribeToMissionRoleTasks } from '@/lib/firebase-utils';
import { ROLE_LABELS, TEAM_ROLES } from '@/lib/types';
import type { Mission, RoleTask } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

function missionIsLocked(mission: Mission | null) {
  if (!mission) return true;
  if (mission.locked) return true;
  if (mission.unlockAt && mission.unlockAt.getTime() > Date.now()) return true;
  return false;
}

export default function MissionPage() {
  const params = useParams();
  const router = useRouter();
  const missionId = Number(params.id);
  const { session, team, isLoading: teamLoading } = useTeam();
  const [mission, setMission] = useState<Mission | null>(null);
  const [roleTasks, setRoleTasks] = useState<RoleTask[]>([]);
  const [answer, setAnswer] = useState('');
  const [bonusCode, setBonusCode] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!teamLoading && !session) router.push('/');
  }, [router, session, teamLoading]);

  useEffect(() => {
    getMission(missionId)
      .then(setMission)
      .catch(() => toast.error('Mission data could not be loaded.'))
      .finally(() => setIsLoading(false));
  }, [missionId]);

  useEffect(() => {
    return subscribeToMissionRoleTasks(missionId, setRoleTasks);
  }, [missionId]);

  const isCompleted = Boolean(team?.completedMissions?.includes(missionId));
  const locked = missionIsLocked(mission) || Boolean(team && missionId !== team.currentMission && !isCompleted);
  const roleProgress = team?.roleProgress?.[String(missionId)] || {};
  const allRolesComplete = TEAM_ROLES.every((role) => roleProgress[role]?.completed);
  const visibleRoles = session?.role ? [session.role] : [];

  useEffect(() => {
    if (!team || !mission || locked || isCompleted || team.currentMission !== missionId) return;

    startTeamMission(team, missionId).catch((error) => {
      console.error('Mission timer start error:', error);
    });
  }, [isCompleted, locked, mission, missionId, team]);

  const handleSubmitAnswer = async (event: FormEvent) => {
    event.preventDefault();
    if (!mission || !team || !answer.trim()) return;

    setIsSubmitting(true);
    try {
      const submittedAnswer = answer.trim().toUpperCase();
      const expectedAnswer = (mission.answerKey || mission.correctAnswer || '').trim().toUpperCase();
      if (!allRolesComplete) {
        toast.error('All four role tasks must be complete before the captain can submit.');
        return;
      }
      if (submittedAnswer !== expectedAnswer) {
        toast.error('That assembled team code is not correct.');
        return;
      }

      if (bonusCode.trim()) {
        const bonusResult = await claimMissionBonusCode(team, mission, bonusCode);
        if (!bonusResult.success) {
          toast.error(bonusResult.error || 'Team bonus code could not be applied.');
          return;
        }
        toast.success(`Team bonus approved: +${bonusResult.points} points.`);
      }

      const result = await completeTeamMissionFromRoleProgress(team, mission, answer);
      if (!result.success) {
        toast.error(result.error || 'Mission could not be completed.');
        return;
      }

      toast.success('Mission complete. Team score posted.');
      window.setTimeout(() => {
        if (mission.nextMissionId) router.push('/dashboard');
        else router.push('/dashboard');
      }, 900);
    } catch (error) {
      console.error('Team mission submit error:', error);
      toast.error('Mission progress could not be saved.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (teamLoading || isLoading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#edf2f5]">
        <Loader2 className="h-8 w-8 animate-spin text-[#3b4f5f]" />
      </div>
    );
  }

  if (!mission || !team) {
    return <MissionShell title="Mission Not Found" message="This mission is missing from Firebase." />;
  }

  if (locked && !isCompleted) {
    return <MissionShell title="Mission Locked" message="This case file is not available yet. Return to Mission Control for the active objective." locked />;
  }

  return (
    <main className="min-h-screen bg-[#edf2f5] text-[#26333d]">
      <header className="border-b border-[#c8d2d9] bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-3 py-3 sm:px-4 sm:py-4">
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-semibold text-[#3b4f5f] hover:text-[#ff7a2a]">
            <ArrowLeft className="h-4 w-4" />
            Mission Control
          </Link>
          <Badge className="bg-[#3b4f5f] text-white hover:bg-[#3b4f5f]">{team.name}</Badge>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-4 px-3 py-4 sm:px-4 sm:py-5 lg:grid-cols-[1fr_360px]">
        <section className="rounded-md border border-[#c8d2d9] bg-white shadow-sm">
          <div className="border-b border-[#d9e1e6] bg-[#f8fafb] p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-[#3b4f5f] text-[#3b4f5f]">Mission {mission.id}</Badge>
              {isCompleted && <Badge className="bg-[#5ba300] text-white hover:bg-[#5ba300]">Completed</Badge>}
              <Badge className="bg-[#ff7a2a] text-white hover:bg-[#ff7a2a]">{mission.points || 100} team pts</Badge>
            </div>
            <h1 className="mt-3 text-2xl font-semibold text-[#26333d] sm:text-3xl">{mission.title}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#54616b]">{mission.description}</p>
          </div>

          <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
            {visibleRoles.map((role) => {
              const progress = roleProgress[role];
              const task = roleTasks.find((item) => item.role === role);
              return (
                <div key={role} className="rounded-md border border-[#d6e0e6] bg-[#f8fafb] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#54616b]">{ROLE_LABELS[role]}</p>
                      <h2 className="mt-1 font-semibold text-[#26333d]">{task?.title || `${ROLE_LABELS[role]} Task`}</h2>
                    </div>
                    {progress?.completed ? <CheckCircle2 className="h-5 w-5 text-[#5ba300]" /> : <Lock className="h-5 w-5 text-[#ff7a2a]" />}
                  </div>
                  <p className="mt-3 text-sm text-[#54616b]">{progress?.completed ? `Code piece: ${progress.codePiece || 'posted'}` : 'Complete your assigned role task.'}</p>
                  <Link href={`/mission/${mission.id}/role/${role}`}>
                    <Button variant="outline" className="mt-4 w-full border-[#b7c3cb]">
                      Open {ROLE_LABELS[role]}
                    </Button>
                  </Link>
                </div>
              );
            })}
          </div>
        </section>

        {session.isCaptain && <aside className="space-y-5">
          <div className="rounded-md border border-[#c8d2d9] bg-white shadow-sm">
            <div className="border-b border-[#d9e1e6] bg-[#f8fafb] px-4 py-3">
              <h2 className="font-semibold text-[#26333d]">Captain Submission</h2>
            </div>
            <div className="space-y-4 p-4">
              <p className="text-sm leading-6 text-[#54616b]">
                Once all four roles are complete, submit the assembled team code and optional team bonus code.
              </p>
              <form onSubmit={handleSubmitAnswer} className="space-y-4">
                <Input
                  value={answer}
                  onChange={(event) => setAnswer(event.target.value.toUpperCase())}
                  className="h-12 text-center font-mono text-lg uppercase"
                  placeholder="TEAM CODE"
                  disabled={isSubmitting || isCompleted}
                />
                <Input
                  value={bonusCode}
                  onChange={(event) => setBonusCode(event.target.value.toUpperCase())}
                  className="h-12 text-center font-mono text-lg uppercase"
                  placeholder="TEAM BONUS CODE"
                  disabled={isSubmitting || isCompleted}
                />
                <Button className="h-12 w-full bg-[#3b4f5f] hover:bg-[#304250]" disabled={!answer.trim() || !allRolesComplete || isSubmitting || isCompleted}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  Submit Team Code
                </Button>
              </form>
              {!allRolesComplete && <p className="text-xs text-[#54616b]">Waiting for all four roles to finish.</p>}
            </div>
          </div>
        </aside>}
      </div>
    </main>
  );
}

function MissionShell({ title, message, locked = false }: { title: string; message: string; locked?: boolean }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#edf2f5] p-4">
      <div className="max-w-md rounded-md border border-[#c8d2d9] bg-white p-6 text-center shadow-sm">
        {locked ? <Lock className="mx-auto h-12 w-12 text-[#ff7a2a]" /> : <XCircle className="mx-auto h-12 w-12 text-destructive" />}
        <h1 className="mt-4 text-2xl font-semibold text-[#26333d]">{title}</h1>
        <p className="mt-2 text-sm text-[#54616b]">{message}</p>
        <Link href="/dashboard">
          <Button className="mt-6 bg-[#3b4f5f] hover:bg-[#304250]">Return to Mission Control</Button>
        </Link>
      </div>
    </main>
  );
}
