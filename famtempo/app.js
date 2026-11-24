import {isCustody,nights,nextDay,eventLabel,validateCustody} from './custody.mjs?v=2';
const $=id=>document.getElementById(id);
const profile=document.body.dataset.profile;
const names={jules:'Jules',marine:'Marine',sophie:'Sophie',mathieu:'Mathieu'};
const BASE='/famtempo/';
const API='https://buxlddhjwgqyxxuszmtj.supabase.co';
const KEY='sb_publishable_1KG-61FmOj1peKXudkh7xA_Ww2oc98N';
const sessionKey='famtempo.auth.v1';
let session=null, access='',calendars=[],events=[],busy=false,loaded=false,stamp='',hidden=new Set(),selected='all';
let month=new Date(Date.UTC(2027,0,1));
let deferredPrompt=null;
const dateFmt=new Intl.DateTimeFormat('fr-FR',{day:'numeric',month:'short',timeZone:'UTC'});
const monthFmt=new Intl.DateTimeFormat('fr-FR',{month:'long',year:'numeric',timeZone:'UTC'});
function storageGet(k){try{return localStorage.getItem(k)}catch{return null}}
function storageSet(k,v){try{localStorage.setItem(k,v)}catch{}}
function say(message,error=false){$('status').textContent=message;$('status').className=error?'error':'ok'}
function headers(){const h={apikey:KEY,'Content-Type':'application/json'};if(profile==='jules'&&session?.access_token)h.Authorization='Bearer '+session.access_token;if(profile!=='jules'&&access)h['x-famtempo-key']=access;return h}
async function call(path,options={}){
 const response=await fetch(API+path,{...options,headers:{...headers(),...options.headers},cache:'no-store'});
 const data=await response.json().catch(()=>null);
 if(!response.ok){const error=new Error(data?.msg||data?.message||'Connexion au service impossible.');error.status=response.status;error.code=data?.code;throw error}return data;
}
async function refreshSession(){
 if(profile!=='jules'||!session)return;
 if(session.expires_at>Date.now()/1000+60)return;
 const data=await call('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:JSON.stringify({refresh_token:session.refresh_token})});
 saveSession(data);
}
function saveSession(data){session=data;storageSet(sessionKey,JSON.stringify(data))}
function editable(c){return c.editors.includes(profile)}
async function sync(manual=false){
 if(busy||document.hidden)return;busy=true;
 try{
 await refreshSession();
 const [ws,cs,es]=await Promise.all([call('/rest/v1/ft_workspaces?select=id,label'),call('/rest/v1/ft_calendars?select=*&order=slug'),call('/rest/v1/ft_events?select=*&order=first_day')]);
 if(!ws.length)throw new Error(profile==='jules'?'Ton compte ne dispose pas encore de cet espace. Vérifie ton adresse e-mail et sa confirmation.':'Ce lien de simulation est invalide ou a expiré.');
 calendars=cs;events=es;
 const next=JSON.stringify([cs,es]);if(next!==stamp){stamp=next;render()}
 $('auth').hidden=true;$('app').hidden=false;$('logout').hidden=profile!=='jules';
 loaded=true;$('sync').textContent='Synchronisé à '+new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
 $('sync').className='sync ok';if(manual)say('Calendriers à jour.');
 }catch(error){$('sync').textContent='Synchronisation interrompue — réessayer';$('sync').className='sync error';if(manual||!loaded)say(error.message,true);if(profile==='jules'&&error.status===401){session=null;localStorage.removeItem(sessionKey);$('auth').hidden=false;$('app').hidden=true;}}
 finally{busy=false}
}
function option(value,text){const el=document.createElement('option');el.value=value;el.textContent=text;return el}
function render(){
 const view=$('calendar-view');view.replaceChildren(option('all','Mon calendrier'),...calendars.map(c=>option(c.id,c.name)));view.value=selected;
 if(!view.value){selected='all';view.value='all'}
 $('filters').replaceChildren();
 for(const c of calendars){const label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.checked=!hidden.has(c.id);check.onchange=()=>{check.checked?hidden.delete(c.id):hidden.add(c.id);renderCalendar()};label.append(check,' '+c.name);$('filters').append(label)}
 $('new-event').disabled=!calendars.some(c=>editable(c)&&!isCustody(c));$('new-custody').disabled=!calendars.some(c=>editable(c)&&isCustody(c));renderCalendar();
}
function visibleEvents(){const ids=new Set(calendars.filter(c=>selected==='all'?!hidden.has(c.id):selected===c.id).map(c=>c.id));return events.filter(e=>ids.has(e.calendar_id))}
function renderCalendar(){
 $('month').textContent=monthFmt.format(month);const grid=$('grid');grid.replaceChildren();
 for(const day of ['Lun.','Mar.','Mer.','Jeu.','Ven.','Sam.','Dim.']){const el=document.createElement('div');el.className='weekday';el.textContent=day;grid.append(el)}
 const year=month.getUTCFullYear(),m=month.getUTCMonth(),offset=(month.getUTCDay()+6)%7,count=new Date(Date.UTC(year,m+1,0)).getUTCDate(),shown=visibleEvents();
 for(let i=0;i<Math.ceil((offset+count)/7)*7;i++){
 const day=i-offset+1,cell=document.createElement('div');cell.className='day';
 if(day<1||day>count){cell.classList.add('empty');grid.append(cell);continue}
 const date=new Date(Date.UTC(year,m,day)).toISOString().slice(0,10),num=document.createElement('div');num.className='number';const canAdd=calendars.some(c=>editable(c)&&isCustody(c)&&(selected==='all'||selected===c.id));if(canAdd){const add=document.createElement('button');add.type='button';add.className='day-add';add.textContent=day;add.setAttribute('aria-label','Ajouter une garde le '+dateFmt.format(new Date(date)));add.onclick=()=>openEvent(null,{kind:'custody',date});num.append(add)}else num.textContent=day;cell.append(num);
 for(const e of shown.filter(e=>e.first_day<=date&&date<e.end_day)){const c=calendars.find(c=>c.id===e.calendar_id),b=document.createElement('button');b.type='button';b.className='event '+e.status;b.style.setProperty('--event-color',c.color);b.textContent=(isCustody(c)?c.name+' · ':'')+eventLabel(e,c);b.title=c.name+' · '+eventLabel(e,c);b.onclick=()=>openEvent(e);cell.append(b)}grid.append(cell);
 }
 const start=new Date(Date.UTC(year,m,1)).toISOString().slice(0,10),end=new Date(Date.UTC(year,m+1,1)).toISOString().slice(0,10);
 const list=$('agenda');list.replaceChildren();
 const monthly=shown.filter(e=>e.first_day<end&&e.end_day>start);
 if(!monthly.length){const p=document.createElement('p');p.className='muted';p.textContent='Aucun événement ce mois-ci. Ajoute une proposition pour tester la synchronisation.';list.append(p)}
 for(const e of monthly){const c=calendars.find(c=>c.id===e.calendar_id),wrap=document.createElement('div'),b=document.createElement('button');wrap.className='agenda-item';b.textContent=dateFmt.format(new Date(e.first_day))+' – '+dateFmt.format(new Date(e.end_day))+' · '+c.name+' · '+eventLabel(e,c)+(isCustody(c)?' · '+nights(e.first_day,e.end_day)+' nuits':'')+' · '+(e.status==='confirmed'?'Confirmé':'Proposé');b.onclick=()=>openEvent(e);wrap.append(b);list.append(wrap)}
 $('filters').hidden=selected!=='all';
}
let formCanEdit=false;
function formCalendar(){return calendars.find(c=>c.id===$('event-calendar').value)}
function updateCustodyForm(keepParent=false){
 const calendar=formCalendar(),custody=isCustody(calendar),previous=$('custody-parent').value;
 $('custody-fields').hidden=!custody;$('title-field').hidden=custody;
 $('event-title').required=!custody;$('custody-parent').required=custody;
 $('event-calendar-label').firstChild.textContent=custody?'Enfant':'Calendrier';
 if(custody){
  const parents=Object.entries(calendar.custody_parents);
  $('custody-parent').replaceChildren(option('','Choisir un parent'),...parents.map(([id,name])=>option(id,'Chez '+name)));
  if(keepParent&&parents.some(([id])=>id===previous))$('custody-parent').value=previous;
  $('time-zone').textContent='Heures locales : '+calendar.time_zone+' · '+calendar.name;
 }else $('time-zone').textContent='';
 updateSummary();
}
function updateSummary(){
 const calendar=formCalendar();if(!isCustody(calendar)){$('custody-summary').hidden=true;return}
 $('custody-summary').hidden=false;
 const data={id:$('event-id').value,calendar_id:calendar.id,custodian:$('custody-parent').value,first_day:$('event-start').value,end_day:$('event-end').value};
 const count=nights(data.first_day,data.end_day),parent=calendar.custody_parents[data.custodian];
 $('custody-summary').textContent=count?(count+' nuit'+(count>1?'s':'')+(parent?' chez '+parent:'')+'. Le jour de retour n’est pas compté comme une nuit.'):'Choisis les dates de début et de retour.';
 const error=formCanEdit?validateCustody(events,data,calendar):'';
 $('custody-warning').textContent=error;$('custody-warning').hidden=!error;
}
function openEvent(event=null,{kind='event',date=null}={}){
 $('event-form').reset();$('event-id').value=event?.id||'';$('event-revision').value=event?.revision||'';
 const available=event?calendars.filter(c=>c.id===event.calendar_id):calendars.filter(c=>editable(c)&&(kind==='custody'?isCustody(c):!isCustody(c)));
 if(!available.length){say('Aucun calendrier modifiable pour ce type de période.',true);return}
 $('event-calendar').replaceChildren(...available.map(c=>option(c.id,c.name)));
 if(!event&&available.some(c=>c.id===selected))$('event-calendar').value=selected;
 formCanEdit=!event||(event.status==='proposed'&&editable(available[0]));
 $('event-title').value=event?.title||'';$('event-start').value=event?.first_day||date||month.toISOString().slice(0,10);
 $('event-end').value=event?.end_day||nextDay($('event-start').value);
 $('event-start-time').value=event?.handoff_start?.slice(0,5)||'';$('event-end-time').value=event?.handoff_end?.slice(0,5)||'';
 for(const el of $('event-form').querySelectorAll('input,select'))el.disabled=!formCanEdit;
 $('event-calendar').disabled=!!event||!formCanEdit;$('save-event').hidden=!formCanEdit;
 updateCustodyForm();if(event?.custodian)$('custody-parent').value=event.custodian;updateSummary();
 const custody=isCustody(formCalendar());
 $('event-heading').textContent=custody?(event?(formCanEdit?'Modifier la garde':'Détail de la garde'):'Ajouter une garde'):(event?'Détail de la période':'Nouvel événement');
 $('edit-note').textContent=formCanEdit?(custody?'Cette garde reste une proposition partagée avec les personnes autorisées.':'La proposition sera enregistrée dans le calendrier partagé.'):(event?.status==='confirmed'?'Cette période est confirmée. Sa modification nécessitera un accord.':'Ce profil peut consulter cette garde, mais seuls les parents concernés peuvent la modifier.');
 $('event-error').textContent='';$('event-dialog').showModal();
}
$('event-calendar').onchange=()=>updateCustodyForm();
for(const id of ['custody-parent','event-start','event-end','event-start-time','event-end-time'])$(id).oninput=()=>{if(id==='event-start'&&$('event-start').value&&$('event-end').value<=$('event-start').value)$('event-end').value=nextDay($('event-start').value);updateSummary()};
$('event-form').onsubmit=async e=>{
 e.preventDefault();const button=$('save-event');button.disabled=true;
 try{
 await refreshSession();
 const id=$('event-id').value,calendar=formCalendar(),custody=isCustody(calendar);
 const data={title:$(custody?'custody-parent':'event-title').value.trim(),first_day:$('event-start').value,end_day:$('event-end').value,handoff_start:$('event-start-time').value||null,handoff_end:$('event-end-time').value||null};
 if(custody){data.custodian=$('custody-parent').value;data.title='Chez '+(calendar.custody_parents[data.custodian]||'');const error=validateCustody(events,{...data,id,calendar_id:calendar.id},calendar);if(error)throw new Error(error)}
 else if(!data.title||data.end_day<=data.first_day)throw new Error('La fin doit se situer après le début.');
 let result;
 if(id)result=await call('/rest/v1/ft_events?id=eq.'+encodeURIComponent(id)+'&revision=eq.'+$('event-revision').value,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(data)});
 else result=await call('/rest/v1/ft_events',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({...data,calendar_id:calendar.id})});
 if(!result?.length)throw new Error('Cette période a été modifiée depuis son ouverture ou tes droits ont changé. Ferme le formulaire, actualise et rouvre la période.');
 month=new Date(data.first_day+'T00:00:00Z');month=new Date(Date.UTC(month.getUTCFullYear(),month.getUTCMonth(),1));
 hidden.delete(calendar.id);if(selected!=='all'&&selected!==calendar.id)selected=calendar.id;
 $('event-dialog').close();say(custody?'Garde enregistrée et partagée.':'Événement enregistré et partagé.');stamp='';await sync();
 }catch(error){$('event-error').textContent=error.code==='23P01'?'Une autre garde occupe déjà ces nuits. Actualise le calendrier avant de réessayer.':error.message}finally{button.disabled=false}
};
$('auth-form').onsubmit=async e=>{e.preventDefault();$('signin').disabled=true;try{const data=await call('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email:$('email').value.trim(),password:$('password').value})});saveSession(data);$('password').value='';await sync(true)}catch(error){say('Connexion impossible. Vérifie ton mot de passe et la confirmation de ton compte.',true)}finally{$('signin').disabled=false}};
$('signup').onclick=async()=>{if(!$('auth-form').reportValidity())return;$('signup').disabled=true;try{const data=await call('/auth/v1/signup',{method:'POST',body:JSON.stringify({email:$('email').value.trim(),password:$('password').value})});if(data.access_token){saveSession(data);await sync(true)}else say('Compte demandé. Ouvre le message de confirmation reçu par e-mail, puis reviens te connecter.')}catch(error){say(error.message,true)}finally{$('signup').disabled=false}};
$('logout').onclick=async()=>{try{await call('/auth/v1/logout',{method:'POST'})}catch{}session=null;localStorage.removeItem(sessionKey);location.reload()};
$('calendar-view').onchange=e=>{selected=e.target.value;renderCalendar()};
$('prev').onclick=()=>{month=new Date(Date.UTC(month.getUTCFullYear(),month.getUTCMonth()-1,1));renderCalendar()};
$('next').onclick=()=>{month=new Date(Date.UTC(month.getUTCFullYear(),month.getUTCMonth()+1,1));renderCalendar()};
$('new-event').onclick=()=>openEvent();$('new-custody').onclick=()=>openEvent(null,{kind:'custody'});$('refresh').onclick=()=>sync(true);
$('close-event').onclick=()=>$('event-dialog').close();$('install-open').onclick=()=>$('install-dialog').showModal();$('install-close').onclick=()=>$('install-dialog').close();
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;$('native-install').hidden=false});
$('native-install').onclick=async()=>{if(deferredPrompt){await deferredPrompt.prompt();deferredPrompt=null;$('native-install').hidden=true}};
async function boot(){
 const hash=new URLSearchParams(location.hash.slice(1));
 if(profile!=='jules'){
 access=hash.get('key')||storageGet('famtempo.demo.'+profile)||'';
 if(access)storageSet('famtempo.demo.'+profile,access);
 $('auth').hidden=true;if(!access){say('Ouvre le lien privé complet reçu dans le mail pour activer ce profil de simulation.',true);return}
 }else{
 try{session=JSON.parse(storageGet(sessionKey)||'null')}catch{}
 const tokenHash=hash.get('token_hash');const type=hash.get('type');
 if(tokenHash&&['invite','recovery','signup','magiclink'].includes(type)){
 try{saveSession(await call('/auth/v1/verify',{method:'POST',body:JSON.stringify({token_hash:tokenHash,type})}));history.replaceState(null,'',location.pathname);$('password-dialog').showModal()}catch{say('Le lien d’activation a expiré. Connecte-toi ou demande un nouveau lien.',true)}
 }
 if(!session){$('auth').hidden=false;return}
 }
 await sync(true);
}
$('password-form').onsubmit=async e=>{e.preventDefault();$('set-password').disabled=true;try{await call('/auth/v1/user',{method:'PUT',body:JSON.stringify({password:$('new-password').value})});$('new-password').value='';$('password-dialog').close();say('Mot de passe enregistré. Ton compte est prêt.')}catch(error){$('password-error').textContent=error.message}finally{$('set-password').disabled=false}};
window.addEventListener('online',()=>sync(true));window.addEventListener('focus',()=>sync());document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync()});
setInterval(()=>{if(loaded)sync()},3000);
if('serviceWorker'in navigator)navigator.serviceWorker.register(BASE+'sw.js',{scope:BASE}).catch(()=>{});
const standalone=matchMedia('(display-mode: standalone)').matches||navigator.standalone;
if(!standalone&&!storageGet('famtempo.install.seen.'+profile)){$('install-dialog').showModal();storageSet('famtempo.install.seen.'+profile,'1')}
boot();
