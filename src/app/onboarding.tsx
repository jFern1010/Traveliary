import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { BackHandler, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/icon';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BrandColor, Spacing } from '@/constants/theme';
import { acceptCurrentTerms } from '@/features/onboarding/storage';

const POINTS: { icon: IconName; title: string; body: string }[] = [
  {
    icon: 'camera',
    title: 'Snap where you are',
    body: 'Take a photo or selfie in the app. It’s tagged with the place, like Zermatt, Switzerland.',
  },
  {
    icon: 'world',
    title: 'Posts are public',
    body: 'Everyone can see your photo at that place. Nothing is posted until you tap “Post publicly”.',
  },
  {
    icon: 'lock',
    title: 'Your exact spot stays private',
    body: 'Others see the place name only, never your exact position. No account or profile needed.',
  },
  {
    icon: 'kind',
    title: 'Be kind',
    body: 'Respect people in your shots. Anyone can report a photo; reported photos are hidden.',
  },
];

function openLegal(doc: 'terms' | 'privacy') {
  router.push({ pathname: '/legal/[doc]', params: { doc } });
}

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();

  // Android back button: agreeing is required, so don't let it dismiss this screen.
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
      return () => sub.remove();
    }, []),
  );

  async function start() {
    await acceptCurrentTerms();
    router.back();
  }

  return (
    <ThemedView style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + Spacing.five,
          paddingHorizontal: Spacing.four,
          paddingBottom: Spacing.four,
          gap: Spacing.four,
        }}>
        <View style={{ gap: Spacing.two }}>
          <ThemedText type="title" style={{ fontSize: 40, lineHeight: 46 }}>
            Traveliary
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={{ fontSize: 18, lineHeight: 26 }}>
            A travel diary in photos. See who’s been where, and add yourself to the map.
          </ThemedText>
        </View>

        {POINTS.map((point) => (
          <View key={point.title} style={{ flexDirection: 'row', gap: Spacing.three }}>
            <Icon name={point.icon} color={BrandColor} size={28} />
            <View style={{ flex: 1, gap: Spacing.half }}>
              <ThemedText type="smallBold" style={{ fontSize: 17 }}>
                {point.title}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {point.body}
              </ThemedText>
            </View>
          </View>
        ))}
      </ScrollView>

      <ThemedText
        type="small"
        themeColor="textSecondary"
        style={{ textAlign: 'center', paddingHorizontal: Spacing.four }}>
        By continuing you agree to the{' '}
        <ThemedText type="small" style={{ color: BrandColor }} onPress={() => openLegal('terms')}>
          Terms of Use
        </ThemedText>
        , including zero tolerance for abusive content, and the{' '}
        <ThemedText type="small" style={{ color: BrandColor }} onPress={() => openLegal('privacy')}>
          Privacy Policy
        </ThemedText>
        .
      </ThemedText>
      <View
        style={{
          flexDirection: 'row',
          paddingHorizontal: Spacing.four,
          paddingTop: Spacing.two,
          paddingBottom: insets.bottom + Spacing.three,
        }}>
        <PrimaryButton label="Agree & continue" onPress={start} />
      </View>
    </ThemedView>
  );
}
