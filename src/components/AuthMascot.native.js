import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import bundle from '../../assets/mascot/firefly-native-runtime.json';
import { createFireflyHtml } from '../services/fireflyHtml';
import useReducedMotion from '../hooks/useReducedMotion';

export default function AuthMascot({ lookingAway, watching, progress, errorSignal = 0, greeting = false, size = 220, embedded = false }) {
  const height = size * 184 / 220;
  const webview = useRef(null);
  const reducedMotion = useReducedMotion();
  const [status, setStatus] = useState('loading');
  const [greetingSignal, setGreetingSignal] = useState(0);
  const source = useMemo(() => ({ html: createFireflyHtml(bundle) }), []);
  useEffect(() => {
    if (status === 'ready') webview.current?.injectJavaScript(`window.updateFirefly(${JSON.stringify({ lookingAway, watching, progress, errorSignal, greeting, greetingSignal, reducedMotion })});true;`);
  }, [status, lookingAway, watching, progress, errorSignal, greeting, greetingSignal, reducedMotion]);
  if (status === 'error') return null;
  return <View style={[styles.stage, { height }, embedded && styles.embedded]}>
    <Pressable accessibilityRole="button" accessibilityLabel="Повторить приветствие" onPress={() => setGreetingSignal(value => value + 1)} style={[styles.portrait, { width: size, height }]}>
      <View style={[styles.ground, { width: size * 0.42, height: size * 0.025, left: size * 0.38, bottom: height * 0.035 }]} />
      <WebView pointerEvents="none" ref={webview} source={source} style={styles.webview} scrollEnabled={false} javaScriptEnabled originWhitelist={['about:blank']} onShouldStartLoadWithRequest={request => request.url === 'about:blank'} onError={() => setStatus('error')} onMessage={event => {
        try { const message = JSON.parse(event.nativeEvent.data); if (message.type === 'ready') setStatus('ready'); if (message.type === 'error') setStatus('error'); } catch {}
      }} />
    </Pressable>
  </View>;
}
const styles = StyleSheet.create({
  stage: { height: 184, width: '100%', alignItems: 'center', marginTop: -12, marginBottom: 14 },
  portrait: { position: 'relative' },
  ground: { position: 'absolute', borderRadius: 100, backgroundColor: 'rgba(0,0,0,0.08)' },
  embedded: { marginTop: 0, marginBottom: 0 },
  webview: { flex: 1, backgroundColor: 'transparent' },
});
