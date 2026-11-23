import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

function FireflyWings() {
  return <Svg width="100%" height="100%" viewBox="0 0 156 140" accessible={false}>
    <Path d="M143 119 C120 109 76 91 39 58 C18 40 8 18 23 10 C42 -1 79 20 102 45 C125 69 137 97 143 119 Z" fill="#d4e1b5" fillOpacity={0.9} stroke="#bfd09f" strokeWidth={0.9} />
    <Path d="M142 119 C112 125 64 137 30 132 C7 129 3 112 15 99 C36 77 70 83 97 95 C118 104 132 112 142 119 Z" fill="#dfe9c7" fillOpacity={0.92} stroke="#c5d6ab" strokeWidth={0.9} />
    <Path d="M135 114 C99 83 61 44 26 19 M108 88 Q102 65 90 45 M82 63 Q62 60 44 49 M61 43 Q57 29 46 19 M134 119 Q75 111 19 117 M99 116 Q86 100 67 94 M69 114 Q52 123 34 125 M49 114 Q38 103 24 104" fill="none" stroke="#f7faeb" strokeOpacity={0.83} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>;
}

function FireflyAntennae() {
  return <Svg width={112} height={53} viewBox="0 0 112 53" style={styles.antennae} accessible={false}>
    <Path d="M33 47 C30 24 16 12 7 17 M65 44 C64 22 77 7 91 8" stroke="#365d43" strokeWidth={4.5} strokeLinecap="round" fill="none" />
    <Path d="M1 17 C5 9 17 10 20 14 C23 20 10 24 4 23 C1 22 0 20 1 17 Z M81 8 C83 1 98 1 103 6 C108 12 96 17 87 15 C83 14 80 12 81 8 Z" fill="#365d43" />
  </Svg>;
}

// Simple organic shapes follow the reference silhouette. No input values reach the rig.
export default function AuthFirefly({ lookingAway, watching, progress }) {
  const [reducedMotion, setReducedMotion] = useState(true);
  const turn = useRef(new Animated.Value(lookingAway ? 1 : 0)).current;
  const gaze = useRef(new Animated.Value(0)).current;
  const hover = useRef(new Animated.Value(0)).current;
  const wings = useRef(new Animated.Value(0)).current;
  const attention = useRef(new Animated.Value(watching ? 1 : 0)).current;
  const blink = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active) setReducedMotion(value); }).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    return () => { active = false; subscription.remove(); };
  }, []);

  useEffect(() => {
    const target = watching && !lookingAway ? progress * 2 - 1 : 0;
    if (reducedMotion) {
      turn.setValue(lookingAway ? 1 : 0); gaze.setValue(target); attention.setValue(watching ? 1 : 0);
      return;
    }
    const animation = Animated.parallel([
      Animated.timing(turn, { toValue: lookingAway ? 1 : 0, duration: 650, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
      Animated.spring(gaze, { toValue: target, damping: 20, stiffness: 85, mass: 0.9, useNativeDriver: true }),
      Animated.timing(attention, { toValue: watching ? 1 : 0, duration: 450, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [lookingAway, watching, progress, reducedMotion]);

  useEffect(() => {
    if (reducedMotion) { hover.setValue(0); wings.setValue(0); blink.setValue(1); return; }
    const floating = Animated.loop(Animated.sequence([
      Animated.timing(hover, { toValue: 1, duration: 1900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(hover, { toValue: 0, duration: 1900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    const flutter = Animated.loop(Animated.sequence([
      Animated.timing(wings, { toValue: 1, duration: 320, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(wings, { toValue: 0, duration: 320, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    const blinking = Animated.loop(Animated.sequence([
      Animated.delay(3800),
      Animated.timing(blink, { toValue: 0.08, duration: 90, useNativeDriver: true }),
      Animated.timing(blink, { toValue: 1, duration: 140, useNativeDriver: true }),
    ]));
    floating.start(); flutter.start(); blinking.start();
    return () => { floating.stop(); flutter.stop(); blinking.stop(); };
  }, [reducedMotion]);

  return <View testID={lookingAway ? 'firefly-away' : watching ? 'firefly-watching' : 'firefly-idle'} style={styles.stage} pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <Animated.View style={[styles.character, { transform: [
      { translateY: hover.interpolate({ inputRange: [0, 1], outputRange: [2, -5] }) },
      { rotate: turn.interpolate({ inputRange: [0, 1], outputRange: ['-2deg', '5deg'] }) },
    ] }]}>
      <Animated.View style={[styles.wings, { transform: [
        { rotate: wings.interpolate({ inputRange: [0, 1], outputRange: ['-5deg', '9deg'] }) },
        { scaleY: wings.interpolate({ inputRange: [0, 1], outputRange: [1, 0.83] }) },
      ] }]}>
        <FireflyWings />
      </Animated.View>
      <Animated.View style={[styles.body, { transform: [
        { rotate: '-30deg' },
        { rotate: hover.interpolate({ inputRange: [0, 1], outputRange: ['1deg', '-3deg'] }) },
        { translateY: attention.interpolate({ inputRange: [0, 1], outputRange: [0, 2] }) },
      ] }]}>
        <View style={styles.glow} />
        <View style={styles.abdomen}><View style={styles.abdomenLight} /></View>
        <View style={[styles.leg, styles.backLeg]} /><View style={[styles.leg, styles.frontLeg]} />
        <View style={styles.thorax} />
        <View style={[styles.cover, styles.lowerCover]} /><View style={styles.cover} />
        <Animated.View style={[styles.arm, { transform: [{ rotate: turn.interpolate({ inputRange: [0, 1], outputRange: ['-12deg', '15deg'] }) }] }]} />
      </Animated.View>
      <Animated.View testID="firefly-gaze" style={[styles.headPosition, { transform: [
        { translateX: gaze.interpolate({ inputRange: [-1, 1], outputRange: [-4, 4] }) },
        { translateY: attention.interpolate({ inputRange: [0, 1], outputRange: [0, 4] }) },
        { rotate: gaze.interpolate({ inputRange: [-1, 1], outputRange: ['-8deg', '6deg'] }) },
      ] }]}>
        <Animated.View testID="firefly-head" style={[styles.head, { transform: [
          { perspective: 650 },
          { rotateY: turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) },
        ] }]}>
          <FireflyAntennae />
          <View style={styles.headShape} />
          <Animated.View testID="firefly-face" style={[styles.face, { opacity: turn.interpolate({ inputRange: [0, 0.45, 0.55, 1], outputRange: [1, 1, 0, 0] }) }]}>
            <View style={[styles.brow, styles.leftBrow]} /><View style={[styles.brow, styles.rightBrow]} />
            <Animated.View style={[styles.eye, styles.leftEye, { transform: [{ rotate: '12deg' }, { scaleY: blink }] }]}>
              <Animated.View testID="firefly-pupil" style={[styles.pupil, { transform: [{ translateX: gaze.interpolate({ inputRange: [-1, 1], outputRange: [-5, 5] }) }, { translateY: attention.interpolate({ inputRange: [0, 1], outputRange: [0, 5] }) }] }]}><View style={styles.highlight} /></Animated.View>
            </Animated.View>
            <Animated.View style={[styles.eye, styles.rightEye, { transform: [{ rotate: '-19deg' }, { scaleY: blink }] }]}>
              <Animated.View style={[styles.pupil, styles.smallPupil, { transform: [{ translateX: gaze.interpolate({ inputRange: [-1, 1], outputRange: [-3, 3] }) }, { translateY: attention.interpolate({ inputRange: [0, 1], outputRange: [0, 4] }) }] }]}><View style={styles.highlight} /></Animated.View>
            </Animated.View>
            <View style={styles.mouth}><View style={styles.teeth} /><View style={styles.tongue} /></View>
          </Animated.View>
          <Animated.View style={[styles.backSeam, { opacity: turn }]} />
        </Animated.View>
      </Animated.View>
    </Animated.View>
  </View>;
}

const styles = StyleSheet.create({
  stage: { height: 186, width: '100%', alignItems: 'center', justifyContent: 'center', marginTop: -12, marginBottom: 14, ...(Platform.OS === 'web' ? { position: 'sticky', top: 8, zIndex: 2 } : {}) },
  character: { width: 228, height: 178 },
  wings: { position: 'absolute', left: -2, top: 4, width: 151, height: 136 },
  body: { position: 'absolute', left: 46, top: 92, width: 128, height: 77 },
  glow: { position: 'absolute', left: -5, top: 13, width: 80, height: 61, borderRadius: 40, backgroundColor: '#d3f59b', opacity: 0.22 },
  abdomen: { position: 'absolute', left: 3, top: 17, width: 72, height: 49, borderTopLeftRadius: 38, borderBottomLeftRadius: 34, borderTopRightRadius: 17, borderBottomRightRadius: 29, backgroundColor: '#c8ed83', overflow: 'hidden' },
  abdomenLight: { position: 'absolute', left: 8, top: 11, width: 48, height: 29, borderRadius: 22, backgroundColor: '#dcf7a9' },
  thorax: { position: 'absolute', left: 55, top: 5, width: 63, height: 52, borderRadius: 28, backgroundColor: '#244b35' },
  cover: { position: 'absolute', left: -2, top: 5, width: 96, height: 32, borderTopLeftRadius: 52, borderBottomLeftRadius: 12, borderTopRightRadius: 36, borderBottomRightRadius: 48, backgroundColor: '#365d43', transform: [{ rotate: '-5deg' }] },
  lowerCover: { left: 13, top: 20, width: 84, backgroundColor: '#2b5039', transform: [{ rotate: '13deg' }] },
  leg: { position: 'absolute', width: 10, height: 35, borderRadius: 8, backgroundColor: '#2c513a' },
  backLeg: { left: 48, top: 42, transform: [{ rotate: '32deg' }] },
  frontLeg: { left: 81, top: 41, height: 30, transform: [{ rotate: '13deg' }] },
  arm: { position: 'absolute', left: 91, top: 22, width: 18, height: 29, borderLeftWidth: 7, borderBottomWidth: 7, borderColor: '#43694b', borderBottomLeftRadius: 14, borderBottomRightRadius: 10 },
  headPosition: { position: 'absolute', left: 100, top: 4, width: 112, height: 122 },
  head: { width: '100%', height: '100%' },
  headShape: { position: 'absolute', top: 35, left: 0, width: 108, height: 85, borderTopLeftRadius: 55, borderTopRightRadius: 44, borderBottomLeftRadius: 45, borderBottomRightRadius: 42, backgroundColor: '#3d6749', borderBottomWidth: 3, borderBottomColor: '#365c42' },
  antennae: { position: 'absolute', top: 0, left: 0 },
  face: { position: 'absolute', top: 35, left: 0, width: 108, height: 85 },
  brow: { position: 'absolute', height: 10, borderTopWidth: 3, borderColor: '#203e2c', borderTopLeftRadius: 14, borderTopRightRadius: 14 },
  leftBrow: { left: 26, top: 12, width: 27, transform: [{ rotate: '-21deg' }] },
  rightBrow: { left: 77, top: 7, width: 18, transform: [{ rotate: '8deg' }] },
  eye: { position: 'absolute', backgroundColor: '#f6f3df', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  leftEye: { left: 27, top: 25, width: 33, height: 36, borderRadius: 18 },
  rightEye: { left: 78, top: 17, width: 22, height: 32, borderRadius: 16 },
  pupil: { width: 19, height: 24, borderRadius: 13, marginLeft: 5, backgroundColor: '#183627' },
  smallPupil: { width: 14, height: 21, marginLeft: 3 },
  highlight: { position: 'absolute', top: 3, right: 4, width: 5, height: 6, borderRadius: 4, backgroundColor: '#fffdf1' },
  mouth: { position: 'absolute', left: 60, top: 60, width: 28, height: 18, borderTopLeftRadius: 3, borderTopRightRadius: 3, borderBottomLeftRadius: 17, borderBottomRightRadius: 17, backgroundColor: '#203c2c', overflow: 'hidden', transform: [{ rotate: '-8deg' }] },
  teeth: { position: 'absolute', left: 1, top: 0, width: 25, height: 4, borderBottomLeftRadius: 10, borderBottomRightRadius: 10, backgroundColor: '#f6f3df' },
  tongue: { position: 'absolute', left: 8, bottom: -1, width: 16, height: 8, borderRadius: 9, backgroundColor: '#bd806a' },
  backSeam: { position: 'absolute', top: 48, left: 55, width: 2, height: 58, borderRadius: 3, backgroundColor: '#365c42', transform: [{ rotate: '8deg' }] },
});
