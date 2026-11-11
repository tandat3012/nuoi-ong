import { memo, useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { colors, typography } from '@/src/core/theme/tokens';

const CELLS = [
  { x: 13.5, y: -23.4 },
  { x: 27, y: 0 },
  { x: 13.5, y: 23.4 },
  { x: -13.5, y: 23.4 },
  { x: -27, y: 0 },
  { x: -13.5, y: -23.4 },
  { x: 0, y: 0 },
] as const;

export type BeeLoaderProps = {
  label?: string;
  size?: 'md' | 'sm';
  delayMs?: number;
  style?: object;
};

function HexCell({ size, honeyOpacity }: { size: number; honeyOpacity: Animated.Value }) {
  const width = size;
  const height = size * 0.58;
  const radius = size * 0.12;

  return (
    <View style={[styles.cellBox, { width: size, height: size }]}>
      {/* Base cell background and border */}
      <View style={[styles.cellPart, { width, height, borderRadius: radius }]} />
      <View style={[styles.cellPart, { width, height, borderRadius: radius, transform: [{ rotate: '60deg' }] }]} />
      <View style={[styles.cellPart, { width, height, borderRadius: radius, transform: [{ rotate: '120deg' }] }]} />

      {/* Pulsing honey fill */}
      <Animated.View style={[styles.honeyPart, { width: width - 3, height: height - 2, borderRadius: radius, opacity: honeyOpacity }]} />
      <Animated.View style={[styles.honeyPart, { width: width - 3, height: height - 2, borderRadius: radius, opacity: honeyOpacity, transform: [{ rotate: '60deg' }] }]} />
      <Animated.View style={[styles.honeyPart, { width: width - 3, height: height - 2, borderRadius: radius, opacity: honeyOpacity, transform: [{ rotate: '120deg' }] }]} />
    </View>
  );
}

function LittleBee({ flapAnim }: { flapAnim: Animated.Value }) {
  const wingScale = flapAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.35],
  });

  return (
    <View style={styles.beeContainer}>
      {/* Wings on top */}
      <Animated.View style={[styles.wingsWrap, { transform: [{ scaleY: wingScale }] }]}>
        <View style={[styles.wing, styles.leftWing]} />
        <View style={[styles.wing, styles.rightWing]} />
      </Animated.View>

      {/* Stinger */}
      <View style={styles.stinger} />

      {/* Main body (amber with stripes) */}
      <View style={styles.beeBody}>
        <View style={styles.stripe} />
        <View style={styles.stripe} />
      </View>

      {/* Head */}
      <View style={styles.beeHead} />
    </View>
  );
}

export const BeeLoader = memo(function BeeLoader({
  label = 'Đang tải dữ liệu...',
  size = 'md',
  delayMs = 250,
  style,
}: BeeLoaderProps) {
  const [ready, setReady] = useState(delayMs <= 0);
  const fadeAnim = useRef(new Animated.Value(delayMs <= 0 ? 1 : 0)).current;
  const orbitAnim = useRef(new Animated.Value(0)).current;
  const bobAnim = useRef(new Animated.Value(0)).current;
  const flapAnim = useRef(new Animated.Value(0)).current;
  const honeyAnims = useRef(CELLS.map(() => new Animated.Value(0.25))).current;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    if (delayMs > 0) {
      timer = setTimeout(() => {
        setReady(true);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }).start();
      }, delayMs);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [delayMs, fadeAnim]);

  useEffect(() => {
    // 1. Orbit animation: 360 degree rotation in 3.2s
    const orbit = Animated.loop(
      Animated.timing(orbitAnim, {
        toValue: 1,
        duration: 3200,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    orbit.start();

    // 2. Bobbing animation: slight vertical floating
    const bob = Animated.loop(
      Animated.sequence([
        Animated.timing(bobAnim, { toValue: 1, duration: 400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(bobAnim, { toValue: 0, duration: 400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    bob.start();

    // 3. Wing flapping: fast flutter
    const flap = Animated.loop(
      Animated.sequence([
        Animated.timing(flapAnim, { toValue: 1, duration: 70, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(flapAnim, { toValue: 0, duration: 70, easing: Easing.linear, useNativeDriver: true }),
      ])
    );
    flap.start();

    // 4. Honey filling: staggered pulsation
    const honeyLoops = honeyAnims.map((anim, index) => {
      const delay = index * 200;
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 0.95, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0.25, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.delay(Math.max(0, 1400 - delay)),
        ])
      );
    });
    honeyLoops.forEach((loop) => loop.start());

    return () => {
      orbit.stop();
      bob.stop();
      flap.stop();
      honeyLoops.forEach((loop) => loop.stop());
    };
  }, [bobAnim, flapAnim, honeyAnims, orbitAnim]);

  if (!ready) return null;

  const scale = size === 'sm' ? 0.65 : 1;
  const cellSize = 22 * scale;
  const orbitSize = 92 * scale;

  const orbitRotate = orbitAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const beeBob = bobAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-2.5, 2.5],
  });

  return (
    <Animated.View style={[styles.container, size === 'sm' ? styles.containerSm : styles.containerMd, { opacity: fadeAnim }, style]}>
      <View style={[styles.stage, { width: orbitSize, height: orbitSize }]}>
        {/* Honeycomb Cells */}
        <View style={styles.cellsCenter}>
          {CELLS.map((pos, index) => (
            <View
              key={index}
              style={[
                styles.cellWrapper,
                {
                  transform: [
                    { translateX: pos.x * scale },
                    { translateY: pos.y * scale },
                  ],
                },
              ]}
            >
              <HexCell size={cellSize} honeyOpacity={honeyAnims[index]} />
            </View>
          ))}
        </View>

        {/* Orbit container with circling bee */}
        <Animated.View style={[styles.orbit, { width: orbitSize, height: orbitSize, transform: [{ rotate: orbitRotate }] }]}>
          <Animated.View style={[styles.beeOrbitSlot, { transform: [{ translateY: beeBob }] }]}>
            <LittleBee flapAnim={flapAnim} />
          </Animated.View>
        </Animated.View>
      </View>

      {label ? (
        <Text numberOfLines={2} style={[styles.label, size === 'sm' && styles.labelSm]}>
          {label}
        </Text>
      ) : null}
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  containerMd: {
    paddingVertical: 24,
    gap: 12,
  },
  containerSm: {
    paddingVertical: 8,
    gap: 6,
  },
  stage: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellsCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellWrapper: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellPart: {
    position: 'absolute',
    backgroundColor: colors.parchmentWarm,
    borderWidth: 1,
    borderColor: colors.borderAmberGlow,
  },
  honeyPart: {
    position: 'absolute',
    backgroundColor: colors.honey,
  },
  orbit: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  beeOrbitSlot: {
    marginTop: -8,
    alignItems: 'center',
  },
  beeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  stinger: {
    width: 3,
    height: 3,
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderRightWidth: 3,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderRightColor: '#2d241e',
    marginRight: -1,
  },
  beeBody: {
    width: 17,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#f59e0b',
    borderWidth: 0.8,
    borderColor: '#78350f',
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    overflow: 'hidden',
  },
  stripe: {
    width: 2,
    height: 12,
    backgroundColor: '#2d241e',
  },
  beeHead: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#2d241e',
    marginLeft: -1,
  },
  wingsWrap: {
    position: 'absolute',
    top: -6,
    left: 4,
    flexDirection: 'row',
    gap: 1,
    zIndex: 2,
  },
  wing: {
    backgroundColor: 'rgba(255, 255, 255, 0.82)',
    borderWidth: 0.6,
    borderColor: 'rgba(86, 67, 56, 0.35)',
  },
  leftWing: {
    width: 7,
    height: 5,
    borderRadius: 3,
    transform: [{ rotate: '-18deg' }],
  },
  rightWing: {
    width: 6,
    height: 5,
    borderRadius: 3,
    transform: [{ rotate: '12deg' }],
  },
  label: {
    ...typography.labelMd,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
  },
  labelSm: {
    ...typography.labelSm,
    fontSize: 11,
  },
});
export default BeeLoader;
