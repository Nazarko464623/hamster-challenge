import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { useFonts } from 'expo-font';
import Slider from '@react-native-community/slider';
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

import { BattleMedia, type BattleMediaType } from '@/components/battle-media';
import { createBattleWithEntry, saveCreatedBattle, type UserBattle } from '@/lib/battles';
import { themeColor, useAppTheme, useThemedStyles } from '@/components/app-theme-provider';

const categories = ['sport', 'photo', 'art', 'music', 'gaming', 'food', 'other'] as const;

// Shorter durations create faster motion; distance, rotation, and scale control intensity.
const WAVE_MOTION = {
  topBase: { duration: 6_000, distance: 14, rotation: 1.1, scale: 1.025, direction: 1 },
  topPeach: { duration: 4_500, distance: 18, rotation: 1.3, scale: 1.04, direction: 1 },
  topOrange: { duration: 7_000, distance: 16, rotation: 1.2, scale: 1.035, direction: 1 },
  bottomBase: { duration: 9_500, distance: 14, rotation: 1, scale: 1.03, direction: -1 },
  bottomPeach: { duration: 8_500, distance: 13, rotation: 1, scale: 1.025, direction: -1 },
  bottomOrange: { duration: 5_000, distance: 18, rotation: 1.3, scale: 1.04, direction: -1 },
} as const;

export default function CreateScreen() {
  const styles = useThemedStyles(baseStyles);
  const { mode } = useAppTheme();
  const router = useRouter();
  const { nickname } = useLocalSearchParams<{ nickname?: string }>();
  const insets = useSafeAreaInsets();
  const [fontsLoaded, fontError] = useFonts({
    NationalPark: require('../../assets/fonts/NationalPark-SemiBold.ttf'),
  });
  const [title, setTitle] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [category, setCategory] = useState<(typeof categories)[number] | null>(null);
  const [durationDays, setDurationDays] = useState(1);
  const [artwork, setArtwork] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const artworkMediaType: BattleMediaType = artwork?.type === 'video' ? 'video' : 'image';
  const isCreateDisabled =
    !title.trim() || !category || (category === 'other' && !customCategory.trim()) || !artwork;

  const chooseArtwork = async (source: 'camera' | 'gallery') => {
    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setErrorMessage(
        source === 'camera'
          ? 'Camera permission is needed to take a photo.'
          : 'Media library permission is needed to choose a photo or video.'
      );
      return;
    }

    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85 })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images', 'videos'],
            quality: 0.85,
          });
    if (!result.canceled) {
      setArtwork(result.assets[0]);
      setErrorMessage(null);
    }
  };

  const createBattle = async () => {
    const owner = typeof nickname === 'string' && nickname.trim() ? nickname.trim() : 'Player';
    if (isCreateDisabled || !category || !artwork) {
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
    const createdAt = new Date().toISOString();
    const endsAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();
    const battle: UserBattle = {
      id: `created-${Date.now()}`,
      owner,
      title: title.trim(),
      category: category[0].toUpperCase() + category.slice(1),
      icon: categoryIcons[category],
      rules: customCategory.trim(),
      time: `${durationDays} ${durationDays === 1 ? 'day' : 'days'}`,
      artworkUrl: artwork.uri,
      artworkMediaType,
      entries: [{
        id: `local-entry-${Date.now()}`,
        creator: owner,
        mediaUrl: artwork.uri,
        mediaType: artworkMediaType,
        votes: 0,
        votedByMe: false,
      }],
      joined: true,
      players: 1,
      score: 0,
      rank: 0,
      status: 'open',
      createdAt,
      endsAt,
    };

    setIsCreating(true);
    setErrorMessage(null);
    try {
      const sharedBattle = await createBattleWithEntry({
        title,
        category: category[0].toUpperCase() + category.slice(1),
        customCategory: category === 'other' ? customCategory : undefined,
        durationDays,
        artworkUri: artwork.uri,
        mediaType: artworkMediaType,
        owner,
      });
      await saveCreatedBattle(owner, sharedBattle ?? battle);
      router.replace({ pathname: '/feed', params: { nickname: owner } });
    } catch (error) {
      console.error('Failed to create battle:', error);
      setErrorMessage(
        error instanceof Error && error.message.toLowerCase().includes('bucket not found')
          ? 'Battle media storage is missing. Run the battles migration in your Supabase project, then try again.'
          : 'Could not create the battle. Please check your connection and try again.'
      );
    } finally {
      setIsCreating(false);
    }
  };

  if (fontError) {
    throw fontError;
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
            placeholderTextColor={themeColor('#999999', mode)}
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
                onPress={() => {
                  setCategory(option);
                  if (option !== 'other') {
                    setCustomCategory('');
                  }
                }}
              />
            ))}
          </View>
        </View>

        {category === 'other' && <View style={styles.fieldSection}>
          <Text style={styles.sectionLabel}>Other category</Text>
          <TextInput
            accessibilityLabel="Other category"
            onChangeText={setCustomCategory}
            placeholder="enter your category"
            placeholderTextColor={themeColor('#999999', mode)}
            style={styles.titleInput}
            value={customCategory}
          />
        </View>}

        <View style={styles.fieldSection}>
          <Text style={styles.sectionLabel}>Add your photo or video</Text>
          <View style={styles.artworkActions}>
            <Pressable accessibilityRole="button" accessibilityLabel="Take artwork photo" onPress={() => chooseArtwork('camera')} style={styles.artworkButton}>
              <Text style={styles.artworkButtonIcon}>⌾</Text>
              <Text style={styles.artworkButtonText}>Camera</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Choose artwork from gallery" onPress={() => chooseArtwork('gallery')} style={styles.artworkButton}>
              <Text style={styles.artworkButtonIcon}>▧</Text>
              <Text style={styles.artworkButtonText}>Gallery</Text>
            </Pressable>
          </View>
          {artwork && (
            <BattleMedia
              source={artwork.uri}
              mediaType={artworkMediaType}
              style={styles.artworkPreview}
            />
          )}
          {artwork && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Remove selected artwork"
              onPress={() => setArtwork(null)}
              style={({ pressed }) => [styles.removeArtworkButton, pressed && styles.pressed]}>
              <Text style={styles.removeArtworkText}>Remove media</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.fieldSection}>
          <Text style={styles.sectionLabel}>Runs for</Text>
          <View style={styles.sliderLabels}>
            <Text style={styles.sliderValue}>1 day</Text>
            <Text style={styles.sliderValue}>{durationDays} {durationDays === 1 ? 'day' : 'days'}</Text>
            <Text style={styles.sliderValue}>7 days</Text>
          </View>
          <Slider accessibilityLabel="Battle duration" minimumValue={1} maximumValue={7} step={1} value={durationDays} onValueChange={setDurationDays} minimumTrackTintColor="#F28C28" maximumTrackTintColor="#3A3530" thumbTintColor="#F28C28" />
        </View>
      </ScrollView>

      <View style={[styles.createFooter, { paddingBottom: Math.max(insets.bottom, 24) + 8 }]}>
        {errorMessage && <Text accessibilityRole="alert" style={styles.errorText}>{errorMessage}</Text>}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Create battle"
          disabled={isCreateDisabled || isCreating}
          onPress={createBattle}
          style={({ pressed }) => [
            styles.createButton,
            (isCreateDisabled || isCreating) && styles.disabledCreateButton,
            pressed && styles.pressed,
          ]}>
          <Text
            style={[
              styles.createButtonText,
              (isCreateDisabled || isCreating) && styles.disabledCreateButtonText,
              fontsLoaded && styles.loadedCreateButtonText,
            ]}>
            {isCreating ? 'Creating…' : 'Create'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function WaveBackground() {
  const styles = useThemedStyles(baseStyles);
  const { mode } = useAppTheme();
  return (
    <View pointerEvents="none" style={styles.backgroundWaves}>
      <AnimatedWaveLayer
        path="M0 0h402v18c-48 21-62 54-122 53-61-1-77-38-137-27C74 54 37 96 0 109V0Z"
        fill={themeColor('#181818', mode, 'fill')}
        motion={WAVE_MOTION.topBase}
      />
      <AnimatedWaveLayer
        path="M0 0h282c-37 34-65 59-115 79C96 94 43 90 0 142V0Z"
        fill={themeColor('#29231D', mode, 'fill')}
        motion={WAVE_MOTION.topPeach}
      />
      <AnimatedWaveLayer
        path="M0 0h402v25c-37 22-65 54-122 49C216 69 192 29 136 40 77 51 35 102 0 128V0Z"
        fill={themeColor('#F28C28', mode, 'fill')}
        motion={WAVE_MOTION.topOrange}
      />
      <AnimatedWaveLayer
        path="M0 698c45 27 81 20 130 12 53-8 78-12 126 1 54 15 83 21 146-8v171H0V698Z"
        fill={themeColor('#181818', mode, 'fill')}
        motion={WAVE_MOTION.bottomBase}
      />
      <AnimatedWaveLayer
        path="M0 748c44-12 68-43 114-44 53-2 86 43 145 38 59-6 79-47 143-43v175H0V748Z"
        fill={themeColor('#29231D', mode, 'fill')}
        motion={WAVE_MOTION.bottomOrange}
      />
      <AnimatedWaveLayer
        path="M0 796c64-13 101-26 159-17 63 10 101 35 155 21 34-9 58-26 88-29v103H0V796Z"
        fill={themeColor('#242424', mode, 'fill')}
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
  const styles = useThemedStyles(baseStyles);
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
  const styles = useThemedStyles(baseStyles);
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

const baseStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#171717',
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
  errorText: {
    marginBottom: 8,
    color: '#FF9B86',
    fontSize: 13,
    textAlign: 'center',
  },
  createButton: {
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 30,
    backgroundColor: '#F28C28',
    shadowColor: '#706050',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 4,
  },
  disabledCreateButton: {
    backgroundColor: '#3A3530',
    shadowOpacity: 0,
    elevation: 0,
  },
  disabledCreateButtonText: {
    color: '#AAA39A',
  },
  createButtonText: {
    color: '#171717',
    fontSize: 18,
    letterSpacing: 0.3,
  },
  loadedCreateButtonText: {
    fontFamily: 'NationalPark',
  },
  backButton: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 28,
    backgroundColor: '#171717',
    shadowColor: '#706050',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  backText: {
    marginTop: -4,
    color: '#F3F0EB',
    fontSize: 44,
    fontWeight: '300',
  },
  screenTitle: {
    marginTop: 16,
    marginBottom: 38,
    color: '#FFAA45',
    fontSize: 29,
    fontWeight: '500',
    textAlign: 'center',
  },
  fieldSection: {
    marginBottom: 24,
  },
  sectionLabel: {
    marginBottom: 10,
    color: '#F5A047',
    fontSize: 17,
    fontWeight: '500',
    textAlign: 'center',
  },
  titleInput: {
    minHeight: 54,
    paddingHorizontal: 20,
    borderRadius: 28,
    backgroundColor: '#222222',
    color: '#F3F0EB',
    fontSize: 15,
    shadowColor: '#706050',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  artworkActions: {
    flexDirection: 'row',
    gap: 10,
  },
  artworkButton: {
    flex: 1,
    minHeight: 76,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: '#222222',
  },
  artworkButtonIcon: {
    color: '#F28C28',
    fontSize: 26,
  },
  artworkButtonText: {
    marginTop: 4,
    color: '#F3F0EB',
    fontSize: 14,
  },
  artworkPreview: {
    width: '100%',
    height: 150,
    marginTop: 12,
    borderRadius: 22,
  },
  removeArtworkButton: {
    alignSelf: 'center',
    marginTop: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#3A3530',
  },
  removeArtworkText: {
    color: '#F3F0EB',
    fontSize: 13,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sliderValue: {
    color: '#AAA39A',
    fontSize: 13,
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
    backgroundColor: '#222222',
    shadowColor: '#706050',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  selectedOptionPill: {
    backgroundColor: '#F28C28',
  },
  optionText: {
    color: '#AAA39A',
    fontSize: 15,
  },
  selectedOptionText: {
    color: '#171717',
    fontWeight: '600',
  },
  rulesInput: {
    minHeight: 116,
    paddingHorizontal: 20,
    paddingTop: 16,
    borderRadius: 24,
    backgroundColor: '#222222',
    color: '#F3F0EB',
    fontSize: 15,
    shadowColor: '#706050',
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
