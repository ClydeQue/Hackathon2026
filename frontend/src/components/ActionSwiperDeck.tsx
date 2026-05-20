import { useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import Swiper from 'react-native-deck-swiper';

const STAMP_THRESHOLD = 120;

// Default card height. react-native-deck-swiper sizes cards from
// Dimensions.get('window') and ignores the parent container, so we override
// via cardStyle. Callers can pass `cardHeight` to tune per-screen.
const DEFAULT_CARD_HEIGHT = 750;

type Props<T> = {
  cards: T[];
  renderCard: (card: T, index: number) => React.ReactNode;
  onSwipeRight: (card: T, index: number) => void;
  onSwipeLeft: (card: T, index: number) => void;
  onAllDone: () => void;
  rightLabel: string;
  leftLabel: string;
  rightColor?: string;
  leftColor?: string;
  bottomInset?: number;
  cardHeight?: number;
};

export function ActionSwiperDeck<T>({
  cards,
  renderCard,
  onSwipeRight,
  onSwipeLeft,
  onAllDone,
  rightLabel,
  leftLabel,
  rightColor = '#0a8',
  leftColor = '#c0392b',
  bottomInset = 0,
  cardHeight = DEFAULT_CARD_HEIGHT,
}: Props<T>) {
  const dragX = useRef(new Animated.Value(0)).current;
  const [cursor, setCursor] = useState(0);

  function springStampBack() {
    Animated.spring(dragX, {
      toValue: 0,
      useNativeDriver: true,
      tension: 90,
      friction: 8,
    }).start();
  }

  const rightOpacity = dragX.interpolate({
    inputRange: [0, STAMP_THRESHOLD],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const rightScale = dragX.interpolate({
    inputRange: [0, STAMP_THRESHOLD],
    outputRange: [0.4, 1],
    extrapolate: 'clamp',
  });
  const leftOpacity = dragX.interpolate({
    inputRange: [-STAMP_THRESHOLD, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  const leftScale = dragX.interpolate({
    inputRange: [-STAMP_THRESHOLD, 0],
    outputRange: [1, 0.4],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.container}>
      <View style={[styles.deckWrap, { paddingBottom: bottomInset }]}>
        <View style={[styles.deckSlot, { maxHeight: cardHeight }]}>
          <Swiper
            cards={cards}
            backgroundColor="transparent"
            stackSize={3}
            cardVerticalMargin={0}
            cardStyle={{ top: 0, height: cardHeight }}
            renderCard={(card: T, index: number) =>
              card ? <>{renderCard(card, index)}</> : null
            }
            onSwiping={(x: number) => dragX.setValue(x)}
            onSwipedAborted={springStampBack}
            onSwiped={(i: number) => setCursor(i + 1)}
            onSwipedRight={(i: number) => {
              springStampBack();
              onSwipeRight(cards[i], i);
            }}
            onSwipedLeft={(i: number) => {
              springStampBack();
              onSwipeLeft(cards[i], i);
            }}
            onSwipedAll={onAllDone}
            disableTopSwipe
            disableBottomSwipe
            verticalSwipe={false}
          />
          <Animated.View
            pointerEvents="none"
            style={[styles.stampLayer, { opacity: rightOpacity }]}
          >
            <Animated.View
              style={[
                styles.stampBox,
                { borderColor: rightColor },
                { transform: [{ scale: rightScale }, { rotate: '-18deg' }] },
              ]}
            >
              <Text style={[styles.stampText, { color: rightColor }]}>
                {rightLabel}
              </Text>
            </Animated.View>
          </Animated.View>
          <Animated.View
            pointerEvents="none"
            style={[styles.stampLayer, { opacity: leftOpacity }]}
          >
            <Animated.View
              style={[
                styles.stampBox,
                { borderColor: leftColor },
                { transform: [{ scale: leftScale }, { rotate: '18deg' }] },
              ]}
            >
              <Text style={[styles.stampText, { color: leftColor }]}>
                {leftLabel}
              </Text>
            </Animated.View>
          </Animated.View>
        </View>
      </View>
      {cards.length > 0 ? (
        <Text style={[styles.progress, { bottom: bottomInset + 16 }]}>
          {Math.min(cursor + 1, cards.length)} / {cards.length}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  deckWrap: { flex: 1 },
  // Pinned to top of deckWrap; cardHeight cap matches the cardStyle we hand
  // to the Swiper so the stamp overlay covers exactly the card.
  deckSlot: { flex: 1 },
  stampLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
    elevation: 20,
  },
  stampBox: {
    paddingVertical: 10,
    paddingHorizontal: 28,
    borderWidth: 5,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  stampText: {
    fontSize: 44,
    fontWeight: '900',
    letterSpacing: 3,
  },
  progress: {
    position: 'absolute',
    alignSelf: 'center',
    color: '#888',
    fontSize: 13,
    fontWeight: '600',
  },
});
