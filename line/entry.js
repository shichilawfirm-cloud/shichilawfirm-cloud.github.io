/* The existing contact page is the entry. Normal visitors keep direct LINE. */
(function () {
  'use strict';
  const DIRECT = 'https://line.me/R/ti/p/%40629xmmsh';
  const SITE = 'https://defense.shichilawfirm.com';
  const match = /^#line_preview=([a-f0-9]{64})$/.exec(location.hash);
  if (location.origin !== SITE || location.pathname !== '/contact/' || !match) return;
  const key = match[1];
  history.replaceState(null, '', location.pathname + location.search);
  try {sessionStorage.setItem('entry-chooser-dismissed', '1');} catch (_) {}
  let prepared = null, preparedAt = 0, busy = false;
  function validConfig(cfg) {
    return cfg.mode === 'owner_only_preview' && cfg.liffId === '2012020380-bva8T4N3'
      && /^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(cfg.apiOrigin)
      && typeof cfg.expires === 'number' && cfg.expires * 1000 > Date.now();
  }
  async function prepare() {
    const cfgResponse = await fetch('/line/config.json', {cache: 'no-store', signal: AbortSignal.timeout(1800)});
    if (!cfgResponse.ok) throw Error();
    const cfg = await cfgResponse.json();
    if (!validConfig(cfg)) throw Error();
    const response = await fetch(cfg.apiOrigin + '/preview/' + key, {
      headers: {Accept: 'application/json'}, cache: 'no-store', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(1800)
    });
    if (!response.ok) throw Error();
    const result = await response.json();
    const url = new URL(result.url);
    if (url.origin !== 'https://liff.line.me' || url.username || url.password
      || url.pathname !== '/' + cfg.liffId || !/^[A-Za-z0-9_-]{100,4096}={0,2}$/.test(url.searchParams.get('bridge') || '')) throw Error();
    return url.href;
  }
  const warm = () => prepare().then(url => {prepared = url; preparedAt = Date.now();}).catch(() => {});
  warm();
  window.addEventListener('click', async event => {
    const anchor = event.target && event.target.closest && event.target.closest('a[href]');
    if (!anchor) return;
    let target;
    try {target = new URL(anchor.href);} catch (_) {return;}
    if (target.origin !== 'https://line.me' || decodeURIComponent(target.pathname) !== '/R/ti/p/@629xmmsh') return;
    // Test clicks must not enter Google Ads conversions or the production ledger.
    event.preventDefault();
    event.stopImmediatePropagation();
    if (busy) return;
    busy = true;
    let url = DIRECT;
    try {url = prepared && Date.now() - preparedAt < 8 * 60 * 1000 ? prepared : await prepare();} catch (_) {}
    location.assign(url);
  }, {capture: true});
}());
