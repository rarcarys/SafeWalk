import { useEffect, useState, useRef } from 'react';
import { Keyboard, Platform } from 'react-native';

// Reveal the full field by scrolling, without resizing any form contents.
export default function useKeyboardScroll({ enabled = true, scrollRef, inputRefs, actionRef, hideAboveRef, focused, layoutKey }) {
  const [viewport, setViewport] = useState(null);
  const keyboardOpen = useRef(false);
  const fullHeight = useRef(0);
  useEffect(() => {
    if (!enabled) return;
    let timers = [];
    let active = true;
    let manuallyScrolling = false;
    const reveal = () => {
      const input = inputRefs[focused]?.current, scroll = scrollRef.current;
      if (!input || !scroll) return;
      if (Platform.OS !== 'web') {
        const move = offset => { if (active) scroll.scrollResponderScrollNativeHandleToKeyboard(input, offset, true); };
        const action = actionRef?.current;
        if (action?.measureInWindow && input.measureInWindow) {
          input.measureInWindow((x, y, width, height) => action.measureInWindow((ax, ay, aw, ah) => {
            const extra = Math.max(0, ay + ah - y - height);
            const keyboardTop = Keyboard.metrics()?.screenY;
            move(keyboardTop && height + extra + 64 < keyboardTop ? 32 + extra : 32);
          }));
        } else move(32);
        return;
      }
      const node = scroll.getScrollableNode();
      if (!node) return;
      const field = input.parentElement?.parentElement || input;
      const rect = field.getBoundingClientRect(), frame = node.getBoundingClientRect();
      const visual = window.visualViewport;
      const top = Math.max(frame.top, visual?.offsetTop || 0) + 16;
      const bottom = Math.min(frame.bottom, (visual?.offsetTop || 0) + (visual?.height ?? window.innerHeight)) - 24;
      const action = actionRef?.current?.getBoundingClientRect?.();
      const targetBottom = action && node.contains(actionRef.current) && action.bottom >= rect.bottom && action.bottom - rect.top <= bottom - top ? action.bottom : rect.bottom;
      let delta = targetBottom > bottom ? targetBottom - bottom : rect.top < top ? rect.top - top : 0;
      const tabs = hideAboveRef?.current?.getBoundingClientRect?.();
      if (keyboardOpen.current && tabs) delta = Math.max(delta, tabs.bottom + 12 - Math.max(frame.top, visual?.offsetTop || 0));
      if (Math.abs(delta) > 1) scroll.scrollTo({ y: node.scrollTop + delta, animated: false });
    };
    const schedule = () => {
      timers.forEach(clearTimeout);
      if (!manuallyScrolling) timers = [setTimeout(reveal, 250)];
    };
    if (Platform.OS === 'web') {
      const visual = window.visualViewport;
      let previousHeight = visual?.height ?? window.innerHeight;
      const updateViewport = () => {
        if (visual) setViewport(previous => previous?.height === visual.height ? previous : { height: visual.height, top: 0 });
      };
      const change = () => {
        fullHeight.current = Math.max(fullHeight.current, window.innerHeight, visual?.height || 0);
        keyboardOpen.current = fullHeight.current - (visual?.height ?? window.innerHeight) > 120;
        updateViewport();
        const nextHeight = visual?.height ?? window.innerHeight;
        // Browser toolbars move during scrolling; only keyboard-sized changes reveal a field.
        if (Math.abs(nextHeight - previousHeight) > 100) schedule();
        previousHeight = nextHeight;
      };
      const cancelAutomaticScroll = () => { manuallyScrolling = true; timers.forEach(clearTimeout); timers = []; };
      const scrollNode = scrollRef.current?.getScrollableNode?.();
      change();
      schedule();
      visual?.addEventListener('resize', change);
      scrollNode?.addEventListener('wheel', cancelAutomaticScroll, { passive: true });
      scrollNode?.addEventListener('touchmove', cancelAutomaticScroll, { passive: true });
      window.addEventListener('resize', change);
      return () => {
        active = false;
        timers.forEach(clearTimeout);
        visual?.removeEventListener('resize', change);
        scrollNode?.removeEventListener('wheel', cancelAutomaticScroll);
        scrollNode?.removeEventListener('touchmove', cancelAutomaticScroll);
        window.removeEventListener('resize', change);
      };
    }
    schedule();
    const show = Keyboard.addListener('keyboardDidShow', () => { keyboardOpen.current = true; schedule(); });
    const hide = Keyboard.addListener('keyboardDidHide', () => { keyboardOpen.current = false; });
    return () => { active = false; timers.forEach(clearTimeout); show.remove(); hide.remove(); };
  }, [enabled, focused, layoutKey, scrollRef]);
  return viewport;
}
