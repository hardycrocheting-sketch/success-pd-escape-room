'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { ArrowLeft, CheckCircle2, ClipboardCopy, Loader2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useTeam } from '@/lib/team-context';
import { registerTeam } from '@/lib/firebase-utils';
import { ROLE_LABELS, TEAM_ROLES } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const TEAM_COLORS = [
  { name: 'SUCCESS Navy', value: '#3b4f5f' },
  { name: 'SUCCESS Orange', value: '#ff7a2a' },
  { name: 'SUCCESS Green', value: '#5ba300' },
  { name: 'SUCCESS Yellow', value: '#fad714' },
  { name: 'SUCCESS Slate', value: '#54616b' },
];

export default function RegisterPage() {
  const router = useRouter();
  const { login } = useTeam();
  const [teamName, setTeamName] = useState('');
  const [captainName, setCaptainName] = useState('');
  const [members, setMembers] = useState<Record<string, string>>({
    investigator: '',
    analyst: '',
    communicator: '',
    pathfinder: '',
  });
  const [selectedColor, setSelectedColor] = useState('#3b4f5f');
  const [isLoading, setIsLoading] = useState(false);
  const [generatedCode, setGeneratedCode] = useState('');

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!teamName.trim() || !captainName.trim()) {
      toast.error('Team name and captain name are required.');
      return;
    }

    setIsLoading(true);
    try {
      const roleMembers = TEAM_ROLES.map((role) => ({
        role,
        name: members[role].trim() || ROLE_LABELS[role],
      }));
      const result = await registerTeam(teamName.trim(), captainName.trim(), roleMembers, selectedColor);
      setGeneratedCode(result.teamCode);
      toast.success('Staff team registered.');
    } catch (error) {
      console.error('Registration error:', error);
      toast.error('Could not register this team. Check Firebase and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const copyCode = async () => {
    await navigator.clipboard.writeText(generatedCode);
    toast.success('Team code copied.');
  };

  const enterMissionControl = async () => {
    setIsLoading(true);
    const result = await login(generatedCode);
    if (result.success) {
      router.push('/dashboard');
      return;
    }

    toast.error('The team was created, but login failed. Use the code on the login page.');
    router.push('/');
  };

  if (generatedCode) {
    return (
      <main className="min-h-screen bg-[#edf2f5] px-4 py-8">
        <div className="mx-auto max-w-xl rounded-md border border-[#c8d2d9] bg-white shadow-[0_18px_55px_rgba(59,79,95,0.14)]">
          <div className="border-b border-[#d9e1e6] bg-[#f8fafb] p-6 text-center">
            <Image src="/success-logo.png" alt="SUCCESS Virtual Learning Centers of Michigan" width={250} height={79} className="mx-auto h-auto w-48 sm:w-[250px]" />
            <CheckCircle2 className="mx-auto mt-6 h-12 w-12 text-[#5ba300]" />
            <h1 className="mt-3 text-2xl font-semibold text-[#26333d]">Team Registration Complete</h1>
            <p className="mt-1 text-sm text-[#54616b]">Share this code with your team. It is their Mission Control login.</p>
          </div>

          <div className="space-y-6 p-6">
            <div className="rounded-md border border-[#d6e0e6] bg-[#f8fafb] p-5 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#54616b]">Team Access Code</p>
              <div className="mt-2 break-all font-mono text-4xl font-bold sm:text-5xl" style={{ color: selectedColor }}>
                {generatedCode}
              </div>
              <Button type="button" variant="outline" className="mt-4 border-[#b7c3cb]" onClick={copyCode}>
                <ClipboardCopy className="mr-2 h-4 w-4" />
                Copy Code
              </Button>
            </div>

            <Button className="h-12 w-full bg-[#3b4f5f] hover:bg-[#304250]" onClick={enterMissionControl} disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enter Mission Control
            </Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#edf2f5] px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-[#3b4f5f] hover:text-[#ff7a2a]">
          <ArrowLeft className="h-4 w-4" />
          Back to login
        </Link>

        <div className="rounded-md border border-[#c8d2d9] bg-white shadow-[0_18px_55px_rgba(59,79,95,0.14)]">
          <div className="grid gap-6 border-b border-[#d9e1e6] bg-[#f8fafb] p-6 md:grid-cols-[auto_1fr] md:items-center">
            <Image src="/success-logo.png" alt="SUCCESS Virtual Learning Centers of Michigan" width={220} height={70} className="h-auto w-48 sm:w-[220px]" />
            <div>
              <h1 className="text-2xl font-semibold text-[#26333d]">Staff Team Registration</h1>
              <p className="mt-1 text-sm text-[#54616b]">
                Create one team code and assign one person to each required role.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="grid gap-6 p-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="teamName">Team Name</Label>
                <Input id="teamName" value={teamName} onChange={(event) => setTeamName(event.target.value)} placeholder="The Credit Recovery Crew" disabled={isLoading} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="captainName">Captain Name</Label>
                <Input id="captainName" value={captainName} onChange={(event) => setCaptainName(event.target.value)} placeholder="Staff lead" disabled={isLoading} />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <Label className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-[#3b4f5f]" />
                  Team Members
                </Label>
                <span className="text-xs text-[#54616b]">4 required roles</span>
              </div>
              <div className="grid gap-2">
                {TEAM_ROLES.map((role) => (
                  <div key={role} className="grid gap-2 rounded border border-[#d6e0e6] bg-[#f8fafb] p-3 sm:grid-cols-[150px_1fr] sm:items-center">
                    <div>
                      <p className="text-sm font-semibold text-[#26333d]">{ROLE_LABELS[role]}</p>
                      <p className="text-xs text-[#54616b]">Role task access</p>
                    </div>
                    <Input value={members[role]} onChange={(event) => setMembers({ ...members, [role]: event.target.value })} placeholder={`${ROLE_LABELS[role]} name`} disabled={isLoading} />
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <Label>Team Color</Label>
              <div className="flex flex-wrap gap-2">
                {TEAM_COLORS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    aria-label={color.name}
                    title={color.name}
                    onClick={() => setSelectedColor(color.value)}
                    className="h-10 w-10 rounded border-2 transition"
                    style={{
                      backgroundColor: color.value,
                      borderColor: selectedColor === color.value ? '#111827' : 'transparent',
                      boxShadow: selectedColor === color.value ? `0 0 0 3px ${color.value}35` : undefined,
                    }}
                    disabled={isLoading}
                  />
                ))}
              </div>
            </div>

            <Button type="submit" className="h-12 bg-[#3b4f5f] hover:bg-[#304250]" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Register Team and Generate Code
            </Button>
          </form>
        </div>
      </div>
    </main>
  );
}
