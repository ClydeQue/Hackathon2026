import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Swiper from 'react-native-deck-swiper';

const OVERLAY_OPACITY_THRESHOLD = 120;

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
}: Props<T>) {
  const [dragX, setDragX] = useState(0);
  const [cursor, setCursor] = useState(0);

  const yesOpacity = Math.min(Math.max(dragX, 0) / OVERLAY_OPACITY_THRESHOLD, 1);
  const nopeOpacity = Math.min(Math.max(-dragX, 0) / OVERLAY_OPACITY_THRESHOLD, 1);

  return (
    <View style={styles.container}>
      <View style={styles.deckWrap}>
        <Swiper
          cards={cards}
          backgroundColor="transparent"
          stackSize={3}
          cardVerticalMargin={20}
          marginBottom={bottomInset}
          renderCard={(card: T, index: number) =>
            card ? <>{renderCard(card, index)}</> : null
          }
          onSwiping={(x: number) => setDragX(x)}
          onSwipedAborted={() => setDragX(0)}
          onSwiped={(i: number) => setCursor(i + 1)}
          onSwipedRight={(i: number) => {
            setDragX(0);
            onSwipeRight(cards[i], i);
          }}
          onSwipedLeft={(i: number) => {
            setDragX(0);
            onSwipeLeft(cards[i], i);
          }}
          onSwipedAll={onAllDone}
          disableTopSwipe
          disableBottomSwipe
        />
      </View>
      <View
        pointerEvents="none"
        style={[styles.overlayCenter, { bottom: bottomInset }]}
      >
        {dragX > 0 ? (
          <Text style={[styles.stamp, { color: rightColor, opacity: yesOpacity }]}>
            {rightLabel}
          </Text>
        ) : dragX < 0 ? (
          <Text style={[styles.stamp, { color: leftColor, opacity: nopeOpacity }]}>
            {leftLabel}
          </Text>
        ) : null}
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
  overlayCenter: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stamp: {
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: 2,
  },
  progress: {
    position: 'absolute',
    alignSelf: 'center',
    color: '#888',
    fontSize: 13,
    fontWeight: '600',
  },
});
