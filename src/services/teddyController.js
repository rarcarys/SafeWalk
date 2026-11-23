// Shared with the native offline WebView. Keep this function self-contained.
// Only a focus flag and the normalised NON-password caret position are accepted.
export function createTeddyController(runtime, canvas, source, notify) {
  const machine = 'Login Machine';
  let animation, inputs, disposed = false, pauseTimer, smoothingFrame;
  let target = { lookingAway: false, watching: false, progress: 0, reducedMotion: false };
  let currentLook = 50;
  let hidden = false;

  function state() {
    return {
      mode: target.lookingAway ? 'privacy' : target.watching ? 'watching' : 'idle',
      handsUp: !!inputs?.isHandsUp.value,
      checking: !!inputs?.isChecking.value,
      look: inputs?.numLook.value ?? 50,
    };
  }
  function smoothLook() {
    if (disposed || !inputs) return;
    const goal = target.lookingAway || !target.watching ? 50 : target.progress * 100;
    currentLook += (goal - currentLook) * 0.23;
    if (Math.abs(goal - currentLook) < 0.1) currentLook = goal;
    inputs.numLook.value = currentLook;
    notify({ type: 'state', ...state() });
    smoothingFrame = currentLook === goal ? null : requestAnimationFrame(smoothLook);
  }
  function apply() {
    if (disposed || !inputs) return;
    inputs.isHandsUp.value = target.lookingAway;
    inputs.isChecking.value = target.watching && !target.lookingAway;
    if (smoothingFrame) cancelAnimationFrame(smoothingFrame);
    if (target.reducedMotion) {
      currentLook = target.watching && !target.lookingAway ? target.progress * 100 : 50;
      inputs.numLook.value = currentLook;
    } else smoothLook();
    clearTimeout(pauseTimer);
    if (!hidden) {
      animation.play(machine);
      // Let a focus reaction settle, then stop all ambient motion for this preference.
      if (target.reducedMotion) pauseTimer = setTimeout(() => { if (!disposed) animation.pause(); }, 900);
    }
    notify({ type: 'state', ...state() });
  }
  animation = new runtime.Rive({
    canvas, ...source, stateMachines: machine, autoplay: true,
    layout: new runtime.Layout({ fit: runtime.Fit.Cover, alignment: runtime.Alignment.Center }),
    shouldDisableRiveListeners: true,
    enableRiveAssetCDN: false,
    onLoad: () => {
      if (disposed) return;
      inputs = Object.fromEntries((animation.stateMachineInputs(machine) || []).map(input => [input.name, input]));
      if (!inputs.isChecking || !inputs.isHandsUp || !inputs.numLook) {
        notify({ type: 'error' }); return;
      }
      animation.resizeDrawingSurfaceToCanvas(Math.min(window.devicePixelRatio || 1, 2));
      apply();
      notify({ type: 'ready', ...state() });
    },
    onLoadError: () => { if (!disposed) notify({ type: 'error' }); },
  });
  return {
    update(next) {
      target = {
        lookingAway: !!next.lookingAway, watching: !!next.watching,
        progress: Math.max(0, Math.min(1, Number(next.progress) || 0)),
        reducedMotion: !!next.reducedMotion,
      };
      apply();
    },
    resize() { if (!disposed && inputs) animation.resizeDrawingSurfaceToCanvas(Math.min(window.devicePixelRatio || 1, 2)); },
    setHidden(value) { hidden = value; if (hidden) animation.pause(); else apply(); },
    cleanup() {
      disposed = true; clearTimeout(pauseTimer);
      if (smoothingFrame) cancelAnimationFrame(smoothingFrame);
      animation.cleanup();
    },
  };
}
