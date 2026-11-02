import { SymbolView } from 'expo-symbols';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const feedTabs = [
  {
    id: 'challenges',
    label: 'Challenges',
    symbol: { ios: 'trophy', android: 'emoji_events', web: 'emoji_events' },
  },
  {
    id: 'home',
    label: 'Home',
    symbol: { ios: 'house', android: 'home', web: 'home' },
  },
  {
    id: 'create',
    label: 'Create',
    symbol: { ios: 'plus', android: 'add', web: 'add' },
  },
  {
    id: 'messages',
    label: 'Messages',
    symbol: {
      ios: 'bubble.left.and.bubble.right',
      android: 'chat_bubble_outline',
      web: 'chat_bubble_outline',
    },
  },
  {
    id: 'profile',
    label: 'Profile',
    symbol: { ios: 'person.crop.circle', android: 'account_circle', web: 'account_circle' },
  },
] as const;

type FeedTabId = (typeof feedTabs)[number]['id'];

export default function FeedScreen() {
  const [activeTab, setActiveTab] = useState<FeedTabId>('home');
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.screen}>
      <StatusBar hidden />

      <View style={[styles.searchContainer, { marginTop: Math.max(insets.top, 40) }]}>
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
          name={{ ios: 'viewfinder', android: 'center_focus_strong', web: 'center_focus_strong' }}
          size={23}
          tintColor="#F98C3E"
          style={styles.searchIcon}
        />
      </View>

      <View style={styles.feedContent} />

      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        {feedTabs.map((tab) => {
          const isCreate = tab.id === 'create';
          const isActive = activeTab === tab.id;

          return (
            <Pressable
              key={tab.id}
              accessibilityRole="button"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: isActive }}
              onPress={() => setActiveTab(tab.id)}
              style={styles.tabButton}>
              <View style={[styles.tabIcon, isCreate && styles.createButton]}>
                <SymbolView
                  name={tab.symbol}
                  size={isCreate ? 28 : 24}
                  tintColor={isCreate ? '#FFFFFF' : isActive ? '#F98C3E' : '#A3A3A3'}
                  style={styles.symbol}
                />
              </View>
            </Pressable>
          );
        })}
      </View>
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
  bottomBar: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 6,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  tabIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createButton: {
    borderRadius: 22,
    backgroundColor: '#F98C3E',
  },
  symbol: {
    width: 26,
    height: 26,
  },
});
