/* Keep the familiar LINE buttons. Identity attribution runs in the background. */
(function () {
  'use strict';
  const SITE='https://defense.shichilawfirm.com', API='https://shichi-line-attribution.shichilawfirm.workers.dev';
  const DIRECT='https://line.me/R/ti/p/%40629xmmsh', LIFF='2012020380-bva8T4N3';
  if(location.origin!==SITE || location.pathname.startsWith('/line/'))return;
  let test=null, testKey='', busy=false, prepared=null, preparedAt=0;
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
  function trace(stage,detail='',url=prepared) {
    try {
      const bridge=url?new URL(url).searchParams.get('bridge'):null;
      const body=bridge?{bridge,stage,detail}:{attempt:crypto.randomUUID(),stage,detail,test_key:testKey};
      fetch(API+'/api/diagnostic',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),keepalive:true,referrerPolicy:'no-referrer'}).catch(()=>{});
    } catch(_) {}
  }
  function lineAnchor(event) {
    const a=event.target?.closest?.('a[href]');if(!a)return;
    try {const u=new URL(a.href);if(u.origin==='https://line.me' && decodeURIComponent(u.pathname)==='/R/ti/p/@629xmmsh')return a;}catch(_){}
  }
  // 只有可歸因的付費流量（30 天內帶 gclid、gbraid、wbraid、fbclid、src 或 utm 進站）才走 LINE 授權；
  // 自然搜尋、直接輸入網址的訪客維持原本的 line.me 連結，不多一個授權畫面。測試金鑰不受此限。
  const paid=['gclid','gbraid','wbraid','fbclid','src','utm'].some(k=>typeof captured[k]==='string' && captured[k]);
  if(!paid && !testKey){
    window.addEventListener('click',event=>{if(lineAnchor(event))trace('direct_no_source');},{capture:true});
    return;
  }
  let prepareStage='config';
  async function prepare() {
    prepareStage='config';
    const cfgResponse=await fetch('/line/config.json',{cache:'no-store',signal:AbortSignal.timeout(1500)});
    if(!cfgResponse.ok)throw Error();
    const cfg=await cfgResponse.json();
    if(cfg.mode!=='production' || cfg.enabled!==true || cfg.apiOrigin!==API || cfg.liffId!==LIFF)throw Error();
    prepareStage='start';
    const r=await fetch(API+'/api/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(captured),cache:'no-store',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(1500)});
    if(!r.ok)throw Error();
    const result=await r.json();
    const u=new URL(result.url);
    if(u.origin!=='https://liff.line.me' || u.pathname!=='/'+LIFF || u.username || u.password || !/^[\w-]{16}\.[\w-]{80,4000}$/.test(u.searchParams.get('bridge')||''))throw Error();
    test=result.test===true;
    return u.href;
  }
  prepare().then(url=>{prepared=url;preparedAt=Date.now();}).catch(()=>{});
  // 從 LINE／LIFF 按「上一頁」回來時頁面常由 BFCache 復原，busy 會留在 true；一律解鎖，按鈕才不會失效。
  window.addEventListener('pageshow',()=>{busy=false;});
  window.addEventListener('click',event=>{
    const a=lineAnchor(event);if(!a)return;
    // 一般 LINE 按鈕沿用正式站同分頁串接；Ctrl／Cmd／Shift／中鍵維持瀏覽器原本行為。
    if((event.button||0)!==0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey){trace('new_tab_direct');return;}
    let u;try{u=new URL(a.href);}catch(_){return;}
    if(u.origin!=='https://line.me' || decodeURIComponent(u.pathname)!=='/R/ti/p/@629xmmsh')return;
    // Existing GoogleTag continues recording ordinary button clicks; only tests
    // stop propagation so owner verification never becomes an Ads conversion.
    const held=test===true && prepared && Date.now()-preparedAt<480000;
    if(!paid && !held){trace('direct_no_source','',null);return;}
    event.preventDefault();if(held)event.stopImmediatePropagation();
    if(busy)return;busy=true;
    setTimeout(()=>{busy=false;},8000);   // 離頁失敗（例如被瀏覽器擋下）也要在幾秒後解鎖
    const navigate=url=>{
      // Unverified test flags never suppress or replace the original event.
      // An arbitrary/expired test fragment must not force an organic visitor
      // through authorization. Only the server can grant this exception.
      if(!paid && test!==true){trace('direct_no_source','',url===DIRECT?null:url);url=DIRECT;}
      else if(url===DIRECT)trace('fallback',prepareStage);
      else trace('line_click','',url);
      location.assign(url);
    };
    if(prepared && Date.now()-preparedAt<480000){navigate(prepared);return;}
    let done=false;
    const leave=url=>{if(done)return;done=true;clearTimeout(timer);navigate(url);};
    const timer=setTimeout(()=>leave(DIRECT),1800);
    prepare().then(leave).catch(()=>leave(DIRECT));
  },{capture:true});
}());
