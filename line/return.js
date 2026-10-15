/* Invisible OAuth return on the official domain. Every failure opens LINE. */
(function () {
  'use strict';
  const DIRECT = 'https://line.me/R/ti/p/%40629xmmsh';
  const SITE = 'https://defense.shichilawfirm.com';
  const API = 'https://shichi-line-attribution.shichilawfirm.workers.dev';
  let finished = false, stage = 'config';
  let bridge='';
  try {
    const q=new URL(location.href).searchParams;
    bridge=q.get('bridge') || new URL(q.get('liff.state')||'',SITE).searchParams.get('bridge') || '';
    if(!/^[\w-]{16}\.[\w-]{80,4000}$/.test(bridge))bridge='';
  } catch(_) {}
  function trace(event,detail='') {
    try {
      const body=bridge?{bridge,stage:event,detail}:{attempt:crypto.randomUUID(),stage:'fallback',detail:'bridge'};
      fetch(API+'/api/diagnostic',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),keepalive:true,referrerPolicy:'no-referrer'}).catch(()=>{});
    } catch(_) {}
  }
  if(bridge)trace('return_open');
  // A native new-tab/copy of the public LIFF link has no per-click bridge.
  // Restore only the browser's saved source; absent evidence stays unknown.
  async function createBridge() {
    let saved=null;try{saved=JSON.parse(localStorage.getItem('sl_attr_v2'));}catch(_){}
    const now=Date.now();
    const valid=saved && /^[A-Z2-9]{4}$/.test(saved.vid) && Number.isFinite(saved.ts) && now>=saved.ts && now-saved.ts<2592000000;
    const alphabet='ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    const a={vid:valid?saved.vid:Array.from(crypto.getRandomValues(new Uint8Array(4)),n=>alphabet[n%alphabet.length]).join(''),
      land_date:new Date((valid?saved.ts:now)+28800000).toISOString().slice(0,10).replace(/-/g,'')};
    if(valid)for(const k of ['gclid','gbraid','wbraid','fbclid','src','utm','ref','land'])if(typeof saved[k]==='string')a[k]=saved[k].slice(0,200);
    try{const key=sessionStorage.getItem('sl_line_test_key');if(/^[a-f0-9]{64}$/.test(key||''))a.test_key=key;}catch(_){}
    const r=await fetch(API+'/api/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(a),referrerPolicy:'no-referrer',signal:AbortSignal.timeout(1500)});
    if(!r.ok)throw Error();
    const u=new URL((await r.json()).url);
    if(u.origin!=='https://liff.line.me' || u.pathname!=='/2012020380-bva8T4N3' || u.username || u.password)throw Error();
    const token=u.searchParams.get('bridge');if(!/^[\w-]{16}\.[\w-]{80,4000}$/.test(token||''))throw Error();
    return token;
  }
  const leave = () => {
    if (finished) return;
    finished = true;
    const status=stage.slice(10);
    const detail=stage.startsWith('bind-http-')?(['400','401','403','404','408','409','429','500','502','503','504'].includes(status)?status:'invalid'):stage;
    if(stage!=='bound')trace('fallback',detail);
    console.info('[line-attribution] ' + stage);
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
    if ((cfg.mode !== 'production' || cfg.enabled !== true) || cfg.liffId !== '2012020380-bva8T4N3'
      || cfg.apiOrigin !== 'https://shichi-line-attribution.shichilawfirm.workers.dev'
      || finished) throw Error();
    stage = 'sdk';
    await new Promise((resolve, reject) => {
      const sdk = document.createElement('script');
      sdk.src = 'https://static.line-scdn.net/liff/edge/2/sdk.js';
      sdk.referrerPolicy = 'no-referrer';
      sdk.onload = resolve;
      sdk.onerror = reject;
      document.head.appendChild(sdk);
    });
    if (finished) return;
    stage = 'init';
    await liff.init({liffId: cfg.liffId});
    if (finished) return;
    // LIFF must first restore its secondary redirect query parameters.
    stage = 'bridge';
    let token = new URL(location.href).searchParams.get('bridge') || bridge;
    if(!token && !bridge){stage='start';token=await createBridge();if(finished)return;bridge=token;trace('return_open');}
    if (!/^[\w-]{16}\.[\w-]{80,4000}$/.test(token || '')) throw Error();
    // External-browser sessions can outlive the one-hour ID token. Renew only
    // the LIFF app session; the LINE account cookie still permits smooth login.
    let refresh = false;
    if (liff.isLoggedIn() && !liff.isInClient()) {
      const claims = liff.getDecodedIDToken();
      refresh = !!claims && Number.isFinite(claims.exp) && claims.exp * 1000 <= Date.now();
      if (refresh) {
        stage = 'id-token';
        if (new URL(location.href).searchParams.get('line_refresh') === '1') throw Error();
        liff.logout();
      }
    }
    if (!liff.isLoggedIn()) {
      stage = 'login';
      trace('login_redirect');
      liff.login({redirectUri: SITE + '/line/return.html?bridge=' + encodeURIComponent(token) + (refresh ? '&line_refresh=1' : '')});
      return;
    }
    stage = 'id-token';
    const idToken = liff.getIDToken();
    if (!idToken) throw Error();
    history.replaceState(null, '', location.pathname);
    for (let attempt=0;attempt<2 && !finished;attempt++) {
      try {
        stage = 'bind';
        const bound = await fetch(cfg.apiOrigin + '/api/bind', {
          method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({bridge: token, id_token: idToken}),
          cache: 'no-store', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(1800)
        });
        stage = 'bind-http-' + bound.status;
        if (bound.ok && (await bound.json()).bound===true) { stage = 'bound'; break; }
        if (bound.status!==429 && bound.status<500) break;
      } catch (_) { /* One retry fits inside the overall 6.5-second deadline. */ }
    }
    leave();
  }
  run().catch(leave);
}());
