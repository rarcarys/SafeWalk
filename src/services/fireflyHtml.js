export function createFireflyHtml(bundle) {
  const scriptSafe = value => value.replace(/<\/script/gi, '<\\/script');
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent}canvas{display:block;width:100%;height:100%}</style></head><body><canvas id="firefly"></canvas><script>
${scriptSafe(bundle.javascript)}
${scriptSafe(bundle.controller)}
rive.RuntimeLoader.setWasmUrl(${JSON.stringify(bundle.wasm)});
rive.RuntimeLoader.setWasmFallbackUrl(null);
var bytes=Uint8Array.from(atob(${JSON.stringify(bundle.animation)}),function(c){return c.charCodeAt(0)});
var controller=createFireflyController(rive,document.getElementById('firefly'),{buffer:bytes.buffer},function(event){window.ReactNativeWebView.postMessage(JSON.stringify(event))});
window.updateFirefly=function(value){controller.update(value)};
window.addEventListener('resize',function(){controller.resize()});
document.addEventListener('visibilitychange',function(){controller.setHidden(document.hidden)});
</script></body></html>`;
}
