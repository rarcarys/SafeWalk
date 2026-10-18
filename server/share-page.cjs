const guestPage = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>Прогулка · SafeWalk</title></head><body><main><h1>Прогулка SafeWalk</h1><p id="status" role="status">Загружаем прогулку…</p><section id="details" hidden><h2 id="target"></h2><p id="arrival"></p><p id="updated"></p><p><a id="map" target="_blank" rel="noreferrer noopener" hidden>Открыть геопозицию на карте</a></p><p id="expiry"></p></section></main><script src="/share.js" defer></script></body></html>`;
const guestScript = `(() => {
  const token = location.hash.slice(1);
  const status = document.getElementById('status');
  const details = document.getElementById('details');
  let stopped = false;
  const clear = message => { details.hidden = true; document.getElementById('target').textContent = ''; document.getElementById('map').removeAttribute('href'); document.getElementById('map').hidden = true; status.textContent = message; };
  async function refresh() {
    if (stopped) return;
    try {
      const response = await fetch('/api/public/journey', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }), cache: 'no-store', signal: AbortSignal.timeout(10000) });
      const data = await response.json();
      if (!response.ok) { stopped = true; clear(data.message); return; }
      if (Date.now() >= data.expiresAt) { stopped = true; clear('Срок действия ссылки истёк'); return; }
      document.getElementById('target').textContent = data.target.name;
      document.getElementById('arrival').textContent = 'Ожидаемое прибытие: ' + new Date(data.expectedAt).toLocaleTimeString();
      document.getElementById('expiry').textContent = 'Доступ до ' + new Date(data.expiresAt).toLocaleTimeString();
      const point = data.position;
      const fresh = point && Date.now() - (point.updatedAt || point.capturedAt || 0) < 120000;
      document.getElementById('updated').textContent = point ? 'Координаты на ' + new Date(point.updatedAt || point.capturedAt).toLocaleTimeString() + (fresh ? '' : ' — давно не обновлялись') : 'Геопозиция ещё не получена';
      const map = document.getElementById('map');
      map.hidden = !fresh;
      if (fresh) map.href = 'https://www.openstreetmap.org/?mlat=' + point.latitude + '&mlon=' + point.longitude + '#map=16/' + point.latitude + '/' + point.longitude;
      else map.removeAttribute('href');
      status.textContent = 'Прогулка продолжается'; details.hidden = false;
    } catch { clear('Не удалось обновить прогулку. Проверяем соединение…'); }
    if (!stopped) setTimeout(refresh, 10000);
  }
  document.body.style.cssText = 'margin:0;background:#f3f5f8;color:#172033;font:16px/1.6 system-ui,sans-serif;padding:24px';
  document.querySelector('main').style.cssText = 'max-width:520px;margin:8vh auto;background:white;padding:28px;border-radius:24px';
  refresh();
})();`;
module.exports = { guestPage, guestScript };
