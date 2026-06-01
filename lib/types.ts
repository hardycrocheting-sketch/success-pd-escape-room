export interface Team {
  id: string;
  name: string;
  code: string;
  captainName?: string;
  members?: string[];
  color?: string | null;
  currentMission: number;
  completedMissions: number[];
  score: number;
  bonusPoints?: number;
  hintsUsed?: Record<string, number>;
  claimedBonusCodes?: Record<string, string[]>;
  missionStartedAt?: Record<string, Date>;
  missionCompletedAt?: Record<string, Date>;
  elapsedSeconds?: number;
  createdAt: Date;
}

export interface BonusCode {
  code: string;
  points: number;
  label?: string;
}

export interface Mission {
  id: number;
  title: string;
  description: string;
  storyContext: string;
  geniallyUrl: string;
  correctAnswer: string;
  answerKey?: string; // Alternative to correctAnswer
  hints?: string[];
  hint?: string;
  points?: number;
  bonusCodes?: BonusCode[];
  bonusPrompt?: string;
  locked?: boolean;
  unlockAt?: Date | null;
  nextMissionId: number | null;
}

export interface Alert {
  id: string;
  teamId: string | null; // null for global alerts
  message: string;
  type: 'info' | 'hint' | 'warning' | 'success';
  timestamp: Date;
  read: boolean;
}

export interface ScheduledAlert {
  id: string;
  teamId: string | null;
  message: string;
  type: Alert['type'];
  sendAt: Date;
  status: 'pending' | 'sent';
  createdAt: Date;
  sentAt?: Date | null;
}

export interface AppSettings {
  countdownTarget: Date;
  countdownLabel: string;
  notificationsEnabled?: boolean;
}

export interface HintRequest {
  id: string;
  teamId: string;
  teamName: string;
  missionId: number;
  missionTitle: string;
  hintNumber: number;
  status: 'pending' | 'sent';
  createdAt: Date;
  sentAt?: Date | null;
}

export interface TeamSession {
  teamId: string;
  teamName: string;
  teamCode: string;
}
