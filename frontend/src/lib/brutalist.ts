// =====================================================================
// WearAble design tokens — modeled on dev-snake/brutalist-ui.
//
//   - 3px solid ink borders everywhere (no radius)
//   - Hard offset shadows (no blur), down-right
//   - Work Sans 900 for headings, Cherry Bomb One for emphasis
//   - Blue-wash palette: cream/paper/smoke on ink base
//
// Hard shadows look correct on iOS via shadowOffset + shadowRadius:0. On
// Android, RN ignores shadow* and renders only blurred `elevation`, which
// doesn't match the look — we keep elevation:0 and accept the border carries it.
// =====================================================================

import type { TextStyle, ViewStyle } from 'react-native';

export const palette = {
  ink:    '#0F1117',   // near-black
  cream:  '#EEF4FB',   // blue wash · page bg
  paper:  '#DCEAF6',   // surface · stronger wash
  smoke:  '#C8DBF0',   // hairlines, disabled
  pink:   '#2A6FDB',   // Blue Primary · primary CTA
  cyan:   '#5BA3E8',   // Blue Light · info
  lilac:  '#C8DBF0',   // Blue Soft · accent surface
  lime:   '#F4FF61',   // signal yellow · secondary highlight
  sun:    '#FFAE2D',   // warning / amber
  coral:  '#FF5C4D',   // destructive
} as const;

export const fonts = {
  display:  'CherryBombOne-Regular',   // emphasis words only
  heading:  'WorkSans',                // Work Sans 900
  body:     'WorkSans',                // Work Sans 400–800
} as const;

export const border = {
  thin: 2,
  base: 3,
  thick: 4,
} as const;

export const radius = {
  none: 0,
} as const;

export function hardShadow(size: 'sm' | 'md' | 'lg' = 'md'): ViewStyle {
  const offset = size === 'sm' ? 2 : size === 'lg' ? 6 : 4;
  return {
    shadowColor: palette.ink,
    shadowOffset: { width: offset, height: offset },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
  };
}

// Reusable composite styles. Spread these into StyleSheet.create() entries.
export const surfaces = {
  card: {
    backgroundColor: palette.cream,
    borderWidth: border.base,
    borderColor: palette.ink,
    ...hardShadow('md'),
  } as ViewStyle,
  cardWhite: {
    backgroundColor: '#fff',
    borderWidth: border.base,
    borderColor: palette.ink,
    ...hardShadow('md'),
  } as ViewStyle,
  cardFlat: {
    backgroundColor: palette.cream,
    borderWidth: border.base,
    borderColor: palette.ink,
  } as ViewStyle,
  inputBox: {
    borderWidth: border.base,
    borderColor: palette.ink,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '600',
    color: palette.ink,
    backgroundColor: '#fff',
    ...hardShadow('sm'),
  } as TextStyle,
} as const;

export const buttons = {
  base: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderWidth: border.base,
    borderColor: palette.ink,
    alignItems: 'center',
    justifyContent: 'center',
    ...hardShadow('md'),
  } as ViewStyle,
  primary: { backgroundColor: palette.pink } as ViewStyle,
  primaryText: {
    color: palette.cream,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontSize: 14,
  } as TextStyle,
  accent: { backgroundColor: palette.ink } as ViewStyle,
  accentText: {
    color: palette.lime,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontSize: 14,
  } as TextStyle,
  secondary: { backgroundColor: palette.lime } as ViewStyle,
  secondaryText: {
    color: palette.ink,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontSize: 14,
  } as TextStyle,
  ghost: { backgroundColor: palette.cream } as ViewStyle,
  ghostText: {
    color: palette.ink,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontSize: 14,
  } as TextStyle,
} as const;

export const typography = {
  display: {
    fontFamily: fonts.heading,
    fontSize: 32,
    fontWeight: '900',
    color: palette.ink,
    letterSpacing: -0.5,
    lineHeight: 34,
  } as TextStyle,
  heading: {
    fontFamily: fonts.heading,
    fontSize: 22,
    fontWeight: '900',
    color: palette.ink,
    letterSpacing: -0.3,
  } as TextStyle,
  subhead: {
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '800',
    color: palette.ink,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  } as TextStyle,
  body: {
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: '400',
    color: palette.ink,
    lineHeight: 20,
  } as TextStyle,
  caption: {
    fontFamily: fonts.body,
    fontSize: 10,
    fontWeight: '700',
    color: palette.ink,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  } as TextStyle,
  mono: {
    fontSize: 10,
    fontWeight: '700',
    color: palette.ink,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  } as TextStyle,
} as const;
