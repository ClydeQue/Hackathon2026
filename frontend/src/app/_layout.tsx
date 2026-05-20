import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null);
  const segments = useSegments();
  const router = useRouter();

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

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
