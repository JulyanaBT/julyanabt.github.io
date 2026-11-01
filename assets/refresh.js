const reloadLatest=()=>{const url=new URL(location.href);url.searchParams.set('_refresh',Date.now());location.replace(url.href);};
const indicator=document.createElement('div');indicator.setAttribute('role','status');indicator.style.cssText='position:fixed;top:env(safe-area-inset-top,0px);left:50%;transform:translateX(-50%);z-index:10000;padding:12px 20px;border-radius:0 0 18px 18px;background:#ffd100;color:#003f2f;font:700 14px system-ui;pointer-events:none;display:none';document.body.append(indicator);
let start=null,distance=0,refreshing=false;
document.addEventListener('touchstart',e=>{if(!refreshing&&e.touches.length===1&&window.scrollY<=3&&!e.target.closest('input,textarea,select,dialog')){start=e.touches[0].clientY;distance=0;}},{passive:true});
document.addEventListener('touchmove',e=>{if(start===null)return;distance=Math.max(0,e.touches[0].clientY-start);if(distance>12&&window.scrollY<=3){if(e.cancelable)e.preventDefault();indicator.style.display='block';indicator.textContent=distance>=85?'↻ Relâchez pour actualiser':'↓ Tirez pour actualiser';}},{passive:false});
document.addEventListener('touchend',()=>{if(start===null)return;start=null;if(distance>=85){refreshing=true;indicator.textContent='↻ Actualisation…';reloadLatest();}else indicator.style.display='none';distance=0;},{passive:true});
document.addEventListener('touchcancel',()=>{start=null;distance=0;indicator.style.display='none';},{passive:true});
window.addEventListener('pageshow',e=>{if(e.persisted&&!document.querySelector('dialog[open]'))reloadLatest();});

