import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

export type BattleMediaType = 'image' | 'video';

export function BattleMedia({
  source,
  mediaType,
  style,
}: {
  source: string;
  mediaType: BattleMediaType;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.container, style]}>
      {mediaType === 'video' ? (
        <BattleVideo source={source} />
      ) : (
        <Image accessibilityLabel="Battle entry" contentFit="cover" source={{ uri: source }} style={styles.media} />
      )}
    </View>
  );
}

function BattleVideo({ source }: { source: string }) {
  const player = useVideoPlayer(source);

  return (
    <VideoView
      accessibilityLabel="Battle video"
      contentFit="cover"
      nativeControls
      player={player}
      style={styles.media}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  media: {
    width: '100%',
    height: '100%',
  },
});
