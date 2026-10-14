/* Keep the familiar LINE buttons. Identity attribution runs in the background. */
(function () {
  'use strict';
  const SITE='https://defense.shichilawfirm.com', API='https://shichi-line-attribution.shichilawfirm.workers.dev';
  const DIRECT='https://line.me/R/ti/p/%40629xmmsh', LIFF='2012020380-bva8T4N3';
  if(location.origin!==SITE || location.pathname.startsWith('/line/'))return;
  let test=null, testKey='', busy=false, prepared=null, preparedAt=0;
  const analyticsReplay=new WeakSet();
  try {
    const keyMatch=/^#line_test=([a-f0-9]{64})$/.exec(location.hash);
    if(keyMatch) {
      sessionStorage.setItem('sl_line_test_key',keyMatch[1]);sessionStorage.setItem('entry-chooser-dismissed','1');
      history.replaceState(null,'',location.pathname+location.search);
    }
    testKey=sessionStorage.getItem('sl_line_test_key')||'';
  } catch (_) {}
  function attr() {
    const now=Date.now(),q=new URL(location.href).searchParams;
    let prev=null;try{prev=JSON.parse(localStorage.getItem('sl_attr_v2'));}catch(_){}
    const valid=prev && /^[A-Z2-9]{4}$/.test(prev.vid) && Number.isFinite(prev.ts) && now>=prev.ts && now-prev.ts<2592000000;
    const alphabet='ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    const random=crypto.getRandomValues(new Uint8Array(4));
    let a={vid:valid?prev.vid:Array.from(random,b=>alphabet[b%alphabet.length]).join(''),ts:now,land:location.pathname.slice(0,80)};
    for(const k of ['gclid','gbraid','wbraid','fbclid','src'])if(q.get(k))a[k]=q.get(k).slice(0,160);
    const utm=[q.get('utm_source'),q.get('utm_campaign')].filter(Boolean).join('/');if(utm)a.utm=utm.slice(0,60);
    const has=['gclid','gbraid','wbraid','fbclid','src','utm'].some(k=>a[k]);
    const unique=a.gclid||a.gbraid||a.wbraid||a.fbclid;
    if(valid && (!has || (unique && ['gclid','gbraid','wbraid','fbclid','src','utm'].every(k=>a[k]===prev[k]))))a=prev;
    if(!has && !valid){try{const ref=new URL(document.referrer).hostname;if(ref && ref!==location.hostname)a.ref=ref.slice(0,60);}catch(_){}}
    try{localStorage.setItem('sl_attr_v2',JSON.stringify(a));}catch(_){}
    const out={vid:a.vid,land_date:new Date(a.ts+28800000).toISOString().slice(0,10).replace(/-/g,'')};
    if(/^[a-f0-9]{64}$/.test(testKey))out.test_key=testKey;
    for(const k of ['gclid','gbraid','wbraid','fbclid','src','utm','ref','land'])if(typeof a[k]==='string')out[k]=a[k].slice(0,200);
    return out;
  }
  let captured;try{captured=attr();}catch(_){return;}
  async function prepare() {
    const cfgResponse=await fetch('/line/config.json',{cache:'no-store',signal:AbortSignal.timeout(1500)});
    if(!cfgResponse.ok)throw Error();
    const cfg=await cfgResponse.json();
    if(cfg.mode!=='production' || cfg.enabled!==true || cfg.apiOrigin!==API || cfg.liffId!==LIFF)throw Error();
    const r=await fetch(API+'/api/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(captured),cache:'no-store',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(1500)});
    if(!r.ok)throw Error();
    const result=await r.json();
    const u=new URL(result.url);
    if(u.origin!=='https://liff.line.me' || u.pathname!=='/'+LIFF || u.username || u.password || !/^[\w-]{16}\.[\w-]{80,4000}$/.test(u.searchParams.get('bridge')||''))throw Error();
    test=result.test===true;
    return u.href;
  }
  prepare().then(url=>{prepared=url;preparedAt=Date.now();}).catch(()=>{});
  window.addEventListener('click',event=>{
    if(analyticsReplay.has(event)){event.preventDefault();return;}
    const a=event.target?.closest?.('a[href]');if(!a)return;
    let u;try{u=new URL(a.href);}catch(_){return;}
    if(u.origin!=='https://line.me' || decodeURIComponent(u.pathname)!=='/R/ti/p/@629xmmsh')return;
    // Existing GoogleTag continues recording ordinary button clicks; only tests
    // stop propagation so owner verification never becomes an Ads conversion.
    const held=!!testKey || test===true;
    event.preventDefault();if(held)event.stopImmediatePropagation();
    if(busy)return;busy=true;
    const navigate=url=>{
      // A presented capability is checked before any production listener sees
      // the click. If the server rejects it, replay exactly once for analytics,
      // with default navigation cancelled by the guard above.
      if(held && test===false){
        const replay=new MouseEvent('click',{bubbles:true,cancelable:true,button:0});
        analyticsReplay.add(replay);a.dispatchEvent(replay);
      }
      location.assign(url);
    };
    if(prepared && Date.now()-preparedAt<480000){navigate(prepared);return;}
    let done=false;
    const leave=url=>{if(done)return;done=true;clearTimeout(timer);navigate(url);};
    const timer=setTimeout(()=>leave(DIRECT),1800);
    prepare().then(leave).catch(()=>leave(DIRECT));
  },{capture:true});
}());
