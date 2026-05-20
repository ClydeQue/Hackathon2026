// =====================================================================
// Brutalist design tokens — modeled on dev-snake/brutalist-ui.
//
//   - 3px solid black borders everywhere
//   - Hard offset shadows (no blur), down-right
//   - Bold 900 typography, often uppercase, tight letter-spacing
//   - Coral / Teal / Yellow accents on a black-and-white base
//
// Hard shadows look correct on iOS via shadowOffset + shadowRadius:0. On
// Android, RN ignores shadow* and renders only blurred `elevation`, which
// doesn't match the look — we keep elevation:0 and accept that Android
// will show the border without the offset shadow. The visual identity
// survives because the heavy borders carry it.
// =====================================================================

import type { TextStyle, ViewStyle } from 'react-native';

export const palette = {
  black: '#000000',
  white: '#FFFFFF',
  bg: '#FAFAF7',
  coral: '#FF6B6B',
  teal: '#4ECDC4',
  yellow: '#FFE66D',
  muted: '#666666',
} as const;

export const border = {
  thin: 2,
  base: 3,
  thick: 4,
} as const;

export const radius = {
  none: 0,
  sm: 4,
  md: 8,
  pill: 999,
} as const;

export function hardShadow(size: 'sm' | 'md' | 'lg' = 'md'): ViewStyle {
  const offset = size === 'sm' ? 2 : size === 'lg' ? 6 : 4;
  return {
    shadowColor: palette.black,
    shadowOffset: { width: offset, height: offset },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
  };
}

// Reusable composite styles. Spread these into StyleSheet.create() entries.
export const surfaces = {
  card: {
    backgroundColor: palette.white,
    borderWidth: border.base,
    borderColor: palette.black,
    borderRadius: radius.sm,
    ...hardShadow('md'),
  } as ViewStyle,
  cardFlat: {
    backgroundColor: palette.white,
    borderWidth: border.base,
    borderColor: palette.black,
    borderRadius: radius.sm,
  } as ViewStyle,
  inputBox: {
    borderWidth: border.base,
    borderColor: palette.black,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: '700',
    color: palette.black,
    backgroundColor: palette.white,
  } as TextStyle,
} as const;

export const buttons = {
  base: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderWidth: border.base,
    borderColor: palette.black,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    ...hardShadow('md'),
  } as ViewStyle,
  primary: { backgroundColor: palette.black } as ViewStyle,
  primaryText: {
    color: palette.white,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontSize: 14,
  } as TextStyle,
  ghost: { backgroundColor: palette.white } as ViewStyle,
  ghostText: {
    color: palette.black,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontSize: 14,
  } as TextStyle,
  accent: (bg: string) => ({ backgroundColor: bg }) as ViewStyle,
} as const;

export const typography = {
  display: {
    fontSize: 28,
    fontWeight: '900',
    color: palette.black,
    letterSpacing: 0.3,
  } as TextStyle,
  heading: {
    fontSize: 20,
    fontWeight: '900',
    color: palette.black,
  } as TextStyle,
  body: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.black,
  } as TextStyle,
  caption: {
    fontSize: 11,
    fontWeight: '900',
    color: palette.black,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  } as TextStyle,
} as const;
