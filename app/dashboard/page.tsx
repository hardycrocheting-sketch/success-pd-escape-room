'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ElementType, ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock,
  FileWarning,
  Gauge,
  KeyRound,
  Lock,
  LogOut,
  RadioTower,
  Trophy,
} from 'lucide-react';
import { useTeam } from '@/lib/team-context';
import { getAllMissions, subscribeToAllTeams, subscribeToAppSettings } from '@/lib/firebase-utils';
import { ROLE_LABELS, TEAM_ROLES } from '@/lib/types';
import type { Mission, Team } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

function formatRemaining(ms: number) {
  if (ms <= 0) return '00:00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatElapsed(seconds = 0) {
  if (!seconds) return 'Not posted';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function isMissionLocked(mission: Mission | null) {
  if (!mission) return true;
  if (mission.locked) return true;
  if (mission.unlockAt && mission.unlockAt.getTime() > Date.now()) return true;
  return false;
}

export default function DashboardPage() {
  const router = useRouter();
  const { session, team, alerts, isLoading: isSessionLoading, logout, notificationsAllowed, enableNotifications } = useTeam();
  const [teams, setTeams] = useState<Team[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [timeRemaining, setTimeRemaining] = useState('00:00:00');
  const [countdownTarget, setCountdownTarget] = useState(new Date('2026-05-29T15:30:00-04:00'));
  const [countdownLabel, setCountdownLabel] = useState('Time Remaining');
  const [setupMessage, setSetupMessage] = useState('');
  const notifiedUnlockedMissions = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (!isSessionLoading && !session) router.push('/');
  }, [isSessionLoading, router, session]);

  useEffect(() => {
    getAllMissions()
      .then((missionList) => {
        const sorted = missionList.sort((a, b) => a.id - b.id);
        setMissions(sorted);
        if (sorted.length === 0) setSetupMessage('No missions are configured yet. The Game Master needs to create Mission 1.');
      })
      .catch(() => setSetupMessage('Mission Control could not load mission data from Firebase.'));

    const unsubscribe = subscribeToAllTeams((updatedTeams) => setTeams(updatedTeams));
    const unsubscribeSettings = subscribeToAppSettings((settings) => {
      setCountdownTarget(settings.countdownTarget);
      setCountdownLabel(settings.countdownLabel);
    });
    return () => {
      unsubscribe();
      unsubscribeSettings();
    };
  }, []);

  useEffect(() => {
    const updateTimer = () => setTimeRemaining(formatRemaining(countdownTarget.getTime() - Date.now()));
    updateTimer();
    const interval = window.setInterval(updateTimer, 1000);
    return () => window.clearInterval(interval);
  }, [countdownTarget]);

  useEffect(() => {
    const processSchedule = () => {
      fetch('/api/process-scheduled').catch(() => undefined);
    };

    processSchedule();
    const interval = window.setInterval(processSchedule, 60000);
    return () => window.clearInterval(interval);
  }, []);

  const activeMission = useMemo(() => {
    if (!team) return null;
    return missions.find((mission) => mission.id === team.currentMission) || null;
  }, [missions, team]);

  const locked = isMissionLocked(activeMission);
  const activeRoleProgress = team?.roleProgress?.[String(team?.currentMission || 1)] || {};
  const completedRoles = TEAM_ROLES.filter((role) => activeRoleProgress[role]?.completed).length;
  const rolePath = session?.role && !session.isCaptain && activeMission ? `/mission/${activeMission.id}/role/${session.role}` : activeMission ? `/mission/${activeMission.id}` : '/dashboard';
  const totalPossibleCompletions = Math.max(teams.length * missions.length, 1);
  const totalCompleted = teams.reduce((sum, entry) => sum + (entry.completedMissions?.length || 0), 0);
  const redevelopmentPercent = Math.min(100, Math.round((totalCompleted / totalPossibleCompletions) * 100));
  const teamCompletionPercent = team && missions.length ? Math.round(((team.completedMissions?.length || 0) / missions.length) * 100) : 0;

  const leaderboard = [...teams]
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if ((a.elapsedSeconds || 0) !== (b.elapsedSeconds || 0)) return (a.elapsedSeconds || Number.MAX_SAFE_INTEGER) - (b.elapsedSeconds || Number.MAX_SAFE_INTEGER);
      return (b.completedMissions?.length || 0) - (a.completedMissions?.length || 0);
    })
    .slice(0, 6);

  const visibleAlerts = alerts.slice(0, 6);

  useEffect(() => {
    if (!activeMission || locked || !notificationsAllowed || notifiedUnlockedMissions.current.has(activeMission.id)) return;

    notifiedUnlockedMissions.current.add(activeMission.id);
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification('New mission unlocked', {
        body: `${activeMission.title} is now available.`,
        tag: `mission-${activeMission.id}-unlocked`,
        icon: '/apple-icon.png',
      });
    }
  }, [activeMission, locked, notificationsAllowed]);

  if (isSessionLoading || !team) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#edf2f5]">
        <div className="rounded-md border border-[#c8d2d9] bg-white px-6 py-5 text-center shadow-sm">
          <RadioTower className="mx-auto h-8 w-8 animate-pulse text-[#ff7a2a]" />
          <p className="mt-3 text-sm font-semibold text-[#3b4f5f]">Opening Mission Control</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#edf2f5] text-[#26333d]">
      <header className="sticky top-0 z-40 border-b border-[#c8d2d9] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/dashboard" className="flex items-center gap-3">
            <Image src="/success-logo.png" alt="SUCCESS Virtual Learning Centers of Michigan" width={214} height={68} priority className="h-auto w-36 sm:w-[214px]" />
            <div className="hidden border-l border-[#d6e0e6] pl-3 md:block">
              <p className="text-sm font-bold text-[#3b4f5f]">Mission Control</p>
              <p className="text-xs text-[#54616b]">Graduation Recovery Initiative</p>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <Badge className="hidden bg-[#ff7a2a] text-white hover:bg-[#ff7a2a] sm:inline-flex">{team.name}</Badge>
            <Button
              variant="outline"
              className="border-[#b7c3cb]"
              onClick={() => {
                logout();
                router.push('/');
              }}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <section className="ps-shell broken-panel border-b border-[#26333d] px-4 py-6 text-white">
        <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded border border-orange-300/50 bg-orange-400/15 px-3 py-2 text-sm font-semibold text-orange-100">
              <FileWarning className="h-4 w-4" />
              Student success case files active
            </div>
            <h1 className="text-2xl font-bold md:text-5xl">Graduation Recovery Console</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-100">
              Work through authentic enrollment, attendance, communication, intervention, and graduation-tracking missions before the next lock window.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <StatusBox icon={Clock} label={countdownLabel} value={timeRemaining} />
            <StatusBox icon={Gauge} label="Recovery Progress" value={`${redevelopmentPercent}%`} />
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-5 px-4 py-5 lg:grid-cols-[1fr_360px]">
        <section className="space-y-5">
          {setupMessage && (
            <div className="rounded-md border border-yellow-300 bg-yellow-50 p-4 text-sm text-[#5c4b00]">
              <AlertTriangle className="mr-2 inline h-4 w-4" />
              {setupMessage}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-3">
            <Metric label="Team Score" value={`${team.score} pts`} detail={`${team.bonusPoints || 0} bonus points logged`} />
            <Metric label="Missions Complete" value={`${team.completedMissions?.length || 0}/${missions.length || 0}`} detail={`${teamCompletionPercent}% team progress`} />
            <Metric label="Elapsed Time" value={formatElapsed(team.elapsedSeconds)} detail="Shown as leaderboard tiebreaker" />
          </div>

          <div className="rounded-md border border-[#c8d2d9] bg-white shadow-sm">
            <div className="border-b border-[#d9e1e6] bg-[#f8fafb] px-5 py-4">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-[#26333d]">
                <KeyRound className="h-5 w-5 text-[#ff7a2a]" />
                Current Mission
              </h2>
            </div>
            <div className="grid gap-5 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#54616b]">Mission {activeMission?.id || team.currentMission}</p>
                <h3 className="mt-2 text-2xl font-semibold text-[#3b4f5f]">{activeMission?.title || 'Awaiting Mission Setup'}</h3>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[#54616b]">
                  {activeMission?.description || 'Ask the Game Master to configure this mission in the admin console.'}
                </p>
                <div className="mt-4 grid gap-2 sm:grid-cols-4">
                  {TEAM_ROLES.map((role) => (
                    <div key={role} className="rounded border border-[#d6e0e6] bg-[#f8fafb] p-3">
                      <p className="text-xs font-semibold uppercase text-[#54616b]">{ROLE_LABELS[role]}</p>
                      <p className={`mt-1 text-sm font-semibold ${activeRoleProgress[role]?.completed ? 'text-[#5ba300]' : 'text-[#3b4f5f]'}`}>
                        {activeRoleProgress[role]?.completed ? 'Complete' : 'In progress'}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mt-4">
                  <Progress value={(completedRoles / 4) * 100} className="h-3 bg-[#e1e7eb] [&>div]:bg-[#5ba300]" />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {locked && (
                  <Badge className="justify-center bg-[#fad714] text-[#26333d] hover:bg-[#fad714]">
                    <Lock className="mr-2 h-4 w-4" />
                    Locked
                  </Badge>
                )}
                <Link href={activeMission && !locked ? rolePath : '/dashboard'} className={activeMission && !locked ? '' : 'pointer-events-none'}>
                  <Button className="h-12 min-w-44 bg-[#3b4f5f] hover:bg-[#304250]" disabled={!activeMission || locked}>
                    {session?.role && !session.isCaptain ? `Open ${ROLE_LABELS[session.role]} Task` : 'Captain Overview'}
                  </Button>
                </Link>
              </div>
            </div>
          </div>

          <div className="rounded-md border border-[#c8d2d9] bg-white shadow-sm">
            <div className="border-b border-[#d9e1e6] bg-[#f8fafb] px-5 py-4">
              <h2 className="text-lg font-semibold text-[#26333d]">Mission Sequence</h2>
            </div>
            <div className="grid gap-3 p-5 md:grid-cols-2">
              {missions.map((mission) => {
                const complete = team.completedMissions?.includes(mission.id);
                const active = mission.id === team.currentMission;
                const missionLocked = !complete && (!active || isMissionLocked(mission));

                return (
                  <div key={mission.id} className="rounded-md border border-[#d6e0e6] bg-[#f8fafb] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#54616b]">Node {mission.id}</p>
                        <h3 className="mt-1 font-semibold text-[#26333d]">{mission.title}</h3>
                      </div>
                      {complete ? <CheckCircle2 className="h-5 w-5 text-[#5ba300]" /> : missionLocked ? <Lock className="h-5 w-5 text-[#ff7a2a]" /> : <RadioTower className="h-5 w-5 text-[#3b4f5f]" />}
                    </div>
                    <p className="mt-3 text-xs text-[#54616b]">{complete ? 'Recovered' : missionLocked ? 'Locked until released' : 'Active objective'}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <aside className="space-y-5">
          <Panel title="News Alerts" icon={Bell}>
            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full border-[#b7c3cb]"
                onClick={async () => {
                  const result = await enableNotifications();
                  if (!result.success) alert(result.error || 'Notifications could not be enabled.');
                }}
                disabled={notificationsAllowed}
              >
                {notificationsAllowed ? 'Notifications Enabled' : 'Enable Device Notifications'}
              </Button>
              {visibleAlerts.length > 0 ? (
                visibleAlerts.map((alert) => (
                  <div key={alert.id} className="rounded border border-[#d6e0e6] bg-[#f8fafb] p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#ff7a2a]">{alert.type}</p>
                    <p className="mt-1 text-sm text-[#26333d]">{alert.message}</p>
                  </div>
                ))
              ) : (
              <p className="text-sm text-[#54616b]">Game Master clues, case updates, and approved hints will appear here.</p>
              )}
            </div>
          </Panel>

          <Panel title="Leaderboard" icon={Trophy}>
            <div className="space-y-2">
              {leaderboard.map((entry, index) => (
                <div key={entry.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded border border-[#d6e0e6] bg-[#f8fafb] p-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded bg-[#3b4f5f] text-sm font-bold text-white">{index + 1}</span>
                  <div>
                    <p className="text-sm font-semibold text-[#26333d]">{entry.name}</p>
                    <p className="text-xs text-[#54616b]">{formatElapsed(entry.elapsedSeconds)} | {entry.completedMissions?.length || 0} missions</p>
                  </div>
                  <Badge className="bg-[#5ba300] text-white hover:bg-[#5ba300]">{entry.score}</Badge>
                </div>
              ))}
            </div>
          </Panel>
        </aside>
      </div>
    </main>
  );
}

function StatusBox({ icon: Icon, label, value }: { icon: ElementType; label: string; value: string }) {
  return (
    <div className="rounded border border-white/15 bg-white/10 p-4">
      <Icon className="h-5 w-5 text-yellow-200" />
      <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-300">{label}</p>
      <p className="mt-1 font-mono text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-md border border-[#c8d2d9] bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#54616b]">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-[#3b4f5f]">{value}</p>
      <p className="mt-1 text-xs text-[#54616b]">{detail}</p>
    </div>
  );
}

function Panel({ title, icon: Icon, children }: { title: string; icon: ElementType; children: ReactNode }) {
  return (
    <div className="rounded-md border border-[#c8d2d9] bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-[#d9e1e6] bg-[#f8fafb] px-4 py-3">
        <Icon className="h-5 w-5 text-[#ff7a2a]" />
        <h2 className="font-semibold text-[#26333d]">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}
