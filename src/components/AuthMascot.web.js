import React, { useEffect, useRef, useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import * as runtime from '@rive-app/canvas-lite';
import { version } from '@rive-app/canvas-lite/package.json';
import useReducedMotion from '../hooks/useReducedMotion';
import { createFireflyController } from '../services/fireflyController';

runtime.RuntimeLoader.setWasmUrl(`/mascot/rive-${version}.wasm`);
runtime.RuntimeLoader.setWasmFallbackUrl(`/mascot/rive-${version}-fallback.wasm`);

export default function AuthMascot({ lookingAway, watching, progress, errorSignal = 0, greeting = false, size = 220, embedded = false }) {
  const height = size * 184 / 220;
  const canvas = useRef(null), controller = useRef(null);
  const reducedMotion = useReducedMotion();
  const [status, setStatus] = useState('loading');
  const [greetingSignal, setGreetingSignal] = useState(0);
  const latest = useRef({ lookingAway, watching, progress, errorSignal, greeting, greetingSignal, reducedMotion });
  latest.current = { lookingAway, watching, progress, errorSignal, greeting, greetingSignal, reducedMotion };
  useEffect(() => {
    let active = true;
    const element = canvas.current;
    const instance = createFireflyController(runtime, element, { src: '/mascot/teddy-login.riv' }, event => {
      if (!active) return;
      if (event.type === 'ready') setStatus('ready');
      if (event.type === 'error') setStatus('error');
      element.dataset.waveAmount = String(event.waveAmount ?? 0);
      element.dataset.errorAmount = String(event.errorAmount ?? 0);
      element.dataset.earDrop = String(event.earDrop ?? 0);
      element.dataset.handsUp = String(event.handsUp ?? false);
      element.dataset.checking = String(event.checking ?? false);
      element.dataset.look = String(Math.round(event.look ?? 50));
      element.dataset.cover = String((event.cover ?? 0).toFixed(3));
      element.dataset.pupilX = String((event.pupilX ?? 0).toFixed(2));
    });
    controller.current = instance;
    instance.update(latest.current);
    const observer = new ResizeObserver(() => instance.resize());
    observer.observe(element);
    const visibility = () => instance.setHidden(document.hidden);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      active = false; observer.disconnect();
      document.removeEventListener('visibilitychange', visibility);
      instance.cleanup(); controller.current = null;
    };
  }, []);
  useEffect(() => { controller.current?.update(latest.current); }, [lookingAway, watching, progress, errorSignal, greeting, greetingSignal, reducedMotion]);
  if (status === 'error') return null;
  return <View testID={`firefly-${lookingAway ? 'privacy' : watching ? 'watching' : 'idle'}`} dataSet={{ ready: status }} style={[styles.stage, { height }, embedded && styles.embedded]}>
    <Pressable accessibilityRole="button" accessibilityLabel="Повторить приветствие" onPress={() => setGreetingSignal(value => value + 1)} style={[styles.portrait, { width: size, height }]}>
      <View style={[styles.ground, { width: size * 0.42, height: size * 0.025, left: size * 0.38, bottom: height * 0.035 }]} />
      <canvas ref={canvas} aria-hidden="true" data-testid="firefly-canvas" style={{ width: '100%', height: '100%', display: 'block', pointerEvents: 'none' }} />
    </Pressable>
  </View>;
}
const styles = StyleSheet.create({
  stage: { height: 184, width: '100%', alignItems: 'center', marginTop: -12, marginBottom: 14, position: 'sticky', top: 8, zIndex: 2 },
  portrait: { position: 'relative' },
  ground: { position: 'absolute', borderRadius: 100, backgroundColor: 'rgba(0,0,0,0.08)' },
  embedded: { position: 'relative', top: 0, marginTop: 0, marginBottom: 0 },
});
