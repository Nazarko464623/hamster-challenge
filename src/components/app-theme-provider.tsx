import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

export type ThemeMode = 'light' | 'dark';

type ThemeContextValue = {
  mode: ThemeMode;
  ready: boolean;
  setMode: (mode: ThemeMode) => Promise<void>;
  loadError: string;
};

const storageKey = 'hamster-battle:theme-mode:v1';
const ThemeContext = createContext<ThemeContextValue | null>(null);
const styleCache = new WeakMap<object, Partial<Record<ThemeMode, unknown>>>();
const lightTextOnAccent = new Set([
  'createButtonText',
  'saveButtonText',
  'pressedButtonText',
  'selectedOptionText',
  'selectedPeriodButtonText',
  'selectedBattleFilterText',
  'selectedBattleCategoryFilterText',
  'battleRankText',
  'endedVotedText',
  'sendButtonText',
  'outgoingMessageText',
  'signUpText',
  'pressedSignUpText',
]);

const lightColors: Record<string, string> = {
  '#171717': '#172B3A',
  '#181818': '#172B3A',
  '#222222': '#F1F8FD',
  '#242424': '#EDF6FC',
  '#29231D': '#EAF5FB',
  '#202020': '#F4F9FD',
  '#252525': '#F1F8FD',
  '#39332D': '#EDF6FC',
  '#393939': '#EAF5FB',
  '#332719': '#EAF5FB',
  '#2B2B2B': '#E8F3FA',
  '#3A2919': '#E4F2FB',
  '#3A3530': '#E5F0F7',
  '#38302A': '#D6E6F0',
  '#444444': '#D6E6F0',
  '#49321F': '#C7DFEF',
  '#D2CCC4': '#718596',
  '#332416': '#E4F2FB',
  '#2C1E1D': '#FFF5F2',
  '#63322D': '#F0C7BD',
  '#F3F0EB': '#172B3A',
  '#F28C28': '#208AEF',
  '#F87415': '#208AEF',
  '#F8A23A': '#3198EB',
  '#FFAA45': '#208AEF',
  '#F5A047': '#287FC1',
  '#D96B0B': '#1769AA',
  '#C96A13': '#287FC1',
  '#B85F12': '#287FC1',
  '#A85208': '#175D9B',
  '#FFD5B8': '#E4F2FB',
  '#FFE0B2': '#E4F2FB',
  '#FFE6C7': '#E4F2FB',
  '#FFE8CE': '#ECF6FC',
  '#FFF0D8': '#F1F8FD',
  '#FFF1DF': '#EAF5FB',
  '#FFF4E8': '#F5FAFD',
  '#FFF6EB': '#F7FBFE',
  '#FFFAF5': '#F8FCFF',
  '#FFFBF7': '#FBFDFF',
  '#FFFCF8': '#FFFFFF',
  '#F5B565': '#8CC8F2',
  '#FFC477': '#8CC8F2',
  '#FFD7A3': '#B5DDF6',
  '#FFD8A8': '#B5DDF6',
  '#E5D8C8': '#D6E6F0',
  '#F2E3D0': '#DCEBF4',
  '#F5DFC5': '#DCEBF4',
  '#FFE2BF': '#E4F2FB',
  '#AAA39A': '#657987',
  '#706050': '#718596',
  '#777777': '#687C8B',
  '#888888': '#738999',
  '#999999': '#8194A2',
  '#969696': '#788C9B',
  '#9F9F9F': '#8A9CAA',
  '#A8A8A8': '#8A9CAA',
};

const lightBackgroundColors: Record<string, string> = {
  '#171717': '#FFFFFF',
  '#181818': '#FFFFFF',
  '#222222': '#F1F8FD',
  '#242424': '#EDF6FC',
  '#29231D': '#EAF5FB',
  '#2B2B2B': '#E8F3FA',
  '#3A2919': '#E4F2FB',
  '#3A3530': '#E5F0F7',
  '#332416': '#E4F2FB',
  '#202020': '#F4F9FD',
  '#252525': '#F1F8FD',
  '#39332D': '#EDF6FC',
  '#393939': '#EAF5FB',
  '#332719': '#EAF5FB',
  '#38302A': '#D6E6F0',
  '#444444': '#D6E6F0',
  '#49321F': '#C7DFEF',
  '#2C1E1D': '#FFF5F2',
  '#63322D': '#F0C7BD',
};

export function themeColor(color: string, mode: ThemeMode, key = 'color') {
  if (mode === 'dark') {
    return color;
  }

  const normalizedColor = color.toUpperCase();
  if (key === 'backgroundColor' || key === 'fill') {
    return lightBackgroundColors[normalizedColor] ?? lightColors[normalizedColor] ?? color;
  }

  return lightColors[normalizedColor] ?? color;
}

function mapStyleColors(value: unknown, mode: ThemeMode, key = '', parentKey = ''): unknown {
  if (typeof value === 'string' && value.startsWith('#')) {
    if (mode === 'light' && key === 'color' && lightTextOnAccent.has(parentKey)) {
      return '#FFFFFF';
    }
    return themeColor(value, mode, key);
  }

  if (Array.isArray(value)) {
    return value.map((item) => mapStyleColors(item, mode, key, parentKey));
  }

  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, childValue]) => [
        childKey,
        mapStyleColors(childValue, mode, childKey, key),
      ])
    );
  }

  return value;
}

export function useThemedStyles<T>(styles: T): T {
  const { mode } = useAppTheme();
  return useMemo(() => {
    const source = styles as object;
    const cached = styleCache.get(source);
    if (cached?.[mode]) {
      return cached[mode] as T;
    }

    const themed = mapStyleColors(styles, mode) as T;
    styleCache.set(source, { ...cached, [mode]: themed });
    return themed;
  }, [mode, styles]);
}

export function useAppTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useAppTheme must be used within AppThemeProvider.');
  }
  return context;
}

export function AppThemeProvider({ children }: PropsWithChildren) {
  const [mode, setModeState] = useState<ThemeMode>('dark');
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(storageKey)
      .then((value) => {
        if (active && (value === 'light' || value === 'dark')) {
          setModeState(value);
        }
      })
      .catch((error: unknown) => {
        console.error('Failed to load saved theme preference:', error);
        if (active) {
          setLoadError('Could not load your saved appearance preference.');
        }
      })
      .finally(() => {
        if (active) {
          setReady(true);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const setMode = useCallback(async (nextMode: ThemeMode) => {
    if (!ready) {
      throw new Error('Appearance preference is still loading.');
    }

    const previousMode = mode;
    setModeState(nextMode);
    setLoadError('');
    try {
      await AsyncStorage.setItem(storageKey, nextMode);
    } catch (error) {
      setModeState(previousMode);
      throw error;
    }
  }, [mode, ready]);

  const value = useMemo(
    () => ({ mode, ready, setMode, loadError }),
    [mode, ready, setMode, loadError]
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
