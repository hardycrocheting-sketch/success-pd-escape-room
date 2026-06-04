'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { AlertTriangle, KeyRound, Loader2, LockKeyhole, RadioTower, ShieldCheck } from 'lucide-react';
import { useTeam } from '@/lib/team-context';
import { ROLE_LABELS } from '@/lib/types';
import type { Team, TeamMember } from '@/lib/types';
import { getTeamByCode } from '@/lib/firebase-utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useTeam();
  const [teamCode, setTeamCode] = useState('');
  const [foundTeam, setFoundTeam] = useState<Team | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const code = teamCode.trim().toUpperCase();

    if (!code) {
      setError('Enter the team access code from staff registration.');
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      const team = await getTeamByCode(code);
      if (!team) {
        setError('That access code was not recognized.');
        setFoundTeam(null);
        return;
      }
      setFoundTeam(team);
    } catch (error) {
      console.error('Team lookup error:', error);
      setError('Connection error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const selectMember = (member: TeamMember) => {
    if (!foundTeam) return;
    login(foundTeam, member.name, member.role, foundTeam.captainRole === member.role);
    router.push('/dashboard');
  };

  return (
    <main className="min-h-screen bg-[#edf2f5] text-[#26333d]">
      <div className="grid min-h-screen lg:grid-cols-[0.95fr_1.05fr]">
        <section className="ps-shell broken-panel flex min-h-[42vh] flex-col justify-between px-6 py-7 text-white lg:min-h-screen lg:px-10">
          <div className="flex items-center justify-between gap-4">
            <div className="rounded bg-white px-3 py-2 shadow-sm sm:px-4 sm:py-3">
              <Image src="/success-logo.png" alt="SUCCESS Virtual Learning Centers of Michigan" width={260} height={82} priority className="h-auto w-44 sm:w-[260px]" />
            </div>
            <div className="hidden rounded border border-white/20 bg-white/10 px-3 py-2 font-mono text-xs uppercase tracking-[0.18em] text-yellow-100 sm:block">
              GRI CASE FILES
            </div>
          </div>

          <div className="max-w-2xl py-10">
            <div className="mb-5 inline-flex items-center gap-2 rounded border border-orange-300/50 bg-orange-400/15 px-3 py-2 text-sm font-semibold text-orange-100">
              <AlertTriangle className="h-4 w-4" />
              Graduation Recovery Initiative
            </div>
            <h1 className="text-3xl font-bold md:text-6xl">
              Find Your Way through real student-success missions.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-100">
              Team up as Student Success Teams, investigate graduation barriers, use AI clues wisely, and build realistic support plans before the countdown ends.
            </p>
          </div>

          <div className="grid gap-3 text-sm sm:grid-cols-3">
            <StatusTile label="Case Files" value="Active" tone="orange" />
            <StatusTile label="AI Support" value="Available" tone="yellow" />
            <StatusTile label="Students" value="Counting on Us" tone="green" />
          </div>
        </section>

        <section className="flex items-center justify-center px-4 py-10">
          <div className="w-full max-w-md rounded-md border border-[#c8d2d9] bg-white shadow-[0_20px_60px_rgba(59,79,95,0.16)]">
            <div className="border-b border-[#d9e1e6] bg-[#f8fafb] px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded bg-[#3b4f5f] text-white">
                  <LockKeyhole className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-[#26333d]">Mission Control Login</h2>
                  <p className="text-sm text-[#54616b]">Graduation Recovery access portal</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 p-6">
              <div className="rounded border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-[#6f3a12]">
                Use the team code generated after staff registration. Codes are shared with team members only.
              </div>

              <div className="space-y-2">
                <Label htmlFor="teamCode">Team Access Code</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#54616b]" />
                  <Input
                    id="teamCode"
                    value={teamCode}
                    onChange={(event) => {
                      setTeamCode(event.target.value.toUpperCase());
                      setError('');
                      setFoundTeam(null);
                    }}
                    className="h-12 pl-10 text-center font-mono text-lg uppercase tracking-[0.24em]"
                    placeholder="A7K2Q9"
                    disabled={isLoading}
                    autoFocus
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
              </div>

              <Button type="submit" className="h-12 w-full bg-[#3b4f5f] text-base hover:bg-[#304250]" disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <ShieldCheck className="mr-2 h-5 w-5" />}
                Find My Team
              </Button>

              {foundTeam && (
                <div className="space-y-3 rounded border border-[#d6e0e6] bg-[#f8fafb] p-4">
                  <div>
                    <p className="text-sm font-semibold text-[#26333d]">{foundTeam.name}</p>
                    <p className="text-xs text-[#54616b]">Choose your name to continue on this device.</p>
                  </div>
                  <div className="grid gap-2">
                    {(foundTeam.members || []).map((member) => (
                      <Button key={`${member.role}-${member.name}`} type="button" variant="outline" className="h-auto justify-start border-[#b7c3cb] p-3 text-left" onClick={() => selectMember(member)}>
                        <span>
                          <span className="block font-semibold">{member.name}</span>
                          <span className="block text-xs text-[#54616b]">{ROLE_LABELS[member.role]}{foundTeam.captainRole === member.role ? ' | Captain' : ''}</span>
                        </span>
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid gap-3 border-t border-[#e1e7eb] pt-5">
                <Link href="/register">
                  <Button type="button" variant="outline" className="h-11 w-full border-[#b7c3cb]">
                    Register Staff Team
                  </Button>
                </Link>
                <Link href="/admin" className="inline-flex items-center justify-center gap-2 text-sm font-medium text-[#3b4f5f] hover:text-[#ff7a2a]">
                  <RadioTower className="h-4 w-4" />
                  Game Master Console
                </Link>
              </div>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}

function StatusTile({ label, value, tone }: { label: string; value: string; tone: 'orange' | 'yellow' | 'green' }) {
  const color = tone === 'orange' ? 'text-orange-200' : tone === 'yellow' ? 'text-yellow-200' : 'text-lime-200';

  return (
    <div className="rounded border border-white/15 bg-white/10 p-3">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-300">{label}</p>
      <p className={`mt-1 font-mono text-sm font-semibold ${color}`}>{value}</p>
    </div>
  );
}
