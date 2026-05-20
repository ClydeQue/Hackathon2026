// Lightweight color compatibility helpers for the rule-based outfit recommender.
// Colors are stored as short canonical names; we map them to hue families and
// neutrality, then decide if two items "go" together.

export type HueFamily =
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'blue'
  | 'purple'
  | 'pink'
  | 'brown';

type ColorEntry =
  | { kind: 'neutral' }
  | { kind: 'hue'; hue: HueFamily };

const COLORS: Record<string, ColorEntry> = {
  // Neutrals — pair with anything.
  black: { kind: 'neutral' },
  white: { kind: 'neutral' },
  grey: { kind: 'neutral' },
  gray: { kind: 'neutral' },
  cream: { kind: 'neutral' },
  beige: { kind: 'neutral' },
  tan: { kind: 'neutral' },
  ivory: { kind: 'neutral' },
  charcoal: { kind: 'neutral' },
  navy: { kind: 'neutral' },
  denim: { kind: 'neutral' },
  khaki: { kind: 'neutral' },
  olive: { kind: 'neutral' },

  // Hued colors.
  red: { kind: 'hue', hue: 'red' },
  maroon: { kind: 'hue', hue: 'red' },
  burgundy: { kind: 'hue', hue: 'red' },
  orange: { kind: 'hue', hue: 'orange' },
  rust: { kind: 'hue', hue: 'orange' },
  yellow: { kind: 'hue', hue: 'yellow' },
  mustard: { kind: 'hue', hue: 'yellow' },
  green: { kind: 'hue', hue: 'green' },
  forest: { kind: 'hue', hue: 'green' },
  mint: { kind: 'hue', hue: 'green' },
  teal: { kind: 'hue', hue: 'green' },
  blue: { kind: 'hue', hue: 'blue' },
  sky: { kind: 'hue', hue: 'blue' },
  cobalt: { kind: 'hue', hue: 'blue' },
  purple: { kind: 'hue', hue: 'purple' },
  violet: { kind: 'hue', hue: 'purple' },
  lavender: { kind: 'hue', hue: 'purple' },
  pink: { kind: 'hue', hue: 'pink' },
  rose: { kind: 'hue', hue: 'pink' },
  brown: { kind: 'hue', hue: 'brown' },
  chocolate: { kind: 'hue', hue: 'brown' },
};

// Hue wheel order — used for analogous/complementary checks.
const WHEEL: HueFamily[] = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink'];

function lookup(color: string | null | undefined): ColorEntry | null {
  if (!color) return null;
  return COLORS[color.trim().toLowerCase()] ?? null;
}

export function isCompatible(a: string | null | undefined, b: string | null | undefined): boolean {
  const ea = lookup(a);
  const eb = lookup(b);
  // Unknown colors don't disqualify — assume neutral-ish.
  if (!ea || !eb) return true;
  if (ea.kind === 'neutral' || eb.kind === 'neutral') return true;

  // Brown plays nicely with everything earthy; treat as neutral.
  if (ea.hue === 'brown' || eb.hue === 'brown') return true;

  const ia = WHEEL.indexOf(ea.hue);
  const ib = WHEEL.indexOf(eb.hue);
  if (ia < 0 || ib < 0) return true;

  const dist = Math.min(Math.abs(ia - ib), WHEEL.length - Math.abs(ia - ib));
  // 0 = same family (monochrome), 1 = analogous, 3 = ~complementary.
  return dist === 0 || dist === 1 || dist === 3;
}
