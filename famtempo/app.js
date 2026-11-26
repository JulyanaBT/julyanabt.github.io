import {readAuthReturn} from './auth-return.mjs?v=5';
import {isCustody,nights,nextDay,eventLabel,validateCustody,addDays,alternatingWeeks,recurrencePreview} from './custody.mjs?v=4';
const $=id=>document.getElementById(id);
const profile=document.body.dataset.profile;
const names={jules:'Jules',marine:'Marine',sophie:'Sophie',mathieu:'Mathieu'};
const parentPalette={jules:['#1d4ed8','#dbeafe'],marine:['#9d174d','#fce7f3'],sophie:['#6d28d9','#ede9fe'],mathieu:['#0f766e','#ccfbf1']};
function parentColors(key){return parentPalette[key]||['#475569','#e2e8f0']}

const BASE='/famtempo/';
const API='https://buxlddhjwgqyxxuszmtj.supabase.co';
const KEY='sb_publishable_1KG-61FmOj1peKXudkh7xA_Ww2oc98N';
const sessionKey='famtempo.auth.v1';
let session=null, access='',calendars=[],events=[],busy=false,loaded=false,stamp='',hidden=new Set(),selected='all';
const now=new Date();
let month=new Date(Date.UTC(now.getFullYear(),now.getMonth(),1));
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
 $('sync').className='sync ok';if(manual)say('');
 }catch(error){$('sync').textContent='Synchronisation interrompue — réessayer';$('sync').className='sync error';if(manual||!loaded)say(error.message,true);if(profile==='jules'&&error.status===401){session=null;localStorage.removeItem(sessionKey);$('auth').hidden=false;$('app').hidden=true;}}
 finally{busy=false}
}
function option(value,text){const el=document.createElement('option');el.value=value;el.textContent=text;return el}
function render(){
 const view=$('calendar-view');view.replaceChildren(option('all','Mon calendrier'),...calendars.map(c=>option(c.id,c.name)));view.value=selected;
 if(!view.value){selected='all';view.value='all'}
 $('filters').replaceChildren();$('calendar-key').replaceChildren();
 for(const c of calendars){const label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.checked=!hidden.has(c.id);check.onchange=()=>{check.checked?hidden.delete(c.id):hidden.add(c.id);renderCalendar()};label.style.setProperty('--event-color',c.color);label.append(check,' '+c.name);$('filters').append(label)}
 $('new-event').disabled=!calendars.some(c=>editable(c)&&!isCustody(c));$('new-custody').disabled=!calendars.some(c=>editable(c)&&isCustody(c));$('new-alternance').disabled=$('new-custody').disabled;$('new-vacation').disabled=$('new-custody').disabled;renderCalendar();
}
function visibleEvents(){const ids=new Set(calendars.filter(c=>selected==='all'?!hidden.has(c.id):selected===c.id).map(c=>c.id));return events.filter(e=>ids.has(e.calendar_id))}
function renderCalendar(){
 $('month').textContent=monthFmt.format(month);$('agenda-month').textContent='Les périodes de '+monthFmt.format(month);const grid=$('grid');grid.replaceChildren();
 for(const day of ['Lun.','Mar.','Mer.','Jeu.','Ven.','Sam.','Dim.']){const el=document.createElement('div');el.className='weekday';el.textContent=day;grid.append(el)}
 const year=month.getUTCFullYear(),m=month.getUTCMonth(),offset=(month.getUTCDay()+6)%7,count=new Date(Date.UTC(year,m+1,0)).getUTCDate(),shown=visibleEvents();grid.style.setProperty('--weeks',Math.ceil((offset+count)/7));
 for(let i=0;i<Math.ceil((offset+count)/7)*7;i++){
 const day=i-offset+1,cell=document.createElement('div');cell.className='day';
 if(day<1||day>count){cell.classList.add('empty');grid.append(cell);continue}
 const date=new Date(Date.UTC(year,m,day)).toISOString().slice(0,10),num=document.createElement('div');num.className='number';if(date===new Date().toLocaleDateString('sv-SE'))cell.classList.add('today');const canAdd=calendars.some(c=>editable(c)&&isCustody(c)&&(selected==='all'||selected===c.id));if(canAdd){const add=document.createElement('button');add.type='button';add.className='day-add';add.textContent=day;add.setAttribute('aria-label','Ajouter une garde le '+dateFmt.format(new Date(date)));add.onclick=()=>openEvent(null,{kind:'custody',date});num.append(add)}else num.textContent=day;cell.append(num);
 for(const e of shown.filter(e=>e.first_day<=date&&date<e.end_day).sort((a,b)=>{const ac=calendars.find(c=>c.id===a.calendar_id),bc=calendars.find(c=>c.id===b.calendar_id);return Number(isCustody(bc))-Number(isCustody(ac))||ac.name.localeCompare(bc.name,'fr')})){const c=calendars.find(c=>c.id===e.calendar_id),b=document.createElement('button');b.type='button';b.className='event '+e.status+(isCustody(c)?' custody-event':'');b.style.setProperty('--event-color',isCustody(c)?parentColors(e.custodian)[0]:c.color);if(isCustody(c)){b.style.setProperty('--parent-bg',parentColors(e.custodian)[1]);b.style.setProperty('--parent-ink',parentColors(e.custodian)[0]);}b.textContent=(e.is_exception?'Vacances / exception · ':'')+(isCustody(c)?c.name+' · ':'')+eventLabel(e,c);b.title=c.name+' · '+eventLabel(e,c);b.setAttribute('aria-label',b.title+(e.is_exception?' · Vacances ou exception':''));const full=document.createElement('span');full.className='event-full';full.textContent=b.textContent;const compact=document.createElement('span');compact.className='event-compact';compact.textContent=(isCustody(c)?c.name:e.title);if(e.is_exception)b.classList.add('holiday');b.replaceChildren(full,compact);b.onclick=()=>openEvent(e);cell.append(b)}grid.append(cell);
 }
 const start=new Date(Date.UTC(year,m,1)).toISOString().slice(0,10),end=new Date(Date.UTC(year,m+1,1)).toISOString().slice(0,10);
 const list=$('agenda');list.replaceChildren();
 const monthly=shown.filter(e=>e.first_day<end&&e.end_day>start);
 if(!monthly.length){const p=document.createElement('p');p.className='muted';p.textContent='Aucun événement ce mois-ci. Ajoute une proposition pour tester la synchronisation.';list.append(p)}
 for(const e of monthly){const c=calendars.find(c=>c.id===e.calendar_id),wrap=document.createElement('div'),b=document.createElement('button');wrap.className='agenda-item';b.textContent=dateFmt.format(new Date(e.first_day))+' – '+dateFmt.format(new Date(e.end_day))+' · '+c.name+' · '+eventLabel(e,c)+(isCustody(c)?' · '+nights(e.first_day,e.end_day)+' nuit'+(nights(e.first_day,e.end_day)>1?'s':''):'')+(e.is_exception?' · Vacances / exception':'')+' · '+(e.status==='confirmed'?'Confirmé':'Proposé');b.onclick=()=>openEvent(e);wrap.append(b);list.append(wrap)}
 $('filters').hidden=selected!=='all';
 const legend=$('calendar-key');legend.replaceChildren();
 const activeCalendars=calendars.filter(c=>selected==='all'?!hidden.has(c.id):selected===c.id),parents=new Map();
 for(const c of activeCalendars.filter(isCustody))for(const [key,name]of Object.entries(c.custody_parents))parents.set(key,name);
 for(const [key,name]of parents){const item=document.createElement('span');item.className='legend-item parent-legend';item.style.setProperty('--event-color',parentColors(key)[0]);item.textContent='Chez '+name;legend.append(item)}
 for(const c of activeCalendars.filter(c=>!isCustody(c))){const item=document.createElement('span');item.className='legend-item other-legend';item.style.setProperty('--event-color',c.color);item.textContent=c.name;legend.append(item)}

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
 $('edit-note').textContent=formCanEdit?(custody?(event?.series_id?'Cette semaine peut être modifiée seule : le reste de l’alternance reste en place.':'Cette garde reste une proposition partagée avec les personnes autorisées.'):'La proposition sera enregistrée dans le calendrier partagé.'):(event?.status==='confirmed'?'Cette période est confirmée. Sa modification nécessitera un accord.':'Ce profil peut consulter cette garde, mais seuls les parents concernés peuvent la modifier.');
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
 }catch(error){const message=error.code==='23P01'?'Une autre garde occupe déjà ces nuits. Actualise le calendrier avant de réessayer.':error.message;$('event-error').textContent=!$('custody-warning').hidden&&$('custody-warning').textContent===message?'':message}finally{button.disabled=false}
};
$('auth-form').onsubmit=async e=>{e.preventDefault();$('signin').disabled=true;try{const data=await call('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email:$('email').value.trim(),password:$('password').value})});saveSession(data);$('password').value='';await sync(true)}catch(error){say('Connexion impossible. Vérifie ton mot de passe et la confirmation de ton compte.',true)}finally{$('signin').disabled=false}};
$('forgot-password').onclick=()=>{$('recovery-email').value=$('email').value.trim();$('recovery-status').textContent='';$('recovery-dialog').showModal()};
$('recovery-close').onclick=()=>$('recovery-dialog').close();
$('recovery-form').onsubmit=async e=>{e.preventDefault();$('recovery-send').disabled=true;$('recovery-status').textContent='Envoi en cours…';try{await call('/auth/v1/recover?redirect_to='+encodeURIComponent('https://julyanabt.fr/famtempo/'),{method:'POST',body:JSON.stringify({email:$('recovery-email').value.trim()})});$('recovery-status').textContent='Si un compte correspond à cette adresse, un e-mail de réinitialisation a été envoyé. Vérifie aussi les indésirables. Le lien est à usage unique.'}catch(error){$('recovery-status').textContent=error.status===429?'Un lien vient déjà d’être demandé. Patiente une minute avant de réessayer.':'L’e-mail n’a pas pu être envoyé. Réessaie dans un instant. Si cela persiste, le service d’envoi doit être vérifié.'}finally{$('recovery-send').disabled=false}};
$('signup').onclick=async()=>{if(!$('auth-form').reportValidity())return;$('signup').disabled=true;try{const data=await call('/auth/v1/signup',{method:'POST',body:JSON.stringify({email:$('email').value.trim(),password:$('password').value})});if(data.access_token){saveSession(data);await sync(true)}else say('Compte demandé. Ouvre le message de confirmation reçu par e-mail, puis reviens te connecter.')}catch(error){say(error.message,true)}finally{$('signup').disabled=false}};
$('logout').onclick=async()=>{try{await call('/auth/v1/logout',{method:'POST'})}catch{}session=null;localStorage.removeItem(sessionKey);location.reload()};
$('calendar-view').onchange=e=>{selected=e.target.value;renderCalendar()};
$('prev').onclick=()=>{month=new Date(Date.UTC(month.getUTCFullYear(),month.getUTCMonth()-1,1));renderCalendar()};
$('next').onclick=()=>{month=new Date(Date.UTC(month.getUTCFullYear(),month.getUTCMonth()+1,1));renderCalendar()};
$('new-event').onclick=()=>openEvent();$('new-custody').onclick=()=>openEvent(null,{kind:'custody'});$('refresh').onclick=()=>sync(true);
$('close-event').onclick=()=>$('event-dialog').close();$('install-open').onclick=()=>$('install-dialog').showModal();$('install-close').onclick=()=>$('install-dialog').close();
const installedKey='famtempo.installed.'+profile;
const standaloneQuery=matchMedia('(display-mode: standalone)');
function updateInstallVisibility(){
 const installed=standaloneQuery.matches||navigator.standalone===true;
 if(installed)storageSet(installedKey,'1');
 $('install-open').hidden=installed||storageGet(installedKey)==='1';
 if($('install-open').hidden&&$('install-dialog').open)$('install-dialog').close();
}
standaloneQuery.addEventListener('change',updateInstallVisibility);
window.addEventListener('appinstalled',()=>{storageSet(installedKey,'1');deferredPrompt=null;updateInstallVisibility()});
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();if(storageGet(installedKey)!=='1'){deferredPrompt=e;$('native-install').hidden=false}});
$('native-install').onclick=async()=>{if(deferredPrompt){await deferredPrompt.prompt();const result=await deferredPrompt.userChoice;if(result.outcome==='accepted'){storageSet(installedKey,'1');updateInstallVisibility()}deferredPrompt=null;$('native-install').hidden=true}};
for(const button of document.querySelectorAll('[data-tab]'))button.onclick=()=>{
 const tab=button.dataset.tab;document.body.dataset.view=tab;
 for(const view of document.querySelectorAll('.tab-view'))view.hidden=view.id!=='view-'+tab;
 for(const item of document.querySelectorAll('[data-tab]')){if(item===button)item.setAttribute('aria-current','page');else item.removeAttribute('aria-current')}
};
$('today').onclick=()=>{const date=new Date();month=new Date(Date.UTC(date.getFullYear(),date.getMonth(),1));renderCalendar()};
updateInstallVisibility();
async function boot(){
 const hash=new URLSearchParams(location.hash.slice(1));
 if(profile!=='jules'){
 access=hash.get('key')||storageGet('famtempo.demo.'+profile)||'';
 if(access)storageSet('famtempo.demo.'+profile,access);
 $('auth').hidden=true;if(!access){say('Ouvre le lien privé complet reçu dans le mail pour activer ce profil de simulation.',true);return}
 }else{
 try{session=JSON.parse(storageGet(sessionKey)||'null')}catch{}
 const authReturn=readAuthReturn(location.href),tokenHash=authReturn.tokenHash,type=authReturn.type;
 const returnedToken=authReturn.accessToken,returnedRefresh=authReturn.refreshToken;
 if(authReturn.error){history.replaceState(null,'',location.pathname);say('Le lien de réinitialisation a expiré ou a déjà été utilisé. Demande un nouveau lien avec « Mot de passe oublié ? ».',true)}
 if(returnedToken&&returnedRefresh&&['recovery','invite','signup','magiclink'].includes(type)){
  try{const user=await fetch(API+'/auth/v1/user',{headers:{apikey:KEY,Authorization:'Bearer '+returnedToken}});if(!user.ok)throw new Error('Invalid session');saveSession({access_token:returnedToken,refresh_token:returnedRefresh,expires_at:Math.floor(Date.now()/1000)+authReturn.expiresIn,user:await user.json()});history.replaceState(null,'',location.pathname);$('password-heading').textContent=type==='recovery'?'Nouveau mot de passe':'Active ton compte';$('password-dialog').showModal()}catch{say('Le lien n’est plus valide. Demande un nouveau lien avec « Mot de passe oublié ? ».',true)}
 }
 if(tokenHash&&['invite','recovery','signup','magiclink'].includes(type)){
 try{saveSession(await call('/auth/v1/verify',{method:'POST',body:JSON.stringify({token_hash:tokenHash,type})}));history.replaceState(null,'',location.pathname);$('password-heading').textContent=type==='recovery'?'Nouveau mot de passe':'Active ton compte';$('password-dialog').showModal()}catch{say('Le lien a expiré ou a déjà été utilisé. Demande un nouveau lien avec « Mot de passe oublié ? ».',true)}
 }
 if(!session){$('auth').hidden=false;return}
 }
 await sync(true);
}
$('password-form').onsubmit=async e=>{e.preventDefault();$('set-password').disabled=true;try{if($('new-password').value!==$('confirm-password').value)throw new Error('Les deux mots de passe doivent être identiques.');await refreshSession();await call('/auth/v1/user',{method:'PUT',body:JSON.stringify({password:$('new-password').value})});$('new-password').value='';$('confirm-password').value='';$('password-dialog').close();say('Mot de passe enregistré. Ton compte est prêt.')}catch(error){$('password-error').textContent=error.message}finally{$('set-password').disabled=false}};
window.addEventListener('online',()=>sync(true));window.addEventListener('focus',()=>sync());document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync()});
setInterval(()=>{if(loaded)sync()},3000);
if('serviceWorker'in navigator)navigator.serviceWorker.register(BASE+'sw.js',{scope:BASE}).catch(()=>{});
boot();

let planningMode='alternance',planningSnapshot=null;
function planningCalendar(){return calendars.find(c=>c.id===$('planning-child').value)}
function openPlanning(mode){
 planningMode=mode;planningSnapshot=null;$('planning-form').reset();
 const available=calendars.filter(c=>editable(c)&&isCustody(c));if(!available.length)return;
 $('planning-child').replaceChildren(...available.map(c=>option(c.id,c.name)));
 if(available.some(c=>c.id===selected))$('planning-child').value=selected;
 const date=month.toISOString().slice(0,10),friday=addDays(date,(5-new Date(date+'T00:00:00Z').getUTCDay()+7)%7);
 $('planning-start').value=mode==='alternance'?friday:date;$('planning-end').value=addDays($('planning-start').value,mode==='alternance'?84:7);$('planning-time').value='18:00';
 $('planning-heading').textContent=mode==='alternance'?'Créer une alternance':'Prévoir des vacances';
 $('planning-note').textContent=mode==='alternance'?'Une semaine chez chaque parent, du vendredi au vendredi. Les semaines qui chevauchent une garde existante ne sont pas créées. Les périodes déjà saisies et le rythme des semaines suivantes sont conservés.':'La plage choisie remplace les gardes proposées concernées. Les nuits avant et après sont conservées ; l’alternance reprend ensuite normalement.';
 $('planning-start-label').firstChild.textContent=mode==='alternance'?'Premier vendredi':'Début des vacances';$('planning-end-label').firstChild.textContent=mode==='alternance'?'Dernier vendredi · fin exclue':'Retour des vacances';
 $('planning-parent-label').firstChild.textContent=mode==='alternance'?'Parent de la première semaine':'Parent pendant les vacances';
 $('planning-save').textContent=mode==='alternance'?'Créer les semaines':'Appliquer les vacances';
 updatePlanningParents();$('planning-dialog').showModal();
}
function updatePlanningParents(){
 const calendar=planningCalendar();$('planning-parent').replaceChildren(option('','Choisir un parent'),...Object.entries(calendar.custody_parents).map(([id,name])=>option(id,'Chez '+name)));
 $('planning-zone').textContent='Heures locales : '+calendar.time_zone;previewPlanning();
}
function previewPlanning(){
 planningSnapshot=null;$('planning-error').textContent='';$('planning-preview').replaceChildren();
 try{
 const calendar=planningCalendar(),first=$('planning-start').value,end=$('planning-end').value,parent=$('planning-parent').value,time=$('planning-time').value||null;
 if(!parent||!first||!end){$('planning-count').textContent='Choisis le parent et les dates pour prévisualiser.';return}
 if(planningMode==='alternance'){
  const weeks=alternatingWeeks(calendar,first,end,parent,time),plan=recurrencePreview(events,weeks);
  planningSnapshot={calendar,first,end,parent,time,...plan};$('planning-count').textContent=plan.create.length+' semaine(s) à créer · '+plan.keep.length+' semaine(s) non créée(s) car une garde y existe déjà.';
  for(const w of weeks){const li=document.createElement('li');const skip=plan.keep.includes(w);li.textContent=dateFmt.format(new Date(w.first_day))+' – '+dateFmt.format(new Date(w.end_day))+' : '+(skip?'non créée · chevauche une garde existante':'chez '+calendar.custody_parents[w.custodian]);$('planning-preview').append(li)}
 }else{
  if(!nights(first,end)||nights(first,end)>366)throw new Error('Choisis une plage de vacances de 1 à 366 nuits.');
  const affected=events.filter(e=>e.calendar_id===calendar.id&&e.first_day<end&&first<e.end_day);
  if(affected.some(e=>e.status==='confirmed'))throw new Error('Une garde confirmée couvre cette plage. Un accord est nécessaire avant de la modifier.');
  planningSnapshot={calendar,first,end,parent,time,expected:affected.map(e=>({id:e.id,revision:e.revision}))};
  $('planning-count').textContent=nights(first,end)+' nuits chez '+calendar.custody_parents[parent]+' · '+affected.length+' période(s) proposée(s) à ajuster.';
  for(const e of affected){const li=document.createElement('li');li.textContent=dateFmt.format(new Date(e.first_day))+' – '+dateFmt.format(new Date(e.end_day))+' : '+eventLabel(e,calendar)+' sera ajustée uniquement sur les nuits de vacances.';$('planning-preview').append(li)}
 }
 }catch(error){$('planning-count').textContent='';$('planning-error').textContent=error.message}
}
$('new-alternance').onclick=()=>openPlanning('alternance');$('new-vacation').onclick=()=>openPlanning('vacation');$('planning-close').onclick=()=>$('planning-dialog').close();
$('planning-child').onchange=updatePlanningParents;for(const id of ['planning-parent','planning-start','planning-end','planning-time'])$(id).oninput=previewPlanning;
$('planning-form').onsubmit=async e=>{
 e.preventDefault();const button=$('planning-save');button.disabled=true;
 try{
  const plan=planningSnapshot;if(!plan)throw new Error('Complète les champs et vérifie la prévisualisation.');await refreshSession();
  if(planningMode==='alternance'){
   if(!plan.create.length)throw new Error('Aucune semaine ne peut être ajoutée sans chevaucher une garde existante. Aucune garde n’a été modifiée.');
   const series=crypto.randomUUID();await call('/rest/v1/ft_events',{method:'POST',body:JSON.stringify(plan.create.map(w=>({...w,series_id:series})))});
  }else await call('/rest/v1/rpc/ft_apply_vacation',{method:'POST',body:JSON.stringify({p_calendar:plan.calendar.id,p_first:plan.first,p_end:plan.end,p_parent:plan.parent,p_start_time:plan.time,p_end_time:plan.time,p_expected:plan.expected})});
  month=new Date(plan.first+'T00:00:00Z');month=new Date(Date.UTC(month.getUTCFullYear(),month.getUTCMonth(),1));hidden.delete(plan.calendar.id);selected=plan.calendar.id;stamp='';$('planning-dialog').close();say(planningMode==='alternance'?'Alternance créée et partagée. Les périodes existantes ont été conservées.':'Vacances enregistrées et partagées. Les gardes hors vacances ont été conservées.');await sync();
 }catch(error){$('planning-error').textContent=error.code==='23P01'||error.code==='40001'?'Le calendrier a changé. Ferme cette fenêtre, actualise puis vérifie une nouvelle prévisualisation.':error.message}finally{button.disabled=false}
};
