import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DM_SERIF, WORK_SANS } from '@/lib/fonts';

const ACCENT = '#FFE66D'; // matches the center "+" tab button
const INK = '#000';
const PAPER = '#fff';

// Three black squares that pulse in sequence — flat, no blur, no soft easing.
// Matches the neobrutalist palette: hard borders, offset shadows, primary
// accents. Avoids ActivityIndicator's iOS-style spinner which would feel
// out of place on top of the rest of the UI.
function LoadingDots() {
  const dots = [useRef(new Animated.Value(0.25)).current, useRef(new Animated.Value(0.25)).current, useRef(new Animated.Value(0.25)).current];

  useEffect(() => {
    const loops = dots.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(v, {
            toValue: 1,
            duration: 320,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.timing(v, {
            toValue: 0.25,
            duration: 320,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.delay(160),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
    // dots are stable refs; intentionally not in deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.dots}>
      {dots.map((v, i) => (
        <Animated.View key={i} style={[styles.dot, { opacity: v }]} />
      ))}
    </View>
  );
}

export function Splash() {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.iconBox}>
          <Ionicons name="shirt" size={36} color={INK} />
        </View>
        <Text style={styles.wordmark}>SlowFashion</Text>
        <View style={styles.rule} />
        <Text style={styles.tagline}>Wear more. Buy less.</Text>
        <LoadingDots />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ACCENT,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  card: {
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
    paddingVertical: 36,
    paddingHorizontal: 28,
    backgroundColor: PAPER,
    borderRadius: 6,
    borderWidth: 3,
    borderColor: INK,
    shadowColor: INK,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 6, height: 6 },
    elevation: 0,
  },
  iconBox: {
    width: 76,
    height: 76,
    backgroundColor: ACCENT,
    borderWidth: 3,
    borderColor: INK,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 22,
  },
  wordmark: {
    fontFamily: DM_SERIF.regular,
    fontSize: 36,
    color: INK,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  rule: {
    width: 56,
    height: 3,
    backgroundColor: INK,
    marginTop: 12,
    marginBottom: 12,
  },
  tagline: {
    fontFamily: WORK_SANS.regular,
    fontSize: 13,
    color: INK,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    fontWeight: '600',
    textAlign: 'center',
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 28,
  },
  dot: {
    width: 10,
    height: 10,
    backgroundColor: INK,
  },
});
