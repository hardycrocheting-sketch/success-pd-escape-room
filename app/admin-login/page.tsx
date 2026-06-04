'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { FormEvent, useState } from 'react';
import { ArrowLeft, Loader2, LockKeyhole, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#edf2f5] text-[#3b4f5f]">Loading admin login...</div>}>
      <AdminLoginForm />
    </Suspense>
  );
}

function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState('');
  const [error, setError] = useState(searchParams.get('error') === 'missing-config' ? 'Admin password is not configured in Vercel yet.' : '');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!password.trim()) {
      setError('Enter the Game Master password.');
      return;
    }

    setIsLoading(true);
    setError('');

    const response = await fetch('/api/admin-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(typeof data.error === 'string' ? data.error : 'Admin login failed.');
      setIsLoading(false);
      return;
    }

    router.push(searchParams.get('next') || '/admin');
    router.refresh();
  };

  return (
    <main className="min-h-screen bg-[#edf2f5] px-4 py-8 text-[#26333d]">
      <div className="mx-auto max-w-md">
        <Link href="/" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-[#3b4f5f] hover:text-[#ff7a2a]">
          <ArrowLeft className="h-4 w-4" />
          Back to team login
        </Link>

        <div className="rounded-md border border-[#c8d2d9] bg-white shadow-[0_18px_55px_rgba(59,79,95,0.14)]">
          <div className="border-b border-[#d9e1e6] bg-[#f8fafb] p-6 text-center">
            <Image src="/success-logo.png" alt="SUCCESS Virtual Learning Centers of Michigan" width={240} height={76} className="mx-auto h-auto w-48 sm:w-[240px]" priority />
            <div className="mx-auto mt-6 flex h-12 w-12 items-center justify-center rounded bg-[#3b4f5f] text-white">
              <LockKeyhole className="h-6 w-6" />
            </div>
            <h1 className="mt-3 text-2xl font-semibold">Game Master Login</h1>
            <p className="mt-1 text-sm text-[#54616b]">Admin access is restricted.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5 p-6">
            <div className="space-y-2">
              <Label htmlFor="adminPassword">Admin Password</Label>
              <Input
                id="adminPassword"
                type="password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setError('');
                }}
                autoFocus
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>

            <Button type="submit" className="h-12 w-full bg-[#3b4f5f] hover:bg-[#304250]" disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
              Open Admin Console
            </Button>
          </form>
        </div>
      </div>
    </main>
  );
}
