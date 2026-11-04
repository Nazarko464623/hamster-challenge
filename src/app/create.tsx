import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { useFonts } from 'expo-font';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  useReducedMotion,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { saveCreatedBattle, type UserBattle } from '@/lib/battles';

const categories = ['sport', 'photo', 'art', 'music', 'gaming', 'food', 'other'] as const;
const durations = ['1 day', '3 days', 'week'] as const;
const votingOptions = ['everyone', 'followers'] as const;

// Increase duration for slower motion; distance, rotation, and scale control intensity.
const WAVE_MOTION = {
  topBase: { duration: 12_000, distance: 14, rotation: 1.1, scale: 1.025, direction: 1 },
  topPeach: { duration: 9_000, distance: 18, rotation: 1.3, scale: 1.04, direction: 1 },
  topOrange: { duration: 14_000, distance: 16, rotation: 1.2, scale: 1.035, direction: 1 },
  bottomBase: { duration: 19_000, distance: 14, rotation: 1, scale: 1.03, direction: -1 },
  bottomPeach: { duration: 17_000, distance: 13, rotation: 1, scale: 1.025, direction: -1 },
  bottomOrange: { duration: 10_000, distance: 18, rotation: 1.3, scale: 1.04, direction: -1 },
} as const;

export default function CreateScreen() {
  const router = useRouter();
  const { nickname } = useLocalSearchParams<{ nickname?: string }>();
  const insets = useSafeAreaInsets();
  const [fontsLoaded, fontError] = useFonts({
    NationalPark: require('../../assets/fonts/NationalPark-SemiBold.ttf'),
  });
  const [title, setTitle] = useState('');
  const [rules, setRules] = useState('');
  const [category, setCategory] = useState<(typeof categories)[number] | null>(null);
  const [duration, setDuration] = useState<(typeof durations)[number] | null>(null);
  const [voting, setVoting] = useState<(typeof votingOptions)[number] | null>(null);

  const createBattle = async () => {
    const owner = typeof nickname === 'string' && nickname.trim() ? nickname.trim() : 'Player';
    if (!title.trim() || !category || !duration || !voting) {
      return;
    }

    const categoryIcons: Record<(typeof categories)[number], string> = {
      sport: '🏀',
      photo: '📷',
      art: '🎨',
      music: '🎵',
      gaming: '🎮',
      food: '🍔',
      other: '✨',
    };
    const battle: UserBattle = {
      id: `created-${Date.now()}`,
      owner,
      title: title.trim(),
      category: category[0].toUpperCase() + category.slice(1),
      icon: categoryIcons[category],
      rules: rules.trim(),
      time: duration,
      players: 0,
      score: 0,
      rank: 0,
      status: 'live',
      createdAt: new Date().toISOString(),
    };

    await saveCreatedBattle(owner, battle);
    router.replace({ pathname: '/feed', params: { nickname: owner } });
  };

  if (fontError) {
    throw fontError;
  }

  if (!fontsLoaded) {
    return null;
  }

  return (
    <View style={styles.screen}>
      <StatusBar hidden />
      <WaveBackground />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: Math.max(insets.top, 24) + 10,
            paddingBottom: 28,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <Pressable
          accessibilityLabel="Go back"
          accessibilityRole="button"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>

        <Text style={styles.screenTitle}>Creating Battle</Text>

        <View style={styles.fieldSection}>
          <Text style={styles.sectionLabel}>Title</Text>
          <TextInput
            accessibilityLabel="Battle title"
            onChangeText={setTitle}
            placeholder="enter your title"
            placeholderTextColor="#B9A58E"
            style={styles.titleInput}
            value={title}
          />
        </View>

        <View style={styles.fieldSection}>
          <Text style={styles.sectionLabel}>Category</Text>
          <View style={styles.optionGrid}>
            {categories.map((option) => (
              <OptionPill
                key={option}
                label={option}
                selected={category === option}
                onPress={() => setCategory(option)}
              />
            ))}
          </View>
        </View>

        <View style={styles.fieldSection}>
          <Text style={styles.sectionLabel}>Rules</Text>
          <TextInput
            accessibilityLabel="Battle rules"
            multiline
            onChangeText={setRules}
            placeholder="what should people submit?"
            placeholderTextColor="#B9A58E"
            style={styles.rulesInput}
            textAlignVertical="top"
            value={rules}
          />
        </View>

        <View style={styles.fieldSection}>
          <Text style={styles.sectionLabel}>Runs for</Text>
          <View style={styles.optionRow}>
            {durations.map((option) => (
              <OptionPill
                key={option}
                label={option}
                selected={duration === option}
                onPress={() => setDuration(option)}
                style={styles.durationPill}
              />
            ))}
          </View>
        </View>

        <View style={styles.fieldSection}>
          <Text style={styles.sectionLabel}>Who can vote</Text>
          <View style={styles.optionRow}>
            {votingOptions.map((option) => (
              <OptionPill
                key={option}
                label={option}
                selected={voting === option}
                onPress={() => setVoting(option)}
                style={styles.votingPill}
              />
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={[styles.createFooter, { paddingBottom: Math.max(insets.bottom, 24) + 8 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Create battle"
          disabled={!title.trim() || !category || !duration || !voting}
          onPress={createBattle}
          style={({ pressed }) => [
            styles.createButton,
            (!title.trim() || !category || !duration || !voting) && styles.disabledCreateButton,
            pressed && styles.pressed,
          ]}>
          <Text style={styles.createButtonText}>Create</Text>
        </Pressable>
      </View>
    </View>
  );
}

function WaveBackground() {
  return (
    <View pointerEvents="none" style={styles.backgroundWaves}>
      <AnimatedWaveLayer
        path="M0 0h402v18c-48 21-62 54-122 53-61-1-77-38-137-27C74 54 37 96 0 109V0Z"
        fill="#F9DFC9"
        motion={WAVE_MOTION.topBase}
      />
      <AnimatedWaveLayer
        path="M0 0h282c-37 34-65 59-115 79C96 94 43 90 0 142V0Z"
        fill="#EFA96F"
        motion={WAVE_MOTION.topPeach}
      />
      <AnimatedWaveLayer
        path="M0 0h402v25c-37 22-65 54-122 49C216 69 192 29 136 40 77 51 35 102 0 128V0Z"
        fill="#E9904D"
        motion={WAVE_MOTION.topOrange}
      />
      <AnimatedWaveLayer
        path="M0 698c45 27 81 20 130 12 53-8 78-12 126 1 54 15 83 21 146-8v171H0V698Z"
        fill="#F3C39B"
        motion={WAVE_MOTION.bottomBase}
      />
      <AnimatedWaveLayer
        path="M0 748c44-12 68-43 114-44 53-2 86 43 145 38 59-6 79-47 143-43v175H0V748Z"
        fill="#EBAA72"
        motion={WAVE_MOTION.bottomOrange}
      />
      <AnimatedWaveLayer
        path="M0 796c64-13 101-26 159-17 63 10 101 35 155 21 34-9 58-26 88-29v103H0V796Z"
        fill="#F7D8BF"
        motion={WAVE_MOTION.bottomPeach}
      />
    </View>
  );
}

function AnimatedWaveLayer({
  path,
  fill,
  motion,
}: {
  path: string;
  fill: string;
  motion: (typeof WAVE_MOTION)[keyof typeof WAVE_MOTION];
}) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      return;
    }

    progress.value = withRepeat(
      withTiming(1, {
        duration: motion.duration,
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      true
    );
  }, [motion.duration, progress, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => {
    const distance = reduceMotion ? 0 : motion.distance;
    const verticalDistance = reduceMotion ? 0 : 2;
    const rotation = reduceMotion ? 0 : motion.rotation;
    const scale = reduceMotion ? 1 : motion.scale;

    return {
      transform: [
        {
          translateX: interpolate(
            progress.value,
            [0, 1],
            [-distance * motion.direction, distance * motion.direction]
          ),
        },
        {
          translateY: interpolate(
            progress.value,
            [0, 1],
            [-verticalDistance * motion.direction, verticalDistance * motion.direction]
          ),
        },
        {
          rotate: `${interpolate(
            progress.value,
            [0, 1],
            [-rotation * motion.direction, rotation * motion.direction]
          )}deg`,
        },
        { scale: interpolate(progress.value, [0, 1], [1, scale]) },
      ],
    };
  });

  return (
    <Animated.View style={[styles.waveLayer, animatedStyle]}>
      <Svg style={styles.waveSvg} viewBox="0 0 402 874" preserveAspectRatio="none">
        <Path d={path} fill={fill} />
      </Svg>
    </Animated.View>
  );
}

function OptionPill({
  label,
  selected,
  onPress,
  style,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  style?: object;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.optionPill,
        style,
        selected && styles.selectedOptionPill,
        pressed && styles.pressed,
      ]}>
      <Text style={[styles.optionText, selected && styles.selectedOptionText]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  backgroundWaves: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },
  waveLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  waveSvg: {
    position: 'absolute',
    left: '-10%',
    width: '120%',
    height: '100%',
  },
  content: {
    paddingHorizontal: 24,
  },
  scrollView: {
    flex: 1,
  },
  createFooter: {
    paddingHorizontal: 24,
    paddingTop: 10,
  },
  createButton: {
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 30,
    backgroundColor: '#E9904D',
    shadowColor: '#8D7967',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 4,
  },
  disabledCreateButton: {
    backgroundColor: '#D6C8BD',
    shadowOpacity: 0,
    elevation: 0,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontFamily: 'NationalPark',
    fontSize: 18,
    letterSpacing: 0.3,
  },
  backButton: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    shadowColor: '#8D7967',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  backText: {
    marginTop: -4,
    color: '#76563F',
    fontSize: 44,
    fontWeight: '300',
  },
  screenTitle: {
    marginTop: 16,
    marginBottom: 38,
    color: '#D9772D',
    fontSize: 29,
    fontWeight: '500',
    textAlign: 'center',
  },
  fieldSection: {
    marginBottom: 24,
  },
  sectionLabel: {
    marginBottom: 10,
    color: '#C77A3E',
    fontSize: 17,
    fontWeight: '500',
    textAlign: 'center',
  },
  titleInput: {
    minHeight: 54,
    paddingHorizontal: 20,
    borderRadius: 28,
    backgroundColor: '#FFF2EB',
    color: '#76563F',
    fontSize: 15,
    shadowColor: '#8D7967',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  optionPill: {
    minHeight: 42,
    minWidth: 76,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    borderRadius: 24,
    backgroundColor: '#FFF2EB',
    shadowColor: '#8D7967',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  selectedOptionPill: {
    backgroundColor: '#E9904D',
  },
  optionText: {
    color: '#B9A58E',
    fontSize: 15,
  },
  selectedOptionText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  rulesInput: {
    minHeight: 116,
    paddingHorizontal: 20,
    paddingTop: 16,
    borderRadius: 24,
    backgroundColor: '#FFF2EB',
    color: '#76563F',
    fontSize: 15,
    shadowColor: '#8D7967',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  durationPill: {
    flex: 1,
  },
  votingPill: {
    flex: 1,
  },
  pressed: {
    opacity: 0.8,
  },
});
