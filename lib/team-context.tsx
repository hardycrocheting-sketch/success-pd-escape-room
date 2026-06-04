'use client';

import { createContext, useContext, useRef, useState, useEffect, ReactNode } from 'react';
import type { TeamSession, Team, Alert, TeamRole } from '@/lib/types';
import { subscribeToTeam, subscribeToAlerts } from '@/lib/firebase-utils';

interface TeamContextType {
  session: TeamSession | null;
  team: Team | null;
  alerts: Alert[];
  unreadAlerts: number;
  isLoading: boolean;
  notificationsAllowed: boolean;
  enableNotifications: () => Promise<{ success: boolean; error?: string }>;
  login: (team: Team, memberName: string, role: TeamRole, isCaptain: boolean) => void;
  logout: () => void;
}

const TeamContext = createContext<TeamContextType | undefined>(undefined);

export function TeamProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<TeamSession | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notificationsAllowed, setNotificationsAllowed] = useState(false);
  const knownAlertIds = useRef<Set<string>>(new Set());
  const alertsInitialized = useRef(false);

  // Load session from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('teamSession');
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as TeamSession;
        setSession(parsed);
      } catch {
        localStorage.removeItem('teamSession');
      }
    }
    setNotificationsAllowed(typeof Notification !== 'undefined' && Notification.permission === 'granted');
    setIsLoading(false);
  }, []);

  // Subscribe to team updates when session exists
  useEffect(() => {
    if (!session?.teamId) {
      setTeam(null);
      return;
    }

    const unsubscribe = subscribeToTeam(session.teamId, (updatedTeam) => {
      setTeam(updatedTeam);
    });

    return () => unsubscribe();
  }, [session?.teamId]);

  // Subscribe to alerts when session exists
  useEffect(() => {
    if (!session?.teamId) {
      setAlerts([]);
      return;
    }

    const unsubscribe = subscribeToAlerts(session.teamId, (newAlerts) => {
      setAlerts(newAlerts);
    });

    return () => unsubscribe();
  }, [session?.teamId]);

  useEffect(() => {
    if (!alerts.length) return;

    const nextIds = new Set(alerts.map((alert) => alert.id));

    if (!alertsInitialized.current) {
      knownAlertIds.current = nextIds;
      alertsInitialized.current = true;
      return;
    }

    const newestAlert = alerts.find((alert) => !knownAlertIds.current.has(alert.id));
    knownAlertIds.current = nextIds;

    if (!newestAlert || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

    new Notification('SUCCESS Mission Control', {
      body: newestAlert.message,
      tag: newestAlert.id,
      icon: '/apple-icon.png',
    });
  }, [alerts]);

  const login = (foundTeam: Team, memberName: string, role: TeamRole, isCaptain: boolean) => {
    const newSession: TeamSession = {
      teamId: foundTeam.id,
      teamName: foundTeam.name,
      teamCode: foundTeam.code,
      memberName,
      role,
      isCaptain,
    };

    setSession(newSession);
    setTeam(foundTeam);
    localStorage.setItem('teamSession', JSON.stringify(newSession));
  };

  const logout = () => {
    setSession(null);
    setTeam(null);
    setAlerts([]);
    localStorage.removeItem('teamSession');
  };

  const enableNotifications = async (): Promise<{ success: boolean; error?: string }> => {
    if (typeof Notification === 'undefined') {
      return { success: false, error: 'This browser does not support notifications.' };
    }

    const permission = await Notification.requestPermission();
    const allowed = permission === 'granted';
    setNotificationsAllowed(allowed);

    return allowed
      ? { success: true }
      : { success: false, error: 'Notifications were not allowed on this device.' };
  };

  const unreadAlerts = alerts.filter(a => !a.read).length;

  return (
    <TeamContext.Provider value={{ session, team, alerts, unreadAlerts, isLoading, notificationsAllowed, enableNotifications, login, logout }}>
      {children}
    </TeamContext.Provider>
  );
}

export function useTeam() {
  const context = useContext(TeamContext);
  if (context === undefined) {
    throw new Error('useTeam must be used within a TeamProvider');
  }
  return context;
}
