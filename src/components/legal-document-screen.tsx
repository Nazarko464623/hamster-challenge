import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useThemedStyles } from '@/components/app-theme-provider';
import { LEGAL_UPDATED, type LegalDocument } from '@/lib/legal';

export function LegalDocumentScreen({ document }: { document: LegalDocument }) {
  const styles = useThemedStyles(baseStyles);
  const insets = useSafeAreaInsets();
  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  return (
    <View style={styles.screen}>
      <StatusBar hidden />
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) + 8 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={8}
          onPress={goBack}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
          <Text style={styles.backArrow}>‹</Text>
        </Pressable>
        <Text accessibilityRole="header" style={styles.title} numberOfLines={1}>
          {document.title}
        </Text>
      </View>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 16) + 24 }]}
        showsVerticalScrollIndicator={false}>
        <Text style={styles.updated}>Last updated: {LEGAL_UPDATED}</Text>
        <Text style={styles.intro}>{document.intro}</Text>
        {document.sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              {section.title}
            </Text>
            {section.paragraphs.map((paragraph) => (
              <Text key={paragraph} selectable style={styles.paragraph}>
                {paragraph}
              </Text>
            ))}
          </View>
        ))}
      </ScrollView>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: '#222222',
  },
  backArrow: {
    marginTop: -4,
    color: '#FFAA45',
    fontSize: 36,
    fontWeight: '300',
    lineHeight: 40,
  },
  title: {
    flex: 1,
    color: '#F3F0EB',
    fontSize: 22,
    fontWeight: '700',
  },
  content: {
    paddingHorizontal: 20,
    gap: 18,
  },
  updated: {
    color: '#999999',
    fontSize: 13,
  },
  intro: {
    color: '#F3F0EB',
    fontSize: 15,
    lineHeight: 22,
  },
  section: {
    gap: 8,
    padding: 16,
    borderRadius: 20,
    backgroundColor: '#222222',
  },
  sectionTitle: {
    color: '#F28C28',
    fontSize: 16,
    fontWeight: '600',
  },
  paragraph: {
    color: '#D2CCC4',
    fontSize: 14,
    lineHeight: 21,
  },
  pressed: {
    opacity: 0.7,
  },
});
