'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Bell, CheckCircle2, Database, Loader2, Lock, Plus, RadioTower, RefreshCw, Send, Trash2, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import {
  createMission,
  createTeam,
  deleteMission,
  deleteScheduledAlert,
  awardTeamBonus,
  fulfillHintRequest,
  getAllMissions,
  initializeSampleData,
  sendAlert,
  createScheduledAlert,
  subscribeToAllTeams,
  subscribeToAppSettings,
  subscribeToHintRequests,
  subscribeToScheduledAlerts,
  updateMission,
  updateAppSettings,
  resetTeamGame,
} from '@/lib/firebase-utils';
import type { Alert, AppSettings, HintRequest, Mission, ScheduledAlert, Team } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const emptyMission = {
  id: 1,
  title: '',
  description: '',
  storyContext: '',
  geniallyUrl: '',
  correctAnswer: '',
  points: 100,
  bonusCodesText: '',
  hintsText: '',
  bonusPrompt: '',
  locked: false,
  unlockAt: '',
  nextMissionId: '',
};

export default function AdminPage() {
  const router = useRouter();
  const [teams, setTeams] = useState<Team[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [hintRequests, setHintRequests] = useState<HintRequest[]>([]);
  const [scheduledAlerts, setScheduledAlerts] = useState<ScheduledAlert[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettings>({
    countdownTarget: new Date('2026-05-29T15:30:00-04:00'),
    countdownLabel: 'Time Remaining',
    notificationsEnabled: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isInitializing, setIsInitializing] = useState(false);
  const [missionForm, setMissionForm] = useState(emptyMission);
  const [editingMissionId, setEditingMissionId] = useState<number | null>(null);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertType, setAlertType] = useState<Alert['type']>('info');
  const [alertTarget, setAlertTarget] = useState('all');
  const [scheduledMessage, setScheduledMessage] = useState('');
  const [scheduledType, setScheduledType] = useState<Alert['type']>('info');
  const [scheduledTarget, setScheduledTarget] = useState('all');
  const [scheduledSendAt, setScheduledSendAt] = useState('');
  const [countdownTarget, setCountdownTarget] = useState('');
  const [countdownLabel, setCountdownLabel] = useState('Time Remaining');
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamCode, setNewTeamCode] = useState('');
  const [bonusAwards, setBonusAwards] = useState<Record<string, string>>({});

  const sortedMissions = useMemo(() => [...missions].sort((a, b) => a.id - b.id), [missions]);

  useEffect(() => {
    const unsubscribeTeams = subscribeToAllTeams((updatedTeams) => {
      setTeams(updatedTeams.sort((a, b) => b.score - a.score));
      setIsLoading(false);
    });
    const unsubscribeHints = subscribeToHintRequests(setHintRequests);
    const unsubscribeScheduledAlerts = subscribeToScheduledAlerts(setScheduledAlerts);
    const unsubscribeSettings = subscribeToAppSettings((settings) => {
      setAppSettings(settings);
      setCountdownLabel(settings.countdownLabel);
      setCountdownTarget(toDatetimeLocal(settings.countdownTarget));
    });
    loadMissions();
    return () => {
      unsubscribeTeams();
      unsubscribeHints();
      unsubscribeScheduledAlerts();
      unsubscribeSettings();
    };
  }, []);

  async function loadMissions() {
    try {
      const missionList = await getAllMissions();
      setMissions(missionList.sort((a, b) => a.id - b.id));
    } catch (error) {
      console.error('Mission load error:', error);
      toast.error('Could not load missions.');
    } finally {
      setIsLoading(false);
    }
  }

  const resetMissionForm = () => {
    setMissionForm({
      ...emptyMission,
      id: sortedMissions.length > 0 ? Math.max(...sortedMissions.map((mission) => mission.id)) + 1 : 1,
    });
    setEditingMissionId(null);
  };

  const editMission = (mission: Mission) => {
    setEditingMissionId(mission.id);
    setMissionForm({
      id: mission.id,
      title: mission.title,
      description: mission.description,
      storyContext: mission.storyContext,
      geniallyUrl: mission.geniallyUrl,
      correctAnswer: mission.correctAnswer,
      points: mission.points || 100,
      bonusCodesText: (mission.bonusCodes || []).map((bonus) => `${bonus.code}, ${bonus.points}${bonus.label ? `, ${bonus.label}` : ''}`).join('\n'),
      hintsText: (mission.hints || []).join('\n'),
      bonusPrompt: mission.bonusPrompt || '',
      locked: Boolean(mission.locked),
      unlockAt: mission.unlockAt ? new Date(mission.unlockAt.getTime() - mission.unlockAt.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '',
      nextMissionId: mission.nextMissionId ? String(mission.nextMissionId) : '',
    });
  };

  const saveMission = async () => {
    if (!missionForm.title.trim() || !missionForm.correctAnswer.trim()) {
      toast.error('Mission title and answer are required.');
      return;
    }

    const mission: Mission = {
      id: Number(missionForm.id),
      title: missionForm.title.trim(),
      description: missionForm.description.trim(),
      storyContext: missionForm.storyContext.trim(),
      geniallyUrl: missionForm.geniallyUrl.trim(),
      correctAnswer: missionForm.correctAnswer.trim().toUpperCase(),
      points: Number(missionForm.points) || 100,
      bonusCodes: parseBonusCodes(missionForm.bonusCodesText),
      hints: missionForm.hintsText.split('\n').map((hint) => hint.trim()).filter(Boolean).slice(0, 3),
      bonusPrompt: missionForm.bonusPrompt.trim(),
      locked: missionForm.locked,
      unlockAt: missionForm.unlockAt ? new Date(missionForm.unlockAt) : null,
      nextMissionId: missionForm.nextMissionId ? Number(missionForm.nextMissionId) : null,
    };

    try {
      if (editingMissionId) await updateMission(mission);
      else await createMission(mission);
      toast.success(editingMissionId ? 'Mission updated.' : 'Mission created.');
      await loadMissions();
      resetMissionForm();
    } catch (error) {
      console.error('Mission save error:', error);
      toast.error('Mission could not be saved.');
    }
  };

  const sendNewsAlert = async () => {
    if (!alertMessage.trim()) {
      toast.error('Enter an alert message.');
      return;
    }

    try {
      await sendAlert({
        teamId: alertTarget === 'all' ? null : alertTarget,
        message: alertMessage.trim(),
        type: alertType,
        timestamp: new Date(),
        read: false,
      });
      setAlertMessage('');
      toast.success('Alert sent.');
    } catch (error) {
      console.error('Alert error:', error);
      toast.error('Alert could not be sent.');
    }
  };

  const scheduleNewsAlert = async () => {
    if (!scheduledMessage.trim() || !scheduledSendAt) {
      toast.error('Enter a scheduled message and send time.');
      return;
    }

    try {
      await createScheduledAlert({
        teamId: scheduledTarget === 'all' ? null : scheduledTarget,
        message: scheduledMessage.trim(),
        type: scheduledType,
        sendAt: new Date(scheduledSendAt),
      });
      setScheduledMessage('');
      setScheduledSendAt('');
      toast.success('Alert scheduled.');
    } catch (error) {
      console.error('Schedule alert error:', error);
      toast.error('Scheduled alert could not be saved.');
    }
  };

  const sendHint = async (request: HintRequest) => {
    const mission = missions.find((item) => item.id === request.missionId);
    const hintText = mission?.hints?.[request.hintNumber - 1] || mission?.hint || '';

    if (!hintText) {
      toast.error('This mission does not have that hint configured.');
      return;
    }

    try {
      await fulfillHintRequest(request, hintText);
      toast.success(`Hint sent to ${request.teamName}.`);
    } catch (error) {
      console.error('Hint send error:', error);
      toast.error('Hint could not be sent.');
    }
  };

  const createManualTeam = async () => {
    if (!newTeamName.trim() || !newTeamCode.trim()) {
      toast.error('Team name and code are required.');
      return;
    }

    try {
      await createTeam({
        name: newTeamName.trim(),
        code: newTeamCode.trim().toUpperCase(),
        captainName: 'Game Master',
        members: [],
        color: '#3b4f5f',
        currentMission: 1,
        completedMissions: [],
        score: 0,
        bonusPoints: 0,
        hintsUsed: {},
        claimedBonusCodes: {},
        missionStartedAt: {},
        missionCompletedAt: {},
        elapsedSeconds: 0,
        createdAt: new Date(),
      });
      setNewTeamName('');
      setNewTeamCode('');
      toast.success('Manual team created.');
    } catch (error) {
      console.error('Team create error:', error);
      toast.error('Team could not be created.');
    }
  };

  const resetTeam = async (team: Team) => {
    try {
      await resetTeamGame(team.id);
      toast.success(`${team.name} reset to Mission 1.`);
    } catch (error) {
      console.error('Reset error:', error);
      toast.error('Team could not be reset.');
    }
  };

  const awardBonus = async (team: Team) => {
    const points = Number(bonusAwards[team.id]);
    if (!points) {
      toast.error('Enter bonus points first.');
      return;
    }

    try {
      await awardTeamBonus(team, points);
      setBonusAwards({ ...bonusAwards, [team.id]: '' });
      toast.success(`${points} bonus points awarded to ${team.name}.`);
    } catch (error) {
      console.error('Bonus award error:', error);
      toast.error('Bonus points could not be awarded.');
    }
  };

  const initializeData = async () => {
    setIsInitializing(true);
    try {
      await initializeSampleData();
      await loadMissions();
      toast.success('Sample Firebase data initialized.');
    } catch (error) {
      console.error('Sample data error:', error);
      toast.error('Sample data could not be initialized.');
    } finally {
      setIsInitializing(false);
    }
  };

  const saveCountdownSettings = async () => {
    if (!countdownTarget) {
      toast.error('Choose a countdown target date and time.');
      return;
    }

    try {
      await updateAppSettings({
        ...appSettings,
        countdownTarget: new Date(countdownTarget),
        countdownLabel: countdownLabel.trim() || 'Time Remaining',
      });
      toast.success('Countdown updated.');
    } catch (error) {
      console.error('Countdown update error:', error);
      toast.error('Countdown could not be updated.');
    }
  };

  const logoutAdmin = async () => {
    await fetch('/api/admin-logout', { method: 'POST' });
    router.push('/admin-login');
    router.refresh();
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#edf2f5]">
        <Loader2 className="h-8 w-8 animate-spin text-[#3b4f5f]" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#edf2f5] text-[#26333d]">
      <header className="border-b border-[#c8d2d9] bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-[#3b4f5f] hover:text-[#ff7a2a]">
              <ArrowLeft className="h-4 w-4" />
              Login
            </Link>
            <Image src="/success-logo.png" alt="SUCCESS Virtual Learning Centers of Michigan" width={214} height={68} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="border-[#b7c3cb]" disabled={isInitializing} onClick={initializeData}>
              {isInitializing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Database className="mr-2 h-4 w-4" />}
              Initialize Sample Data
            </Button>
            <Button variant="ghost" onClick={logoutAdmin}>Admin Logout</Button>
          </div>
        </div>
      </header>

      <section className="ps-shell broken-panel px-4 py-6 text-white">
        <div className="mx-auto max-w-7xl">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-yellow-100">Game Master Console</p>
          <h1 className="mt-2 text-3xl font-bold md:text-5xl">Graduation Recovery Operations</h1>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-5">
        <Tabs defaultValue="missions" className="space-y-5">
          <TabsList className="grid h-auto w-full grid-cols-2 bg-white md:grid-cols-6">
            <TabsTrigger value="missions">Missions</TabsTrigger>
            <TabsTrigger value="hints">Hint Queue</TabsTrigger>
            <TabsTrigger value="teams">Teams</TabsTrigger>
            <TabsTrigger value="alerts">Alerts</TabsTrigger>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="missions" className="grid gap-5 lg:grid-cols-[420px_1fr]">
            <Panel title={editingMissionId ? `Edit Mission ${editingMissionId}` : 'Create Mission'}>
              <MissionForm form={missionForm} setForm={setMissionForm} saveMission={saveMission} resetMissionForm={resetMissionForm} />
            </Panel>

            <Panel title="Mission List">
              <div className="space-y-3">
                {sortedMissions.map((mission) => (
                  <div key={mission.id} className="rounded border border-[#d6e0e6] bg-[#f8fafb] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#54616b]">Mission {mission.id}</p>
                        <h3 className="font-semibold text-[#26333d]">{mission.title}</h3>
                        <p className="mt-1 text-sm text-[#54616b]">{mission.points || 100} pts | {mission.hints?.length || 0} hints | {mission.bonusCodes?.length || 0} bonus codes</p>
                      </div>
                      <div className="flex gap-2">
                        {mission.locked && <Badge className="bg-[#fad714] text-[#26333d] hover:bg-[#fad714]"><Lock className="mr-1 h-3 w-3" />Locked</Badge>}
                        <Button variant="outline" className="border-[#b7c3cb]" onClick={() => editMission(mission)}>Edit</Button>
                        <Button variant="ghost" size="icon" onClick={async () => {
                          await deleteMission(mission.id);
                          await loadMissions();
                          toast.success('Mission deleted.');
                        }} aria-label="Delete mission">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          </TabsContent>

          <TabsContent value="hints">
            <Panel title="Pending Hint Requests">
              <div className="space-y-3">
                {hintRequests.length === 0 && <p className="text-sm text-[#54616b]">No hint requests yet.</p>}
                {hintRequests.map((request) => (
                  <div key={request.id} className="grid gap-3 rounded border border-[#d6e0e6] bg-[#f8fafb] p-4 md:grid-cols-[1fr_auto] md:items-center">
                    <div>
                      <Badge className={request.status === 'sent' ? 'bg-[#5ba300] text-white hover:bg-[#5ba300]' : 'bg-[#ff7a2a] text-white hover:bg-[#ff7a2a]'}>
                        {request.status}
                      </Badge>
                      <h3 className="mt-2 font-semibold text-[#26333d]">{request.teamName}</h3>
                      <p className="text-sm text-[#54616b]">{request.missionTitle} | Hint {request.hintNumber}</p>
                    </div>
                    <Button className="bg-[#3b4f5f] hover:bg-[#304250]" disabled={request.status === 'sent'} onClick={() => sendHint(request)}>
                      <Send className="mr-2 h-4 w-4" />
                      Send Hint
                    </Button>
                  </div>
                ))}
              </div>
            </Panel>
          </TabsContent>

          <TabsContent value="teams" className="grid gap-5 lg:grid-cols-[360px_1fr]">
            <Panel title="Manual Team">
              <div className="space-y-3">
                <Input value={newTeamName} onChange={(event) => setNewTeamName(event.target.value)} placeholder="Team name" />
                <Input value={newTeamCode} onChange={(event) => setNewTeamCode(event.target.value.toUpperCase())} placeholder="Custom code" />
                <Button className="w-full bg-[#3b4f5f] hover:bg-[#304250]" onClick={createManualTeam}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Team
                </Button>
              </div>
            </Panel>
            <Panel title="Team Standings">
              <div className="space-y-3">
                {teams.map((team, index) => (
                  <div key={team.id} className="grid gap-3 rounded border border-[#d6e0e6] bg-[#f8fafb] p-4 md:grid-cols-[auto_1fr_auto] md:items-center">
                    <span className="flex h-9 w-9 items-center justify-center rounded bg-[#3b4f5f] font-bold text-white">{index + 1}</span>
                    <div>
                      <h3 className="font-semibold text-[#26333d]">{team.name}</h3>
                      <p className="text-sm text-[#54616b]">Code {team.code} | Mission {team.currentMission} | {team.completedMissions?.length || 0} complete</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="bg-[#5ba300] text-white hover:bg-[#5ba300]"><Trophy className="mr-1 h-3 w-3" />{team.score}</Badge>
                      <Input
                        type="number"
                        className="h-9 w-24"
                        value={bonusAwards[team.id] || ''}
                        onChange={(event) => setBonusAwards({ ...bonusAwards, [team.id]: event.target.value })}
                        placeholder="+pts"
                      />
                      <Button variant="outline" className="border-[#b7c3cb]" onClick={() => awardBonus(team)}>Bonus</Button>
                      <Button variant="outline" className="border-[#b7c3cb]" onClick={() => resetTeam(team)}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Reset
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          </TabsContent>

          <TabsContent value="alerts">
            <Panel title="Send News Alert">
              <div className="grid gap-4 md:grid-cols-[1fr_180px_180px_auto] md:items-end">
                <div className="space-y-2">
                  <Label>Message</Label>
                  <Textarea value={alertMessage} onChange={(event) => setAlertMessage(event.target.value)} placeholder="Drop a clue, announce a lock window, or send a student-success update." />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={alertType} onChange={(event) => setAlertType(event.target.value as Alert['type'])}>
                    <option value="info">Info</option>
                    <option value="warning">Warning</option>
                    <option value="hint">Hint</option>
                    <option value="success">Success</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Target</Label>
                  <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={alertTarget} onChange={(event) => setAlertTarget(event.target.value)}>
                    <option value="all">All Teams</option>
                    {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
                  </select>
                </div>
                <Button className="bg-[#3b4f5f] hover:bg-[#304250]" onClick={sendNewsAlert}>
                  <Bell className="mr-2 h-4 w-4" />
                  Send
                </Button>
              </div>
            </Panel>
          </TabsContent>

          <TabsContent value="schedule" className="grid gap-5 lg:grid-cols-[420px_1fr]">
            <Panel title="Schedule Alert">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Message</Label>
                  <Textarea value={scheduledMessage} onChange={(event) => setScheduledMessage(event.target.value)} placeholder="This clue will appear automatically at the scheduled time." />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={scheduledType} onChange={(event) => setScheduledType(event.target.value as Alert['type'])}>
                      <option value="info">Info</option>
                      <option value="warning">Warning</option>
                      <option value="hint">Hint</option>
                      <option value="success">Success</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Target</Label>
                    <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={scheduledTarget} onChange={(event) => setScheduledTarget(event.target.value)}>
                      <option value="all">All Teams</option>
                      {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Send At</Label>
                  <Input type="datetime-local" value={scheduledSendAt} onChange={(event) => setScheduledSendAt(event.target.value)} />
                </div>
                <Button className="w-full bg-[#3b4f5f] hover:bg-[#304250]" onClick={scheduleNewsAlert}>
                  Schedule Alert
                </Button>
              </div>
            </Panel>

            <Panel title="Scheduled Alerts">
              <div className="space-y-3">
                {scheduledAlerts.length === 0 && <p className="text-sm text-[#54616b]">No scheduled alerts yet.</p>}
                {scheduledAlerts.map((alert) => (
                  <div key={alert.id} className="rounded border border-[#d6e0e6] bg-[#f8fafb] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <Badge className={alert.status === 'sent' ? 'bg-[#5ba300] text-white hover:bg-[#5ba300]' : 'bg-[#ff7a2a] text-white hover:bg-[#ff7a2a]'}>
                          {alert.status}
                        </Badge>
                        <p className="mt-2 text-sm font-semibold text-[#26333d]">{alert.message}</p>
                        <p className="mt-1 text-xs text-[#54616b]">{alert.sendAt.toLocaleString()} | {alert.teamId ? 'Team only' : 'All teams'}</p>
                      </div>
                      <Button variant="ghost" size="icon" onClick={async () => {
                        await deleteScheduledAlert(alert.id);
                        toast.success('Scheduled alert deleted.');
                      }} aria-label="Delete scheduled alert">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          </TabsContent>

          <TabsContent value="settings">
            <Panel title="Countdown Control">
              <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
                <div className="space-y-2">
                  <Label>Countdown Label</Label>
                  <Input value={countdownLabel} onChange={(event) => setCountdownLabel(event.target.value)} placeholder="Time Remaining" />
                </div>
                <div className="space-y-2">
                  <Label>Countdown Ends At</Label>
                  <Input type="datetime-local" value={countdownTarget} onChange={(event) => setCountdownTarget(event.target.value)} />
                </div>
                <Button className="bg-[#3b4f5f] hover:bg-[#304250]" onClick={saveCountdownSettings}>
                  Save Countdown
                </Button>
              </div>
            </Panel>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}

function toDatetimeLocal(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-md border border-[#c8d2d9] bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-[#d9e1e6] bg-[#f8fafb] px-5 py-4">
        <RadioTower className="h-5 w-5 text-[#ff7a2a]" />
        <h2 className="font-semibold text-[#26333d]">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function MissionForm({
  form,
  setForm,
  saveMission,
  resetMissionForm,
}: {
  form: typeof emptyMission;
  setForm: (form: typeof emptyMission) => void;
  saveMission: () => void;
  resetMissionForm: () => void;
}) {
  const update = (key: keyof typeof emptyMission, value: string | number | boolean) => setForm({ ...form, [key]: value });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[100px_1fr] gap-3">
        <div className="space-y-2">
          <Label>ID</Label>
          <Input type="number" value={form.id} onChange={(event) => update('id', Number(event.target.value))} />
        </div>
        <div className="space-y-2">
          <Label>Title</Label>
          <Input value={form.title} onChange={(event) => update('title', event.target.value)} placeholder="The Enrollment Barrier" />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea value={form.description} onChange={(event) => update('description', event.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>Story Context</Label>
        <Textarea value={form.storyContext} onChange={(event) => update('storyContext', event.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>Activity URL</Label>
        <Input value={form.geniallyUrl} onChange={(event) => update('geniallyUrl', event.target.value)} placeholder="https://view.genially.com/..." />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Recovery Code (Finish Mission)</Label>
          <Input value={form.correctAnswer} onChange={(event) => update('correctAnswer', event.target.value.toUpperCase())} />
        </div>
        <div className="space-y-2">
          <Label>Points</Label>
          <Input type="number" value={form.points} onChange={(event) => update('points', Number(event.target.value))} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Hints, One Per Line</Label>
        <Textarea value={form.hintsText} onChange={(event) => update('hintsText', event.target.value)} placeholder="Hint 1&#10;Hint 2&#10;Hint 3" />
      </div>
      <div className="space-y-2">
        <Label>Bonus Codes, One Per Line</Label>
        <Textarea value={form.bonusCodesText} onChange={(event) => update('bonusCodesText', event.target.value)} placeholder="BONUS10, 10, Found all documents&#10;EMPATHY15, 15, Rewrote outreach message" />
        <p className="text-xs text-[#54616b]">Format: code, points, optional label. Teams enter these on the mission page to claim bonus points.</p>
      </div>
      <div className="space-y-2">
        <Label>Bonus Prompt</Label>
        <Textarea value={form.bonusPrompt} onChange={(event) => update('bonusPrompt', event.target.value)} />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Next Mission ID</Label>
          <Input value={form.nextMissionId} onChange={(event) => update('nextMissionId', event.target.value)} placeholder="2" />
        </div>
        <div className="space-y-2">
          <Label>Unlock At</Label>
          <Input type="datetime-local" value={form.unlockAt} onChange={(event) => update('unlockAt', event.target.value)} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" checked={form.locked} onChange={(event) => update('locked', event.target.checked)} />
        Force mission locked
      </label>
      <div className="flex gap-2">
        <Button className="bg-[#3b4f5f] hover:bg-[#304250]" onClick={saveMission}>
          <CheckCircle2 className="mr-2 h-4 w-4" />
          Save Mission
        </Button>
        <Button variant="outline" className="border-[#b7c3cb]" onClick={resetMissionForm}>New Mission</Button>
      </div>
    </div>
  );
}

function parseBonusCodes(value: string) {
  return value
    .split('\n')
    .map((line) => {
      const [rawCode, rawPoints, ...labelParts] = line.split(',');
      const code = rawCode?.trim().toUpperCase();
      const points = Number(rawPoints?.trim());
      if (!code || !Number.isFinite(points) || points <= 0) return null;

      return {
        code,
        points,
        label: labelParts.join(',').trim(),
      };
    })
    .filter((bonus): bonus is { code: string; points: number; label: string } => Boolean(bonus));
}
