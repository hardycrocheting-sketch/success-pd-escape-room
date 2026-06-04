import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
  deleteDoc,
  limit,
  runTransaction,
} from 'firebase/firestore';
import type { DocumentData } from 'firebase/firestore';
import { db } from './firebase';
import { ROLE_LABELS, TEAM_ROLES } from './types';
import type { Team, Mission, Alert, ScheduledAlert, AppSettings, BonusCode, RoleProgress, RoleTask, TeamMember, TeamRole } from './types';

function normalizeNumber(value: unknown, fallback: number): number {
  const numberValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function normalizeDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate();
  }
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeDateMap(value: unknown): Record<string, Date> {
  if (!value || typeof value !== 'object') return {};

  return Object.entries(value as Record<string, unknown>).reduce<Record<string, Date>>((acc, [key, item]) => {
    const date = normalizeDate(item);
    if (date) acc[key] = date;
    return acc;
  }, {});
}

function normalizeNumberMap(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object') return {};

  return Object.entries(value as Record<string, unknown>).reduce<Record<string, number>>((acc, [key, item]) => {
    acc[key] = normalizeNumber(item, 0);
    return acc;
  }, {});
}

function normalizeStringArrayMap(value: unknown): Record<string, string[]> {
  if (!value || typeof value !== 'object') return {};

  return Object.entries(value as Record<string, unknown>).reduce<Record<string, string[]>>((acc, [key, item]) => {
    acc[key] = Array.isArray(item) ? item.map(String) : [];
    return acc;
  }, {});
}

function normalizeRole(value: unknown): TeamRole {
  return TEAM_ROLES.includes(value as TeamRole) ? value as TeamRole : 'investigator';
}

function normalizeMembers(value: unknown): TeamMember[] {
  if (!Array.isArray(value)) return [];

  return value.slice(0, 4).map((item, index) => {
    if (typeof item === 'string') {
      return {
        name: item,
        role: TEAM_ROLES[index] || 'investigator',
      };
    }

    const data = item && typeof item === 'object' ? item as Record<string, unknown> : {};
    return {
      name: typeof data.name === 'string' ? data.name : '',
      role: normalizeRole(data.role),
    };
  });
}

function normalizeRoleProgress(value: unknown): Record<string, Partial<Record<TeamRole, RoleProgress>>> {
  if (!value || typeof value !== 'object') return {};

  return Object.entries(value as Record<string, unknown>).reduce<Record<string, Partial<Record<TeamRole, RoleProgress>>>>((acc, [missionId, item]) => {
    if (!item || typeof item !== 'object') return acc;

    acc[missionId] = {};
    Object.entries(item as Record<string, unknown>).forEach(([roleKey, progressValue]) => {
      if (!TEAM_ROLES.includes(roleKey as TeamRole) || !progressValue || typeof progressValue !== 'object') return;
      const progress = progressValue as Record<string, unknown>;
      acc[missionId][roleKey as TeamRole] = {
        completed: Boolean(progress.completed),
        points: normalizeNumber(progress.points, 0),
        codePiece: typeof progress.codePiece === 'string' ? progress.codePiece : '',
        completedAt: normalizeDate(progress.completedAt) || undefined,
      };
    });

    return acc;
  }, {});
}

function serializeDateMap(value: Record<string, Date> | undefined): Record<string, Timestamp> {
  if (!value) return {};

  return Object.entries(value).reduce<Record<string, Timestamp>>((acc, [key, date]) => {
    acc[key] = Timestamp.fromDate(date);
    return acc;
  }, {});
}

function mapTeamDocument(docData: { id: string; data: () => DocumentData | undefined }): Team {
  const data = docData.data() || {};

  return {
    id: docData.id,
    name: typeof data.name === 'string' ? data.name : 'Unnamed Team',
    code: typeof data.code === 'string' ? data.code : '',
    captainName: typeof data.captainName === 'string' ? data.captainName : undefined,
    members: normalizeMembers(data.members),
    color: typeof data.color === 'string' ? data.color : null,
    currentMission: normalizeNumber(data.currentMission, 1),
    completedMissions: Array.isArray(data.completedMissions)
      ? data.completedMissions.map((missionId) => normalizeNumber(missionId, 0)).filter(Boolean)
      : [],
    score: normalizeNumber(data.score, 0),
    bonusPoints: normalizeNumber(data.bonusPoints, 0),
    roleProgress: normalizeRoleProgress(data.roleProgress),
    hintsUsed: normalizeNumberMap(data.hintsUsed),
    claimedBonusCodes: normalizeStringArrayMap(data.claimedBonusCodes),
    missionStartedAt: normalizeDateMap(data.missionStartedAt),
    missionCompletedAt: normalizeDateMap(data.missionCompletedAt),
    elapsedSeconds: normalizeNumber(data.elapsedSeconds, 0),
    createdAt: normalizeDate(data.createdAt) || new Date(),
  };
}

function mapRoleTaskDocument(docData: { id: string; data: () => DocumentData | undefined }): RoleTask {
  const data = docData.data() || {};

  return {
    id: docData.id,
    missionId: normalizeNumber(data.missionId, 1),
    role: normalizeRole(data.role),
    title: typeof data.title === 'string' ? data.title : '',
    instructions: typeof data.instructions === 'string' ? data.instructions : '',
    geniallyUrl: typeof data.geniallyUrl === 'string' ? data.geniallyUrl : '',
    taskCode: typeof data.taskCode === 'string' ? data.taskCode.trim().toUpperCase() : '',
    codePiece: typeof data.codePiece === 'string' ? data.codePiece.trim().toUpperCase() : '',
    points: normalizeNumber(data.points, 25),
    hint: typeof data.hint === 'string' ? data.hint : '',
    bonusCode: typeof data.bonusCode === 'string' ? data.bonusCode.trim().toUpperCase() : '',
    bonusPoints: normalizeNumber(data.bonusPoints, 0),
    createdAt: normalizeDate(data.createdAt) || new Date(),
  };
}

function mapMissionDocument(docData: { id: string; data: () => DocumentData | undefined }): Mission {
  const data = docData.data() || {};
  const id = normalizeNumber(data.id, parseInt(docData.id, 10));

  return {
    id,
    title: typeof data.title === 'string' ? data.title : `Mission ${id}`,
    description: typeof data.description === 'string' ? data.description : '',
    storyContext: typeof data.storyContext === 'string' ? data.storyContext : '',
    geniallyUrl: typeof data.geniallyUrl === 'string' ? data.geniallyUrl : '',
    correctAnswer: typeof data.correctAnswer === 'string' ? data.correctAnswer : '',
    answerKey: typeof data.answerKey === 'string' ? data.answerKey : undefined,
    points: normalizeNumber(data.points, 100),
    bonusPrompt: typeof data.bonusPrompt === 'string' ? data.bonusPrompt : '',
    locked: Boolean(data.locked),
    unlockAt: normalizeDate(data.unlockAt),
    nextMissionId: data.nextMissionId === null || data.nextMissionId === undefined ? null : normalizeNumber(data.nextMissionId, id + 1),
  };
}

function mapBonusCodeDocument(docData: { id: string; data: () => DocumentData | undefined }): BonusCode {
  const data = docData.data() || {};

  return {
    id: docData.id,
    missionId: normalizeNumber(data.missionId, 1),
    code: typeof data.code === 'string' ? data.code.trim().toUpperCase() : '',
    points: normalizeNumber(data.points, 0),
    label: typeof data.label === 'string' ? data.label : '',
    createdAt: normalizeDate(data.createdAt) || new Date(),
  };
}

function mapScheduledAlertDocument(docData: { id: string; data: () => DocumentData | undefined }): ScheduledAlert {
  const data = docData.data() || {};

  return {
    id: docData.id,
    teamId: typeof data.teamId === 'string' ? data.teamId : null,
    message: typeof data.message === 'string' ? data.message : '',
    type: ['info', 'hint', 'warning', 'success'].includes(data.type) ? data.type : 'info',
    sendAt: normalizeDate(data.sendAt) || new Date(),
    status: data.status === 'sent' ? 'sent' : 'pending',
    createdAt: normalizeDate(data.createdAt) || new Date(),
    sentAt: normalizeDate(data.sentAt),
  };
}

function mapAppSettings(data: DocumentData | undefined): AppSettings {
  return {
    countdownTarget: normalizeDate(data?.countdownTarget) || new Date('2026-05-29T15:30:00-04:00'),
    countdownLabel: typeof data?.countdownLabel === 'string' ? data.countdownLabel : 'Time Remaining',
    notificationsEnabled: Boolean(data?.notificationsEnabled),
  };
}

// Teams
export async function getTeamByCode(code: string): Promise<Team | null> {
  const teamsRef = collection(db, 'teams');
  const q = query(teamsRef, where('code', '==', code.toUpperCase()));
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) return null;
  
  return mapTeamDocument(snapshot.docs[0]);
}

export async function getAllTeams(): Promise<Team[]> {
  const teamsRef = collection(db, 'teams');
  const snapshot = await getDocs(teamsRef);
  
  return snapshot.docs.map(mapTeamDocument);
}

export async function createTeam(team: Omit<Team, 'id'>): Promise<string> {
  const teamsRef = collection(db, 'teams');
  const docRef = await addDoc(teamsRef, {
    ...team,
    captainName: team.captainName || '',
    members: team.members || [],
    color: team.color || null,
    bonusPoints: team.bonusPoints || 0,
    roleProgress: team.roleProgress || {},
    hintsUsed: team.hintsUsed || {},
    claimedBonusCodes: team.claimedBonusCodes || {},
    missionStartedAt: serializeDateMap(team.missionStartedAt),
    missionCompletedAt: serializeDateMap(team.missionCompletedAt),
    elapsedSeconds: team.elapsedSeconds || 0,
    createdAt: Timestamp.fromDate(team.createdAt),
  });
  return docRef.id;
}

// Generate a unique team code
export function generateTeamCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Check if team code exists
export async function isTeamCodeUnique(code: string): Promise<boolean> {
  const existing = await getTeamByCode(code);
  return existing === null;
}

// Register a new team with unique code
export async function registerTeam(
  name: string,
  captainName: string,
  members: TeamMember[],
  color: string | null
): Promise<{ teamId: string; teamCode: string }> {
  // Generate unique code
  let code = generateTeamCode();
  let attempts = 0;
  while (!(await isTeamCodeUnique(code)) && attempts < 10) {
    code = generateTeamCode();
    attempts++;
  }

  const teamId = await createTeam({
    name,
    code,
    captainName,
    members,
    color,
    currentMission: 1,
    completedMissions: [],
    score: 0,
    bonusPoints: 0,
    roleProgress: {},
    hintsUsed: {},
    claimedBonusCodes: {},
    missionStartedAt: {},
    missionCompletedAt: {},
    elapsedSeconds: 0,
    createdAt: new Date(),
  });

  return { teamId, teamCode: code };
}

export async function updateTeamProgress(
  teamId: string,
  currentMission: number,
  completedMissions: number[],
  score: number,
  missionCompletedAt?: Record<string, Date>,
  elapsedSeconds?: number
): Promise<void> {
  const teamRef = doc(db, 'teams', teamId);
  const payload: Record<string, string | number | number[] | Record<string, Timestamp>> = {
    currentMission: normalizeNumber(currentMission, 1),
    completedMissions: completedMissions.map((missionId) => normalizeNumber(missionId, 0)).filter(Boolean),
    score: normalizeNumber(score, 0),
  };

  if (missionCompletedAt) payload.missionCompletedAt = serializeDateMap(missionCompletedAt);
  if (typeof elapsedSeconds === 'number') payload.elapsedSeconds = normalizeNumber(elapsedSeconds, 0);

  await updateDoc(teamRef, payload);
}

export async function completeTeamMission(team: Team, mission: Mission): Promise<void> {
  const teamRef = doc(db, 'teams', team.id);

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(teamRef);
    const data = snapshot.data() || {};
    const completedMissions = Array.isArray(data.completedMissions)
      ? data.completedMissions.map((missionId) => normalizeNumber(missionId, 0)).filter(Boolean)
      : [];
    const alreadyCompleted = completedMissions.includes(mission.id);
    const completedAt = new Date();
    const startedAt = normalizeDate(data.missionStartedAt?.[String(mission.id)]) || completedAt;
    const addedSeconds = alreadyCompleted ? 0 : Math.max(0, Math.floor((completedAt.getTime() - startedAt.getTime()) / 1000));

    transaction.update(teamRef, {
      currentMission: normalizeNumber(mission.nextMissionId || mission.id, mission.id),
      completedMissions: Array.from(new Set([...completedMissions, mission.id])),
      score: normalizeNumber(data.score, 0) + (alreadyCompleted ? 0 : normalizeNumber(mission.points, 100)),
      elapsedSeconds: normalizeNumber(data.elapsedSeconds, 0) + addedSeconds,
      [`missionCompletedAt.${mission.id}`]: Timestamp.fromDate(completedAt),
    });
  });
}

export async function startTeamMission(team: Team, missionId: number): Promise<void> {
  if (team.missionStartedAt?.[String(missionId)]) return;

  const teamRef = doc(db, 'teams', team.id);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(teamRef);
    const data = snapshot.data();
    if (data?.missionStartedAt?.[String(missionId)]) return;

    transaction.update(teamRef, {
      [`missionStartedAt.${missionId}`]: Timestamp.fromDate(new Date()),
    });
  });
}

export async function resetTeamGame(teamId: string): Promise<void> {
  const teamRef = doc(db, 'teams', teamId);
  await updateDoc(teamRef, {
    currentMission: 1,
    completedMissions: [],
    score: 0,
    bonusPoints: 0,
    roleProgress: {},
    hintsUsed: {},
    claimedBonusCodes: {},
    missionStartedAt: {},
    missionCompletedAt: {},
    elapsedSeconds: 0,
  });
}

export async function claimMissionBonusCode(team: Team, mission: Mission, submittedCode: string): Promise<{ success: boolean; points?: number; label?: string; error?: string }> {
  const code = submittedCode.trim().toUpperCase();
  if (!code) return { success: false, error: 'Enter a bonus code.' };

  const bonusesRef = collection(db, 'bonusCodes');
  const bonusQuery = query(
    bonusesRef,
    where('missionId', '==', mission.id),
    where('code', '==', code),
    limit(1)
  );
  const bonusSnapshot = await getDocs(bonusQuery);
  const matchingBonus = bonusSnapshot.empty ? null : mapBonusCodeDocument(bonusSnapshot.docs[0]);
  if (!matchingBonus) return { success: false, error: 'That bonus code was not recognized for this mission.' };

  const missionKey = String(mission.id);
  const claimedForMission = team.claimedBonusCodes?.[missionKey] || [];
  if (claimedForMission.includes(code)) {
    return { success: false, error: 'Your team already claimed that bonus code.' };
  }

  const points = normalizeNumber(matchingBonus.points, 0);
  if (points <= 0) return { success: false, error: 'This bonus code does not have points configured.' };

  const teamRef = doc(db, 'teams', team.id);
  const transactionResult = await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(teamRef);
    const data = snapshot.data() || {};
    const currentClaimed = Array.isArray(data.claimedBonusCodes?.[missionKey])
      ? data.claimedBonusCodes[missionKey].map(String)
      : [];

    if (currentClaimed.includes(code)) {
      return { success: false as const, error: 'Your team already claimed that bonus code.' };
    }

    transaction.update(teamRef, {
      score: normalizeNumber(data.score, 0) + points,
      bonusPoints: normalizeNumber(data.bonusPoints, 0) + points,
      [`claimedBonusCodes.${missionKey}`]: [...currentClaimed, code],
    });

    return { success: true as const };
  });

  if (!transactionResult.success) return transactionResult;

  await sendAlert({
    teamId: team.id,
    message: `Bonus approved: +${points} points for ${mission.title}${matchingBonus.label ? ` (${matchingBonus.label})` : ''}.`,
    type: 'success',
    timestamp: new Date(),
    read: false,
  });

  return { success: true, points, label: matchingBonus.label };
}

export async function awardTeamBonus(team: Team, points: number): Promise<void> {
  const bonus = normalizeNumber(points, 0);
  if (!bonus) return;

  const teamRef = doc(db, 'teams', team.id);
  await updateDoc(teamRef, {
    score: normalizeNumber(team.score, 0) + bonus,
    bonusPoints: normalizeNumber(team.bonusPoints, 0) + bonus,
  });
}

export function subscribeToTeam(teamId: string, callback: (team: Team | null) => void) {
  const teamRef = doc(db, 'teams', teamId);
  return onSnapshot(teamRef, (snapshot) => {
    if (!snapshot.exists()) {
      callback(null);
      return;
    }
    callback(mapTeamDocument(snapshot));
  });
}

export function subscribeToAllTeams(callback: (teams: Team[]) => void) {
  const teamsRef = collection(db, 'teams');
  return onSnapshot(teamsRef, (snapshot) => {
    const teams = snapshot.docs.map(mapTeamDocument);
    callback(teams);
  }, (error) => {
    console.error('Firebase subscription error:', error);
    callback([]);
  });
}

// Missions
export async function getMission(missionId: number): Promise<Mission | null> {
  const missionRef = doc(db, 'missions', missionId.toString());
  const snapshot = await getDoc(missionRef);
  
  if (!snapshot.exists()) return null;
  
  return mapMissionDocument(snapshot);
}

export async function getAllMissions(): Promise<Mission[]> {
  const missionsRef = collection(db, 'missions');
  const snapshot = await getDocs(missionsRef);
  
  return snapshot.docs.map(mapMissionDocument);
}

export async function createMission(mission: Mission): Promise<void> {
  const missionRef = doc(db, 'missions', mission.id.toString());
  await setDoc(missionRef, {
    ...mission,
    unlockAt: mission.unlockAt ? Timestamp.fromDate(mission.unlockAt) : null,
  });
}

export async function updateMission(mission: Mission): Promise<void> {
  const missionRef = doc(db, 'missions', mission.id.toString());
  await updateDoc(missionRef, {
    ...mission,
    unlockAt: mission.unlockAt ? Timestamp.fromDate(mission.unlockAt) : null,
  });
}

export async function deleteMission(missionId: number): Promise<void> {
  const missionRef = doc(db, 'missions', missionId.toString());
  await deleteDoc(missionRef);
}

// Role tasks
export async function getRoleTask(missionId: number, role: TeamRole): Promise<RoleTask | null> {
  const taskRef = doc(db, 'roleTasks', `${missionId}_${role}`);
  const snapshot = await getDoc(taskRef);
  if (!snapshot.exists()) return null;
  return mapRoleTaskDocument(snapshot);
}

export function subscribeToRoleTasks(callback: (tasks: RoleTask[]) => void) {
  const tasksRef = collection(db, 'roleTasks');
  return onSnapshot(tasksRef, (snapshot) => {
    const tasks = snapshot.docs
      .map(mapRoleTaskDocument)
      .sort((a, b) => {
        if (a.missionId !== b.missionId) return a.missionId - b.missionId;
        return TEAM_ROLES.indexOf(a.role) - TEAM_ROLES.indexOf(b.role);
      });
    callback(tasks);
  }, (error) => {
    console.error('Role task subscription error:', error);
    callback([]);
  });
}

export function subscribeToMissionRoleTasks(missionId: number, callback: (tasks: RoleTask[]) => void) {
  const tasksRef = collection(db, 'roleTasks');
  const q = query(tasksRef, where('missionId', '==', missionId));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(mapRoleTaskDocument));
  }, (error) => {
    console.error('Mission role task subscription error:', error);
    callback([]);
  });
}

export async function upsertRoleTask(task: Omit<RoleTask, 'id' | 'createdAt'>): Promise<void> {
  const role = normalizeRole(task.role);
  const taskRef = doc(db, 'roleTasks', `${normalizeNumber(task.missionId, 1)}_${role}`);
  await setDoc(taskRef, {
    missionId: normalizeNumber(task.missionId, 1),
    role,
    title: task.title.trim(),
    instructions: task.instructions.trim(),
    geniallyUrl: task.geniallyUrl.trim(),
    taskCode: task.taskCode.trim().toUpperCase(),
    codePiece: task.codePiece.trim().toUpperCase(),
    points: normalizeNumber(task.points, 25),
    hint: task.hint.trim(),
    bonusCode: task.bonusCode.trim().toUpperCase(),
    bonusPoints: normalizeNumber(task.bonusPoints, 0),
    createdAt: Timestamp.fromDate(new Date()),
  }, { merge: true });
}

export async function submitRoleTask(team: Team, task: RoleTask, submittedCode: string, submittedBonus = ''): Promise<{ success: boolean; points?: number; error?: string }> {
  const code = submittedCode.trim().toUpperCase();
  const expected = task.taskCode.trim().toUpperCase();
  if (!code) return { success: false, error: 'Enter your role task code.' };
  if (!expected) return { success: false, error: 'This role does not have a task code configured yet.' };
  if (code !== expected) return { success: false, error: 'That role task code is not correct yet.' };

  const bonus = submittedBonus.trim().toUpperCase();
  const bonusPoints = bonus && task.bonusCode && bonus === task.bonusCode ? normalizeNumber(task.bonusPoints, 0) : 0;
  const points = normalizeNumber(task.points, 25) + bonusPoints;
  const missionKey = String(task.missionId);
  const role = normalizeRole(task.role);
  const teamRef = doc(db, 'teams', team.id);

  const result = await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(teamRef);
    const data = snapshot.data() || {};
    const alreadyCompleted = Boolean(data.roleProgress?.[missionKey]?.[role]?.completed);
    if (alreadyCompleted) return { success: false as const, error: 'This role has already completed the task.' };

    transaction.update(teamRef, {
      score: normalizeNumber(data.score, 0) + points,
      bonusPoints: normalizeNumber(data.bonusPoints, 0) + bonusPoints,
      [`roleProgress.${missionKey}.${role}`]: {
        completed: true,
        points,
        codePiece: task.codePiece,
        completedAt: Timestamp.fromDate(new Date()),
      },
    });

    return { success: true as const };
  });

  if (!result.success) return result;

  await sendAlert({
    teamId: team.id,
    message: `${team.name} ${role} task complete for Mission ${task.missionId}.`,
    type: 'success',
    timestamp: new Date(),
    read: false,
  });

  return { success: true, points };
}

export async function completeTeamMissionFromRoleProgress(team: Team, mission: Mission, submittedCode: string): Promise<{ success: boolean; error?: string }> {
  const expectedAnswer = (mission.answerKey || mission.correctAnswer || '').trim().toUpperCase();
  const submittedAnswer = submittedCode.trim().toUpperCase();
  if (!submittedAnswer) return { success: false, error: 'Enter the assembled team code.' };
  if (submittedAnswer !== expectedAnswer) return { success: false, error: 'That assembled team code is not correct.' };

  const missionProgress = team.roleProgress?.[String(mission.id)] || {};
  const missingRole = TEAM_ROLES.find((role) => !missionProgress[role]?.completed);
  if (missingRole) return { success: false, error: 'All four role tasks must be complete before the captain can submit.' };

  await completeTeamMission(team, mission);
  return { success: true };
}

// Bonus codes
export async function createBonusCode(bonus: Omit<BonusCode, 'id' | 'createdAt'>): Promise<string> {
  const bonusesRef = collection(db, 'bonusCodes');
  const docRef = await addDoc(bonusesRef, {
    missionId: normalizeNumber(bonus.missionId, 1),
    code: bonus.code.trim().toUpperCase(),
    points: normalizeNumber(bonus.points, 0),
    label: bonus.label?.trim() || '',
    createdAt: Timestamp.fromDate(new Date()),
  });
  return docRef.id;
}

export function subscribeToBonusCodes(callback: (bonuses: BonusCode[]) => void) {
  const bonusesRef = collection(db, 'bonusCodes');

  return onSnapshot(bonusesRef, (snapshot) => {
    const bonuses = snapshot.docs
      .map(mapBonusCodeDocument)
      .filter((bonus) => bonus.code)
      .sort((a, b) => {
        if (a.missionId !== b.missionId) return a.missionId - b.missionId;
        return a.code.localeCompare(b.code);
      });
    callback(bonuses);
  }, (error) => {
    console.error('Bonus code subscription error:', error);
    callback([]);
  });
}

export function subscribeToMissionBonusCodes(missionId: number, callback: (bonuses: BonusCode[]) => void) {
  const bonusesRef = collection(db, 'bonusCodes');
  const q = query(bonusesRef, where('missionId', '==', missionId));

  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(mapBonusCodeDocument).filter((bonus) => bonus.code));
  }, (error) => {
    console.error('Mission bonus code subscription error:', error);
    callback([]);
  });
}

export async function deleteBonusCode(bonusId: string): Promise<void> {
  const bonusRef = doc(db, 'bonusCodes', bonusId);
  await deleteDoc(bonusRef);
}

// Alerts
export async function sendAlert(alert: Omit<Alert, 'id'>): Promise<string> {
  const alertsRef = collection(db, 'alerts');
  const docRef = await addDoc(alertsRef, {
    ...alert,
    timestamp: Timestamp.fromDate(alert.timestamp),
  });
  return docRef.id;
}

export async function getAlertsForTeam(teamId: string): Promise<Alert[]> {
  const alertsRef = collection(db, 'alerts');
  const q = query(
    alertsRef,
    where('teamId', 'in', [teamId, null]),
    orderBy('timestamp', 'desc')
  );
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(docData => ({
    id: docData.id,
    ...docData.data(),
    timestamp: docData.data().timestamp?.toDate() || new Date(),
  })) as Alert[];
}

export function subscribeToAlerts(teamId: string, callback: (alerts: Alert[]) => void) {
  const alertsRef = collection(db, 'alerts');
  // Subscribe to all alerts and filter client-side for real-time updates
  return onSnapshot(alertsRef, (snapshot) => {
    const alerts = snapshot.docs
      .map(docData => {
        const data = docData.data();
        return {
          id: docData.id,
          teamId: typeof data.teamId === 'string' ? data.teamId : null,
          message: typeof data.message === 'string' ? data.message : '',
          type: ['info', 'hint', 'warning', 'success'].includes(data.type) ? data.type : 'info',
          timestamp: normalizeDate(data.timestamp) || new Date(),
          read: Boolean(data.read),
        } as Alert;
      })
      .filter(alert => alert.teamId === teamId || alert.teamId === null)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    callback(alerts);
  });
}

export async function markAlertAsRead(alertId: string): Promise<void> {
  const alertRef = doc(db, 'alerts', alertId);
  await updateDoc(alertRef, { read: true });
}

export async function deleteAlert(alertId: string): Promise<void> {
  const alertRef = doc(db, 'alerts', alertId);
  await deleteDoc(alertRef);
}

// Game settings
export async function getAppSettings(): Promise<AppSettings> {
  const settingsRef = doc(db, 'settings', 'game');
  const snapshot = await getDoc(settingsRef);
  return mapAppSettings(snapshot.data());
}

export function subscribeToAppSettings(callback: (settings: AppSettings) => void) {
  const settingsRef = doc(db, 'settings', 'game');
  return onSnapshot(settingsRef, (snapshot) => {
    callback(mapAppSettings(snapshot.data()));
  }, (error) => {
    console.error('Settings subscription error:', error);
    callback(mapAppSettings(undefined));
  });
}

export async function updateAppSettings(settings: AppSettings): Promise<void> {
  const settingsRef = doc(db, 'settings', 'game');
  await setDoc(settingsRef, {
    countdownTarget: Timestamp.fromDate(settings.countdownTarget),
    countdownLabel: settings.countdownLabel,
    notificationsEnabled: Boolean(settings.notificationsEnabled),
  }, { merge: true });
}

// Scheduled alerts
export async function createScheduledAlert(alert: Omit<ScheduledAlert, 'id' | 'status' | 'createdAt' | 'sentAt'>): Promise<string> {
  const scheduledRef = collection(db, 'scheduledAlerts');
  const docRef = await addDoc(scheduledRef, {
    teamId: alert.teamId,
    message: alert.message,
    type: alert.type,
    sendAt: Timestamp.fromDate(alert.sendAt),
    status: 'pending',
    createdAt: Timestamp.fromDate(new Date()),
    sentAt: null,
  });
  return docRef.id;
}

export function subscribeToScheduledAlerts(callback: (alerts: ScheduledAlert[]) => void) {
  const scheduledRef = collection(db, 'scheduledAlerts');
  const q = query(scheduledRef, orderBy('sendAt', 'asc'));

  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(mapScheduledAlertDocument));
  }, (error) => {
    console.error('Scheduled alert subscription error:', error);
    callback([]);
  });
}

export async function deleteScheduledAlert(alertId: string): Promise<void> {
  const scheduledRef = doc(db, 'scheduledAlerts', alertId);
  await deleteDoc(scheduledRef);
}

export async function processDueScheduledAlerts(): Promise<number> {
  const scheduledRef = collection(db, 'scheduledAlerts');
  const q = query(
    scheduledRef,
    where('status', '==', 'pending'),
    limit(50)
  );
  const snapshot = await getDocs(q);
  const now = Date.now();
  const dueDocs = snapshot.docs.filter((scheduledDoc) => mapScheduledAlertDocument(scheduledDoc).sendAt.getTime() <= now);

  await Promise.all(dueDocs.map(async (scheduledDoc) => {
    const scheduled = mapScheduledAlertDocument(scheduledDoc);
    if (!scheduled.message.trim()) return;

    await sendAlert({
      teamId: scheduled.teamId,
      message: scheduled.message,
      type: scheduled.type,
      timestamp: new Date(),
      read: false,
    });

    await updateDoc(doc(db, 'scheduledAlerts', scheduled.id), {
      status: 'sent',
      sentAt: Timestamp.fromDate(new Date()),
    });
  }));

  return dueDocs.length;
}

// Initialize sample data
export async function initializeSampleData(): Promise<void> {
  // Check if missions exist
  const missions = await getAllMissions();
  if (missions.length > 0) return;

  const sampleMissions: Mission[] = [
    {
      id: 1,
      title: 'The Enrollment Barrier',
      description: 'Help a 17-year-old transfer student complete enrollment despite missing documents, family stress, and instability.',
      storyContext: 'Enrollment is often the first opportunity to show families they are supported. Locate what is actually missing, identify the barriers, and rewrite outreach so it sounds supportive.',
      geniallyUrl: '',
      correctAnswer: 'SUPPORTED',
      points: 100,
      nextMissionId: 2,
    },
    {
      id: 2,
      title: 'The Student Who Stopped Logging In',
      description: 'Investigate why attendance and assignment submissions suddenly dropped.',
      storyContext: 'Students disengage for reasons we do not always see. Review login patterns, communication attempts, counselor notes, technology barriers, and stressors.',
      geniallyUrl: '',
      correctAnswer: 'RECONNECT',
      points: 100,
      nextMissionId: 3,
    },
    {
      id: 3,
      title: 'Family Communication Breakdown',
      description: 'Rebuild trust and improve communication with a struggling family.',
      storyContext: 'Connection changes outcomes. Rebuild the communication timeline, identify missed empathy opportunities, and choose realistic trust-building next steps.',
      geniallyUrl: '',
      correctAnswer: 'CONNECTION',
      points: 100,
      nextMissionId: 4,
    },
    {
      id: 4,
      title: 'The Student Balancing Parenthood and Graduation',
      description: 'Support a student trying to graduate while parenting and working.',
      storyContext: 'Small flexibility can change a student future. Reconstruct responsibilities, identify urgent supports, and design flexible learning and communication solutions.',
      geniallyUrl: '',
      correctAnswer: 'FLEXIBILITY',
      points: 100,
      nextMissionId: 5,
    },
    {
      id: 5,
      title: 'The Student Ready to Give Up',
      description: 'Help a student regain hope when graduation still feels impossible.',
      storyContext: 'Sometimes students need hope before they need academics. Review credits, identify barriers, and build a graduation recovery timeline.',
      geniallyUrl: '',
      correctAnswer: 'HOPE',
      points: 100,
      nextMissionId: 6,
    },
    {
      id: 6,
      title: 'Attendance Crisis Response',
      description: 'Help a student with chronic attendance struggles reconnect to school.',
      storyContext: 'Attendance problems are often symptoms of larger barriers. Analyze patterns, outside factors, intervention priorities, and support solutions.',
      geniallyUrl: '',
      correctAnswer: 'BARRIERS',
      points: 100,
      nextMissionId: 7,
    },
    {
      id: 7,
      title: 'Graduation Recovery Team Challenge',
      description: 'Bring departments together to support multiple at-risk students before deadlines close.',
      storyContext: 'Student success requires teamwork across every department. Review case files, prioritize interventions, assign support roles, and respond to crisis updates.',
      geniallyUrl: '',
      correctAnswer: 'TEAMWORK',
      points: 125,
      nextMissionId: 8,
    },
    {
      id: 8,
      title: 'Graduation Day Countdown',
      description: 'Complete final graduation approvals before commencement begins.',
      storyContext: 'The work staff does every day changes lives. Combine prior mission information, complete eligibility checks, and submit final recovery plans.',
      geniallyUrl: '',
      correctAnswer: 'CHANGESLIVES',
      points: 150,
      nextMissionId: null,
    },
  ];

  for (const mission of sampleMissions) {
    await createMission(mission);
  }

  const sampleBonusCodes = [
    { missionId: 1, code: 'DOCS10', points: 10, label: 'Located all enrollment documents' },
    { missionId: 2, code: 'LOGIN10', points: 10, label: 'Identified the login pattern' },
    { missionId: 3, code: 'TRUST10', points: 10, label: 'Rebuilt the communication timeline' },
    { missionId: 4, code: 'PLAN10', points: 10, label: 'Created a flexible weekly plan' },
    { missionId: 5, code: 'CREDITS10', points: 10, label: 'Built a credit recovery timeline' },
    { missionId: 6, code: 'PATTERN10', points: 10, label: 'Found the attendance pattern' },
    { missionId: 7, code: 'ROLES15', points: 15, label: 'Assigned realistic team roles' },
    { missionId: 8, code: 'APPROVED20', points: 20, label: 'Completed final graduation approvals' },
  ];

  await Promise.all(sampleBonusCodes.map(createBonusCode));

  // Create sample teams
  const sampleTeams = [
    { name: 'Team Alpha', code: 'TEAM1', captainName: 'Alpha Leader', color: '#00d4ff' },
    { name: 'Team Beta', code: 'TEAM2', captainName: 'Beta Leader', color: '#ffb800' },
    { name: 'Team Gamma', code: 'TEAM3', captainName: 'Gamma Leader', color: '#00ff88' },
  ];

  for (const team of sampleTeams) {
    const existing = await getTeamByCode(team.code);
    if (!existing) {
      await createTeam({
        name: team.name,
        code: team.code,
        captainName: team.captainName,
        members: TEAM_ROLES.map((role) => ({ role, name: ROLE_LABELS[role] })),
        color: team.color,
        currentMission: 1,
        completedMissions: [],
        score: 0,
        createdAt: new Date(),
      });
    }
  }
}
