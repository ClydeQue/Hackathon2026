import { useEffect, useRef } from 'react';
import { Animated, type DimensionValue, type ViewStyle } from 'react-native';

// Brutalist skeleton — a solid black block (or any color) with a thick black
// border and a punchy opacity pulse. No soft gradients, no shimmer; the
// placeholder reads as "filled-in block missing its content".
type Props = {
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
  style?: ViewStyle;
  // The base color of the block. Defaults to a mid-gray so it pulses softly
  // against a white card; pass '#000' for a stark, attention-grabbing block.
  color?: string;
  // 2px is the default brutalist border. Pass 0 for borderless skeletons
  // (e.g. inline text-line placeholders inside an already-bordered card).
  borderWidth?: number;
};

export function Skeleton({
  width = '100%',
  height = 20,
  borderRadius = 4,
  style,
  color = '#DDDDDD',
  borderWidth = 2,
}: Props) {
  const opacity = useRef(new Animated.Value(0.55)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 550,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.55,
          duration: 550,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: color,
          borderWidth,
          borderColor: '#000',
          opacity,
        },
        style,
      ]}
    />
  );
}

// Convenience composition for a tile-style placeholder: square image area
// with two text lines underneath. The 50%-minus-margin width lets it land
// in the same 2-column flow the ItemTile grid uses.
export function SkeletonTile() {
  return (
    <Animated.View style={{ width: '50%', padding: 6 }}>
      <Skeleton height={undefined as any} style={{ aspectRatio: 1 }} />
      <Skeleton
        width="70%"
        height={12}
        borderWidth={0}
        style={{ marginTop: 10 }}
      />
      <Skeleton
        width="50%"
        height={10}
        borderWidth={0}
        style={{ marginTop: 6 }}
      />
    </Animated.View>
  );
}
