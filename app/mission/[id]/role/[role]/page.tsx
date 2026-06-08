'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, HelpCircle, Loader2, ShieldAlert, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useTeam } from '@/lib/team-context';
import { getMission, getRoleTask, startTeamMission, submitRoleTask } from '@/lib/firebase-utils';
import { ROLE_LABELS, TEAM_ROLES } from '@/lib/types';
import type { Mission, RoleTask, TeamRole } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function RoleMissionPage() {
  const params = useParams();
  const router = useRouter();
  const missionId = Number(params.id);
  const role = String(params.role) as TeamRole;
  const { session, team, isLoading: teamLoading } = useTeam();
  const [mission, setMission] = useState<Mission | null>(null);
  const [task, setTask] = useState<RoleTask | null>(null);
  const [taskCode, setTaskCode] = useState('');
  const [bonusCodes, setBonusCodes] = useState(['', '']);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validRole = TEAM_ROLES.includes(role);

  useEffect(() => {
    if (!teamLoading && !session) router.push('/');
  }, [router, session, teamLoading]);

  useEffect(() => {
    if (!teamLoading && session?.role && role !== session.role) {
      router.replace(`/mission/${missionId}/role/${session.role}`);
    }
  }, [missionId, role, router, session, teamLoading]);

  useEffect(() => {
    if (!validRole) {
      setIsLoading(false);
      return;
    }

    Promise.all([getMission(missionId), getRoleTask(missionId, role)])
      .then(([missionData, taskData]) => {
        setMission(missionData);
        setTask(taskData);
      })
      .catch(() => toast.error('Role task could not be loaded.'))
      .finally(() => setIsLoading(false));
  }, [missionId, role, validRole]);

  const completed = Boolean(team?.roleProgress?.[String(missionId)]?.[role]?.completed);

  useEffect(() => {
    const assignedRole = session?.role === role;
    const activeMission = team?.currentMission === missionId;
    const missionComplete = Boolean(team?.completedMissions?.includes(missionId));
    if (!team || !mission || !validRole || !assignedRole || !activeMission || missionComplete) return;

    startTeamMission(team, missionId).catch((error) => {
      console.error('Mission timer start error:', error);
    });
  }, [mission, missionId, role, session?.role, team, validRole]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!team || !task || !taskCode.trim()) return;

    setIsSubmitting(true);
    try {
      const result = await submitRoleTask(team, task, taskCode, bonusCodes);
      if (!result.success) {
        toast.error(result.error || 'Role task could not be completed.');
        return;
      }

      toast.success(`Role task complete: +${result.points} points.`);
      router.push('/dashboard');
    } catch (error) {
      console.error('Role task submit error:', error);
      toast.error('Role task progress could not be saved.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (teamLoading || isLoading || !session || (session.role && role !== session.role)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#edf2f5]">
        <Loader2 className="h-8 w-8 animate-spin text-[#3b4f5f]" />
      </div>
    );
  }

  if (!validRole || !mission || !team) {
    return <RoleShell title="Role Task Not Found" message="This role task is not available." />;
  }

  return (
    <main className="min-h-screen bg-[#edf2f5] text-[#26333d]">
      <header className="border-b border-[#c8d2d9] bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-3 py-3 sm:px-4 sm:py-4">
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-semibold text-[#3b4f5f] hover:text-[#ff7a2a]">
            <ArrowLeft className="h-4 w-4" />
            Mission Control
          </Link>
          <Badge className="bg-[#3b4f5f] text-white hover:bg-[#3b4f5f]">{ROLE_LABELS[role]}</Badge>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-4 px-3 py-4 sm:px-4 sm:py-5 lg:grid-cols-[1fr_360px]">
        <section className="rounded-md border border-[#c8d2d9] bg-white shadow-sm">
          <div className="border-b border-[#d9e1e6] bg-[#f8fafb] p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-[#3b4f5f] text-[#3b4f5f]">Mission {mission.id}</Badge>
              <Badge className="bg-[#ff7a2a] text-white hover:bg-[#ff7a2a]">{task?.points || 25} role pts</Badge>
              {completed && <Badge className="bg-[#5ba300] text-white hover:bg-[#5ba300]">Complete</Badge>}
            </div>
            <h1 className="mt-3 text-2xl font-semibold text-[#26333d] sm:text-3xl">{task?.title || `${ROLE_LABELS[role]} Task`}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#54616b]">{task?.instructions || mission.description}</p>
          </div>

          <div className="p-3 sm:p-5">
            <div className="min-h-[260px] overflow-hidden rounded-md border border-[#c8d2d9] bg-[#101820] sm:aspect-video sm:min-h-0">
              {task?.geniallyUrl ? (
                <iframe src={task.geniallyUrl} className="h-full w-full" allowFullScreen title={task.title || ROLE_LABELS[role]} />
              ) : (
                <div className="flex h-full flex-col items-center justify-center p-6 text-center text-slate-200">
                  <ShieldAlert className="mb-4 h-12 w-12 text-[#fad714]" />
                  <p className="font-semibold">This role task needs an activity URL.</p>
                  <p className="mt-2 text-sm text-slate-400">Add a Genially URL in the Game Master Console.</p>
                </div>
              )}
            </div>
          </div>
        </section>

        <aside className="space-y-5">
          {task?.hint && (
            <div className="rounded-md border border-[#fad714] bg-yellow-50 p-4 text-sm text-[#5c4b00] shadow-sm">
              <div className="flex items-center gap-2 font-semibold">
                <HelpCircle className="h-4 w-4" />
                Role Hint
              </div>
              <p className="mt-2 leading-6">{task.hint}</p>
            </div>
          )}

          <div className="rounded-md border border-[#c8d2d9] bg-white shadow-sm">
            <div className="border-b border-[#d9e1e6] bg-[#f8fafb] px-4 py-3">
              <h2 className="font-semibold text-[#26333d]">Submit Role Task</h2>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4 p-4">
              <Input
                value={taskCode}
                onChange={(event) => setTaskCode(event.target.value.toUpperCase())}
                className="h-12 text-center font-mono text-lg uppercase"
                placeholder="ROLE TASK CODE"
                disabled={completed || isSubmitting}
              />
              {[0, 1].map((index) => (
                <Input
                  key={index}
                  value={bonusCodes[index]}
                  onChange={(event) => {
                    const nextBonusCodes = [...bonusCodes];
                    nextBonusCodes[index] = event.target.value.toUpperCase();
                    setBonusCodes(nextBonusCodes);
                  }}
                  className="h-11 text-center font-mono uppercase"
                  placeholder={`BONUS CODE ${index + 1}`}
                  disabled={completed || isSubmitting || !task?.bonuses[index]}
                  aria-label={`Bonus code ${index + 1}`}
                />
              ))}
              <Button className="h-12 w-full bg-[#3b4f5f] hover:bg-[#304250]" disabled={!taskCode.trim() || !task || completed || isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                Complete {ROLE_LABELS[role]} Task
              </Button>
            </form>
          </div>
        </aside>
      </div>
    </main>
  );
}

function RoleShell({ title, message }: { title: string; message: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#edf2f5] p-4">
      <div className="max-w-md rounded-md border border-[#c8d2d9] bg-white p-6 text-center shadow-sm">
        <XCircle className="mx-auto h-12 w-12 text-destructive" />
        <h1 className="mt-4 text-2xl font-semibold text-[#26333d]">{title}</h1>
        <p className="mt-2 text-sm text-[#54616b]">{message}</p>
        <Link href="/dashboard">
          <Button className="mt-6 bg-[#3b4f5f] hover:bg-[#304250]">Return to Mission Control</Button>
        </Link>
      </div>
    </main>
  );
}
