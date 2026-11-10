import AsyncStorage from '@react-native-async-storage/async-storage';

export type BattleStatus = 'live' | 'ended';

export type UserBattle = {
  id: string;
  owner: string;
  title: string;
  category: string;
  icon: string;
  rules: string;
  time: string;
  players: number;
  score: number;
  rank: number;
  status: BattleStatus;
  createdAt: string;
};

type MineData = {
  pinnedIds: string[];
  createdBattles: UserBattle[];
};

const storagePrefix = 'hamster-battle:mine:';

function storageKey(user: string) {
  return `${storagePrefix}${encodeURIComponent(user.trim().toLowerCase() || 'player')}`;
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
}
