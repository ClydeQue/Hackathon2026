import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { palette } from '@/lib/brutalist';

function PressBtn({ children, style, onPress, disabled }: { children: React.ReactNode; style?: any; onPress?: () => void; disabled?: boolean }) {
  const scale = useRef(new Animated.Value(1)).current;
  const pressIn = () => { if (disabled) return; Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 60, bounciness: 0 }).start(); };
  const pressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 8 }).start();
  return (
    <Pressable onPressIn={pressIn} onPressOut={pressOut} onPress={onPress} disabled={disabled}>
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 320, useNativeDriver: true }).start();
  }, []);

  async function submit() {
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) Alert.alert('Sign-in failed', error.message);
  }

  return (
    <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
    <SafeAreaView style={styles.container}>
      {/* Wordmark */}
      <View style={styles.topRow}>
        <Text style={styles.wordmark}>
          Wear<Text style={styles.wordmarkAccent}>Able</Text>
        </Text>
        <View style={styles.sticker}>
          <Text style={styles.stickerText}>v1.0 · MVP</Text>
        </View>
      </View>

      {/* Hero headline */}
      <View style={styles.heroBlock}>
        <Text style={styles.heroText}>
          Wear{'\n'}what{'\n'}you{'\n'}
          <Text style={styles.heroEmphasis}> own. </Text>
        </Text>
        <View style={styles.stickerAbsolute}>
          <Text style={styles.stickerText}>▲ stop · buying</Text>
        </View>
      </View>

      {/* Tagline */}
      <Text style={styles.tagline}>
        Sort your closet by swipe.{'\n'}Give what you don't wear to someone{' '}
        <Text style={{ fontStyle: 'italic' }}>nearby</Text>.{'\n'}Outfit ideas from
        clothes you <Text style={{ textDecorationLine: 'underline' }}>already have</Text>.
      </Text>

      {/* Stats strip */}
      <View style={styles.statsRow}>
        <View style={[styles.statChip, { backgroundColor: palette.lime, transform: [{ rotate: '-3deg' }] }]}>
          <Text style={styles.statChipText}>◉ 92M tonnes wasted / yr</Text>
        </View>
        <View style={[styles.statChip, { backgroundColor: palette.sun, transform: [{ rotate: '3deg' }] }]}>
          <Text style={styles.statChipText}>SDG · 12</Text>
        </View>
      </View>

      {/* Form */}
      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#6B8BB8"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#6B8BB8"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      {/* CTA buttons */}
      <PressBtn style={styles.btnPrimary} onPress={submit} disabled={busy}>
        <Text style={styles.btnPrimaryText}>{busy ? '…' : 'Sign In →'}</Text>
      </PressBtn>
      <Link href="/(auth)/sign-up" asChild>
        <PressBtn style={styles.btnGhost}>
          <Text style={styles.btnGhostText}>Create account</Text>
        </PressBtn>
      </Link>
    </SafeAreaView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.cream,
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 24,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  wordmark: {
    fontFamily: 'CherryBombOne-Regular',
    fontSize: 26,
    color: palette.ink,
    lineHeight: 28,
  },
  wordmarkAccent: { color: palette.pink },
  sticker: {
    backgroundColor: palette.sun,
    borderWidth: 3,
    borderColor: palette.ink,
    paddingHorizontal: 8,
    paddingVertical: 4,
    shadowColor: palette.ink,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    transform: [{ rotate: '6deg' }],
  },
  stickerText: {
    fontWeight: '700',
    fontSize: 10,
    color: palette.ink,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  stickerAbsolute: {
    position: 'absolute',
    top: -8,
    right: -4,
    backgroundColor: palette.cyan,
    borderWidth: 3,
    borderColor: palette.ink,
    paddingHorizontal: 8,
    paddingVertical: 4,
    shadowColor: palette.ink,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    transform: [{ rotate: '-8deg' }],
  },
  heroBlock: { position: 'relative', marginBottom: 16 },
  heroText: {
    fontFamily: 'WorkSans',
    fontWeight: '900',
    fontSize: 52,
    lineHeight: 50,
    color: palette.ink,
    letterSpacing: -1,
  },
  heroEmphasis: {
    fontFamily: 'CherryBombOne-Regular',
    fontSize: 60,
    color: palette.cream,
    backgroundColor: palette.pink,
  },
  tagline: {
    fontSize: 14,
    lineHeight: 20,
    color: palette.ink,
    marginBottom: 14,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
    flexWrap: 'wrap',
  },
  statChip: {
    borderWidth: 3,
    borderColor: palette.ink,
    paddingHorizontal: 10,
    paddingVertical: 5,
    shadowColor: palette.ink,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  statChipText: {
    fontWeight: '700',
    fontSize: 10,
    color: palette.ink,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  input: {
    borderWidth: 3,
    borderColor: palette.ink,
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    fontSize: 15,
    fontWeight: '600',
    color: palette.ink,
    shadowColor: palette.ink,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  btnPrimary: {
    backgroundColor: palette.ink,
    borderWidth: 3,
    borderColor: palette.ink,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: palette.ink,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  btnPrimaryText: {
    color: palette.lime,
    fontWeight: '900',
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  btnGhost: {
    backgroundColor: palette.cream,
    borderWidth: 3,
    borderColor: palette.ink,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: palette.ink,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  btnGhostText: {
    color: palette.ink,
    fontWeight: '900',
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
});
