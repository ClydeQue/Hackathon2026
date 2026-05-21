import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import type { Session } from '@supabase/supabase-js';
import { Splash } from '@/components/Splash';
import { supabase } from '@/lib/supabase';

// Font files live in frontend/assets/fonts/. Work Sans is a variable font
// (wght axis) so we only need two files. Cherry Bomb One is the WearAble
// display/emphasis font used for standout words.
const FONT_ASSETS = {
  'WorkSans': require('../../assets/fonts/WorkSans-VariableFont_wght.ttf'),
  'WorkSans-Italic': require('../../assets/fonts/WorkSans-Italic-VariableFont_wght.ttf'),
  'DMSerifDisplay-Regular': require('../../assets/fonts/DMSerifDisplay-Regular.ttf'),
  'DMSerifDisplay-Italic': require('../../assets/fonts/DMSerifDisplay-Italic.ttf'),
  'CherryBombOne-Regular': require('../../assets/fonts/CherryBombOne-Regular.ttf'),
};

// React Native's `Text` is a plain function component (TextImpl), not a
// forwardRef, so we can't monkey-patch a `render` method or rely on
// defaultProps (deprecated for function components in React 18+).
//
// Modern Expo / Babel uses the JSX automatic runtime — `<Text>` compiles
// to `jsx(Text, ...)` from `react/jsx-runtime`, NOT `React.createElement`.
// We patch BOTH paths so every render of Text/TextInput gets a default
// font family prepended to its style array. The caller's style still wins
// because it lands after ours in the resulting array, so screens that opt
// into DM Serif Display (via @/lib/fonts) keep their chosen face.
function styleHasFamily(style: unknown): boolean {
  const flat = StyleSheet.flatten(style as any) as Record<string, unknown> | null;
  return !!(flat && typeof flat.fontFamily === 'string' && flat.fontFamily);
}

function styleIsItalic(style: unknown): boolean {
  const flat = StyleSheet.flatten(style as any) as Record<string, unknown> | null;
  return !!(flat && flat.fontStyle === 'italic');
}

function wrapElementFactory<T extends (...args: any[]) => any>(original: T): T {
  return function patched(type: any, props: any, ...rest: any[]) {
    if (
      (type === Text || type === TextInput) &&
      (!props || !styleHasFamily(props.style))
    ) {
      const family = styleIsItalic(props?.style) ? 'WorkSans-Italic' : 'WorkSans';
      const nextProps = {
        ...(props ?? {}),
        style: [{ fontFamily: family }, props?.style],
      };
      return original(type, nextProps, ...rest);
    }
    return original(type, props, ...rest);
  } as unknown as T;
}

function applyGlobalFontMapping() {
  // Patch the classic createElement path (used by older JSX transforms,
  // direct calls, and some libraries).
  if (!(React as any).__fontPatched) {
    const originalCreateElement = React.createElement;
    (React as any).createElement = wrapElementFactory(originalCreateElement);
    (React as any).__fontPatched = true;
  }

  // Patch the automatic JSX runtime — this is what babel-preset-expo emits
  // for `<Text>` etc. Without this, the createElement patch above never
  // fires for ordinary JSX in screens.
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const jsxRuntime = require('react/jsx-runtime');
    if (jsxRuntime && !jsxRuntime.__fontPatched) {
      if (typeof jsxRuntime.jsx === 'function') {
        jsxRuntime.jsx = wrapElementFactory(jsxRuntime.jsx);
      }
      if (typeof jsxRuntime.jsxs === 'function') {
        jsxRuntime.jsxs = wrapElementFactory(jsxRuntime.jsxs);
      }
      jsxRuntime.__fontPatched = true;
    }
  } catch {}

  // Dev builds may use the jsxDEV variant.
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const jsxDevRuntime = require('react/jsx-dev-runtime');
    if (jsxDevRuntime && !jsxDevRuntime.__fontPatched) {
      if (typeof jsxDevRuntime.jsxDEV === 'function') {
        jsxDevRuntime.jsxDEV = wrapElementFactory(jsxDevRuntime.jsxDEV);
      }
      jsxDevRuntime.__fontPatched = true;
    }
  } catch {}
}

applyGlobalFontMapping();

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null);
  const segments = useSegments();
  const router = useRouter();

  const [fontsReady] = useFonts(FONT_ASSETS);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Fetch onboarding status whenever the session's user changes.
  useEffect(() => {
    if (!session?.user) {
      setNeedsOnboarding(null);
      return;
    }
    let cancelled = false;
    supabase
      .from('profiles')
      .select('onboarded_at')
      .eq('user_id', session.user.id)
      .single()
      .then(({ data }) => {
        if (cancelled) return;
        setNeedsOnboarding(!data?.onboarded_at);
      });
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === '(auth)';
    const inOnboarding = segments[0] === 'onboarding';
    if (!session && !inAuthGroup) {
      router.replace('/(auth)/sign-in');
      return;
    }
    if (session && needsOnboarding === true && !inOnboarding) {
      router.replace('/onboarding');
      return;
    }
    if (session && needsOnboarding === false && (inAuthGroup || inOnboarding)) {
      router.replace('/(tabs)');
    }
  }, [session, loading, needsOnboarding, segments, router]);

  if (loading || !fontsReady) {
    return <Splash />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            headerBackTitle: '',
            headerBackButtonDisplayMode: 'minimal',
          }}
        />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
