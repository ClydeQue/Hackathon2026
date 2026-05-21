import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
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

function Field({
  label,
  value,
  placeholder,
  onChangeText,
  secureTextEntry,
  keyboardType,
  badge,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChangeText: (v: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: 'email-address' | 'default';
  badge?: string;
}) {
  return (
    <View style={styles.fieldWrap}>
      <View style={styles.fieldLabelRow}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {badge ? <Text style={styles.fieldBadge}>{badge}</Text> : null}
      </View>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor="#6B8BB8"
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType ?? 'default'}
        autoCapitalize="none"
      />
    </View>
  );
}

export default function SignUp() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 320, useNativeDriver: true }).start();
  }, []);

  async function submit() {
    setBusy(true);
    const { error } = await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (error) Alert.alert('Sign-up failed', error.message);
    else Alert.alert('Check your email', 'Confirm your account, then sign in.');
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {/* Back / step indicator */}
        <Text style={styles.crumb}>← back · step 1 / 2</Text>

        {/* Headline */}
        <Text style={styles.headline}>
          New{'\n'}<Text style={styles.headlineEm}>here.</Text>
        </Text>
        <Text style={styles.subtitle}>
          We need just enough to find your neighbours.
        </Text>

        {/* Form fields */}
        <Field
          label="email"
          value={email}
          placeholder="you@example.com"
          keyboardType="email-address"
          onChangeText={setEmail}
        />
        <Field
          label="password"
          value={password}
          placeholder="8+ characters"
          secureTextEntry
          onChangeText={setPassword}
          badge="strong ✓"
        />

        {/* Privacy notice */}
        <View style={styles.notice}>
          <Text style={styles.noticeText}>
            <Text style={{ fontWeight: '900' }}>City only.</Text> We never store
            your exact location. Donation matches stay within ~10 km of where you are.
          </Text>
        </View>

        {/* CTA */}
        <PressBtn style={styles.btnPrimary} onPress={submit} disabled={busy}>
          <Text style={styles.btnPrimaryText}>
            {busy ? '…' : 'Create my closet →'}
          </Text>
        </PressBtn>

        <Link href="/(auth)/sign-in" asChild>
          <PressBtn style={styles.btnGhost}>
            <Text style={styles.btnGhostText}>I already have an account</Text>
          </PressBtn>
        </Link>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.cream },
  scroll: { flex: 1 },
  container: {
    paddingHorizontal: 22,
    paddingTop: 16,
    paddingBottom: 32,
  },
  crumb: {
    fontWeight: '700',
    fontSize: 11,
    color: palette.ink,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    opacity: 0.6,
    marginBottom: 14,
  },
  headline: {
    fontFamily: 'WorkSans',
    fontWeight: '900',
    fontSize: 42,
    lineHeight: 42,
    color: palette.ink,
    letterSpacing: -0.8,
    marginBottom: 6,
  },
  headlineEm: {
    fontFamily: 'CherryBombOne-Regular',
    fontSize: 48,
    color: palette.pink,
  },
  subtitle: {
    fontSize: 13,
    color: palette.ink,
    opacity: 0.7,
    marginBottom: 22,
    lineHeight: 18,
  },
  fieldWrap: { marginBottom: 14 },
  fieldLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  fieldLabel: {
    fontWeight: '700',
    fontSize: 10,
    color: palette.ink,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  fieldBadge: {
    fontWeight: '700',
    fontSize: 10,
    color: palette.pink,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  input: {
    borderWidth: 3,
    borderColor: palette.ink,
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '600',
    color: palette.ink,
    shadowColor: palette.ink,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  notice: {
    backgroundColor: palette.lilac,
    borderWidth: 3,
    borderColor: palette.ink,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 20,
    shadowColor: palette.ink,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  noticeText: {
    fontSize: 12,
    lineHeight: 17,
    color: palette.ink,
  },
  btnPrimary: {
    backgroundColor: palette.pink,
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
    color: palette.cream,
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
