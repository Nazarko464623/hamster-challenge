/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/theme';
import { useAppTheme } from '@/components/app-theme-provider';

export function useTheme() {
  const { mode } = useAppTheme();
  return Colors[mode];
}
