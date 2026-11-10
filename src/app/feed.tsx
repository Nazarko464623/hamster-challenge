import { SymbolView } from 'expo-symbols';
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
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { PlayerSettings } from '@/components/player-settings';
import { getMineData, setBattlePinned, type UserBattle } from '@/lib/battles';
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
    artworkColor: '#B8E8C6',
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
    artworkColor: '#FFD276',
  },
] as const;

export default function FeedScreen() {
  const [activeTab, setActiveTab] = useState<FeedTabId>('home');
  const [battleStatus, setBattleStatus] = useState<BattleStatus>('live');
  const [pinnedBattleIds, setPinnedBattleIds] = useState<string[]>([]);
  const [createdBattles, setCreatedBattles] = useState<UserBattle[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [savedDisplayName, setSavedDisplayName] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { nickname } = useLocalSearchParams<{ nickname?: string }>();
  const displayName =
    savedDisplayName ??
    (typeof nickname === 'string' && nickname.trim() ? nickname.trim() : 'Player');

  useEffect(() => {
    let active = true;
    getMineData(displayName).then((data) => {
      if (active) {
        setPinnedBattleIds(data.pinnedIds);
        setCreatedBattles(data.createdBattles);
      }
    });
    return () => {
      active = false;
    };
  }, [displayName]);

  const handleTabPress = (tabId: FeedTabId) => {
    if (tabId === 'create') {
      router.push({ pathname: '/create', params: { nickname: displayName } });
      return;
    }

    setActiveTab(tabId);
  };

  return (
    <View style={styles.screen}>
      <StatusBar hidden />

      {activeTab === 'challenges' ? (
        <LeaderboardContent displayName={displayName} />
      ) : activeTab === 'messages' ? (
        <ChatContent />
      ) : activeTab === 'profile' ? (
        showSettings ? (
          <PlayerSettings
            displayName={displayName}
            onClose={() => setShowSettings(false)}
            onNameSaved={setSavedDisplayName}
          />
        ) : (
          <ProfileContent displayName={displayName} onOpenSettings={() => setShowSettings(true)} />
        )
      ) : (
        <HomeContent
          topInset={insets.top}
          status={battleStatus}
          onStatusChange={setBattleStatus}
          pinnedBattleIds={pinnedBattleIds}
          createdBattles={createdBattles}
          onTogglePin={async (battleId, pinned) => {
            setPinnedBattleIds((current) =>
              pinned ? [...new Set([...current, battleId])] : current.filter((id) => id !== battleId)
            );
            await setBattlePinned(displayName, battleId, pinned);
          }}
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
                      stroke="#FFFFFF"
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

function LeaderboardContent({ displayName }: { displayName: string }) {
  const [period, setPeriod] = useState<'week' | 'all-time'>('week');
  const topPlayers =
    period === 'week'
      ? [
          { name: 'Emma', score: '2,840', rank: 2, color: '#D5A27C' },
          { name: 'Alex', score: '3,120', rank: 1, color: '#E89550' },
          { name: 'Dani', score: '2,610', rank: 3, color: '#A8A08E' },
        ]
      : [
          { name: 'Mila', score: '12,840', rank: 2, color: '#D5A27C' },
          { name: 'Alex', score: '15,320', rank: 1, color: '#E89550' },
          { name: 'Dani', score: '11,610', rank: 3, color: '#A8A08E' },
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
  onTogglePin,
}: {
  topInset: number;
  status: BattleStatus;
  onStatusChange: (status: BattleStatus) => void;
  pinnedBattleIds: string[];
  createdBattles: UserBattle[];
  onTogglePin: (battleId: string, pinned: boolean) => void;
}) {
  const [selectedCategory, setSelectedCategory] = useState<BattleCategory>('All');
  const visibleLiveBattles =
    selectedCategory === 'All'
      ? liveBattles
      : liveBattles.filter((battle) => battle.category === selectedCategory);
  const mineLiveBattles = liveBattles.filter((battle) => pinnedBattleIds.includes(battle.id));
  const mineEndedGames = endedGames.filter((game) => pinnedBattleIds.includes(game.id));
  const mineBattlesCount = mineLiveBattles.length + mineEndedGames.length + createdBattles.length;

  return (
    <ScrollView
      style={styles.contentScroll}
      contentContainerStyle={[
        styles.battlesContent,
        { paddingTop: Math.max(topInset, 20) + 10 },
      ]}
      showsVerticalScrollIndicator={false}>
      <View style={styles.battlesHeader}>
        <Text style={styles.battlesTitle}>Battles</Text>
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

      {status === 'live' && visibleLiveBattles.map((battle) => (
        <View key={battle.id} style={styles.battleCard}>
          <PinButton
            pinned={pinnedBattleIds.includes(battle.id)}
            onPress={() => onTogglePin(battle.id, !pinnedBattleIds.includes(battle.id))}
          />
          <View style={styles.battleCategory}>
            <Text style={styles.battleCategoryIcon}>{battle.icon}</Text>
            <Text style={styles.battleCategoryText}>{battle.category}</Text>
          </View>
          <Text style={styles.battleTitle}>{battle.title}</Text>
          <View style={styles.battleMeta}>
            <Text style={styles.battleMetaText}>◷ {battle.time}</Text>
            <Text style={styles.battleMetaText}>{battle.players} players</Text>
            <Text style={styles.battleJoined}>✓ Joined</Text>
          </View>
          <View style={styles.battleResult}>
            <View style={styles.battleAvatar}>
              <Text style={styles.battleAvatarText}>VO</Text>
            </View>
            <Text style={styles.battleScore}>{battle.score}</Text>
            <View style={styles.battleRank}>
              <Text style={styles.battleRankText}>{battle.rank}</Text>
            </View>
          </View>
        </View>
      ))}
      {status === 'ended' &&
        endedGames.map((game) => (
          <EndedGameCard
            key={game.id}
            game={game}
            pinned={pinnedBattleIds.includes(game.id)}
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
          pinned
          onTogglePin={onTogglePin}
        />
      ))}
      {status === 'mine' && createdBattles.map((battle) => (
        <CreatedBattleCard key={battle.id} battle={battle} onTogglePin={onTogglePin} />
      ))}
    </ScrollView>
  );
}

function EndedGameCard({
  game,
  pinned,
  onTogglePin,
}: {
  game: (typeof endedGames)[number];
  pinned: boolean;
  onTogglePin: (battleId: string, pinned: boolean) => void;
}) {
  const [hasVoted, setHasVoted] = useState(false);

  return (
    <View style={styles.endedGameCard}>
      <PinButton pinned={pinned} onPress={() => onTogglePin(game.id, !pinned)} />
      <View style={styles.endedAuthorRow}>
        <View style={styles.endedAvatar}>
          <Text style={styles.endedAvatarText}>
            {game.author.slice(0, 2).toUpperCase()}
          </Text>
        </View>
        <View style={styles.endedAuthorDetails}>
          <Text style={styles.endedAuthorName}>{game.author}</Text>
          <Text style={styles.endedTime}>{game.time}</Text>
        </View>
        <Text style={styles.endedChallenge} numberOfLines={1}>
          {game.challenge}
        </Text>
      </View>

      <View style={[styles.endedArtwork, { backgroundColor: game.artworkColor }]}>
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
              tintColor="#B69478"
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
  onTogglePin,
}: {
  battle: UserBattle;
  onTogglePin: (battleId: string, pinned: boolean) => void;
}) {
  return (
    <View style={styles.battleCard}>
      <PinButton pinned onPress={() => onTogglePin(battle.id, false)} />
      <View style={styles.battleCategory}>
        <Text style={styles.battleCategoryIcon}>{battle.icon}</Text>
        <Text style={styles.battleCategoryText}>{battle.category}</Text>
      </View>
      <Text style={styles.battleTitle}>{battle.title}</Text>
      <Text style={styles.createdByText}>Created by you · {battle.time}</Text>
      <Text style={styles.battleMetaText}>{battle.rules || 'No rules added'}</Text>
    </View>
  );
}

function PinButton({ pinned, onPress }: { pinned: boolean; onPress: () => void }) {
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
        tintColor={pinned ? '#E7842D' : '#B8A99D'}
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

function ChatContent() {
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
            <View style={[styles.chatAvatar, { backgroundColor: colorForName(conversationName) }]}>
              <Text style={styles.chatAvatarText}>{conversationName.slice(0, 1).toUpperCase()}</Text>
            </View>
            <View style={styles.chatHeaderInfo}>
              <Text style={styles.chatHeaderName}>{conversationName}</Text>
              <Text style={styles.chatOnline}>Direct messages</Text>
            </View>
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
              const outgoing = message.senderId === userId;
              return (
                <View
                  key={message.id}
                  style={[
                    styles.messageLine,
                    outgoing ? styles.outgoingMessageLine : styles.incomingMessageLine,
                  ]}>
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
              placeholderTextColor="#B6A493"
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
              <Text style={styles.sendButtonText}>{sending ? '…' : '↑'}</Text>
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
        <Text style={styles.pageTitle}>Messages</Text>
        <Text style={styles.pageSubtitle}>Keep the conversation going</Text>
      </View>

      <View style={styles.chatSearch}>
        <SymbolView
          accessibilityLabel="Search messages"
          name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }}
          size={19}
          tintColor="#E89550"
          style={styles.chatSearchIcon}
        />
        <TextInput
          accessibilityLabel="Search conversations"
          placeholder="Search messages"
          placeholderTextColor="#B6A493"
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
              <View style={[styles.chatAvatar, { backgroundColor: colorForName(conversation.name) }]}>
                <Text style={styles.chatAvatarText}>{conversation.name.slice(0, 1).toUpperCase()}</Text>
              </View>
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

function colorForName(name: string) {
  const colors = ['#E89550', '#A8A08E', '#C77A61', '#8E9C78', '#9B83A8'];
  const colorIndex = name.split('').reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return colors[colorIndex % colors.length];
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
  const color = active ? '#E89550' : '#A3A3A3';
  const fill = active ? '#FCE4D1' : '#E5E5E5';

  if (type === 'challenges') {
    return (
      <Svg width={40} height={40} viewBox="0 0 48 48">
        <Path
          d="M12 7h24v11c0 8.3-5.4 14-12 14s-12-5.7-12-14V7Z"
          fill={fill}
          stroke={color}
          strokeLinejoin="round"
          strokeWidth={3.5}
        />
        <Path
          d="M12 12H6v5c0 5 3.5 8 9 8M36 12h6v5c0 5-3.5 8-9 8M24 32v7m-8 2h16"
          fill="none"
          stroke={color}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={3.5}
        />
      </Svg>
    );
  }

  if (type === 'home') {
    return (
      <Svg width={40} height={40} viewBox="0 0 48 48">
        <Path
          d="m5.5 21.5 15.1-13.4a5 5 0 0 1 6.8 0l15.1 13.4v13a5 5 0 0 1-5 5h-27a5 5 0 0 1-5-5v-13Z"
          fill={fill}
          stroke={color}
          strokeLinejoin="round"
          strokeWidth={3.5}
        />
        <Path
          d="M18 39V28a6 6 0 0 1 12 0v11"
          fill="#FFFFFF"
          stroke={color}
          strokeLinejoin="round"
          strokeWidth={3.5}
        />
      </Svg>
    );
  }

  if (type === 'messages') {
    return (
      <Svg width={40} height={40} viewBox="0 0 48 48">
        <Path
          d="M8 11a7 7 0 0 1 7-7h16a7 7 0 0 1 7 7v12a7 7 0 0 1-7 7H20l-9 7 2-9a7 7 0 0 1-5-6V11Z"
          fill={fill}
          stroke={color}
          strokeLinejoin="round"
          strokeWidth={3.5}
        />
        <Circle
          cx={37}
          cy={10}
          r={6}
          fill={active ? '#FCE4D1' : '#FFFFFF'}
          stroke={color}
          strokeWidth={3}
        />
      </Svg>
    );
  }

  return (
    <Svg width={40} height={40} viewBox="0 0 48 48">
      <Circle cx={24} cy={24} r={18} fill={fill} stroke={color} strokeWidth={3.5} />
      <Circle cx={24} cy={18} r={6} fill="#FFFFFF" stroke={color} strokeWidth={3} />
      <Path
        d="M13 37c.8-6 5-9 11-9s10.2 3 11 9"
        fill="#FFFFFF"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={3}
      />
    </Svg>
  );
}

function ProfileContent({
  displayName,
  onOpenSettings,
}: {
  displayName: string;
  onOpenSettings: () => void;
}) {
  return (
    <ScrollView
      style={styles.profileScroll}
      contentContainerStyle={styles.profileContent}
      showsVerticalScrollIndicator={false}>
      <View style={styles.profileHeader}>
        <View style={styles.avatarRing}>
          <View style={styles.avatar}>
            <SymbolView
              accessibilityLabel="Profile photo placeholder"
              name={{
                ios: 'person.crop.circle.fill',
                android: 'account_circle',
                web: 'account_circle',
              }}
              size={88}
              tintColor="#F4E9DE"
              style={styles.avatarSymbol}
            />
          </View>
        </View>
        <Text style={styles.profileName} numberOfLines={1}>
          {displayName}
        </Text>
        <Text style={styles.profileTags}>#humstbattle   #newgen</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open settings"
          hitSlop={6}
          onPress={onOpenSettings}
          style={({ pressed }) => [styles.settingsButton, pressed && styles.settingsButtonPressed]}>
          <SymbolView
            name={{ ios: 'slider.horizontal.3', android: 'tune', web: 'tune' }}
            size={22}
            tintColor="#C96B30"
            style={styles.settingsIcon}
          />
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
              tintColor="#F04438"
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
          tintColor="#E9803F"
          style={styles.pinnedIcon}
        />
      </View>
      <View style={styles.pinnedPhotosCard}>
        <View style={styles.pinnedPhotosIconWrap}>
          <SymbolView
            accessibilityLabel="Photo collection"
            name={{ ios: 'photo.on.rectangle.angled', android: 'photo_library', web: 'photo_library' }}
            size={28}
            tintColor="#E9803F"
            style={styles.pinnedPhotosIcon}
          />
        </View>
        <Text style={styles.pinnedPhotosTitle}>Your best moments, on display</Text>
        <Text style={styles.pinnedPhotosDescription}>
          Pin your favorite entry photos here when they’re ready to share.
        </Text>
      </View>
    </ScrollView>
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
          tintColor={unlocked ? '#FFFFFF' : '#C6B9AC'}
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
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    width: '100%',
    maxWidth: 402,
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
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
  avatarRing: {
    width: 112,
    height: 112,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 56,
    borderWidth: 5,
    borderColor: '#E89550',
  },
  avatar: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: 48,
    backgroundColor: '#A49C8C',
  },
  avatarSymbol: {
    width: 90,
    height: 90,
  },
  profileName: {
    maxWidth: '90%',
    marginTop: 8,
    color: '#171717',
    fontSize: 23,
  },
  profileTags: {
    marginTop: 4,
    color: '#929292',
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
    borderColor: '#F2D1B8',
    borderRadius: 23,
    backgroundColor: '#FFF3E9',
    shadowColor: '#8D7967',
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
    backgroundColor: '#FFF2EB',
    shadowColor: '#8D7967',
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
    backgroundColor: '#FFF8F3',
  },
  emptyMineCard: {
    alignItems: 'center',
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 36,
    borderRadius: 22,
    backgroundColor: '#FFF8F3',
  },
  emptyMineIcon: {
    fontSize: 30,
  },
  emptyMineTitle: {
    marginTop: 12,
    color: '#44372F',
    fontSize: 17,
    fontWeight: '700',
  },
  emptyMineText: {
    marginTop: 6,
    color: '#9B8C7F',
    fontSize: 13,
    textAlign: 'center',
  },
  createdByText: {
    marginTop: 8,
    color: '#D68140',
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
    color: '#E9803F',
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
    color: '#E9803F',
    fontSize: 14,
  },
  progressTrack: {
    height: 18,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#E89550',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  progressFill: {
    width: '69%',
    height: '100%',
    borderRadius: 10,
    backgroundColor: '#F98C3E',
  },
  levelDescription: {
    marginTop: 12,
    color: '#8A4B2B',
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
    backgroundColor: '#FFFFFF',
    shadowColor: '#8D7967',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 4,
    elevation: 3,
  },
  statValue: {
    color: '#E9803F',
    fontSize: 20,
    fontWeight: '600',
  },
  statLabel: {
    marginTop: 2,
    color: '#858585',
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
    color: '#44372F',
    fontSize: 18,
    fontWeight: '700',
  },
  achievementCount: {
    color: '#C77A3E',
    fontSize: 12,
    fontWeight: '600',
  },
  achievementsCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#F3D6BE',
    borderRadius: 24,
    backgroundColor: '#FFFAF6',
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
    backgroundColor: '#F98C3E',
  },
  lockedAchievement: {
    borderWidth: 1.5,
    borderColor: '#E7DCD2',
    backgroundColor: '#F8F3EF',
  },
  achievementIcon: {
    width: 25,
    height: 25,
  },
  achievementLabel: {
    maxWidth: 76,
    marginTop: 7,
    color: '#76563F',
    fontSize: 11,
    lineHeight: 14,
    textAlign: 'center',
  },
  lockedAchievementLabel: {
    color: '#A99C91',
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
    borderColor: '#F3D6BE',
    borderRadius: 24,
    backgroundColor: '#FFFAF6',
  },
  pinnedPhotosIconWrap: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 26,
    backgroundColor: '#FFF0E4',
  },
  pinnedPhotosIcon: {
    width: 30,
    height: 30,
  },
  pinnedPhotosTitle: {
    marginTop: 10,
    color: '#5D4635',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  pinnedPhotosDescription: {
    maxWidth: 270,
    marginTop: 4,
    color: '#9B8774',
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
  pageTitle: {
    color: '#24201D',
    fontSize: 27,
    fontWeight: '600',
  },
  pageSubtitle: {
    marginTop: 4,
    color: '#9B8C7F',
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
    backgroundColor: '#E89550',
  },
  periodButtonText: {
    color: '#9B8C7F',
    fontSize: 14,
  },
  selectedPeriodButtonText: {
    color: '#FFFFFF',
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
    backgroundColor: '#FFF2EB',
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
    borderColor: '#FFFFFF',
    borderRadius: 24,
  },
  winnerAvatar: {
    width: 58,
    height: 58,
    borderWidth: 3,
    borderColor: '#F6C28E',
    borderRadius: 29,
  },
  podiumInitial: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '600',
  },
  podiumName: {
    maxWidth: '100%',
    marginTop: 6,
    color: '#44372F',
    fontSize: 14,
    fontWeight: '600',
  },
  podiumScore: {
    marginTop: 2,
    color: '#A18F80',
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
    backgroundColor: '#FCE4D1',
  },
  otherPlaceStep: {
    height: 52,
    backgroundColor: '#F5F0EB',
  },
  podiumRank: {
    color: '#D68140',
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
    borderColor: '#F0B37C',
    borderRadius: 22,
    backgroundColor: '#FFF8F3',
  },
  rankNumber: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 21,
    backgroundColor: '#FCE4D1',
  },
  rankNumberText: {
    color: '#D68140',
    fontSize: 14,
    fontWeight: '700',
  },
  rankPlayer: {
    flex: 1,
    marginLeft: 10,
  },
  rankPlayerName: {
    color: '#44372F',
    fontSize: 15,
    fontWeight: '600',
  },
  youLabel: {
    color: '#E89550',
    fontWeight: '400',
  },
  rankPlayerSubtext: {
    marginTop: 2,
    color: '#9B8C7F',
    fontSize: 11,
  },
  rankPoints: {
    color: '#D68140',
    fontSize: 13,
    fontWeight: '600',
  },
  listHeading: {
    marginTop: 22,
    marginBottom: 8,
    color: '#44372F',
    fontSize: 17,
    fontWeight: '600',
  },
  rankingList: {
    paddingHorizontal: 12,
    borderRadius: 22,
    backgroundColor: '#FFF8F3',
  },
  rankingRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F3E9E1',
  },
  rankingPlace: {
    width: 28,
    color: '#9B8C7F',
    fontSize: 14,
    fontWeight: '600',
  },
  rankingAvatar: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    backgroundColor: '#E7D5C6',
  },
  rankingInitial: {
    color: '#8E674B',
    fontSize: 14,
    fontWeight: '600',
  },
  rankingName: {
    flex: 1,
    marginLeft: 10,
    color: '#44372F',
    fontSize: 14,
  },
  rankingScore: {
    color: '#9B8C7F',
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
  battlesTitle: {
    color: '#28231F',
    fontSize: 25,
    fontWeight: '700',
  },
  battleStreakBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#FFF2EB',
  },
  battleStreakText: {
    color: '#D68140',
    fontSize: 12,
    fontWeight: '600',
  },
  battleFilters: {
    height: 50,
    flexDirection: 'row',
    padding: 4,
    borderRadius: 25,
    backgroundColor: '#FFF2EB',
  },
  battleFilter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  selectedBattleFilter: {
    backgroundColor: '#E7842D',
  },
  battleFilterText: {
    color: '#A77F61',
    fontSize: 14,
    fontWeight: '500',
  },
  selectedBattleFilterText: {
    color: '#FFFFFF',
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
    backgroundColor: '#E7842D',
    shadowColor: '#B86B2E',
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
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  featuredBattleSubtitle: {
    marginTop: 3,
    color: '#FFF7F0',
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
    backgroundColor: '#FFF2EB',
  },
  selectedBattleCategoryFilter: {
    backgroundColor: '#F98C3E',
  },
  battleCategoryFilterEmoji: {
    fontSize: 12,
  },
  battleCategoryFilterText: {
    color: '#A77F61',
    fontSize: 13,
    fontWeight: '500',
  },
  selectedBattleCategoryFilterText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  battleCard: {
    marginTop: 14,
    padding: 16,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    shadowColor: '#8D7967',
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
    backgroundColor: '#FFF2EB',
  },
  battleCategoryIcon: {
    fontSize: 12,
  },
  battleCategoryText: {
    color: '#B07D50',
    fontSize: 12,
    fontWeight: '500',
  },
  battleTitle: {
    marginTop: 9,
    color: '#44372F',
    fontSize: 16,
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
    color: '#A99B90',
    fontSize: 12,
  },
  battleJoined: {
    color: '#D68140',
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
    backgroundColor: '#C9552B',
  },
  battleAvatarText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  battleScore: {
    marginTop: 4,
    color: '#8F8176',
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
    backgroundColor: '#E7842D',
  },
  battleRankText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  endedGameCard: {
    marginTop: 14,
    marginHorizontal: 2,
    overflow: 'hidden',
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    shadowColor: '#8D7967',
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
    backgroundColor: '#D95B28',
  },
  endedAvatarText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  endedAuthorDetails: {
    marginLeft: 10,
  },
  endedAuthorName: {
    color: '#5D4635',
    fontSize: 14,
    fontWeight: '600',
  },
  endedTime: {
    marginTop: 2,
    color: '#A89483',
    fontSize: 12,
  },
  endedChallenge: {
    maxWidth: '52%',
    marginLeft: 'auto',
    paddingHorizontal: 10,
    paddingVertical: 6,
    overflow: 'hidden',
    borderRadius: 14,
    backgroundColor: '#FFF2E5',
    color: '#B07D50',
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
    backgroundColor: '#FFFFFF',
  },
  endedRankText: {
    color: '#76563F',
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
    color: '#5D4635',
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
    borderColor: '#E89550',
    borderRadius: 21,
    backgroundColor: '#FFF9F4',
  },
  endedVotedButton: {
    backgroundColor: '#F98C3E',
  },
  endedVoteText: {
    color: '#D68140',
    fontSize: 14,
    fontWeight: '600',
  },
  endedVotedText: {
    color: '#FFFFFF',
  },
  endedCommentCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  endedCommentText: {
    color: '#A89483',
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
    borderColor: '#F0D8C6',
    borderRadius: 22,
    backgroundColor: '#FFF8F3',
  },
  chatSearchIcon: {
    width: 22,
    height: 22,
  },
  chatSearchInput: {
    flex: 1,
    height: '100%',
    marginLeft: 8,
    color: '#6E5544',
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
    color: '#9B8C7F',
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
    backgroundColor: '#FFF0E4',
  },
  retryButtonText: {
    color: '#9B592E',
    fontSize: 13,
    fontWeight: '600',
  },
  conversationRow: {
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F2E9E2',
  },
  chatAvatar: {
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 25,
  },
  chatAvatarText: {
    color: '#FFFFFF',
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
    color: '#44372F',
    fontSize: 15,
    fontWeight: '600',
  },
  conversationTime: {
    color: '#A99B90',
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
    color: '#9B8C7F',
    fontSize: 13,
  },
  unreadPreview: {
    color: '#6E5544',
    fontWeight: '500',
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    borderRadius: 10,
    backgroundColor: '#E89550',
  },
  unreadBadgeText: {
    color: '#FFFFFF',
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
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F2E9E2',
  },
  chatBackButton: {
    width: 34,
    height: 42,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  chatBackArrow: {
    color: '#D68140',
    fontSize: 36,
    lineHeight: 40,
  },
  chatHeaderInfo: {
    marginLeft: 10,
  },
  chatHeaderName: {
    color: '#44372F',
    fontSize: 16,
    fontWeight: '600',
  },
  chatOnline: {
    marginTop: 2,
    color: '#9A9A8B',
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
    color: '#B3A599',
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
    backgroundColor: '#FFF2EB',
  },
  outgoingMessageBubble: {
    borderBottomRightRadius: 5,
    backgroundColor: '#E89550',
  },
  messageText: {
    color: '#604A3A',
    fontSize: 14,
    lineHeight: 20,
  },
  outgoingMessageText: {
    color: '#FFFFFF',
  },
  messageTime: {
    alignSelf: 'flex-end',
    marginTop: 3,
    color: '#A9988A',
    fontSize: 10,
  },
  outgoingMessageTime: {
    color: '#FFF0E4',
  },
  composer: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 14,
    marginVertical: 10,
    padding: 5,
    borderWidth: 1,
    borderColor: '#F0D8C6',
    borderRadius: 28,
    backgroundColor: '#FFF8F3',
  },
  composerInput: {
    flex: 1,
    height: 42,
    paddingHorizontal: 12,
    color: '#604A3A',
    fontSize: 14,
  },
  sendButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 21,
    backgroundColor: '#E89550',
  },
  disabledSendButton: {
    backgroundColor: '#D7C8BC',
  },
  sendButtonText: {
    marginTop: -2,
    color: '#FFFFFF',
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
    borderColor: '#FFFFFF',
    borderRadius: 31,
    backgroundColor: '#F98C3E',
  },
});
