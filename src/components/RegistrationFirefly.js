import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';
import useReducedMotion from '../hooks/useReducedMotion';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const interpolate = (value, from, to) => value.interpolate({ inputRange: [0, 1], outputRange: [from, to] });

function WingPair({ mirrored = false }) {
  return <Svg width="100%" height="100%" viewBox="0 0 290 220" accessible={false}>
    <G transform={mirrored ? 'translate(290 0) scale(-1 1)' : undefined}>
      <Path d="M132 128 C104 121 58 117 27 99 C7 87 10 66 31 62 C69 56 112 85 132 128 Z" fill="#d9e5bf" fillOpacity={0.88} stroke="#b8cba2" strokeWidth={1} />
      <Path d="M132 128 C103 147 73 167 49 164 C25 161 22 143 39 131 C66 114 106 114 132 128 Z" fill="#e0e9cc" fillOpacity={0.92} stroke="#c0d0ac" strokeWidth={0.9} />
      <Path d="M126 125 C96 105 58 86 25 80 M102 111 Q86 91 66 82 M79 99 Q57 102 40 94 M57 88 Q46 73 32 71 M124 130 Q80 143 39 148 M94 139 Q82 130 65 130 M73 145 Q64 155 52 157" fill="none" stroke="#afc393" strokeOpacity={0.7} strokeWidth={1.1} strokeLinecap="round" />
    </G>
  </Svg>;
}

function Body() {
  return <Svg width="100%" height="100%" viewBox="0 0 290 220" accessible={false}>
    <Path d="M132 177 C126 188 130 200 124 208 M159 178 C166 189 159 201 163 208" fill="none" stroke="#355b40" strokeWidth={7} strokeLinecap="round" />
    <Path d="M128 110 C115 126 112 152 121 174 Q145 196 164 174 C178 151 173 126 160 110 Z" fill="#4e6f3f" />
    <Path d="M122 128 Q144 138 169 126 L170 139 Q145 152 119 140 Z" fill="#648047" />
    <Path d="M120 149 Q146 160 170 145 L166 160 Q146 172 122 162 Z" fill="#58773e" />
    <Path d="M129 170 Q145 165 160 171 L161 184 Q158 200 145 200 Q130 197 128 184 Z" fill="#c6e979" />
    <Path d="M133 173 Q145 170 156 174 L156 182 Q154 192 145 192 Q135 191 133 183 Z" fill="#e2f7aa" />
    <Path d="M127 113 C110 128 100 158 105 182 C123 177 136 146 138 120 Z" fill="#31543b" />
    <Path d="M160 113 C179 130 185 161 178 183 C161 174 153 148 151 120 Z" fill="#294b35" />
    <Path d="M127 113 C111 129 107 149 107 168 C118 150 124 135 132 117 Z" fill="#3d6142" />
    <Path d="M128 113 Q143 120 160 112 Q164 124 151 128 Q136 132 125 122 Z" fill="#769050" />
  </Svg>;
}

function HeadShape() {
  return <Svg width="100%" height="100%" viewBox="0 0 290 220" accessible={false}>
    <Path d="M127 45 C117 21 97 7 83 14 M163 43 C172 20 191 6 205 15" stroke="#30533b" strokeWidth={3} fill="none" strokeLinecap="round" />
    <Path d="M76 13 C79 7 88 8 93 12 C99 18 86 24 80 22 C76 21 74 17 76 13 Z M198 13 C202 8 211 11 215 16 C220 24 207 24 202 20 C199 18 197 16 198 13 Z" fill="#88a659" />
    <Path d="M100 82 C99 58 120 39 143 38 C171 35 190 56 193 78 C198 103 175 119 149 119 C123 120 102 106 100 82 Z" fill="#426749" />
    <Path d="M111 56 C106 79 118 102 146 111 Q171 123 190 95 C183 112 166 120 149 119 C120 120 99 104 100 82 Q99 67 111 56 Z" fill="#35583e" />
    <Path d="M114 66 Q122 57 133 63 M158 58 Q167 52 176 59" stroke="#254631" strokeWidth={2.3} fill="none" strokeLinecap="round" />
    <Path d="M142 101 Q151 107 159 99" stroke="#203e2c" strokeWidth={2.1} fill="none" strokeLinecap="round" />
  </Svg>;
}

// All curves are local vector artwork. The rig receives focus/caret metadata only.
export default function RegistrationFirefly({ lookingAway, watching, progress }) {
  const reducedMotion = useReducedMotion();
  const cover = useRef(new Animated.Value(lookingAway ? 1 : 0)).current;
  const gaze = useRef(new Animated.Value(0)).current;
  const attention = useRef(new Animated.Value(watching ? 1 : 0)).current;
  const hover = useRef(new Animated.Value(0)).current;
  const flutter = useRef(new Animated.Value(0)).current;
  const blink = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const goal = watching && !lookingAway ? Math.max(0, Math.min(1, progress)) * 2 - 1 : 0;
    if (reducedMotion) { cover.setValue(lookingAway ? 1 : 0); gaze.setValue(goal); attention.setValue(watching && !lookingAway ? 1 : 0); return; }
    const movement = Animated.parallel([
      // The two arm paths morph through all intermediate shapes, not sprite frames.
      Animated.timing(cover, { toValue: lookingAway ? 1 : 0, duration: lookingAway ? 560 : 680, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }),
      Animated.spring(gaze, { toValue: goal, damping: 20, stiffness: 95, mass: 0.8, useNativeDriver: true }),
      Animated.timing(attention, { toValue: watching && !lookingAway ? 1 : 0, duration: 360, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]);
    movement.start();
    return () => movement.stop();
  }, [lookingAway, watching, progress, reducedMotion]);

  useEffect(() => {
    if (reducedMotion) { hover.setValue(0); flutter.setValue(0); blink.setValue(1); return; }
    const floating = Animated.loop(Animated.sequence([
      Animated.timing(hover, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(hover, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    const wings = Animated.loop(Animated.sequence([
      Animated.timing(flutter, { toValue: 1, duration: 380, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(flutter, { toValue: 0, duration: 380, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    const blinking = Animated.loop(Animated.sequence([
      Animated.delay(4200),
      Animated.timing(blink, { toValue: 0.06, duration: 95, useNativeDriver: true }),
      Animated.timing(blink, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]));
    floating.start(); wings.start(); blinking.start();
    return () => { floating.stop(); wings.stop(); blinking.stop(); };
  }, [reducedMotion]);

  return <View testID={`firefly-${lookingAway ? 'privacy' : watching ? 'watching' : 'idle'}`} style={styles.stage} pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <Animated.View style={[styles.character, { transform: [{ translateY: interpolate(hover, 1, -5) }] }]}>
      <Animated.View style={[styles.layer, { transform: [{ rotate: interpolate(flutter, '-3deg', '3deg') }, { scaleY: interpolate(flutter, 1, 0.92) }] }]}><WingPair /></Animated.View>
      <Animated.View style={[styles.layer, { transform: [{ rotate: interpolate(flutter, '3deg', '-3deg') }, { scaleY: interpolate(flutter, 1, 0.92) }] }]}><WingPair mirrored /></Animated.View>
      <Animated.View style={[styles.layer, { transform: [{ rotate: interpolate(hover, '-1deg', '1deg') }] }]}><Body /></Animated.View>
      <Animated.View testID="firefly-head" style={[styles.layer, { transform: [{ translateY: interpolate(attention, 0, 3) }, { translateX: gaze.interpolate({ inputRange: [-1, 1], outputRange: [-3, 3] }) }, { rotate: gaze.interpolate({ inputRange: [-1, 1], outputRange: ['-4deg', '4deg'] }) }] }]}>
        <HeadShape />
        <Animated.View testID="firefly-eyes" style={[styles.layer, { opacity: cover.interpolate({ inputRange: [0, 0.65, 1], outputRange: [1, 1, 0] }) }]}>
          {[false, true].map(small => <Animated.View key={String(small)} style={[styles.eye, small ? styles.rightEye : styles.leftEye, { transform: [{ scaleY: blink }, { rotate: small ? '-9deg' : '9deg' }] }]}>
            <Animated.View testID={small ? undefined : 'firefly-pupil'} style={[styles.pupil, small && styles.smallPupil, { transform: [{ translateX: gaze.interpolate({ inputRange: [-1, 1], outputRange: [-4, 4] }) }, { translateY: interpolate(attention, 0, 4) }] }]}><View style={styles.highlight} /></Animated.View>
          </Animated.View>)}
        </Animated.View>
      </Animated.View>
      <View style={styles.layer}>
        <Svg width="100%" height="100%" viewBox="0 0 290 220" accessible={false}>
          <AnimatedPath d={interpolate(cover, 'M119 128 C109 137 107 149 113 158 C116 162 119 164 121 168', 'M119 128 C106 120 105 101 116 91 C120 87 125 85 129 86')} fill="none" stroke="#64854e" strokeWidth={9} strokeLinecap="round" />
          <AnimatedPath d={interpolate(cover, 'M166 128 C176 137 181 150 176 159 C174 163 172 165 171 169', 'M166 128 C180 118 184 101 174 90 C172 86 169 84 165 85')} fill="none" stroke="#5b7c48" strokeWidth={9} strokeLinecap="round" />
          <AnimatedPath testID="firefly-left-hand" d={interpolate(cover, 'M121 159 C114 157 111 163 115 169 C119 175 126 175 128 169 C130 165 126 161 121 159 Z', 'M128 69 C117 67 111 75 112 85 C113 97 124 101 133 96 C141 89 139 74 128 69 Z')} fill="#6c8b51" />
          <AnimatedPath d={interpolate(cover, 'M173 160 C180 158 183 165 179 171 C175 177 168 175 167 170 C166 166 169 162 173 160 Z', 'M163 66 C174 64 181 72 180 83 C179 95 168 98 160 93 C153 87 153 72 163 66 Z')} fill="#66864d" />
        </Svg>
      </View>
    </Animated.View>
  </View>;
}

const styles = StyleSheet.create({
  stage: { height: 202, width: '100%', alignItems: 'center', justifyContent: 'center', marginTop: -12, marginBottom: 14, ...(Platform.OS === 'web' ? { position: 'sticky', top: 8, zIndex: 2 } : {}) },
  character: { width: 262, height: 199 },
  layer: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  eye: { position: 'absolute', backgroundColor: '#f7f3df', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  leftEye: { left: 105, top: 65, width: 23, height: 29, borderRadius: 15 },
  rightEye: { left: 141, top: 60, width: 21, height: 28, borderRadius: 14 },
  pupil: { width: 13, height: 19, borderRadius: 10, backgroundColor: '#294d36', marginLeft: 3 },
  smallPupil: { width: 12, height: 18 },
  highlight: { position: 'absolute', top: 3, right: 3, width: 4, height: 5, borderRadius: 3, backgroundColor: '#fffef0' },
});
