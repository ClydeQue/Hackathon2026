import { useEffect, useRef } from 'react';
import { Animated, Easing, type ViewStyle } from 'react-native';

// Brutalist spinner — a thick-bordered square with one transparent edge,
// rotating linearly. The square shape (not a circle) and chunky 4px border
// match the rest of the kit.
type Props = {
  size?: number;
  color?: string;
  borderWidth?: number;
  style?: ViewStyle;
};

export function Spinner({
  size = 32,
  color = '#000',
  borderWidth = 4,
  style,
}: Props) {
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
        easing: Easing.linear,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [rotation]);

  const spin = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View
      style={[
        {
          width: size,
          height: size,
          borderWidth,
          borderColor: color,
          borderTopColor: 'transparent',
          borderRadius: 4,
          transform: [{ rotate: spin }],
        },
        style,
      ]}
    />
  );
}

// Centered full-screen / full-section variant: spinner in the middle of a
// flex:1 box. Useful drop-in for any `<View><ActivityIndicator/></View>`.
export function SpinnerScreen({ size = 36, color = '#000' }: Props) {
  return (
    <Animated.View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <Spinner size={size} color={color} />
    </Animated.View>
  );
}
