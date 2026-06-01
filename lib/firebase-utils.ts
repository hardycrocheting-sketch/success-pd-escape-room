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
  increment,
  limit,
  runTransaction,
} from 'firebase/firestore';
import type { DocumentData } from 'firebase/firestore';
import { db } from './firebase';
import type { Team, Mission, Alert, HintRequest, ScheduledAlert, AppSettings, BonusCode } from './types';

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

function normalizeBonusCodes(value: unknown): BonusCode[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const data = item as Record<string, unknown>;
      const code = typeof data.code === 'string' ? data.code.trim().toUpperCase() : '';
      if (!code) return null;

      return {
        code,
        points: normalizeNumber(data.points, 0),
        label: typeof data.label === 'string' ? data.label : '',
      };
    })
    .filter((code): code is BonusCode => Boolean(code));
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
    members: Array.isArray(data.members) ? data.members : [],
    color: typeof data.color === 'string' ? data.color : null,
    currentMission: normalizeNumber(data.currentMission, 1),
    completedMissions: Array.isArray(data.completedMissions)
      ? data.completedMissions.map((missionId) => normalizeNumber(missionId, 0)).filter(Boolean)
      : [],
    score: normalizeNumber(data.score, 0),
    bonusPoints: normalizeNumber(data.bonusPoints, 0),
    hintsUsed: normalizeNumberMap(data.hintsUsed),
    claimedBonusCodes: normalizeStringArrayMap(data.claimedBonusCodes),
    missionStartedAt: normalizeDateMap(data.missionStartedAt),
    missionCompletedAt: normalizeDateMap(data.missionCompletedAt),
    elapsedSeconds: normalizeNumber(data.elapsedSeconds, 0),
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
    hints: Array.isArray(data.hints) ? data.hints.filter((hint) => typeof hint === 'string') : data.hint ? [String(data.hint)] : [],
    hint: typeof data.hint === 'string' ? data.hint : undefined,
    points: normalizeNumber(data.points, 100),
    bonusCodes: normalizeBonusCodes(data.bonusCodes),
    bonusPrompt: typeof data.bonusPrompt === 'string' ? data.bonusPrompt : '',
    locked: Boolean(data.locked),
    unlockAt: normalizeDate(data.unlockAt),
    nextMissionId: data.nextMissionId === null || data.nextMissionId === undefined ? null : normalizeNumber(data.nextMissionId, id + 1),
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
  members: string[],
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
  const payload: Record<string, unknown> = {
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

  const matchingBonus = mission.bonusCodes?.find((bonus) => bonus.code.toUpperCase() === code);
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
      .map(docData => ({
        id: docData.id,
        ...docData.data(),
        timestamp: docData.data().timestamp?.toDate() || new Date(),
      }))
      .filter(alert => alert.teamId === teamId || alert.teamId === null)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()) as Alert[];
    callback(alerts);
  });
}

export async function requestMissionHint(team: Team, mission: Mission): Promise<{ success: boolean; error?: string }> {
  const missionKey = String(mission.id);
  const used = team.hintsUsed?.[missionKey] || 0;
  const availableHints = mission.hints?.length || (mission.hint ? 1 : 0);

  if (used >= 3 || used >= availableHints) {
    return { success: false, error: 'No more hints are available for this mission.' };
  }

  const hintNumber = used + 1;
  const teamRef = doc(db, 'teams', team.id);
  const requestsRef = collection(db, 'hintRequests');

  await updateDoc(teamRef, {
    [`hintsUsed.${missionKey}`]: hintNumber,
    score: increment(-5),
  });

  await addDoc(requestsRef, {
    teamId: team.id,
    teamName: team.name,
    missionId: mission.id,
    missionTitle: mission.title,
    hintNumber,
    status: 'pending',
    createdAt: Timestamp.fromDate(new Date()),
    sentAt: null,
  });

  return { success: true };
}

function mapHintRequestDocument(docData: { id: string; data: () => DocumentData | undefined }): HintRequest {
  const data = docData.data() || {};

  return {
    id: docData.id,
    teamId: typeof data.teamId === 'string' ? data.teamId : '',
    teamName: typeof data.teamName === 'string' ? data.teamName : 'Unknown Team',
    missionId: normalizeNumber(data.missionId, 0),
    missionTitle: typeof data.missionTitle === 'string' ? data.missionTitle : 'Unknown Mission',
    hintNumber: normalizeNumber(data.hintNumber, 1),
    status: data.status === 'sent' ? 'sent' : 'pending',
    createdAt: normalizeDate(data.createdAt) || new Date(),
    sentAt: normalizeDate(data.sentAt),
  };
}

export function subscribeToHintRequests(callback: (requests: HintRequest[]) => void) {
  const requestsRef = collection(db, 'hintRequests');
  return onSnapshot(requestsRef, (snapshot) => {
    const requests = snapshot.docs
      .map(mapHintRequestDocument)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    callback(requests);
  }, (error) => {
    console.error('Hint request subscription error:', error);
    callback([]);
  });
}

export async function fulfillHintRequest(request: HintRequest, hintText: string): Promise<void> {
  await sendAlert({
    teamId: request.teamId,
    message: `Hint ${request.hintNumber} for ${request.missionTitle}: ${hintText}`,
    type: 'hint',
    timestamp: new Date(),
    read: false,
  });

  const requestRef = doc(db, 'hintRequests', request.id);
  await updateDoc(requestRef, {
    status: 'sent',
    sentAt: Timestamp.fromDate(new Date()),
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
      hints: ['Think about what families should feel during enrollment.', 'The emotional takeaway says families need this.', 'The answer is SUPPORTED.'],
      bonusCodes: [
        { code: 'DOCS10', points: 10, label: 'Located all enrollment documents' },
      ],
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
      hints: ['The mission is about bringing the student back into school.', 'The support plan should help the student do this.', 'The answer is RECONNECT.'],
      bonusCodes: [
        { code: 'LOGIN10', points: 10, label: 'Identified the login pattern' },
      ],
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
      hints: ['The emotional takeaway gives the key idea.', 'This word changes outcomes.', 'The answer is CONNECTION.'],
      bonusCodes: [
        { code: 'TRUST10', points: 10, label: 'Rebuilt the communication timeline' },
      ],
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
      hints: ['The student needs options that fit real life.', 'The emotional takeaway names the key support.', 'The answer is FLEXIBILITY.'],
      bonusCodes: [
        { code: 'PLAN10', points: 10, label: 'Created a flexible weekly plan' },
      ],
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
      hints: ['This comes before academics in the emotional takeaway.', 'It is what the student needs to believe graduation is possible.', 'The answer is HOPE.'],
      bonusCodes: [
        { code: 'CREDITS10', points: 10, label: 'Built a credit recovery timeline' },
      ],
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
      hints: ['Attendance is not usually the root problem.', 'The mission asks you to investigate what is underneath.', 'The answer is BARRIERS.'],
      bonusCodes: [
        { code: 'PATTERN10', points: 10, label: 'Found the attendance pattern' },
      ],
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
      hints: ['This mission brings every department together.', 'The emotional takeaway names what student success requires.', 'The answer is TEAMWORK.'],
      bonusCodes: [
        { code: 'ROLES15', points: 15, label: 'Assigned realistic team roles' },
      ],
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
      hints: ['The final emotional takeaway gives the phrase.', 'Use the last two words with no space.', 'The answer is CHANGESLIVES.'],
      bonusCodes: [
        { code: 'APPROVED20', points: 20, label: 'Completed final graduation approvals' },
      ],
      points: 150,
      nextMissionId: null,
    },
  ];

  for (const mission of sampleMissions) {
    await createMission(mission);
  }

  // Create sample teams
  const sampleTeams = [
    { name: 'Team Alpha', code: 'TEAM1', captainName: 'Alpha Leader', members: ['Member 1', 'Member 2'], color: '#00d4ff' },
    { name: 'Team Beta', code: 'TEAM2', captainName: 'Beta Leader', members: ['Member 1', 'Member 2'], color: '#ffb800' },
    { name: 'Team Gamma', code: 'TEAM3', captainName: 'Gamma Leader', members: ['Member 1', 'Member 2'], color: '#00ff88' },
  ];

  for (const team of sampleTeams) {
    const existing = await getTeamByCode(team.code);
    if (!existing) {
      await createTeam({
        name: team.name,
        code: team.code,
        captainName: team.captainName,
        members: team.members,
        color: team.color,
        currentMission: 1,
        completedMissions: [],
        score: 0,
        createdAt: new Date(),
      });
    }
  }
}
