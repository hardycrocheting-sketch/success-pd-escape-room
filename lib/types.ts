export const TEAM_ROLES = ['investigator', 'analyst', 'communicator', 'pathfinder'] as const;

export type TeamRole = typeof TEAM_ROLES[number];

export const ROLE_LABELS: Record<TeamRole, string> = {
  investigator: 'Investigator',
  analyst: 'Analyst',
  communicator: 'Communicator',
  pathfinder: 'Pathfinder',
};

export interface TeamMember {
  name: string;
  role: TeamRole;
}

export interface RoleProgress {
  completed: boolean;
  points: number;
  codePiece?: string;
  completedAt?: Date;
}

export interface Team {
  id: string;
  name: string;
  code: string;
  captainName?: string;
  members?: TeamMember[];
  color?: string | null;
  currentMission: number;
  completedMissions: number[];
  score: number;
  bonusPoints?: number;
  roleProgress?: Record<string, Partial<Record<TeamRole, RoleProgress>>>;
  hintsUsed?: Record<string, number>;
  claimedBonusCodes?: Record<string, string[]>;
  missionStartedAt?: Record<string, Date>;
  missionCompletedAt?: Record<string, Date>;
  elapsedSeconds?: number;
  createdAt: Date;
}

export interface BonusCode {
  id: string;
  missionId: number;
  code: string;
  points: number;
  label?: string;
  createdAt?: Date;
}

export interface Mission {
  id: number;
  title: string;
  description: string;
  storyContext: string;
  geniallyUrl: string;
  correctAnswer: string;
  answerKey?: string; // Alternative to correctAnswer
  points?: number;
  bonusPrompt?: string;
  locked?: boolean;
  unlockAt?: Date | null;
  nextMissionId: number | null;
}

export interface RoleTask {
  id: string;
  missionId: number;
  role: TeamRole;
  title: string;
  instructions: string;
  geniallyUrl: string;
  taskCode: string;
  codePiece: string;
  points: number;
  hint: string;
  bonusCode: string;
  bonusPoints: number;
  createdAt?: Date;
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
  role?: TeamRole | 'captain';
}
