import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@/lib/supabase';

/**
 * Battle lifecycle (SCRUM-34):
 * - open:   players join and submit entries; voting is not available yet
 * - active: entries are closed, everyone votes (second half of the battle time)
 * - ended:  voting is closed, the winner is decided
 *
 * The first half of the battle duration is for entries, the second half for voting.
 * Example: a 4-day battle has 2 days of entries, then 2 days of voting.
 */
export type BattleStatus = 'open' | 'active' | 'ended';

export const BATTLE_STATUS_LABELS: Record<BattleStatus, string> = {
  open: 'Open',
  active: 'Voting',
  ended: 'Ended',
};

type BattleTiming = { createdAt?: string; endsAt?: string };

function parseTime(value?: string) {
  const time = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(time) ? time : null;
}

/** Moment when entries close and voting starts (middle of the battle). */
export function getVotingStartsAt(battle: BattleTiming): number | null {
  const createdAt = parseTime(battle.createdAt);
  const endsAt = parseTime(battle.endsAt);
  if (createdAt === null || endsAt === null || endsAt <= createdAt) {
    return null;
  }
  return createdAt + (endsAt - createdAt) / 2;
}

/** Status of a battle at a given moment, worked out from its dates. */
export function getBattleStatus(battle: BattleTiming, now = Date.now()): BattleStatus {
  const endsAt = parseTime(battle.endsAt);
  if (endsAt === null) {
    // Battles without dates (old local data, demo cards) stay open.
    return 'open';
  }
  if (now >= endsAt) {
    return 'ended';
  }
  const votingStartsAt = getVotingStartsAt(battle);
  return votingStartsAt !== null && now >= votingStartsAt ? 'active' : 'open';
}

/** Time left until the current stage changes, e.g. "1d 4h", "5h 11m", "12m". */
export function getBattleTimeLeft(battle: BattleTiming, now = Date.now()): string | null {
  const status = getBattleStatus(battle, now);
  const target = status === 'open' ? getVotingStartsAt(battle) : status === 'active' ? parseTime(battle.endsAt) : null;
  if (target === null) {
    return null;
  }
  const minutes = Math.max(1, Math.ceil((target - now) / 60_000));
  const days = Math.floor(minutes / (24 * 60));
  const hours = Math.floor((minutes % (24 * 60)) / 60);
  const restMinutes = minutes % 60;
  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${restMinutes}m`;
  }
  return `${restMinutes}m`;
}

/** Short line for a battle card, e.g. "Entries close in 5h 11m". */
export function describeBattleStatus(battle: BattleTiming, now = Date.now()): string {
  const status = getBattleStatus(battle, now);
  const timeLeft = getBattleTimeLeft(battle, now);
  if (status === 'open') {
    return timeLeft ? `Entries close in ${timeLeft}` : 'Open for entries';
  }
  if (status === 'active') {
    return timeLeft ? `Voting ends in ${timeLeft}` : 'Voting';
  }
  return 'Ended';
}

export class BattleClosedError extends Error {
  constructor() {
    super('Entries for this battle are closed.');
    this.name = 'BattleClosedError';
  }
}

export type UserBattle = {
  id: string;
  owner: string;
  title: string;
  category: string;
  icon: string;
  rules: string;
  time: string;
  artworkUrl?: string;
  players: number;
  score: number;
  rank: number;
  status: BattleStatus;
  createdAt: string;
  endsAt?: string;
};

type MineData = {
  pinnedIds: string[];
  createdBattles: UserBattle[];
};

const storagePrefix = 'hamster-battle:mine:';
const localBattlesKey = 'hamster-battle:local-battles';

function storageKey(user: string) {
  return `${storagePrefix}${encodeURIComponent(user.trim().toLowerCase() || 'player')}`;
}

export async function addBattleEntry(battleId: string, artworkUri: string) {
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData.session?.user;
  if (!user || !isUuid(battleId)) {
    return artworkUri;
  }

  const { data: battleTiming, error: timingError } = await supabase
    .from('battles')
    .select('created_at, ends_at')
    .eq('id', battleId)
    .maybeSingle();
  if (timingError && !isSupabaseSetupError(timingError)) {
    throw timingError;
  }
  if (
    battleTiming &&
    getBattleStatus({ createdAt: battleTiming.created_at, endsAt: battleTiming.ends_at }) !== 'open'
  ) {
    throw new BattleClosedError();
  }

  const artworkPath = `${user.id}/entries/${Date.now()}.${artworkExtension(artworkUri)}`;
  const artworkResponse = await fetch(artworkUri);
  const artworkData = await artworkResponse.arrayBuffer();
  const { error: uploadError } = await supabase.storage
    .from('battle-artwork')
    .upload(artworkPath, artworkData, {
      upsert: false,
      contentType: artworkResponse.headers.get('content-type') ?? 'image/jpeg',
    });
  if (uploadError) {
    if (isSupabaseSetupError(uploadError)) {
      return artworkUri;
    }
    throw uploadError;
  }

  const { data: artworkUrlData } = supabase.storage.from('battle-artwork').getPublicUrl(artworkPath);
  const artworkUrl = artworkUrlData.publicUrl;
  const { error: entryError } = await supabase.from('battle_entries').insert({
    battle_id: battleId,
    creator_id: user.id,
    artwork_url: artworkUrl,
  });
  if (entryError) {
    if (isSupabaseSetupError(entryError)) {
      return artworkUri;
    }
    throw entryError;
  }

  return artworkUrl;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isSupabaseSetupError(error: { code?: string; message?: string }) {
  return error.code === 'PGRST205' || error.message?.toLowerCase().includes('bucket not found');
}

async function readMineData(user: string): Promise<MineData> {
  try {
    const value = await AsyncStorage.getItem(storageKey(user));
    if (!value) {
      return { pinnedIds: [], createdBattles: [] };
    }

    const parsed = JSON.parse(value) as Partial<MineData>;
    return {
      pinnedIds: Array.isArray(parsed.pinnedIds) ? parsed.pinnedIds : [],
      createdBattles: Array.isArray(parsed.createdBattles) ? parsed.createdBattles : [],
    };
  } catch {
    return { pinnedIds: [], createdBattles: [] };
  }
}

async function writeMineData(user: string, data: MineData) {
  await AsyncStorage.setItem(storageKey(user), JSON.stringify(data));
}

async function readLocalBattles(): Promise<UserBattle[]> {
  try {
    const value = await AsyncStorage.getItem(localBattlesKey);
    if (!value) {
      return [];
    }

    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeLocalBattle(battle: UserBattle) {
  const battles = await readLocalBattles();
  await AsyncStorage.setItem(
    localBattlesKey,
    JSON.stringify([battle, ...battles.filter((item) => item.id !== battle.id)])
  );
}

export async function getMineData(user: string) {
  return readMineData(user);
}

export async function renameMineData(previousUser: string, nextUser: string) {
  const previousKey = storageKey(previousUser);
  const nextKey = storageKey(nextUser);
  if (previousKey === nextKey) {
    return;
  }

  const previousValue = await AsyncStorage.getItem(previousKey);
  if (!previousValue) {
    return;
  }

  const previousData = await readMineData(previousUser);
  const nextData = await readMineData(nextUser);
  const previousBattleIds = new Set(previousData.createdBattles.map((battle) => battle.id));
  await writeMineData(nextUser, {
    pinnedIds: [...new Set([...previousData.pinnedIds, ...nextData.pinnedIds])],
    createdBattles: [
      ...previousData.createdBattles,
      ...nextData.createdBattles.filter((battle) => !previousBattleIds.has(battle.id)),
    ],
  });
  await AsyncStorage.removeItem(previousKey);
}

export async function setBattlePinned(user: string, battleId: string, pinned: boolean) {
  const data = await readMineData(user);
  const pinnedIds = new Set(data.pinnedIds);

  if (pinned) {
    pinnedIds.add(battleId);
  } else {
    pinnedIds.delete(battleId);
  }

  await writeMineData(user, { ...data, pinnedIds: [...pinnedIds] });
}

export async function saveCreatedBattle(user: string, battle: UserBattle) {
  const data = await readMineData(user);
  await writeMineData(user, {
    pinnedIds: data.pinnedIds,
    createdBattles: [battle, ...data.createdBattles.filter((item) => item.id !== battle.id)],
  });
  await writeLocalBattle(battle);
}

export type CreateBattleInput = {
  title: string;
  category: string;
  customCategory?: string;
  durationDays: number;
  artworkUri: string;
  owner: string;
};

function artworkExtension(uri: string) {
  const extension = uri.split('?')[0].split('.').pop()?.toLowerCase();
  return extension && /^[a-z0-9]+$/.test(extension) ? extension : 'jpg';
}

export async function createBattleWithEntry(input: CreateBattleInput): Promise<UserBattle | null> {
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData.session?.user;
  if (!user) {
    return null;
  }

  const durationDays = Math.min(7, Math.max(1, Math.round(input.durationDays)));
  const endsAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();
  const artworkPath = `${user.id}/${Date.now()}.${artworkExtension(input.artworkUri)}`;
  const artworkResponse = await fetch(input.artworkUri);
  const artworkData = await artworkResponse.arrayBuffer();
  const { error: uploadError } = await supabase.storage
    .from('battle-artwork')
    .upload(artworkPath, artworkData, { upsert: false, contentType: artworkResponse.headers.get('content-type') ?? 'image/jpeg' });
  if (uploadError) {
    throw uploadError;
  }

  const { data: artworkUrlData } = supabase.storage.from('battle-artwork').getPublicUrl(artworkPath);
  const { data: battleData, error: battleError } = await supabase
    .from('battles')
    .insert({
      owner_id: user.id,
      title: input.title.trim(),
      category: input.category,
      custom_category: input.customCategory?.trim() || null,
      duration_days: durationDays,
      ends_at: endsAt,
    })
    .select('id, created_at')
    .single();
  if (battleError) {
    throw battleError;
  }

  const { error: entryError } = await supabase.from('battle_entries').insert({
    battle_id: battleData.id,
    creator_id: user.id,
    artwork_url: artworkUrlData.publicUrl,
  });
  if (entryError) {
    throw entryError;
  }

  return {
    id: battleData.id,
    owner: input.owner,
    title: input.title.trim(),
    category: input.category,
    icon: categoryIcon(input.category),
    rules: input.customCategory?.trim() ?? '',
    time: `${durationDays} ${durationDays === 1 ? 'day' : 'days'}`,
    artworkUrl: artworkUrlData.publicUrl,
    players: 1,
    score: 0,
    rank: 0,
    status: 'open',
    createdAt: battleData.created_at,
    endsAt,
  };
}

export async function getSharedBattles(): Promise<UserBattle[]> {
  const localBattles = await readLocalBattles();
  const { data, error } = await supabase
    .from('battles')
    .select('id, title, category, custom_category, duration_days, created_at, ends_at, owner:profiles(nickname), battle_entries(artwork_url)')
    .order('created_at', { ascending: false });
  if (error) {
    if (error.code !== 'PGRST205') {
      console.error('Failed to load shared battles:', error);
    }
    return localBattles;
  }

  const remoteBattles: UserBattle[] = (data ?? []).map((battle) => {
    const owner = Array.isArray(battle.owner) ? battle.owner[0] : battle.owner;
    const entries = Array.isArray(battle.battle_entries) ? battle.battle_entries : [];
    const durationDays = Number(battle.duration_days);
    return {
      id: battle.id,
      owner: owner?.nickname ?? 'Player',
      title: battle.title,
      category: battle.category,
      icon: categoryIcon(battle.category),
      rules: battle.custom_category ?? '',
      time: `${durationDays} ${durationDays === 1 ? 'day' : 'days'}`,
      artworkUrl: entries[0]?.artwork_url,
      players: entries.length,
      score: 0,
      rank: 0,
      status: getBattleStatus({ createdAt: battle.created_at, endsAt: battle.ends_at }),
      createdAt: battle.created_at,
      endsAt: battle.ends_at,
    };
  });
  const remoteIds = new Set(remoteBattles.map((battle) => battle.id));
  return [...remoteBattles, ...localBattles.filter((battle) => !remoteIds.has(battle.id))];
}

function categoryIcon(category: string) {
  const icons: Record<string, string> = {
    Sport: '🏀',
    Sports: '🏀',
    Photo: '📷',
    Art: '🎨',
    Music: '🎵',
    Gaming: '🎮',
    Food: '🍔',
    Other: '✨',
  };
  return icons[category] ?? '✨';
}
