import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@/lib/supabase';

export type BattleStatus = 'live' | 'ended';

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
    status: 'live',
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
      status: (new Date(battle.ends_at).getTime() > Date.now() ? 'live' : 'ended') as BattleStatus,
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
