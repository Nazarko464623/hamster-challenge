import { SymbolView } from 'expo-symbols';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ComponentRef,
} from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { PlayerSettings } from '@/components/player-settings';
import { getPlayerAvatar, getPlayerTags, removePlayerAvatar, savePlayerAvatar, savePlayerTags } from '@/lib/player-settings';
import { themeColor, useAppTheme, useThemedStyles } from '@/components/app-theme-provider';
import { addBattleEntry, getMineData, getSharedBattles, setBattlePinned, type UserBattle } from '@/lib/battles';
import {
  getDirectMessages,
  getMessagingSnapshot,
  markDirectMessagesRead,
  sendDirectMessage,
  subscribeToMessages,
  type ChatContact,
  type DirectMessage,
} from '@/lib/messages';
import { supabase } from '@/lib/supabase';

const feedTabs = [
  {
    id: 'challenges',
    label: 'Challenges',
    symbol: { ios: 'trophy', android: 'emoji_events', web: 'emoji_events' },
  },
  {
    id: 'home',
    label: 'Home',
  },
  {
    id: 'create',
    label: 'Create',
    symbol: { ios: 'plus', android: 'add', web: 'add' },
  },
  {
    id: 'messages',
    label: 'Messages',
  },
  {
    id: 'profile',
    label: 'Profile',
  },
] as const;

type FeedTabId = (typeof feedTabs)[number]['id'];
type BattleStatus = 'live' | 'ended' | 'mine';
type BattleCategory = 'All' | 'Sports' | 'Art' | 'Photo';

const battleCategories: BattleCategory[] = ['All', 'Sports', 'Art', 'Photo'];

const liveBattles = [
  {
    id: 'jump-rope-live',
    category: 'Sports',
    icon: '🏀',
    title: '30-second jump rope',
    time: '5h 11m',
    players: 87,
    score: 156,
    rank: 1,
  },
  {
    id: 'pixel-level-live',
    category: 'Gaming',
    icon: '🎮',
    title: 'Daily: a pixel level in 60 seconds',
    time: '20h 59m',
    players: 313,
    score: 77,
    rank: 1,
  },
  {
    id: 'photo-live',
    category: 'Photo',
    icon: '📷',
    title: 'Golden hour challenge',
    time: '1d 4h',
    players: 42,
    score: 42,
    rank: 3,
  },
  {
    id: 'pixel-art-live',
    category: 'Art',
    icon: '🎨',
    title: 'Daily pixel art challenge',
    time: '8h 24m',
    players: 64,
    score: 28,
    rank: 5,
  },
] as const;

const endedGames = [
  {
    id: 'lava-jump-ended',
    author: 'volod_hoops',
    time: '10m ago',
    challenge: 'Daily: a pixel level in 60 sec',
    title: 'Lava jump, level 1',
    votes: 77,
    comments: 0,
    artwork: '🎮',
    artworkColor: '#252525',
  },
  {
    id: 'jump-rope-ended',
    author: 'volod_hoops',
    time: '20m ago',
    challenge: '30-second jump rope',
    title: '30-second jump rope',
    votes: 156,
    comments: 3,
    artwork: '🏀',
    artworkColor: '#332416',
  },
] as const;

export default function FeedScreen() {
  const styles = useThemedStyles(baseStyles);
  const { mode } = useAppTheme();
  const [activeTab, setActiveTab] = useState<FeedTabId>('home');
  const [battleStatus, setBattleStatus] = useState<BattleStatus>('live');
  const [pinnedBattleIds, setPinnedBattleIds] = useState<string[]>([]);
  const [createdBattles, setCreatedBattles] = useState<UserBattle[]>([]);
  const [sharedBattles, setSharedBattles] = useState<UserBattle[]>([]);
  const [debugEndedBattleIds, setDebugEndedBattleIds] = useState<string[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [savedDisplayName, setSavedDisplayName] = useState<string | null>(null);
  const [userTags, setUserTags] = useState<string>('');
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { nickname } = useLocalSearchParams<{ nickname?: string }>();
  const displayName =
    savedDisplayName ??
    (typeof nickname === 'string' && nickname.trim() ? nickname.trim() : 'Player');

  useEffect(() => {
    let active = true;
    getPlayerTags(displayName).then((tags) => {
      if (active && tags) {
        setUserTags(tags);
      }
    });
    getPlayerAvatar(displayName).then((avatar) => {
      if (active && avatar) {
        setUserAvatar(avatar);
      }
    });
    supabase.auth.getUser().then(({ data }) => {
      const meta = data.user?.user_metadata;
      if (active && meta) {
        if (typeof meta.profile_tags === 'string' && meta.profile_tags) {
          setUserTags(meta.profile_tags);
          savePlayerTags(meta.profile_tags, displayName);
        }
        if (typeof meta.avatar_url === 'string' && meta.avatar_url) {
          setUserAvatar(meta.avatar_url);
          savePlayerAvatar(meta.avatar_url, displayName);
        }
      }
    });
    getMineData(displayName).then((data) => {
      if (active) {
        setPinnedBattleIds(data.pinnedIds);
        setCreatedBattles(data.createdBattles);
      }
    });
    getSharedBattles().then((battles) => {
      if (active) {
        setSharedBattles(battles);
      }
    });
    return () => {
      active = false;
    };
  }, [displayName]);

  const handlePickAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });

    if (!result.canceled && result.assets?.[0]?.uri) {
      const uri = result.assets[0].uri;
      setUserAvatar(uri);
      await savePlayerAvatar(uri, displayName);

      try {
        await supabase.auth.updateUser({
          data: { avatar_url: uri },
        });
      } catch (err) {
        console.warn('Could not sync avatar to supabase:', err);
      }
    }
  };

  const handleRemoveAvatar = async () => {
    setUserAvatar(null);
    await removePlayerAvatar(displayName);

    try {
      await supabase.auth.updateUser({
        data: { avatar_url: null },
      });
    } catch (err) {
      console.warn('Could not sync removed avatar to supabase:', err);
    }
  };

  const handleTabPress = (tabId: FeedTabId) => {
    if (tabId === 'create') {
      router.push({ pathname: '/create', params: { nickname: displayName } });
      return;
    }

    setActiveTab(tabId);
  };

  const handleJoinBattle = async (battleId: string, artworkUri: string) => {
    const artworkUrl = await addBattleEntry(battleId, artworkUri);
    setPinnedBattleIds((current) => [...new Set([...current, battleId])]);
    await setBattlePinned(displayName, battleId, true);
    setCreatedBattles((current) =>
      current.map((battle) =>
        battle.id === battleId ? { ...battle, players: battle.players + 1 } : battle
      )
    );
    setSharedBattles((current) =>
      current.map((battle) =>
        battle.id === battleId ? { ...battle, players: battle.players + 1 } : battle
      )
    );
    return artworkUrl;
  };

  return (
    <View style={styles.screen}>
      <StatusBar hidden />

      {activeTab === 'challenges' ? (
        <LeaderboardContent displayName={displayName} userAvatar={userAvatar} />
      ) : activeTab === 'messages' ? (
        <ChatContent displayName={displayName} userAvatar={userAvatar} />
      ) : activeTab === 'profile' ? (
        showSettings ? (
          <PlayerSettings
            displayName={displayName}
            initialTags={userTags}
            onClose={() => setShowSettings(false)}
            onNameSaved={setSavedDisplayName}
            onTagsSaved={setUserTags}
          />
        ) : (
          <ProfileContent
            displayName={displayName}
            tags={userTags}
            userAvatar={userAvatar}
            onPickAvatar={handlePickAvatar}
            onRemoveAvatar={handleRemoveAvatar}
            onOpenSettings={() => setShowSettings(true)}
          />
        )
      ) : (
        <HomeContent
          topInset={insets.top}
          status={battleStatus}
          onStatusChange={setBattleStatus}
          pinnedBattleIds={pinnedBattleIds}
          createdBattles={createdBattles}
          sharedBattles={sharedBattles}
          onJoinBattle={handleJoinBattle}
          debugEndedBattleIds={debugEndedBattleIds}
          onEndBattle={(battleId) => setDebugEndedBattleIds((current) => [...new Set([...current, battleId])])}
          onTogglePin={async (battleId, pinned) => {
            setPinnedBattleIds((current) =>
              pinned ? [...new Set([...current, battleId])] : current.filter((id) => id !== battleId)
            );
            await setBattlePinned(displayName, battleId, pinned);
          }}
          displayName={displayName}
          userAvatar={userAvatar}
        />
      )}

      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        {feedTabs.map((tab) => {
          const isActive = activeTab === tab.id;

          return (
            <Pressable
              key={tab.id}
              accessibilityRole="button"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: isActive }}
              onPress={() => handleTabPress(tab.id)}
              style={styles.tabButton}>
              {tab.id === 'create' ? (
                <View style={styles.createButton}>
                  <Svg width={34} height={34} viewBox="0 0 48 48" accessibilityLabel="Create">
                    <Path
                      d="M24 13v22M13 24h22"
                      fill="none"
                      stroke={mode === 'light' ? '#FFFFFF' : '#171717'}
                      strokeLinecap="round"
                      strokeWidth={3.5}
                    />
                  </Svg>
                </View>
              ) : (
                <LineIcon type={tab.id} active={isActive} />
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function isBattleLive(battle: UserBattle, now: number) {
  return battle.status === 'live' && (!battle.endsAt || new Date(battle.endsAt).getTime() > now);
}

function dedupeBattles(battles: UserBattle[]) {
  return [...new Map(battles.map((battle) => [battle.id, battle])).values()];
}

function UserAvatar({
  name,
  uri,
  size = 40,
  style,
}: {
  name: string;
  uri?: string | null;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { mode } = useAppTheme();
  const [loadFailed, setLoadFailed] = useState(false);
  const initial = (name.trim()[0] || 'P').toUpperCase();
  const fontSize = Math.round(size * 0.44);

  useEffect(() => {
    setLoadFailed(false);
  }, [uri]);

  if (uri && !loadFailed) {
    return (
      <Image
        key={uri}
        source={{ uri }}
        onError={() => setLoadFailed(true)}
        accessibilityLabel={`${name} avatar`}
        style={[
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: mode === 'light' ? '#E8F3FA' : '#202020',
          },
          style as StyleProp<ImageStyle>,
        ]}
      />
    );
  }

  const backgroundColor = mode === 'light' ? '#208AEF' : '#F28C28';
  const textColor = mode === 'light' ? '#FFFFFF' : '#1E1E1E';

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}>
      <Text
        style={{
          color: textColor,
          fontSize,
          fontWeight: '800',
          textAlign: 'center',
          includeFontPadding: false,
        }}>
        {initial}
      </Text>
    </View>
  );
}

function LeaderboardContent({
  displayName,
  userAvatar,
}: {
  displayName: string;
  userAvatar?: string | null;
}) {
  const styles = useThemedStyles(baseStyles);
  const { mode } = useAppTheme();
  const [period, setPeriod] = useState<'week' | 'all-time'>('week');
  const topPlayers =
    period === 'week'
      ? [
          { name: 'Emma', score: '2,840', rank: 2, color: themeColor('#FFC477', mode) },
          { name: 'Alex', score: '3,120', rank: 1, color: themeColor('#F28C28', mode) },
          { name: 'Dani', score: '2,610', rank: 3, color: '#A8A8A8' },
        ]
      : [
          { name: 'Mila', score: '12,840', rank: 2, color: themeColor('#FFC477', mode) },
          { name: 'Alex', score: '15,320', rank: 1, color: themeColor('#F28C28', mode) },
          { name: 'Dani', score: '11,610', rank: 3, color: '#A8A8A8' },
        ];
  const otherPlayers =
    period === 'week'
      ? [
          { name: 'Noah', score: '2,280' },
          { name: 'Mila', score: '2,040' },
          { name: 'Leo', score: '1,890' },
        ]
      : [
          { name: 'Noah', score: '10,280' },
          { name: 'Leo', score: '9,890' },
          { name: 'Sam', score: '8,640' },
        ];

  return (
    <ScrollView
      style={styles.contentScroll}
      contentContainerStyle={styles.leaderboardContent}
      showsVerticalScrollIndicator={false}>
      <View style={styles.pageHeading}>
        <Text style={styles.pageTitle}>Leaderboard</Text>
        <Text style={styles.pageSubtitle}>A little friendly competition</Text>
      </View>

      <View style={styles.periodSwitch}>
        <PeriodButton
          title="This week"
          selected={period === 'week'}
          onPress={() => setPeriod('week')}
        />
        <PeriodButton
          title="All time"
          selected={period === 'all-time'}
          onPress={() => setPeriod('all-time')}
        />
      </View>

      <View style={styles.podium}>
        {topPlayers.map((player) => (
          <View
            key={player.rank}
            style={[
              styles.podiumColumn,
              player.rank === 1 ? styles.winnerColumn : styles.runnerUpColumn,
            ]}>
            <View
              style={[
                styles.podiumAvatar,
                { backgroundColor: player.color },
                player.rank === 1 && styles.winnerAvatar,
              ]}>
              <Text style={styles.podiumInitial}>{player.name.slice(0, 1)}</Text>
            </View>
            <Text style={styles.podiumName} numberOfLines={1}>
              {player.name}
            </Text>
            <Text style={styles.podiumScore}>{player.score} pts</Text>
            <View
              style={[
                styles.podiumStep,
                player.rank === 1 ? styles.firstPlaceStep : styles.otherPlaceStep,
              ]}>
              <Text style={styles.podiumRank}>{player.rank}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.yourRankCard}>
        <View style={styles.rankNumber}>
          <Text style={styles.rankNumberText}>#12</Text>
        </View>
        <UserAvatar name={displayName} uri={userAvatar} size={38} style={{ marginRight: 10 }} />
        <View style={styles.rankPlayer}>
          <Text style={styles.rankPlayerName} numberOfLines={1}>
            {displayName} <Text style={styles.youLabel}>· You</Text>
          </Text>
          <Text style={styles.rankPlayerSubtext}>Keep playing to climb the board</Text>
        </View>
        <Text style={styles.rankPoints}>690 pts</Text>
      </View>

      <Text style={styles.listHeading}>Top players</Text>
      <View style={styles.rankingList}>
        {otherPlayers.map((player, index) => (
          <View key={player.name} style={styles.rankingRow}>
            <Text style={styles.rankingPlace}>{index + 4}</Text>
            <View style={styles.rankingAvatar}>
              <Text style={styles.rankingInitial}>{player.name.slice(0, 1)}</Text>
            </View>
            <Text style={styles.rankingName}>{player.name}</Text>
            <Text style={styles.rankingScore}>{player.score} pts</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function HomeContent({
  topInset,
  status,
  onStatusChange,
  pinnedBattleIds,
  createdBattles,
  sharedBattles,
  onTogglePin,
  onJoinBattle,
  debugEndedBattleIds,
  onEndBattle,
  displayName,
  userAvatar,
}: {
  topInset: number;
  status: BattleStatus;
  onStatusChange: (status: BattleStatus) => void;
  pinnedBattleIds: string[];
  createdBattles: UserBattle[];
  sharedBattles: UserBattle[];
  onTogglePin: (battleId: string, pinned: boolean) => void;
  onJoinBattle: (battleId: string, artworkUri: string) => Promise<string>;
  debugEndedBattleIds: string[];
  onEndBattle: (battleId: string) => void;
  displayName: string;
  userAvatar?: string | null;
}) {
  const styles = useThemedStyles(baseStyles);
  const [selectedCategory, setSelectedCategory] = useState<BattleCategory>('All');
  const [now, setNow] = useState(Date.now());
  const [participationBattle, setParticipationBattle] = useState<UserBattle | (typeof liveBattles)[number] | null>(null);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  const createdAndSharedBattles = dedupeBattles([...createdBattles, ...sharedBattles]);
  const userLiveBattles = createdAndSharedBattles.filter((battle) => isBattleLive(battle, now));
  const userEndedBattles = createdAndSharedBattles.filter((battle) => !isBattleLive(battle, now));
  const allKnownBattles = [...liveBattles, ...userLiveBattles];
  const allLiveBattles = allKnownBattles.filter((battle) => !debugEndedBattleIds.includes(battle.id));
  const debugEndedBattles = allKnownBattles.filter((battle) => debugEndedBattleIds.includes(battle.id));
  const visibleLiveBattles =
    selectedCategory === 'All'
      ? allLiveBattles
      : allLiveBattles.filter((battle) => battle.category === selectedCategory);
  const mineLiveBattles = [...liveBattles, ...userLiveBattles].filter(
    (battle) => pinnedBattleIds.includes(battle.id) && !debugEndedBattleIds.includes(battle.id)
  );
  const mineEndedGames = endedGames.filter((game) => pinnedBattleIds.includes(game.id));
  const mineBattlesCount = mineLiveBattles.length + mineEndedGames.length + createdBattles.length;

  const chooseParticipationArtwork = async (source: 'camera' | 'gallery') => {
    if (!participationBattle) {
      return;
    }

    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      return;
    }

    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
    if (result.canceled) {
      return;
    }

    try {
      await onJoinBattle(participationBattle.id, result.assets[0].uri);
      setParticipationBattle(null);
    } catch (error) {
      console.error('Failed to add battle entry:', error);
    }
  };

  return (
    <>
      <ScrollView
      style={styles.contentScroll}
      contentContainerStyle={[
        styles.battlesContent,
        { paddingTop: Math.max(topInset, 20) + 10 },
      ]}
      showsVerticalScrollIndicator={false}>
      <View style={styles.battlesHeader}>
        <View style={styles.battlesHeaderTitleRow}>
          <UserAvatar name={displayName} uri={userAvatar} size={36} />
          <Text style={styles.battlesTitle}>Battles</Text>
        </View>
        <View style={styles.battleStreakBadge}>
          <Text style={styles.battleStreakText}>🔥 4-day streak</Text>
        </View>
      </View>

      <View style={styles.battleFilters}>
        {(['live', 'ended', 'mine'] as const).map((filter) => {
          const selected = status === filter;
          const title = filter === 'live' ? 'Live' : filter === 'ended' ? 'Ended' : 'Mine';
          return (
            <Pressable
              key={filter}
              accessibilityRole="button"
              accessibilityLabel={`${title} battles`}
              accessibilityState={{ selected }}
              onPress={() => onStatusChange(filter)}
              style={[styles.battleFilter, selected && styles.selectedBattleFilter]}>
              <Text
                style={[
                  styles.battleFilterText,
                  selected && styles.selectedBattleFilterText,
                ]}>
                {title}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {status === 'live' && (
        <View style={styles.featuredBattle}>
          <PinButton
            pinned={pinnedBattleIds.includes('pixel-level-live')}
            onPress={() =>
              onTogglePin('pixel-level-live', !pinnedBattleIds.includes('pixel-level-live'))
            }
          />
          <Text style={styles.featuredBattleIcon}>⚡</Text>
          <View style={styles.featuredBattleDetails}>
            <Text style={styles.featuredBattleTitle}>Daily battle</Text>
            <Text style={styles.featuredBattleSubtitle}>
              a pixel level in 60 seconds · ends in 20h 59m
            </Text>
          </View>
        </View>
      )}

      {status === 'live' && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.battleCategoryFilters}>
          {battleCategories.map((category) => {
            const selected = selectedCategory === category;
            return (
              <Pressable
                key={category}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => setSelectedCategory(category)}
                style={[styles.battleCategoryFilter, selected && styles.selectedBattleCategoryFilter]}>
                {category === 'Sports' && <Text style={styles.battleCategoryFilterEmoji}>🏀</Text>}
                {category === 'Art' && <Text style={styles.battleCategoryFilterEmoji}>🎨</Text>}
                {category === 'Photo' && <Text style={styles.battleCategoryFilterEmoji}>📷</Text>}
                <Text
                  style={[
                    styles.battleCategoryFilterText,
                    selected && styles.selectedBattleCategoryFilterText,
                  ]}>
                  {category}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {status === 'live' && visibleLiveBattles.map((battle) => {
        const battleOwner = ('owner' in battle && typeof battle.owner === 'string' && battle.owner) ? battle.owner : 'Player';
        return (
        <View key={battle.id} style={styles.battleCard}>
          <PinButton
            pinned={pinnedBattleIds.includes(battle.id)}
            onPress={() => onTogglePin(battle.id, !pinnedBattleIds.includes(battle.id))}
          />
          <View style={styles.battleHeaderRow}>
            <View style={styles.battleCategory}>
              <Text style={styles.battleCategoryIcon}>{battle.icon}</Text>
              <Text style={styles.battleCategoryText}>{battle.category}</Text>
            </View>
            <View style={styles.battleCreatorBadge}>
              <UserAvatar
                name={battleOwner}
                uri={battleOwner === displayName ? userAvatar : undefined}
                size={22}
              />
              <Text style={styles.battleCreatorText}>{battleOwner}</Text>
            </View>
          </View>
          <Text style={styles.battleTitle}>{battle.title}</Text>
           {'artworkUrl' in battle && battle.artworkUrl && (
             <Image
               accessibilityLabel={`${battle.title} artwork`}
               source={{ uri: battle.artworkUrl }}
               style={styles.battleArtwork}
             />
           )}
           <Pressable
             accessibilityRole="button"
             accessibilityLabel={`Join ${battle.title}`}
             onPress={() => setParticipationBattle(battle)}
             style={({ pressed }) => [styles.joinButton, pressed && { opacity: 0.75 }]}>
             <Text style={styles.joinButtonText}>＋</Text>
           </Pressable>
          <View style={styles.battleMeta}>
            <Text style={styles.battleMetaText}>◷ {battle.time}</Text>
            <Text style={styles.battleMetaText}>{battle.players} players</Text>
            <Text style={styles.battleJoined}>✓ Joined</Text>
          </View>
           <Pressable
             accessibilityRole="button"
             accessibilityLabel={`End ${battle.title} for debugging`}
             onPress={() => onEndBattle(battle.id)}
             style={({ pressed }) => [styles.debugEndButton, pressed && { opacity: 0.75 }]}>
             <Text style={styles.debugEndButtonText}>End battle (debug)</Text>
           </Pressable>
        </View>
      );
      })}
      {status === 'ended' &&
        endedGames.map((game) => (
          <EndedGameCard
            key={game.id}
            game={game}
            displayName={displayName}
            userAvatar={userAvatar}
            pinned={pinnedBattleIds.includes(game.id)}
            onTogglePin={onTogglePin}
          />
        ))}
      {status === 'ended' && debugEndedBattles.map((battle) => (
        <View key={battle.id} style={styles.battleCard}>
          <Text style={styles.battleCategoryText}>Ended (debug)</Text>
          <Text style={styles.battleTitle}>{battle.title}</Text>
          <Text style={styles.battleMetaText}>This battle was ended manually for testing.</Text>
        </View>
      ))}
      {status === 'ended' && userEndedBattles.map((battle) => (
        <CreatedBattleCard
          key={battle.id}
          battle={battle}
          displayName={displayName}
          userAvatar={userAvatar}
          onTogglePin={onTogglePin}
        />
      ))}
      {status === 'mine' && mineBattlesCount === 0 && (
        <View style={styles.emptyMineCard}>
          <Text style={styles.emptyMineIcon}>📌</Text>
          <Text style={styles.emptyMineTitle}>Your Mine is empty</Text>
          <Text style={styles.emptyMineText}>Pin battles you want to find quickly, or create your own.</Text>
        </View>
      )}
      {status === 'mine' && mineLiveBattles.map((battle) => (
        <View key={battle.id} style={styles.battleCard}>
          <PinButton pinned onPress={() => onTogglePin(battle.id, false)} />
          <View style={styles.battleCategory}>
            <Text style={styles.battleCategoryIcon}>{battle.icon}</Text>
            <Text style={styles.battleCategoryText}>{battle.category}</Text>
          </View>
          <Text style={styles.battleTitle}>{battle.title}</Text>
          <View style={styles.battleMeta}>
            <Text style={styles.battleMetaText}>◷ {battle.time}</Text>
            <Text style={styles.battleMetaText}>{battle.players} players</Text>
          </View>
        </View>
      ))}
      {status === 'mine' && mineEndedGames.map((game) => (
        <EndedGameCard
          key={game.id}
          game={game}
          displayName={displayName}
          userAvatar={userAvatar}
          pinned
          onTogglePin={onTogglePin}
        />
      ))}
      {status === 'mine' && createdBattles.map((battle) => (
        <CreatedBattleCard
          key={battle.id}
          battle={battle}
          displayName={displayName}
          userAvatar={userAvatar}
          onTogglePin={onTogglePin}
        />
      ))}
      </ScrollView>

      <Modal
        animationType="fade"
        transparent
        visible={participationBattle !== null}
        onRequestClose={() => setParticipationBattle(null)}>
        <View style={styles.participationOverlay}>
          <View style={styles.participationSheet}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel joining battle"
              onPress={() => setParticipationBattle(null)}
              style={({ pressed }) => [styles.closeParticipationButton, pressed && { opacity: 0.75 }]}>
              <Text style={styles.closeParticipationText}>×</Text>
            </Pressable>
            <Text style={styles.participationTitle}>Add your entry</Text>
            <Text style={styles.participationSubtitle}>{participationBattle?.title}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Take entry photo"
              onPress={() => chooseParticipationArtwork('camera')}
              style={({ pressed }) => [styles.participationAction, pressed && { opacity: 0.75 }]}>
              <Text style={styles.participationActionIcon}>⌾</Text>
              <Text style={styles.participationActionText}>Camera</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Choose entry from gallery"
              onPress={() => chooseParticipationArtwork('gallery')}
              style={({ pressed }) => [styles.participationAction, pressed && { opacity: 0.75 }]}>
              <Text style={styles.participationActionIcon}>▧</Text>
              <Text style={styles.participationActionText}>Gallery</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

function EndedGameCard({
  game,
  pinned,
  displayName,
  userAvatar,
  onTogglePin,
}: {
  game: (typeof endedGames)[number];
  pinned: boolean;
  displayName: string;
  userAvatar?: string | null;
  onTogglePin: (battleId: string, pinned: boolean) => void;
}) {
  const styles = useThemedStyles(baseStyles);
  const { mode } = useAppTheme();
  const [hasVoted, setHasVoted] = useState(false);

  return (
    <View style={styles.endedGameCard}>
      <PinButton pinned={pinned} onPress={() => onTogglePin(game.id, !pinned)} />
      <View style={styles.endedAuthorRow}>
        <UserAvatar
          name={game.author}
          uri={game.author === displayName ? userAvatar : undefined}
          size={38}
        />
        <View style={styles.endedAuthorDetails}>
          <Text style={styles.endedAuthorName}>{game.author}</Text>
          <Text style={styles.endedTime}>{game.time}</Text>
        </View>
        <Text style={styles.endedChallenge} numberOfLines={1}>
          {game.challenge}
        </Text>
      </View>

      <View
        style={[
          styles.endedArtwork,
          { backgroundColor: themeColor(game.artworkColor, mode, 'backgroundColor') },
        ]}>
        <View style={styles.endedRankBadge}>
          <Text style={styles.endedRankText}>#1</Text>
        </View>
        <Text style={styles.endedArtworkEmoji}>{game.artwork}</Text>
      </View>

      <View style={styles.endedDetails}>
        <Text style={styles.endedTitle}>{game.title}</Text>
        <View style={styles.endedActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hasVoted ? 'Remove vote' : 'Vote'}
            accessibilityState={{ selected: hasVoted }}
            onPress={() => setHasVoted((voted) => !voted)}
            style={[styles.endedVoteButton, hasVoted && styles.endedVotedButton]}>
            <Text style={[styles.endedVoteText, hasVoted && styles.endedVotedText]}>
              ↑ Vote {game.votes + (hasVoted ? 1 : 0)}
            </Text>
          </Pressable>
          <View style={styles.endedCommentCount}>
            <SymbolView
              accessibilityLabel="Comments"
              name={{ ios: 'bubble.right', android: 'chat_bubble_outline', web: 'chat_bubble_outline' }}
              size={17}
              tintColor={themeColor('#888888', mode, 'tintColor')}
            />
            <Text style={styles.endedCommentText}>{game.comments}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function CreatedBattleCard({
  battle,
  displayName,
  userAvatar,
  onTogglePin,
}: {
  battle: UserBattle;
  displayName: string;
  userAvatar?: string | null;
  onTogglePin: (battleId: string, pinned: boolean) => void;
}) {
  const styles = useThemedStyles(baseStyles);
  return (
    <View style={styles.battleCard}>
      <PinButton pinned onPress={() => onTogglePin(battle.id, false)} />
      <View style={styles.battleCategory}>
        <Text style={styles.battleCategoryIcon}>{battle.icon}</Text>
        <Text style={styles.battleCategoryText}>{battle.category}</Text>
      </View>
      <Text style={styles.battleTitle}>{battle.title}</Text>
      {battle.artworkUrl && (
        <Image accessibilityLabel={`${battle.title} artwork`} source={{ uri: battle.artworkUrl }} style={styles.battleArtwork} />
      )}
      <View style={styles.battleCreatorRow}>
        <UserAvatar name={battle.owner || displayName} uri={userAvatar} size={28} />
        <Text style={styles.createdByText}>Created by you · {battle.time}</Text>
      </View>
      <Text style={styles.battleMetaText}>{battle.status === 'ended' ? 'Ended' : battle.rules || 'Open to everyone'}</Text>
    </View>
  );
}

function PinButton({ pinned, onPress }: { pinned: boolean; onPress: () => void }) {
  const styles = useThemedStyles(baseStyles);
  const { mode } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={pinned ? 'Unpin battle' : 'Pin battle'}
      accessibilityState={{ selected: pinned }}
      onPress={onPress}
      style={styles.pinButton}>
      <SymbolView
        name={{ ios: pinned ? 'pin.fill' : 'pin', android: 'push_pin', web: 'push_pin' }}
        size={18}
        tintColor={themeColor(pinned ? '#D96B0B' : '#999999', mode, 'tintColor')}
      />
    </Pressable>
  );
}

function PeriodButton({
  title,
  selected,
  onPress,
}: {
  title: string;
  selected: boolean;
  onPress: () => void;
}) {
  const styles = useThemedStyles(baseStyles);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.periodButton, selected && styles.selectedPeriodButton]}>
      <Text style={[styles.periodButtonText, selected && styles.selectedPeriodButtonText]}>
        {title}
      </Text>
    </Pressable>
  );
}

function ChatContent({
  displayName,
  userAvatar,
}: {
  displayName: string;
  userAvatar?: string | null;
}) {
  const styles = useThemedStyles(baseStyles);
  const { mode } = useAppTheme();
  const [activeAvatar, setActiveAvatar] = useState<string | null>(userAvatar ?? null);
  const [contactAvatars, setContactAvatars] = useState<Record<string, string | null>>({});
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [chatError, setChatError] = useState('');
  const selectedChatIdRef = useRef<string | null>(null);
  const messageListRef = useRef<ComponentRef<typeof ScrollView>>(null);

  useEffect(() => {
    if (userAvatar) {
      setActiveAvatar(userAvatar);
    } else {
      getPlayerAvatar(displayName).then((saved) => {
        if (saved) {
          setActiveAvatar(saved);
        }
      });
    }
  }, [userAvatar, displayName]);

  useEffect(() => {
    let active = true;
    contacts.forEach((contact) => {
      getPlayerAvatar(contact.name).then((avatar) => {
        if (active && avatar) {
          setContactAvatars((prev) => ({
            ...prev,
            [contact.name]: avatar,
            [contact.id]: avatar,
          }));
        }
      });
    });
    return () => {
      active = false;
    };
  }, [contacts]);

  useEffect(() => {
    selectedChatIdRef.current = selectedChatId;
  }, [selectedChatId]);

  const refreshMessagingData = useCallback(async () => {
    if (!userId) {
      return;
    }

    try {
      const nextContacts = await getMessagingSnapshot(userId);
      setContacts(nextContacts);
      const openContactId = selectedChatIdRef.current;
      if (openContactId) {
        const nextMessages = await getDirectMessages(userId, openContactId);
        if (selectedChatIdRef.current === openContactId) {
          setMessages(nextMessages);
        }
      }
      setError('');
    } catch (loadError) {
      console.error('Failed to refresh messages:', loadError);
      setError('Could not load messages. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data, error: authError }) => {
      if (!active) {
        return;
      }
      if (authError) {
        throw authError;
      }
      if (!data.user) {
        setError('Sign in to view and send messages.');
        setLoading(false);
        return;
      }
      setUserId(data.user.id);
    }).catch((authError: unknown) => {
      console.error('Failed to get the signed-in user for messages:', authError);
      if (active) {
        setError('Could not verify your account. Please sign in again.');
        setLoading(false);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!userId) {
      return;
    }

    void Promise.resolve().then(() => refreshMessagingData());
    const channel = subscribeToMessages(() => {
      void refreshMessagingData();
    });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [refreshMessagingData, userId]);

  useEffect(() => {
    if (!userId || !selectedChatId) {
      return;
    }

    let active = true;
    getDirectMessages(userId, selectedChatId)
      .then((nextMessages) => {
        if (active) {
          setMessages(nextMessages);
        }
      })
      .catch((loadError: unknown) => {
        console.error('Failed to load direct messages:', loadError);
        if (active) {
          setChatError('Could not load this conversation. Check your connection and try again.');
        }
      })
      .finally(() => {
        if (active) {
          setLoadingMessages(false);
        }
      });

    markDirectMessagesRead(userId, selectedChatId)
      .then(() => refreshMessagingData())
      .catch((readError: unknown) => {
        console.error('Failed to mark messages as read:', readError);
        if (active) {
          setChatError('Messages loaded, but unread status could not be updated.');
        }
      });

    return () => {
      active = false;
    };
  }, [refreshMessagingData, selectedChatId, userId]);

  const selectedConversation = contacts.find((contact) => contact.id === selectedChatId);

  const sendMessage = async () => {
    const text = draft.trim();
    if (!userId || !selectedChatId || !text || sending) {
      return;
    }

    setSending(true);
    setChatError('');
    try {
      const sentMessage = await sendDirectMessage(userId, selectedChatId, text);
      setMessages((current) =>
        current.some((message) => message.id === sentMessage.id)
          ? current
          : [...current, sentMessage]
      );
      setDraft('');
      await refreshMessagingData();
    } catch (sendError) {
      console.error('Failed to send direct message:', sendError);
      setChatError('Message could not be sent. Please try again.');
    } finally {
      setSending(false);
    }
  };

  if (selectedChatId) {
    const conversationName = selectedConversation?.name ?? 'Player';
    return (
      <View style={styles.chatScreen}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
          style={styles.chatKeyboard}>
          <View style={styles.chatHeader}>
            <View style={styles.chatHeaderLeft}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Back to messages"
                onPress={() => {
                  selectedChatIdRef.current = null;
                  setLoadingMessages(false);
                  setSelectedChatId(null);
                  setMessages([]);
                }}
                style={styles.chatBackButton}>
                <Text style={styles.chatBackArrow}>‹</Text>
              </Pressable>
              <UserAvatar
                name={conversationName}
                uri={
                  contactAvatars[conversationName] ??
                  (selectedConversation ? contactAvatars[selectedConversation.id] : undefined) ??
                  (conversationName.toLowerCase() === displayName.toLowerCase() ? activeAvatar : undefined)
                }
                size={40}
              />
              <View style={styles.chatHeaderInfo}>
                <Text style={styles.chatHeaderName}>{conversationName}</Text>
                <Text style={styles.chatOnline}>Direct messages</Text>
              </View>
            </View>
            <UserAvatar name={displayName} uri={activeAvatar} size={36} />
          </View>

          <ScrollView
            ref={messageListRef}
            style={styles.messageScroll}
            contentContainerStyle={styles.messageList}
            onContentSizeChange={() => messageListRef.current?.scrollToEnd({ animated: true })}
            showsVerticalScrollIndicator={false}>
            {loadingMessages ? <Text style={styles.chatStatus}>Loading conversation…</Text> : null}
            {!loadingMessages && messages.length === 0 ? (
              <Text style={styles.chatStatus}>Send a message to start the conversation.</Text>
            ) : null}
            {messages.map((message) => {
              const outgoing = Boolean(userId && message.senderId === userId);
              return (
                <View
                  key={message.id}
                  style={[
                    styles.messageLine,
                    outgoing ? styles.outgoingMessageLine : styles.incomingMessageLine,
                  ]}>
                  {!outgoing ? (
                    <UserAvatar
                      name={conversationName}
                      uri={
                        contactAvatars[conversationName] ??
                        contactAvatars[message.senderId] ??
                        (conversationName.toLowerCase() === displayName.toLowerCase() ? activeAvatar : undefined)
                      }
                      size={28}
                      style={{ marginRight: 8, alignSelf: 'flex-end', marginBottom: 2 }}
                    />
                  ) : null}
                  <View
                    style={[
                      styles.messageBubble,
                      outgoing ? styles.outgoingMessageBubble : styles.incomingMessageBubble,
                    ]}>
                    <Text
                      style={[
                        styles.messageText,
                        outgoing && styles.outgoingMessageText,
                      ]}>
                      {message.body}
                    </Text>
                    <Text
                      style={[
                        styles.messageTime,
                        outgoing && styles.outgoingMessageTime,
                      ]}>
                      {formatChatTime(message.createdAt)}
                    </Text>
                  </View>
                  {outgoing ? (
                    <UserAvatar
                      name={displayName}
                      uri={activeAvatar}
                      size={28}
                      style={{ marginLeft: 8, alignSelf: 'flex-end', marginBottom: 2 }}
                    />
                  ) : null}
                </View>
              );
            })}
          </ScrollView>

          {chatError ? <Text style={styles.chatError}>{chatError}</Text> : null}
          <View style={styles.composer}>
            <TextInput
              accessibilityLabel="Write a message"
              maxLength={4000}
              placeholder="Write a message..."
              placeholderTextColor={themeColor('#999999', mode)}
              returnKeyType="send"
              onChangeText={setDraft}
              onSubmitEditing={() => void sendMessage()}
              value={draft}
              style={styles.composerInput}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Send message"
              disabled={!draft.trim() || sending}
              onPress={() => void sendMessage()}
              style={[
                styles.sendButton,
                (!draft.trim() || sending) && styles.disabledSendButton,
              ]}>
              <Text
                style={[
                  styles.sendButtonText,
                  (!draft.trim() || sending) && styles.disabledSendButtonText,
                ]}>
                {sending ? '…' : '↑'}
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    );
  }

  const visibleConversations = contacts.filter((contact) => {
    const searchTerm = search.trim().toLowerCase();
    const matchesSearch =
      contact.name.toLowerCase().includes(searchTerm) ||
      contact.lastMessage.toLowerCase().includes(searchTerm);
    const matchesFilter = filter === 'all' || contact.unreadCount > 0;
    return matchesSearch && matchesFilter;
  });

  return (
    <ScrollView
      style={styles.contentScroll}
      contentContainerStyle={styles.chatListContent}
      showsVerticalScrollIndicator={false}>
      <View style={styles.pageHeading}>
        <View style={styles.chatHeaderTopRow}>
          <Text style={styles.pageTitle}>Messages</Text>
          <UserAvatar name={displayName} uri={activeAvatar} size={38} />
        </View>
        <Text style={styles.pageSubtitle}>Keep the conversation going</Text>
      </View>

      <View style={styles.chatSearch}>
        <SymbolView
          accessibilityLabel="Search messages"
          name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }}
          size={19}
          tintColor={themeColor('#F28C28', mode, 'tintColor')}
          style={styles.chatSearchIcon}
        />
        <TextInput
          accessibilityLabel="Search conversations"
          placeholder="Search messages"
          placeholderTextColor={themeColor('#999999', mode)}
          onChangeText={setSearch}
          style={styles.chatSearchInput}
          value={search}
        />
      </View>

      <View style={styles.chatFilters}>
        <PeriodButton
          title="All"
          selected={filter === 'all'}
          onPress={() => setFilter('all')}
        />
        <PeriodButton
          title="Unread"
          selected={filter === 'unread'}
          onPress={() => setFilter('unread')}
        />
      </View>

      <View style={styles.conversationList}>
        {loading ? (
          <Text style={styles.chatStatus}>Loading players and conversations…</Text>
        ) : error ? (
          <View style={styles.chatEmptyState}>
            <Text style={styles.chatError}>{error}</Text>
            {userId ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => void refreshMessagingData()}
                style={styles.retryButton}>
                <Text style={styles.retryButtonText}>Try again</Text>
              </Pressable>
            ) : null}
          </View>
        ) : visibleConversations.length === 0 ? (
          <Text style={styles.chatStatus}>
            {contacts.length === 0
              ? 'No other players have joined yet.'
              : filter === 'unread' && !search.trim()
                ? 'You have no unread messages.'
                : 'No players match your search.'}
          </Text>
        ) : (
          visibleConversations.map((conversation) => (
            <Pressable
              key={conversation.id}
              accessibilityRole="button"
              accessibilityLabel={`Open chat with ${conversation.name}`}
              onPress={() => {
                setChatError('');
                setDraft('');
                setMessages([]);
                setLoadingMessages(true);
                selectedChatIdRef.current = conversation.id;
                setSelectedChatId(conversation.id);
              }}
              style={styles.conversationRow}>
              <UserAvatar
                name={conversation.name}
                uri={
                  contactAvatars[conversation.name] ??
                  contactAvatars[conversation.id] ??
                  (conversation.name.toLowerCase() === displayName.toLowerCase() ? activeAvatar : undefined)
                }
                size={50}
              />
              <View style={styles.conversationInfo}>
                <View style={styles.conversationTopline}>
                  <Text style={styles.conversationName}>{conversation.name}</Text>
                  <Text style={styles.conversationTime}>
                    {conversation.lastMessageAt ? formatInboxTime(conversation.lastMessageAt) : ''}
                  </Text>
                </View>
                <View style={styles.conversationBottomline}>
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.conversationPreview,
                      conversation.unreadCount > 0 && styles.unreadPreview,
                    ]}>
                    {conversation.lastMessage || 'Start a conversation'}
                  </Text>
                  {conversation.unreadCount > 0 ? (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadBadgeText}>
                        {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </Pressable>
          ))
        )}
      </View>
    </ScrollView>
  );
}

function colorForName(name: string, mode: 'light' | 'dark') {
  const colors = ['#F28C28', '#A8A8A8', '#F5B565', '#888888', '#888888'];
  const colorIndex = name.split('').reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return themeColor(colors[colorIndex % colors.length], mode, 'backgroundColor');
}

function formatChatTime(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatInboxTime(timestamp: string) {
  const date = new Date(timestamp);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return formatChatTime(timestamp);
  }
  if (now.getTime() - date.getTime() < 7 * 24 * 60 * 60 * 1000) {
    return date.toLocaleDateString([], { weekday: 'short' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function LineIcon({ type, active }: { type: Exclude<FeedTabId, 'create'>; active: boolean }) {
  const { mode } = useAppTheme();
  const activeStroke = themeColor('#F28C28', mode);
  const activeFill = themeColor('#FFE6C7', mode, 'fill');
  const inactiveStroke = themeColor('#9F9F9F', mode);
  const bgColor = themeColor('#171717', mode, 'fill');
  const strokeWidth = 3;

  if (type === 'challenges') {
    if (active) {
      return (
        <Svg width={36} height={36} viewBox="129 38 38 38">
          <Path
            d="M138.5 39.3569V54.2855C138.5 56.8051 139.501 59.2214 141.282 61.003C143.064 62.7846 145.48 63.7855 148 63.7855C150.52 63.7855 152.936 62.7846 154.718 61.003C156.499 59.2214 157.5 56.8051 157.5 54.2855V39.3569H138.5Z"
            fill={activeFill}
          />
          <Path
            d="M148 63.7855V74.6426M148 74.6426H138.5M148 74.6426H157.5M138.5 39.3569H130.357V47.4998C130.357 49.6594 131.215 51.7306 132.742 53.2577C134.269 54.7847 136.341 55.6426 138.5 55.6426V39.3569ZM157.5 39.3569H165.643V47.4998C165.643 49.6594 164.785 51.7306 163.258 53.2577C161.731 54.7847 159.66 55.6426 157.5 55.6426V39.3569Z"
            fill="none"
            stroke={activeStroke}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={3}
          />
          <Path
            d="M138.5 39.3569V54.2855C138.5 56.8051 139.501 59.2214 141.282 61.003C143.064 62.7846 145.48 63.7855 148 63.7855C150.52 63.7855 152.936 62.7846 154.718 61.003C156.499 59.2214 157.5 56.8051 157.5 54.2855V39.3569H138.5Z"
            fill="none"
            stroke={activeStroke}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={3}
          />
        </Svg>
      );
    }
    return (
      <Svg width={36} height={36} viewBox="38.5 37.5 38 38">
        <Path
          d="M57.5004 61.6785V69.9642M57.5004 69.9642H50.2504M57.5004 69.9642H64.7504M50.2504 43.0356H44.0361V49.2499C44.0361 50.8981 44.6909 52.4787 45.8563 53.6441C47.0217 54.8095 48.6023 55.4642 50.2504 55.4642V43.0356ZM64.7504 43.0356H70.9647V49.2499C70.9647 50.8981 70.31 52.4787 69.1446 53.6441C67.9792 54.8095 66.3985 55.4642 64.7504 55.4642V43.0356Z"
          fill="none"
          stroke={inactiveStroke}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={3}
        />
        <Path
          d="M50.25 43.0356V54.4285C50.25 56.3513 51.0138 58.1954 52.3735 59.555C53.7331 60.9147 55.5772 61.6785 57.5 61.6785C59.4228 61.6785 61.2669 60.9147 62.6265 59.555C63.9862 58.1954 64.75 56.3513 64.75 54.4285V43.0356H50.25Z"
          fill="none"
          stroke={inactiveStroke}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={3}
        />
      </Svg>
    );
  }

  if (type === 'home') {
    if (active) {
      return (
        <Svg width={36} height={36} viewBox="133.5 36.5 38 38">
          <Path
            d="M135.553 55.4813V60.2151C135.553 66.4388 135.553 69.5506 137.486 71.4837C139.419 73.4168 142.531 73.4168 148.754 73.4168H156.298C162.522 73.4168 165.634 73.4168 167.567 71.4837C169.5 69.5506 169.5 66.4388 169.5 60.2151V55.4813C169.5 52.3091 169.5 50.7249 168.829 49.3519C168.157 47.9789 166.905 47.0058 164.404 45.0595L160.632 42.1268C156.738 39.0979 154.79 37.5835 152.526 37.5835C150.263 37.5835 148.315 39.0979 144.421 42.1268L140.649 45.0595C138.146 47.0058 136.896 47.9789 136.224 49.3519C135.553 50.7249 135.553 52.3091 135.553 55.4813Z"
            fill={activeFill}
            stroke={activeStroke}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
          />
          <Path
            d="M147.138 64.3911V71.6656H157.915V64.3911L154.682 61.9663H150.371L147.138 64.3911Z"
            fill={bgColor}
          />
          <Path
            d="M147.812 72.0697V65.4688C147.812 64.0638 147.812 63.3603 148.028 62.8021C148.189 62.3864 148.435 62.0089 148.75 61.6936C149.065 61.3783 149.442 61.1321 149.858 60.9708C150.418 60.7539 151.121 60.7539 152.526 60.7539C153.931 60.7539 154.635 60.7539 155.193 60.9708C155.609 61.1317 155.986 61.3775 156.302 61.6925C156.617 62.0074 156.863 62.3847 157.024 62.8002C157.241 63.3603 157.241 64.0638 157.241 65.4688V72.0697"
            fill="none"
            stroke={activeStroke}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
          />
        </Svg>
      );
    }
    return (
      <Svg width={36} height={36} viewBox="38.5 36.5 38 38">
        <Path
          d="M43.0527 55.4839V59.5204C43.0527 64.8274 43.0527 67.4809 44.7011 69.1293C46.3495 70.7777 49.003 70.7777 54.31 70.7777H60.7428C66.0498 70.7777 68.7033 70.7777 70.3517 69.1293C72.0001 67.4809 72.0001 64.8274 72.0001 59.5204V55.4839C72.0001 52.7789 72.0001 51.428 71.4276 50.2573C70.8551 49.0865 69.7872 48.2567 67.6548 46.597L64.4384 44.0963C61.1175 41.5135 59.4562 40.2222 57.5264 40.2222C55.5966 40.2222 53.9353 41.5135 50.6144 44.0963L47.3981 46.597C45.264 48.2567 44.1978 49.0865 43.6252 50.2573C43.0527 51.428 43.0527 52.7789 43.0527 55.4839Z"
          fill="none"
          stroke={inactiveStroke}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={3}
        />
        <Path
          d="M53.5059 69.6291V64.0004C53.5059 62.8023 53.5059 62.2025 53.6908 61.7265C53.828 61.3721 54.0376 61.0501 54.3062 60.7813C54.5748 60.5124 54.8965 60.3025 55.2507 60.1649C55.7284 59.98 56.3282 59.98 57.5263 59.98C58.7244 59.98 59.3243 59.98 59.8003 60.1649C60.1547 60.3021 60.4766 60.5117 60.7455 60.7803C61.0144 61.0489 61.2243 61.3706 61.3619 61.7249C61.5468 62.2025 61.5468 62.8023 61.5468 64.0004V69.6291"
          fill="none"
          stroke={inactiveStroke}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={3}
        />
      </Svg>
    );
  }

  if (type === 'messages') {
    if (active) {
      return (
        <Svg width={36} height={36} viewBox="125 38 38 38">
          <Path
            d="M143.995 39.52C140.833 39.5213 137.731 40.38 135.019 42.0046C132.307 43.6293 130.086 45.9591 128.593 48.746C127.1 51.5329 126.391 54.6725 126.541 57.8305C126.692 60.9884 127.695 64.0466 129.446 66.6792L126.515 74.48L136.332 72.7076C138.696 73.8617 141.289 74.4675 143.92 74.4798C146.55 74.4922 149.149 73.9108 151.524 72.7789C153.898 71.647 155.986 69.9939 157.633 67.9428C159.28 65.8916 160.442 63.4953 161.034 60.9324C161.625 58.3695 161.631 55.7061 161.05 53.1407C160.47 50.5752 159.317 48.174 157.68 46.1158C156.042 44.0576 153.961 42.3955 151.591 41.2535C149.222 40.1115 146.625 39.5189 143.995 39.52Z"
            fill={activeFill}
          />
          <Path
            d="M143.995 39.52C140.833 39.5213 137.731 40.38 135.019 42.0046C132.307 43.6293 130.086 45.9591 128.593 48.746C127.1 51.5329 126.391 54.6725 126.541 57.8305C126.692 60.9884 127.695 64.0466 129.446 66.6792L126.515 74.48L136.332 72.7076C139.029 74.0252 142.02 74.6261 145.017 74.4524C148.014 74.2786 150.915 73.3361 153.442 71.7156C155.969 70.0951 158.035 67.8513 159.443 65.2002C160.851 62.5491 161.553 59.5802 161.48 56.5793"
            fill="none"
            stroke={activeStroke}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={3}
          />
          <Path
            d="M154.857 52.9284C156.657 52.9284 158.383 52.2134 159.655 50.9409C160.928 49.6683 161.643 47.9423 161.643 46.1426C161.643 44.343 160.928 42.617 159.655 41.3444C158.383 40.0719 156.657 39.3569 154.857 39.3569C153.057 39.3569 151.331 40.0719 150.059 41.3444C148.786 42.617 148.071 44.343 148.071 46.1426C148.071 47.9423 148.786 49.6683 150.059 50.9409C151.331 52.2134 153.057 52.9284 154.857 52.9284Z"
            fill={bgColor}
            stroke={activeStroke}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={3}
          />
        </Svg>
      );
    }
    return (
      <Svg width={36} height={36} viewBox="36.5 38.5 38 38">
        <Path
          d="M55.3749 44.1245C52.9558 44.1255 50.5823 44.7825 48.5071 46.0256C46.4319 47.2688 44.7326 49.0514 43.5904 51.1838C42.4481 53.3162 41.9055 55.7185 42.0205 58.1348C42.1354 60.5512 42.9035 62.8911 44.243 64.9054L42 70.8743L49.512 69.5181C51.5756 70.5263 53.8642 70.9861 56.1571 70.8531C58.45 70.7202 60.6701 69.999 62.6034 68.7591C64.5368 67.5192 66.1182 65.8023 67.1955 63.7738C68.2727 61.7453 68.8094 59.4736 68.7539 57.1775"
          fill="none"
          stroke={inactiveStroke}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={3}
        />
        <Path
          d="M63.6863 54.3842C65.0633 54.3842 66.3839 53.8372 67.3576 52.8635C68.3314 51.8898 68.8784 50.5692 68.8784 49.1921C68.8784 47.8151 68.3314 46.4944 67.3576 45.5207C66.3839 44.547 65.0633 44 63.6863 44C62.3092 44 60.9886 44.547 60.0149 45.5207C59.0412 46.4944 58.4941 47.8151 58.4941 49.1921C58.4941 50.5692 59.0412 51.8898 60.0149 52.8635C60.9886 53.8372 62.3092 54.3842 63.6863 54.3842Z"
          fill="none"
          stroke={inactiveStroke}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={3}
        />
      </Svg>
    );
  }

  if (active) {
    return (
      <Svg width={36} height={36} viewBox="152 38 38 38">
        <Path
          d="M159.527 70.3174C160.733 68.3362 162.429 66.6987 164.451 65.5625C166.473 64.4262 168.753 63.8294 171.073 63.8295C175.963 63.8295 180.248 66.4247 182.618 70.3174C185.315 67.9663 187.23 64.8481 188.107 61.3796C188.984 57.911 188.781 54.2575 187.526 50.9073C186.27 47.5571 184.022 44.6699 181.082 42.6317C178.141 40.5936 174.649 39.5015 171.071 39.5015C167.494 39.5015 164.001 40.5936 161.061 42.6317C158.121 44.6699 155.873 47.5571 154.617 50.9073C153.362 54.2575 153.159 57.911 154.036 61.3796C154.913 64.8481 156.828 67.9663 159.524 70.3174M171.073 59.7746C172.865 59.7746 174.584 59.0625 175.852 57.7951C177.119 56.5277 177.831 54.8087 177.831 53.0163C177.831 51.224 177.119 49.505 175.852 48.2376C174.584 46.9701 172.865 46.2581 171.073 46.2581C169.28 46.2581 167.561 46.9701 166.294 48.2376C165.027 49.505 164.315 51.224 164.315 53.0163C164.315 54.8087 165.027 56.5277 166.294 57.7951C167.561 59.0625 169.28 59.7746 171.073 59.7746Z"
          fill={activeFill}
          clipRule="evenodd"
          fillRule="evenodd"
        />
        <Path
          d="M159.529 70.3176C160.736 68.3375 162.431 66.701 164.453 65.5654C166.474 64.4298 168.754 63.8334 171.072 63.8334C173.391 63.8334 175.671 64.4298 177.692 65.5654C179.714 66.701 181.409 68.3375 182.615 70.3176M171.072 59.7748C172.865 59.7748 174.584 59.0627 175.851 57.7953C177.119 56.5279 177.831 54.8089 177.831 53.0165C177.831 51.2241 177.119 49.5052 175.851 48.2377C174.584 46.9703 172.865 46.2583 171.072 46.2583C169.28 46.2583 167.561 46.9703 166.294 48.2377C165.026 49.5052 164.314 51.2241 164.314 53.0165C164.314 54.8089 165.026 56.5279 166.294 57.7953C167.561 59.0627 169.28 59.7748 171.072 59.7748Z"
          fill="none"
          stroke={activeStroke}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={3}
        />
        <Path
          d="M171.072 74.6428C175.733 74.6428 180.202 72.7915 183.497 69.4962C186.792 66.201 188.644 61.7316 188.644 57.0714C188.644 52.4112 186.792 47.9418 183.497 44.6465C180.202 41.3513 175.733 39.5 171.072 39.5C166.412 39.5 161.943 41.3513 158.648 44.6465C155.352 47.9418 153.501 52.4112 153.501 57.0714C153.501 61.7316 155.352 66.201 158.648 69.4962C161.943 72.7915 166.412 74.6428 171.072 74.6428Z"
          fill="none"
          stroke={activeStroke}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={3}
        />
      </Svg>
    );
  }

  return (
    <Svg width={36} height={36} viewBox="38 45 38 38">
      <Path
        d="M47.9229 74.5708C48.879 73.0013 50.2229 71.7041 51.8252 70.804C53.4275 69.9039 55.2345 69.4311 57.0723 69.4311C58.9101 69.4311 60.7171 69.9039 62.3194 70.804C63.9217 71.7041 65.2656 73.0013 66.2218 74.5708M57.0723 66.2141C58.493 66.2141 59.8555 65.6498 60.8601 64.6452C61.8647 63.6406 62.4291 62.278 62.4291 60.8573C62.4291 59.4366 61.8647 58.0741 60.8601 57.0695C59.8555 56.0649 58.493 55.5005 57.0723 55.5005C55.6516 55.5005 54.2891 56.0649 53.2845 57.0695C52.2799 58.0741 51.7155 59.4366 51.7155 60.8573C51.7155 62.278 52.2799 63.6406 53.2845 64.6452C54.2891 65.6498 55.6516 66.2141 57.0723 66.2141Z"
        fill="none"
        stroke={inactiveStroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={3}
      />
      <Path
        d="M57.0723 77.999C60.7661 77.999 64.3087 76.5316 66.9207 73.9197C69.5326 71.3077 71 67.7652 71 64.0713C71 60.3774 69.5326 56.8349 66.9207 54.2229C64.3087 51.6109 60.7661 50.1436 57.0723 50.1436C53.3784 50.1436 49.8358 51.6109 47.2239 54.2229C44.6119 56.8349 43.1445 60.3774 43.1445 64.0713C43.1445 67.7652 44.6119 71.3077 47.2239 73.9197C49.8358 76.5316 53.3784 77.999 57.0723 77.999Z"
        fill="none"
        stroke={inactiveStroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={3}
      />
    </Svg>
  );
}

function SettingsIcon({ color, size = 24 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 30 30" fill="none">
      <Path
        d="M3.75 6.25H8.75M26.25 6.25H13.75M3.75 15H18.75M26.25 15H23.75M3.75 23.75H6.25M26.25 23.75H11.25"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Path
        d="M13.75 6.25C13.75 7.63071 12.6307 8.75 11.25 8.75C9.86929 8.75 8.75 7.63071 8.75 6.25C8.75 4.86929 9.86929 3.75 11.25 3.75C12.6307 3.75 13.75 4.86929 13.75 6.25Z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Path
        d="M23.75 15C23.75 16.3807 22.6307 17.5 21.25 17.5C19.8693 17.5 18.75 16.3807 18.75 15C18.75 13.6193 19.8693 12.5 21.25 12.5C22.6307 12.5 23.75 13.6193 23.75 15Z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Path
        d="M11.25 23.75C11.25 25.1307 10.1307 26.25 8.75 26.25C7.36929 26.25 6.25 25.1307 6.25 23.75C6.25 22.3693 7.36929 21.25 8.75 21.25C10.1307 21.25 11.25 22.3693 11.25 23.75Z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function ProfileContent({
  displayName,
  tags,
  userAvatar,
  onPickAvatar,
  onRemoveAvatar,
  onOpenSettings,
}: {
  displayName: string;
  tags: string;
  userAvatar?: string | null;
  onPickAvatar: () => void;
  onRemoveAvatar: () => void;
  onOpenSettings: () => void;
}) {
  const styles = useThemedStyles(baseStyles);
  const { mode } = useAppTheme();
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);

  const handleAvatarPress = () => {
    if (userAvatar) {
      setShowAvatarMenu(true);
    } else {
      onPickAvatar();
    }
  };

  return (
    <>
      <ScrollView
        style={styles.profileScroll}
        contentContainerStyle={styles.profileContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.profileHeader}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Change profile avatar"
            onPress={handleAvatarPress}
            style={styles.avatarPressable}>
            <View style={styles.avatarRing}>
              <UserAvatar name={displayName} uri={userAvatar} size={96} />
            </View>
            <View style={styles.avatarEditBadge}>
              <SymbolView
                accessibilityLabel="Change photo"
                name={{ ios: 'camera.fill', android: 'photo_camera', web: 'photo_camera' }}
                size={15}
                tintColor={mode === 'light' ? '#FFFFFF' : '#171717'}
              />
            </View>
          </Pressable>
        <Text style={styles.profileName} numberOfLines={1}>
          {displayName}
        </Text>
        {tags ? <Text style={styles.profileTags}>{tags}</Text> : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open settings"
          hitSlop={6}
          onPress={onOpenSettings}
          style={({ pressed }) => [styles.settingsButton, pressed && styles.settingsButtonPressed]}>
          <SettingsIcon color={themeColor('#F28C28', mode)} size={24} />
        </Pressable>
      </View>

      <View style={styles.levelCard}>
        <View style={styles.levelHeader}>
          <Text style={styles.levelTitle}>Level 3</Text>
          <View style={styles.streakBadge}>
            <SymbolView
              accessibilityLabel="Streak"
              name={{ ios: 'flame.fill', android: 'local_fire_department', web: 'local_fire_department' }}
              size={22}
              tintColor={themeColor('#F28C28', mode, 'tintColor')}
              style={styles.streakIcon}
            />
            <Text style={styles.streakText}>4-day streak</Text>
          </View>
        </View>
        <View
          accessibilityRole="progressbar"
          accessibilityLabel="Level progress"
          accessibilityValue={{ min: 0, max: 1000, now: 690 }}
          style={styles.progressTrack}>
          <View style={styles.progressFill} />
        </View>
        <Text style={styles.levelDescription}>
          690 / 1000 xp vote, join and create to level up
        </Text>
      </View>

      <View style={styles.statsRow}>
        <ProfileStat value="12" label="Followers" />
        <ProfileStat value="7" label="Votes cast" />
        <ProfileStat value="1" label="Wins" />
      </View>

      <View style={styles.profileSectionHeader}>
        <Text style={styles.profileSectionTitle}>Achievements</Text>
        <Text style={styles.achievementCount}>2 of 4 unlocked</Text>
      </View>
      <View style={styles.achievementsCard}>
        <AchievementBadge
          icon={{ ios: 'hand.thumbsup.fill', android: 'thumb_up', web: 'thumb_up' }}
          label="First vote"
          unlocked
        />
        <AchievementBadge
          icon={{ ios: 'trophy.fill', android: 'emoji_events', web: 'emoji_events' }}
          label="First win"
          unlocked
        />
        <AchievementBadge
          icon={{ ios: 'person.3.fill', android: 'groups', web: 'groups' }}
          label="10 votes"
        />
        <AchievementBadge
          icon={{ ios: 'flame.fill', android: 'local_fire_department', web: 'local_fire_department' }}
          label="7-day streak"
        />
      </View>

      <View style={styles.pinnedPhotosHeader}>
        <Text style={styles.profileSectionTitle}>Pinned photos</Text>
        <SymbolView
          accessibilityLabel="Pinned photos"
          name={{ ios: 'pin.fill', android: 'push_pin', web: 'push_pin' }}
          size={18}
          tintColor={themeColor('#F28C28', mode, 'tintColor')}
          style={styles.pinnedIcon}
        />
      </View>
      <View style={styles.pinnedPhotosCard}>
        <View style={styles.pinnedPhotosIconWrap}>
          <SymbolView
            accessibilityLabel="Photo collection"
            name={{ ios: 'photo.on.rectangle.angled', android: 'photo_library', web: 'photo_library' }}
            size={28}
            tintColor={themeColor('#F28C28', mode, 'tintColor')}
            style={styles.pinnedPhotosIcon}
          />
        </View>
        <Text style={styles.pinnedPhotosTitle}>Your best moments, on display</Text>
        <Text style={styles.pinnedPhotosDescription}>
          Pin your favorite entry photos here when they’re ready to share.
        </Text>
      </View>
    </ScrollView>

    <Modal
      animationType="fade"
      transparent
      visible={showAvatarMenu}
      onRequestClose={() => setShowAvatarMenu(false)}>
      <Pressable
        style={styles.participationOverlay}
        onPress={() => setShowAvatarMenu(false)}>
        <Pressable style={styles.participationSheet} onPress={(e) => e.stopPropagation()}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close photo menu"
            onPress={() => setShowAvatarMenu(false)}
            style={({ pressed }) => [styles.closeParticipationButton, pressed && { opacity: 0.75 }]}>
            <Text style={styles.closeParticipationText}>×</Text>
          </Pressable>
          <Text style={styles.participationTitle}>Profile photo</Text>
          <Text style={styles.participationSubtitle}>{displayName}</Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Choose new photo from gallery"
            onPress={() => {
              setShowAvatarMenu(false);
              onPickAvatar();
            }}
            style={({ pressed }) => [styles.participationAction, pressed && { opacity: 0.75 }]}>
            <SymbolView
              name={{ ios: 'photo.on.rectangle', android: 'photo_library', web: 'photo_library' }}
              size={22}
              tintColor={mode === 'light' ? '#208AEF' : '#F28C28'}
            />
            <Text style={styles.participationActionText}>Choose from gallery</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Remove photo"
            onPress={() => {
              setShowAvatarMenu(false);
              onRemoveAvatar();
            }}
            style={({ pressed }) => [styles.participationAction, pressed && { opacity: 0.75 }]}>
            <SymbolView
              name={{ ios: 'trash.fill', android: 'delete', web: 'delete' }}
              size={22}
              tintColor="#E53935"
            />
            <Text style={[styles.participationActionText, { color: '#E53935' }]}>Remove photo</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  </>
  );
}

function AchievementBadge({
  icon,
  label,
  unlocked = false,
}: {
  icon: ComponentProps<typeof SymbolView>['name'];
  label: string;
  unlocked?: boolean;
}) {
  const styles = useThemedStyles(baseStyles);
  const { mode } = useAppTheme();
  return (
    <View
      accessibilityLabel={`${label}, ${unlocked ? 'unlocked' : 'locked'}`}
      style={styles.achievementBadge}>
      <View
        style={[
          styles.achievementIconWrap,
          unlocked ? styles.unlockedAchievement : styles.lockedAchievement,
        ]}>
        <SymbolView
          name={icon}
          size={23}
          tintColor={themeColor(unlocked ? '#171717' : '#A8A8A8', mode, 'tintColor')}
          style={styles.achievementIcon}
        />
      </View>
      <Text
        style={[
          styles.achievementLabel,
          !unlocked && styles.lockedAchievementLabel,
        ]}>
        {label}
      </Text>
    </View>
  );
}

function ProfileStat({ value, label }: { value: string; label: string }) {
  const styles = useThemedStyles(baseStyles);
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  screen: {
    flex: 1,
    width: '100%',
    maxWidth: 402,
    alignSelf: 'center',
    backgroundColor: '#171717',
  },
  profileScroll: {
    flex: 1,
  },
  profileContent: {
    paddingTop: 44,
    paddingHorizontal: 18,
    paddingBottom: 16,
  },
  profileHeader: {
    alignItems: 'center',
    paddingTop: 10,
  },
  avatarPressable: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarRing: {
    width: 112,
    height: 112,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 56,
    borderWidth: 5,
    borderColor: '#F28C28',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F28C28',
    borderWidth: 2,
    borderColor: '#171717',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: 48,
    backgroundColor: '#A8A8A8',
  },
  avatarSymbol: {
    width: 90,
    height: 90,
  },
  profileName: {
    maxWidth: '90%',
    marginTop: 8,
    color: '#F3F0EB',
    fontSize: 23,
  },
  profileTags: {
    marginTop: 4,
    color: '#AAA39A',
    fontSize: 17,
  },
  settingsButton: {
    position: 'absolute',
    top: -1,
    right: 0,
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#49321F',
    borderRadius: 23,
    backgroundColor: '#242424',
    shadowColor: '#706050',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  settingsButtonPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.96 }],
  },
  settingsIcon: {
    width: 24,
    height: 24,
  },
  levelCard: {
    marginTop: 24,
    padding: 18,
    borderRadius: 34,
    backgroundColor: '#222222',
    shadowColor: '#706050',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 5,
    elevation: 3,
  },
  pinButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 1,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: '#202020',
  },
  emptyMineCard: {
    alignItems: 'center',
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 36,
    borderRadius: 22,
    backgroundColor: '#202020',
  },
  emptyMineIcon: {
    fontSize: 30,
  },
  emptyMineTitle: {
    marginTop: 12,
    color: '#F3F0EB',
    fontSize: 17,
    fontWeight: '700',
  },
  emptyMineText: {
    marginTop: 6,
    color: '#AAA39A',
    fontSize: 13,
    textAlign: 'center',
  },
  createdByText: {
    marginTop: 8,
    color: '#F5A047',
    fontSize: 12,
    fontWeight: '600',
  },
  levelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  levelTitle: {
    color: '#F28C28',
    fontSize: 19,
    fontWeight: '600',
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  streakIcon: {
    width: 24,
    height: 24,
  },
  streakText: {
    color: '#F28C28',
    fontSize: 14,
  },
  progressTrack: {
    height: 18,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#F28C28',
    borderRadius: 12,
    backgroundColor: '#171717',
  },
  progressFill: {
    width: '69%',
    height: '100%',
    borderRadius: 10,
    backgroundColor: '#F28C28',
  },
  levelDescription: {
    marginTop: 12,
    color: '#F5A047',
    fontSize: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 24,
  },
  statCard: {
    flex: 1,
    minHeight: 76,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 26,
    backgroundColor: '#171717',
    shadowColor: '#706050',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 4,
    elevation: 3,
  },
  statValue: {
    color: '#F28C28',
    fontSize: 20,
    fontWeight: '600',
  },
  statLabel: {
    marginTop: 2,
    color: '#AAA39A',
    fontSize: 14,
  },
  profileSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 25,
    marginBottom: 10,
  },
  profileSectionTitle: {
    color: '#F3F0EB',
    fontSize: 18,
    fontWeight: '700',
  },
  achievementCount: {
    color: '#F5A047',
    fontSize: 12,
    fontWeight: '600',
  },
  achievementsCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#49321F',
    borderRadius: 24,
    backgroundColor: '#202020',
  },
  achievementBadge: {
    flex: 1,
    alignItems: 'center',
  },
  achievementIconWrap: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
  },
  unlockedAchievement: {
    backgroundColor: '#F28C28',
  },
  lockedAchievement: {
    borderWidth: 1.5,
    borderColor: '#39332D',
    backgroundColor: '#202020',
  },
  achievementIcon: {
    width: 25,
    height: 25,
  },
  achievementLabel: {
    maxWidth: 76,
    marginTop: 7,
    color: '#F3F0EB',
    fontSize: 11,
    lineHeight: 14,
    textAlign: 'center',
  },
  lockedAchievementLabel: {
    color: '#AAA39A',
  },
  pinnedPhotosHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 23,
    marginBottom: 10,
  },
  pinnedIcon: {
    width: 20,
    height: 20,
  },
  pinnedPhotosCard: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderWidth: 1,
    borderColor: '#49321F',
    borderRadius: 24,
    backgroundColor: '#202020',
  },
  pinnedPhotosIconWrap: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 26,
    backgroundColor: '#29231D',
  },
  pinnedPhotosIcon: {
    width: 30,
    height: 30,
  },
  pinnedPhotosTitle: {
    marginTop: 10,
    color: '#F3F0EB',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  pinnedPhotosDescription: {
    maxWidth: 270,
    marginTop: 4,
    color: '#AAA39A',
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
  contentScroll: {
    flex: 1,
  },
  pageHeading: {
    marginBottom: 18,
  },
  chatHeaderTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pageTitle: {
    color: '#F3F0EB',
    fontSize: 27,
    fontWeight: '600',
  },
  pageSubtitle: {
    marginTop: 4,
    color: '#AAA39A',
    fontSize: 14,
  },
  periodButton: {
    minWidth: 74,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
  },
  selectedPeriodButton: {
    backgroundColor: '#F28C28',
  },
  periodButtonText: {
    color: '#AAA39A',
    fontSize: 14,
  },
  selectedPeriodButtonText: {
    color: '#171717',
    fontWeight: '600',
  },
  leaderboardContent: {
    paddingTop: 42,
    paddingHorizontal: 18,
    paddingBottom: 20,
  },
  periodSwitch: {
    height: 44,
    flexDirection: 'row',
    padding: 4,
    borderRadius: 22,
    backgroundColor: '#222222',
  },
  podium: {
    height: 194,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 8,
    marginTop: 22,
    paddingHorizontal: 2,
  },
  podiumColumn: {
    flex: 1,
    alignItems: 'center',
  },
  winnerColumn: {
    marginBottom: 0,
  },
  runnerUpColumn: {
    marginBottom: 0,
  },
  podiumAvatar: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#393939',
    borderRadius: 24,
  },
  winnerAvatar: {
    width: 58,
    height: 58,
    borderWidth: 3,
    borderColor: '#FFD7A3',
    borderRadius: 29,
  },
  podiumInitial: {
    color: '#171717',
    fontSize: 19,
    fontWeight: '600',
  },
  podiumName: {
    maxWidth: '100%',
    marginTop: 6,
    color: '#F3F0EB',
    fontSize: 14,
    fontWeight: '600',
  },
  podiumScore: {
    marginTop: 2,
    color: '#AAA39A',
    fontSize: 11,
  },
  podiumStep: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
  },
  firstPlaceStep: {
    height: 70,
    backgroundColor: '#3A2919',
  },
  otherPlaceStep: {
    height: 52,
    backgroundColor: '#202020',
  },
  podiumRank: {
    color: '#F5A047',
    fontSize: 22,
    fontWeight: '700',
  },
  yourRankCard: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: '#FFD8A8',
    borderRadius: 22,
    backgroundColor: '#202020',
  },
  rankNumber: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 21,
    backgroundColor: '#3A2919',
  },
  rankNumberText: {
    color: '#F5A047',
    fontSize: 14,
    fontWeight: '700',
  },
  rankPlayer: {
    flex: 1,
    marginLeft: 10,
  },
  rankPlayerName: {
    color: '#F3F0EB',
    fontSize: 15,
    fontWeight: '600',
  },
  youLabel: {
    color: '#F28C28',
    fontWeight: '400',
  },
  rankPlayerSubtext: {
    marginTop: 2,
    color: '#AAA39A',
    fontSize: 11,
  },
  rankPoints: {
    color: '#F5A047',
    fontSize: 13,
    fontWeight: '600',
  },
  listHeading: {
    marginTop: 22,
    marginBottom: 8,
    color: '#F3F0EB',
    fontSize: 17,
    fontWeight: '600',
  },
  rankingList: {
    paddingHorizontal: 12,
    borderRadius: 22,
    backgroundColor: '#202020',
  },
  rankingRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F2E3D0',
  },
  rankingPlace: {
    width: 28,
    color: '#AAA39A',
    fontSize: 14,
    fontWeight: '600',
  },
  rankingAvatar: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    backgroundColor: '#332719',
  },
  rankingInitial: {
    color: '#D2CCC4',
    fontSize: 14,
    fontWeight: '600',
  },
  rankingName: {
    flex: 1,
    marginLeft: 10,
    color: '#F3F0EB',
    fontSize: 14,
  },
  rankingScore: {
    color: '#AAA39A',
    fontSize: 12,
  },
  battlesContent: {
    paddingTop: 36,
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  battlesHeader: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  battlesHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  battleHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  battleCreatorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  battleCreatorText: {
    color: '#AAA39A',
    fontSize: 12,
    fontWeight: '500',
  },
  battleCreatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    marginBottom: 4,
  },
  battlesTitle: {
    color: '#F3F0EB',
    fontSize: 25,
    fontWeight: '700',
  },
  battleStreakBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#222222',
  },
  battleStreakText: {
    color: '#F5A047',
    fontSize: 12,
    fontWeight: '600',
  },
  battleFilters: {
    height: 50,
    flexDirection: 'row',
    padding: 4,
    borderRadius: 25,
    backgroundColor: '#222222',
  },
  battleFilter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  selectedBattleFilter: {
    backgroundColor: '#D96B0B',
  },
  battleFilterText: {
    color: '#AAA39A',
    fontSize: 14,
    fontWeight: '500',
  },
  selectedBattleFilterText: {
    color: '#171717',
    fontWeight: '600',
  },
  featuredBattle: {
    minHeight: 108,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderRadius: 24,
    backgroundColor: '#D96B0B',
    shadowColor: '#B85F12',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 7,
    elevation: 3,
  },
  featuredBattleIcon: {
    fontSize: 26,
  },
  featuredBattleDetails: {
    flex: 1,
    marginLeft: 14,
  },
  featuredBattleTitle: {
    color: '#171717',
    fontSize: 16,
    fontWeight: '700',
  },
  featuredBattleSubtitle: {
    marginTop: 3,
    color: '#171717',
    fontSize: 13,
    lineHeight: 19,
  },
  battleCategoryFilters: {
    gap: 8,
    paddingTop: 14,
    paddingBottom: 2,
  },
  battleCategoryFilter: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 15,
    borderRadius: 19,
    backgroundColor: '#222222',
  },
  selectedBattleCategoryFilter: {
    backgroundColor: '#F28C28',
  },
  battleCategoryFilterEmoji: {
    fontSize: 12,
  },
  battleCategoryFilterText: {
    color: '#AAA39A',
    fontSize: 13,
    fontWeight: '500',
  },
  selectedBattleCategoryFilterText: {
    color: '#171717',
    fontWeight: '600',
  },
  battleCard: {
    marginTop: 14,
    padding: 16,
    borderRadius: 22,
    backgroundColor: '#171717',
    shadowColor: '#706050',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  battleCategory: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: '#222222',
  },
  battleCategoryIcon: {
    fontSize: 12,
  },
  battleCategoryText: {
    color: '#AAA39A',
    fontSize: 12,
    fontWeight: '500',
  },
  battleTitle: {
    marginTop: 9,
    color: '#F3F0EB',
    fontSize: 16,
    fontWeight: '600',
  },
  battleArtwork: {
    width: '100%',
    height: 170,
    marginTop: 12,
    borderRadius: 16,
  },
  joinButton: {
    position: 'absolute',
    top: 14,
    right: 52,
    zIndex: 2,
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: '#F28C28',
  },
  joinButtonText: {
    color: '#171717',
    fontSize: 24,
    lineHeight: 27,
    fontWeight: '700',
  },
  debugEndButton: {
    alignSelf: 'flex-start',
    marginTop: 12,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#6A4035',
  },
  debugEndButtonText: {
    color: '#D68B76',
    fontSize: 10,
    fontWeight: '600',
  },
  participationOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
  },
  participationSheet: {
    width: '100%',
    maxWidth: 360,
    padding: 24,
    borderRadius: 24,
    backgroundColor: '#171717',
  },
  closeParticipationButton: {
    position: 'absolute',
    top: 12,
    right: 14,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeParticipationText: {
    color: '#AAA39A',
    fontSize: 30,
    lineHeight: 30,
  },
  participationTitle: {
    color: '#F3F0EB',
    fontSize: 20,
    fontWeight: '700',
  },
  participationSubtitle: {
    marginTop: 6,
    marginBottom: 18,
    color: '#AAA39A',
    fontSize: 13,
  },
  participationAction: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 10,
    paddingHorizontal: 16,
    borderRadius: 15,
    backgroundColor: '#222222',
  },
  participationActionIcon: {
    color: '#F28C28',
    fontSize: 24,
  },
  participationActionText: {
    color: '#F3F0EB',
    fontSize: 15,
    fontWeight: '600',
  },
  battleMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 7,
  },
  battleMetaText: {
    color: '#AAA39A',
    fontSize: 12,
  },
  battleJoined: {
    color: '#F5A047',
    fontSize: 12,
    fontWeight: '600',
  },
  battleResult: {
    alignItems: 'center',
    marginTop: 20,
  },
  battleAvatar: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: '#F28C28',
  },
  battleAvatarText: {
    color: '#171717',
    fontSize: 12,
    fontWeight: '700',
  },
  battleScore: {
    marginTop: 4,
    color: '#AAA39A',
    fontSize: 13,
  },
  battleRank: {
    width: 84,
    height: 70,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 7,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    backgroundColor: '#D96B0B',
  },
  battleRankText: {
    color: '#171717',
    fontSize: 18,
    fontWeight: '700',
  },
  endedGameCard: {
    marginTop: 14,
    marginHorizontal: 2,
    overflow: 'hidden',
    borderRadius: 24,
    backgroundColor: '#171717',
    shadowColor: '#706050',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: 4,
  },
  endedAuthorRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  endedAvatar: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: '#F28C28',
  },
  endedAvatarText: {
    color: '#171717',
    fontSize: 14,
    fontWeight: '700',
  },
  endedAuthorDetails: {
    marginLeft: 10,
  },
  endedAuthorName: {
    color: '#F3F0EB',
    fontSize: 14,
    fontWeight: '600',
  },
  endedTime: {
    marginTop: 2,
    color: '#AAA39A',
    fontSize: 12,
  },
  endedChallenge: {
    maxWidth: '52%',
    marginLeft: 'auto',
    paddingHorizontal: 10,
    paddingVertical: 6,
    overflow: 'hidden',
    borderRadius: 14,
    backgroundColor: '#242424',
    color: '#AAA39A',
    fontSize: 11,
  },
  endedArtwork: {
    width: '100%',
    aspectRatio: 1.6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  endedRankBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    minWidth: 38,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    borderRadius: 16,
    backgroundColor: '#171717',
  },
  endedRankText: {
    color: '#F3F0EB',
    fontSize: 13,
    fontWeight: '700',
  },
  endedArtworkEmoji: {
    fontSize: 54,
  },
  endedDetails: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
  },
  endedTitle: {
    color: '#F3F0EB',
    fontSize: 16,
    fontWeight: '600',
  },
  endedActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  endedVoteButton: {
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#F28C28',
    borderRadius: 21,
    backgroundColor: '#202020',
  },
  endedVotedButton: {
    backgroundColor: '#F28C28',
  },
  endedVoteText: {
    color: '#F5A047',
    fontSize: 14,
    fontWeight: '600',
  },
  endedVotedText: {
    color: '#171717',
  },
  endedCommentCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  endedCommentText: {
    color: '#AAA39A',
    fontSize: 14,
  },
  chatListContent: {
    paddingTop: 42,
    paddingHorizontal: 18,
    paddingBottom: 20,
  },
  chatSearch: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#49321F',
    borderRadius: 22,
    backgroundColor: '#202020',
  },
  chatSearchIcon: {
    width: 22,
    height: 22,
  },
  chatSearchInput: {
    flex: 1,
    height: '100%',
    marginLeft: 8,
    color: '#D2CCC4',
    fontSize: 14,
  },
  chatFilters: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  conversationList: {
    marginTop: 10,
  },
  chatStatus: {
    marginTop: 18,
    color: '#AAA39A',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  chatEmptyState: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  chatError: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    color: '#B84235',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 18,
    backgroundColor: '#29231D',
  },
  retryButtonText: {
    color: '#F5A047',
    fontSize: 13,
    fontWeight: '600',
  },
  conversationRow: {
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F2E3D0',
  },
  chatAvatar: {
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 25,
  },
  chatAvatarText: {
    color: '#171717',
    fontSize: 20,
    fontWeight: '600',
  },
  conversationInfo: {
    flex: 1,
    marginLeft: 12,
  },
  conversationTopline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  conversationName: {
    color: '#F3F0EB',
    fontSize: 15,
    fontWeight: '600',
  },
  conversationTime: {
    color: '#AAA39A',
    fontSize: 11,
  },
  conversationBottomline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 5,
  },
  conversationPreview: {
    flex: 1,
    marginRight: 8,
    color: '#AAA39A',
    fontSize: 13,
  },
  unreadPreview: {
    color: '#D2CCC4',
    fontWeight: '500',
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    borderRadius: 10,
    backgroundColor: '#F28C28',
  },
  unreadBadgeText: {
    color: '#171717',
    fontSize: 11,
    fontWeight: '600',
  },
  chatScreen: {
    flex: 1,
    paddingTop: 38,
  },
  chatKeyboard: {
    flex: 1,
  },
  chatHeader: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F2E3D0',
  },
  chatHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
  },
  chatBackButton: {
    width: 34,
    height: 42,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  chatBackArrow: {
    color: '#F5A047',
    fontSize: 36,
    lineHeight: 40,
  },
  chatHeaderInfo: {
    marginLeft: 10,
  },
  chatHeaderName: {
    color: '#F3F0EB',
    fontSize: 16,
    fontWeight: '600',
  },
  chatOnline: {
    marginTop: 2,
    color: '#AAA39A',
    fontSize: 12,
  },
  messageScroll: {
    flex: 1,
  },
  messageList: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 16,
  },
  chatDate: {
    alignSelf: 'center',
    marginBottom: 18,
    color: '#AAA39A',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
  },
  messageLine: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  incomingMessageLine: {
    justifyContent: 'flex-start',
  },
  outgoingMessageLine: {
    justifyContent: 'flex-end',
  },
  messageBubble: {
    maxWidth: '82%',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 7,
    borderRadius: 18,
  },
  incomingMessageBubble: {
    borderBottomLeftRadius: 5,
    backgroundColor: '#222222',
  },
  outgoingMessageBubble: {
    borderBottomRightRadius: 5,
    backgroundColor: '#F28C28',
  },
  messageText: {
    color: '#F3F0EB',
    fontSize: 14,
    lineHeight: 20,
  },
  outgoingMessageText: {
    color: '#171717',
  },
  messageTime: {
    alignSelf: 'flex-end',
    marginTop: 3,
    color: '#AAA39A',
    fontSize: 10,
  },
  outgoingMessageTime: {
    color: '#171717',
  },
  composer: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 14,
    marginVertical: 10,
    padding: 5,
    borderWidth: 1,
    borderColor: '#49321F',
    borderRadius: 28,
    backgroundColor: '#202020',
  },
  composerInput: {
    flex: 1,
    height: 42,
    paddingHorizontal: 12,
    color: '#F3F0EB',
    fontSize: 14,
  },
  sendButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 21,
    backgroundColor: '#F28C28',
  },
  disabledSendButton: {
    backgroundColor: '#3A3530',
  },
  disabledSendButtonText: {
    color: '#AAA39A',
  },
  sendButtonText: {
    marginTop: -2,
    color: '#171717',
    fontSize: 26,
    fontWeight: '600',
  },
  bottomBar: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 6,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 62,
  },
  createButton: {
    width: 62,
    height: 62,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#393939',
    borderRadius: 31,
    backgroundColor: '#F28C28',
  },
});
