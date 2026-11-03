import { SymbolView } from 'expo-symbols';
import { useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

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

type ChatMessage = {
  id: string;
  text: string;
  time: string;
  outgoing: boolean;
};

const conversations = [
  { id: 'mila', name: 'Mila', message: 'That was a close game!', time: 'now', unread: 2, color: '#E89550' },
  { id: 'alex', name: 'Alex', message: 'Are you joining the next challenge?', time: '12:42', unread: 1, color: '#A8A08E' },
  { id: 'team', name: 'Newgen team', message: 'You: Let’s do it 🔥', time: 'Yesterday', unread: 0, color: '#C77A61' },
] as const;

const initialChatMessages: Record<string, ChatMessage[]> = {
  mila: [
    { id: 'mila-1', text: 'Hey! Did you see the new challenge?', time: '10:24', outgoing: false },
    { id: 'mila-2', text: 'Yes, I’m joining now!', time: '10:26', outgoing: true },
    { id: 'mila-3', text: 'That was a close game!', time: 'now', outgoing: false },
  ],
  alex: [
    { id: 'alex-1', text: 'Nice work on your last win 👏', time: '12:38', outgoing: false },
    { id: 'alex-2', text: 'Are you joining the next challenge?', time: '12:42', outgoing: false },
  ],
  team: [
    { id: 'team-1', text: 'New challenge starts tonight!', time: 'Yesterday', outgoing: false },
    { id: 'team-2', text: 'Let’s do it 🔥', time: 'Yesterday', outgoing: true },
  ],
};

export default function FeedScreen() {
  const [activeTab, setActiveTab] = useState<FeedTabId>('home');
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState(initialChatMessages);
  const [chatDraft, setChatDraft] = useState('');
  const insets = useSafeAreaInsets();
  const { nickname } = useLocalSearchParams<{ nickname?: string }>();
  const displayName = typeof nickname === 'string' && nickname.trim() ? nickname.trim() : 'Player';

  const handleTabPress = (tabId: FeedTabId) => {
    setActiveTab(tabId);
    if (tabId !== 'messages') {
      setSelectedChatId(null);
    }
  };

  const sendChatMessage = () => {
    const text = chatDraft.trim();
    if (!selectedChatId || !text) {
      return;
    }

    setChatMessages((current) => ({
      ...current,
      [selectedChatId]: [
        ...(current[selectedChatId] ?? []),
        { id: `${selectedChatId}-${Date.now()}`, text, time: 'now', outgoing: true },
      ],
    }));
    setChatDraft('');
  };

  return (
    <View style={styles.screen}>
      <StatusBar hidden />

      {activeTab === 'challenges' ? (
        <LeaderboardContent displayName={displayName} />
      ) : activeTab === 'messages' ? (
        <ChatContent
          selectedChatId={selectedChatId}
          messages={chatMessages}
          draft={chatDraft}
          onDraftChange={setChatDraft}
          onSend={sendChatMessage}
          onOpenConversation={setSelectedChatId}
          onBack={() => setSelectedChatId(null)}
        />
      ) : activeTab === 'profile' ? (
        <ProfileContent displayName={displayName} />
      ) : (
        <HomeContent topInset={insets.top} />
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

function HomeContent({ topInset }: { topInset: number }) {
  return (
    <>
      <View style={[styles.searchContainer, { marginTop: Math.max(topInset, 40) }]}>
        <TextInput
          accessibilityLabel="Search current games"
          autoCapitalize="none"
          placeholder="Search"
          placeholderTextColor="#F98C3E"
          returnKeyType="search"
          style={styles.searchInput}
        />
        <SymbolView
          accessibilityLabel="Search"
          name={{
            ios: 'viewfinder',
            android: 'center_focus_strong',
            web: 'center_focus_strong',
          }}
          size={23}
          tintColor="#F98C3E"
          style={styles.searchIcon}
        />
      </View>
      <View style={styles.feedContent} />
    </>
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

function ChatContent({
  selectedChatId,
  messages,
  draft,
  onDraftChange,
  onSend,
  onOpenConversation,
  onBack,
}: {
  selectedChatId: string | null;
  messages: Record<string, ChatMessage[]>;
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  onOpenConversation: (id: string) => void;
  onBack: () => void;
}) {
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const selectedConversation = conversations.find((conversation) => conversation.id === selectedChatId);

  if (selectedConversation) {
    return (
      <View style={styles.chatScreen}>
        <View style={styles.chatHeader}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to messages"
            onPress={onBack}
            style={styles.chatBackButton}>
            <Text style={styles.chatBackArrow}>‹</Text>
          </Pressable>
          <View style={[styles.chatAvatar, { backgroundColor: selectedConversation.color }]}>
            <Text style={styles.chatAvatarText}>{selectedConversation.name.slice(0, 1)}</Text>
          </View>
          <View style={styles.chatHeaderInfo}>
            <Text style={styles.chatHeaderName}>{selectedConversation.name}</Text>
            <Text style={styles.chatOnline}>Active now</Text>
          </View>
        </View>

        <ScrollView
          style={styles.messageScroll}
          contentContainerStyle={styles.messageList}
          showsVerticalScrollIndicator={false}>
          <Text style={styles.chatDate}>TODAY</Text>
          {(messages[selectedConversation.id] ?? []).map((message) => (
            <View
              key={message.id}
              style={[
                styles.messageLine,
                message.outgoing ? styles.outgoingMessageLine : styles.incomingMessageLine,
              ]}>
              <View
                style={[
                  styles.messageBubble,
                  message.outgoing ? styles.outgoingMessageBubble : styles.incomingMessageBubble,
                ]}>
                <Text
                  style={[
                    styles.messageText,
                    message.outgoing && styles.outgoingMessageText,
                  ]}>
                  {message.text}
                </Text>
                <Text
                  style={[
                    styles.messageTime,
                    message.outgoing && styles.outgoingMessageTime,
                  ]}>
                  {message.time}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>

        <View style={styles.composer}>
          <TextInput
            accessibilityLabel="Write a message"
            placeholder="Write a message..."
            placeholderTextColor="#B6A493"
            returnKeyType="send"
            onChangeText={onDraftChange}
            onSubmitEditing={onSend}
            value={draft}
            style={styles.composerInput}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send message"
            disabled={!draft.trim()}
            onPress={onSend}
            style={[styles.sendButton, !draft.trim() && styles.disabledSendButton]}>
            <Text style={styles.sendButtonText}>↑</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const visibleConversations = conversations.filter(
    (conversation) => filter === 'all' || conversation.unread > 0
  );

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
          style={styles.chatSearchInput}
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
        {visibleConversations.map((conversation) => (
          <Pressable
            key={conversation.id}
            accessibilityRole="button"
            accessibilityLabel={`Open chat with ${conversation.name}`}
            onPress={() => onOpenConversation(conversation.id)}
            style={styles.conversationRow}>
            <View style={[styles.chatAvatar, { backgroundColor: conversation.color }]}>
              <Text style={styles.chatAvatarText}>{conversation.name.slice(0, 1)}</Text>
            </View>
            <View style={styles.conversationInfo}>
              <View style={styles.conversationTopline}>
                <Text style={styles.conversationName}>{conversation.name}</Text>
                <Text style={styles.conversationTime}>{conversation.time}</Text>
              </View>
              <View style={styles.conversationBottomline}>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.conversationPreview,
                    conversation.unread > 0 && styles.unreadPreview,
                  ]}>
                  {conversation.message}
                </Text>
                {conversation.unread > 0 && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadBadgeText}>{conversation.unread}</Text>
                  </View>
                )}
              </View>
            </View>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
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

function ProfileContent({ displayName }: { displayName: string }) {
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
        <SymbolView
          accessibilityLabel="Profile settings"
          name={{ ios: 'slider.horizontal.3', android: 'tune', web: 'tune' }}
          size={26}
          tintColor="#E9803F"
          style={styles.settingsIcon}
        />
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
    </ScrollView>
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
  searchContainer: {
    height: 38,
    marginHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#F98C3E',
    borderRadius: 22,
    backgroundColor: '#FFF7F2',
  },
  searchInput: {
    flex: 1,
    height: '100%',
    paddingLeft: 16,
    paddingRight: 8,
    color: '#F98C3E',
    fontSize: 16,
  },
  searchIcon: {
    width: 26,
    height: 26,
    marginHorizontal: 10,
  },
  feedContent: {
    flex: 1,
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
  settingsIcon: {
    position: 'absolute',
    top: 0,
    right: 4,
    width: 32,
    height: 32,
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
  contentScroll: {
    flex: 1,
  },
  leaderboardContent: {
    paddingTop: 42,
    paddingHorizontal: 18,
    paddingBottom: 20,
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
  periodSwitch: {
    height: 44,
    flexDirection: 'row',
    padding: 4,
    borderRadius: 22,
    backgroundColor: '#FFF2EB',
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
