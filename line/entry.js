/* Keep the familiar LINE buttons. Identity attribution runs in the background. */
(function () {
  'use strict';
  const SITE='https://defense.shichilawfirm.com', API='https://shichi-line-attribution.shichilawfirm.workers.dev';
  const DIRECT='https://line.me/R/ti/p/%40629xmmsh', LIFF='2012020380-bva8T4N3';
  const ENTRY='https://liff.line.me/'+LIFF;
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
    if(valid && (!has || ['gclid','gbraid','wbraid','fbclid','src','utm'].every(k=>a[k]===prev[k])))a=prev;
    if(!has && !valid){try{const ref=new URL(document.referrer).hostname;if(ref && ref!==location.hostname)a.ref=ref.slice(0,60);}catch(_){}}
    try{localStorage.setItem('sl_attr_v2',JSON.stringify(a));}catch(_){}
    const out={vid:a.vid,land_date:new Date(a.ts+28800000).toISOString().slice(0,10).replace(/-/g,'')};
    if(/^[a-f0-9]{64}$/.test(testKey))out.test_key=testKey;
    for(const k of ['gclid','gbraid','wbraid','fbclid','src','utm','ref','land'])if(typeof a[k]==='string')out[k]=a[k].slice(0,200);
    return out;
  }
  let captured,sourceVersion=0,preparing=null;try{captured=attr();}catch(_){return;}
  const fresh=()=>prepared && Date.now()-preparedAt<480000?prepared:null;
  function refreshSource() {
    try{const latest=attr();if(JSON.stringify(latest)!==JSON.stringify(captured)){captured=latest;sourceVersion++;prepared=null;test=null;rewriteLinks(document);}}catch(_){}
  }
  function trace(stage,detail='',url=prepared) {
    try {
      const bridge=url?new URL(url).searchParams.get('bridge'):null;
      const body=bridge?{bridge,stage,detail}:{attempt:crypto.randomUUID(),stage,detail,test_key:testKey};
      fetch(API+'/api/diagnostic',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),keepalive:true,referrerPolicy:'no-referrer'}).catch(()=>{});
    } catch(_) {}
  }
  function lineAnchor(event) {
    const a=event.target?.closest?.('a[href]');if(!a)return;
    if(isLine(a.href))return a;
  }
  function isLine(href) {
    try {
      const u=new URL(href,location.href);if(u.username||u.password)return false;
      return (u.origin==='https://line.me' && decodeURIComponent(u.pathname)==='/R/ti/p/@629xmmsh')
        || (u.origin==='https://page.line.me' && u.pathname==='/629xmmsh')
        || (u.origin==='https://lin.ee' && ['/ZZsQ3FE','/4m9Ceeq'].includes(u.pathname))
        || (u.origin==='https://liff.line.me' && u.pathname==='/'+LIFF);
    }catch(_){return false;}
  }
  // Every official LINE entrance uses LIFF, including copied links/new tabs.
  // Reapply after React hydration and client-side navigation add old anchors.
  function rewriteLinks(root) {
    const links=[];
    if(root.matches?.('a[href]'))links.push(root);
    if(root.querySelectorAll)links.push(...root.querySelectorAll('a[href]'));
    const destination=fresh()||ENTRY;
    for(const a of links)if(isLine(a.href) && a.href!==destination)a.href=destination;
  }
  rewriteLinks(document);
  new MutationObserver(records=>{for(const r of records){
    if(r.type==='attributes')rewriteLinks(r.target);
    else for(const n of r.addedNodes)rewriteLinks(n);
  }}).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['href']});
  let prepareStage='config';
  async function prepare() {
    const version=sourceVersion,snapshot=JSON.stringify(captured);
    prepareStage='config';
    const cfgResponse=await fetch('/line/config.json',{cache:'no-store',signal:AbortSignal.timeout(1500)});
    if(!cfgResponse.ok)throw Error();
    const cfg=await cfgResponse.json();
    if(cfg.mode!=='production' || cfg.enabled!==true || cfg.apiOrigin!==API || cfg.liffId!==LIFF)throw Error();
    prepareStage='start';
    const r=await fetch(API+'/api/start',{method:'POST',headers:{'Content-Type':'application/json'},body:snapshot,cache:'no-store',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(1500)});
    if(!r.ok)throw Error();
    const result=await r.json();
    const u=new URL(result.url);
    if(u.origin!=='https://liff.line.me' || u.pathname!=='/'+LIFF || u.username || u.password || !/^[\w-]{16}\.[\w-]{80,4000}$/.test(u.searchParams.get('bridge')||''))throw Error();
    return {url:u.href,test:result.test===true,version};
  }
  function accept(result) {
    if(result.version!==sourceVersion)return null;
    test=result.test;prepared=result.url;preparedAt=Date.now();rewriteLinks(document);return prepared;
  }
  function prepareShared() {
    if(preparing?.version===sourceVersion)return preparing.promise;
    const job={version:sourceVersion,promise:null};
    job.promise=prepare().then(accept).finally(()=>{if(preparing===job)preparing=null;});
    preparing=job;return job.promise;
  }
  prepareShared().catch(()=>{});
  const nativeIntent=event=>{const a=lineAnchor(event);if(a){refreshSource();rewriteLinks(a);}};
  window.addEventListener('contextmenu',nativeIntent,{capture:true});
  window.addEventListener('pointerdown',nativeIntent,{capture:true});
  // 從 LINE／LIFF 按「上一頁」回來時頁面常由 BFCache 復原，busy 會留在 true；一律解鎖，按鈕才不會失效。
  window.addEventListener('pageshow',()=>{busy=false;rewriteLinks(document);});
  window.addEventListener('click',event=>{
    const a=lineAnchor(event);if(!a)return;
    // Refresh source if the visitor reached a new campaign via client navigation.
    refreshSource();
    a.href=fresh()||ENTRY;
    // Native new-tab actions also land on LIFF; the return page creates a bridge.
    const held=test===true && fresh();
    const target=a.getAttribute?.('target') || document.querySelector?.('base[target]')?.getAttribute('target') || '';
    if((event.button||0)!==0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || (target && target.toLowerCase()!=='_self')){
      if(held)event.stopImmediatePropagation();return;
    }
    // Existing GoogleTag continues recording ordinary button clicks; only tests
    // stop propagation so owner verification never becomes an Ads conversion.
    event.preventDefault();if(held)event.stopImmediatePropagation();
    if(busy)return;busy=true;
    setTimeout(()=>{busy=false;},8000);   // 離頁失敗（例如被瀏覽器擋下）也要在幾秒後解鎖
    const navigate=url=>{
      if(url===DIRECT)trace('fallback',prepareStage);
      else trace('line_click','',url);
      location.assign(url);
    };
    if(fresh()){navigate(fresh());return;}
    let done=false;
    const leave=url=>{if(done)return;done=true;clearTimeout(timer);navigate(url);};
    const timer=setTimeout(()=>leave(fresh()||DIRECT),1800);
    prepareShared().then(url=>leave(url||fresh()||DIRECT)).catch(()=>leave(fresh()||DIRECT));
  },{capture:true});
}());
