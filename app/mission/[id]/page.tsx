'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, HelpCircle, Loader2, Lock, Send, ShieldAlert, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useTeam } from '@/lib/team-context';
import { claimMissionBonusCode, completeTeamMission, getMission, requestMissionHint, startTeamMission } from '@/lib/firebase-utils';
import type { Mission } from '@/lib/types';
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
  const [isLoading, setIsLoading] = useState(true);
  const [answer, setAnswer] = useState('');
  const [bonusCode, setBonusCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmittingBonus, setIsSubmittingBonus] = useState(false);
  const [isRequestingHint, setIsRequestingHint] = useState(false);
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const [openedAt, setOpenedAt] = useState<Date | null>(null);

  useEffect(() => {
    if (!teamLoading && !session) router.push('/');
  }, [router, session, teamLoading]);

  useEffect(() => {
    getMission(missionId)
      .then(setMission)
      .catch(() => toast.error('Mission data could not be loaded.'))
      .finally(() => setIsLoading(false));
  }, [missionId]);

  const isCompleted = Boolean(team?.completedMissions?.includes(missionId));
  const locked = missionIsLocked(mission) || Boolean(team && missionId !== team.currentMission && !isCompleted);
  const hintsUsed = team?.hintsUsed?.[String(missionId)] || 0;
  const hintLimit = Math.min(3, mission?.hints?.length || (mission?.hint ? 1 : 0));
  const canAskForHint = Boolean(team && mission && !isCompleted && !locked && hintsUsed < hintLimit);
  const claimedBonusCodes = team?.claimedBonusCodes?.[String(missionId)] || [];
  const availableBonusCount = mission?.bonusCodes?.length || 0;

  useEffect(() => {
    if (!team || !mission || locked || isCompleted) return;
    if (team.missionStartedAt?.[String(missionId)] || openedAt) return;

    const now = new Date();
    setOpenedAt(now);
    startTeamMission(team, missionId).catch((error) => {
      console.error('Mission start error:', error);
    });
  }, [isCompleted, locked, mission, missionId, openedAt, team]);

  const handleSubmitAnswer = async (event: FormEvent) => {
    event.preventDefault();
    if (!mission || !team || !session || !answer.trim()) return;

    const expectedAnswer = (mission.answerKey || mission.correctAnswer || '').trim().toUpperCase();
    const submittedAnswer = answer.trim().toUpperCase();

    setIsSubmitting(true);
    setFeedback(null);

    if (submittedAnswer !== expectedAnswer) {
      setFeedback('incorrect');
      toast.error('Incorrect answer. No penalty, keep investigating.');
      setIsSubmitting(false);
      return;
    }

    try {
      if (!team.missionStartedAt?.[String(mission.id)]) {
        await startTeamMission(team, mission.id);
      }
      await completeTeamMission(team, mission);
      setFeedback('correct');
      toast.success('Mission complete. Student support plan submitted.');
      window.setTimeout(() => {
        if (mission.nextMissionId) router.push(`/mission/${mission.nextMissionId}`);
        else router.push('/dashboard');
      }, 1200);
    } catch (error) {
      console.error('Progress update error:', error);
      toast.error('Correct answer, but progress could not be saved.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleHintRequest = async () => {
    if (!team || !mission) return;

    setIsRequestingHint(true);
    try {
      const result = await requestMissionHint(team, mission);
      if (!result.success) {
        toast.error(result.error || 'Hint request could not be created.');
        return;
      }

      toast.success('Hint requested. 5 points deducted. Watch News Alerts for the Game Master response.');
    } catch (error) {
      console.error('Hint request error:', error);
      toast.error('Hint request failed.');
    } finally {
      setIsRequestingHint(false);
    }
  };

  const handleSubmitBonusCode = async (event: FormEvent) => {
    event.preventDefault();
    if (!mission || !team || !bonusCode.trim()) return;

    setIsSubmittingBonus(true);
    try {
      const result = await claimMissionBonusCode(team, mission, bonusCode);
      if (!result.success) {
        toast.error(result.error || 'Bonus code could not be claimed.');
        return;
      }

      setBonusCode('');
      toast.success(`Bonus claimed: +${result.points} points.`);
    } catch (error) {
      console.error('Bonus code error:', error);
      toast.error('Bonus code could not be submitted.');
    } finally {
      setIsSubmittingBonus(false);
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
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4">
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-semibold text-[#3b4f5f] hover:text-[#ff7a2a]">
            <ArrowLeft className="h-4 w-4" />
            Mission Control
          </Link>
          <Badge className="bg-[#3b4f5f] text-white hover:bg-[#3b4f5f]">{team.name}</Badge>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-5 px-4 py-5 lg:grid-cols-[1fr_360px]">
        <section className="rounded-md border border-[#c8d2d9] bg-white shadow-sm">
          <div className="border-b border-[#d9e1e6] bg-[#f8fafb] p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-[#3b4f5f] text-[#3b4f5f]">Mission {mission.id}</Badge>
              {isCompleted && <Badge className="bg-[#5ba300] text-white hover:bg-[#5ba300]">Completed</Badge>}
              <Badge className="bg-[#ff7a2a] text-white hover:bg-[#ff7a2a]">{mission.points || 100} pts</Badge>
            </div>
            <h1 className="mt-3 text-3xl font-semibold text-[#26333d]">{mission.title}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#54616b]">{mission.description}</p>
          </div>

          <div className="p-5">
            <div className="aspect-video overflow-hidden rounded-md border border-[#c8d2d9] bg-[#101820]">
              {mission.geniallyUrl ? (
                <iframe src={mission.geniallyUrl} className="h-full w-full" allowFullScreen title={mission.title} />
              ) : (
                <div className="flex h-full flex-col items-center justify-center p-6 text-center text-slate-200">
                  <ShieldAlert className="mb-4 h-12 w-12 text-[#fad714]" />
                  <p className="font-semibold">Mission room is awaiting its embedded activity.</p>
                  <p className="mt-2 text-sm text-slate-400">Add a Genially or activity URL in the Game Master Console.</p>
                </div>
              )}
            </div>
          </div>
        </section>

        <aside className="space-y-5">
          <div className="rounded-md border border-[#c8d2d9] bg-white shadow-sm">
            <div className="border-b border-[#d9e1e6] bg-[#f8fafb] px-4 py-3">
              <h2 className="font-semibold text-[#26333d]">Mission Briefing</h2>
            </div>
            <div className="space-y-4 p-4">
              <p className="text-sm leading-6 text-[#54616b]">{mission.storyContext || 'Review the student scenario, complete the case task, and submit the answer code.'}</p>
              {mission.bonusPrompt && (
                <div className="rounded border border-[#fad714] bg-yellow-50 p-3 text-sm text-[#5c4b00]">
                  <strong>Bonus Task:</strong> {mission.bonusPrompt}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-md border border-[#c8d2d9] bg-white shadow-sm">
            <div className="border-b border-[#d9e1e6] bg-[#f8fafb] px-4 py-3">
              <h2 className="font-semibold text-[#26333d]">Submit Bonus Code</h2>
            </div>
            <div className="space-y-3 p-4">
              <p className="text-sm text-[#54616b]">
                If Genially reveals a bonus code, enter it here. Each bonus code can only be claimed once per team.
              </p>
              <div className="text-sm font-semibold text-[#3b4f5f]">Claimed: {claimedBonusCodes.length}/{availableBonusCount}</div>
              <form onSubmit={handleSubmitBonusCode} className="space-y-3">
                <Input
                  value={bonusCode}
                  onChange={(event) => setBonusCode(event.target.value.toUpperCase())}
                  className="h-11 text-center font-mono uppercase tracking-[0.16em]"
                  placeholder="BONUS CODE"
                  disabled={isSubmittingBonus || availableBonusCount === 0}
                />
                <Button type="submit" variant="outline" className="h-11 w-full border-[#b7c3cb]" disabled={!bonusCode.trim() || isSubmittingBonus || availableBonusCount === 0}>
                  {isSubmittingBonus ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                  Claim Bonus Points
                </Button>
              </form>
            </div>
          </div>

          <div className="rounded-md border border-[#c8d2d9] bg-white shadow-sm">
            <div className="border-b border-[#d9e1e6] bg-[#f8fafb] px-4 py-3">
              <h2 className="font-semibold text-[#26333d]">Submit Recovery Code</h2>
            </div>
            <div className="p-4">
              {isCompleted ? (
                <div className="rounded border border-green-200 bg-green-50 p-4 text-center text-sm text-[#315c00]">
                  <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-[#5ba300]" />
                  Mission already completed.
                </div>
              ) : (
                <form onSubmit={handleSubmitAnswer} className="space-y-4">
                  <Input
                    value={answer}
                    onChange={(event) => {
                      setAnswer(event.target.value.toUpperCase());
                      setFeedback(null);
                    }}
                    className="h-12 text-center font-mono text-lg uppercase tracking-[0.18em]"
                    placeholder="ANSWER CODE"
                    disabled={isSubmitting}
                  />
                  {feedback === 'incorrect' && (
                    <p className="flex items-center justify-center gap-2 text-sm text-destructive">
                      <XCircle className="h-4 w-4" />
                      Incorrect. Try again.
                    </p>
                  )}
                  <Button className="h-12 w-full bg-[#3b4f5f] hover:bg-[#304250]" disabled={!answer.trim() || isSubmitting}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    Submit Answer
                  </Button>
                </form>
              )}
            </div>
          </div>

          <div className="rounded-md border border-[#c8d2d9] bg-white shadow-sm">
            <div className="border-b border-[#d9e1e6] bg-[#f8fafb] px-4 py-3">
              <h2 className="font-semibold text-[#26333d]">Hint Request</h2>
            </div>
            <div className="space-y-3 p-4">
              <p className="text-sm text-[#54616b]">
                Hints are approved by the Game Master and delivered through News Alerts. Each request costs 5 points.
              </p>
              <div className="text-sm font-semibold text-[#3b4f5f]">Hints used: {hintsUsed}/{hintLimit || 0}</div>
              <Button type="button" variant="outline" className="h-11 w-full border-[#b7c3cb]" disabled={!canAskForHint || isRequestingHint} onClick={handleHintRequest}>
                {isRequestingHint ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <HelpCircle className="mr-2 h-4 w-4" />}
                Request Hint (-5 pts)
              </Button>
            </div>
          </div>
        </aside>
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
