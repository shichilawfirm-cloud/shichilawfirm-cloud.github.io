/* Invisible OAuth return on the official domain. Every failure opens LINE. */
(function () {
  'use strict';
  const DIRECT = 'https://line.me/R/ti/p/%40629xmmsh';
  const SITE = 'https://defense.shichilawfirm.com';
  let finished = false;
  const leave = () => {
    if (finished) return;
    finished = true;
    clearTimeout(deadline);
    history.replaceState(null, '', location.pathname);
    location.replace(DIRECT);
  };
  const deadline = setTimeout(leave, 6500);
  async function run() {
    if (location.origin !== SITE) throw Error();
    const response = await fetch('/line/config.json', {cache: 'no-store', signal: AbortSignal.timeout(1800)});
    if (!response.ok) throw Error();
    const cfg = await response.json();
    if (cfg.mode !== 'owner_only_preview' || cfg.liffId !== '2012020380-bva8T4N3'
      || !/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(cfg.apiOrigin)
      || typeof cfg.expires !== 'number' || cfg.expires * 1000 <= Date.now() || finished) throw Error();
    await new Promise((resolve, reject) => {
      const sdk = document.createElement('script');
      sdk.src = 'https://static.line-scdn.net/liff/edge/2/sdk.js';
      sdk.referrerPolicy = 'no-referrer';
      sdk.onload = resolve;
      sdk.onerror = reject;
      document.head.appendChild(sdk);
    });
    if (finished) return;
    await liff.init({liffId: cfg.liffId});
    if (finished) return;
    // LIFF must first restore its secondary redirect query parameters.
    const token = new URL(location.href).searchParams.get('bridge');
    if (!/^[A-Za-z0-9_-]{100,4096}={0,2}$/.test(token || '')) throw Error();
    if (!liff.isLoggedIn()) {
      liff.login({redirectUri: SITE + '/line/return.html?bridge=' + encodeURIComponent(token)});
      return;
    }
    const idToken = liff.getIDToken();
    if (!idToken) throw Error();
    history.replaceState(null, '', location.pathname);
    await fetch(cfg.apiOrigin + '/api/bind', {
      method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({bridge: token, id_token: idToken}),
      cache: 'no-store', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(2500)
    });
    leave();
  }
  run().catch(leave);
}());
