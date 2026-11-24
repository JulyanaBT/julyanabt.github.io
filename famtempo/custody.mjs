export function isCustody(calendar){return !!calendar?.custody_parents&&Object.keys(calendar.custody_parents).length>0}
export function nights(first,end){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(first)||!/^\d{4}-\d{2}-\d{2}$/.test(end))return 0;
 const value=Math.round((Date.parse(end+'T00:00:00Z')-Date.parse(first+'T00:00:00Z'))/86400000);return Number.isFinite(value)?Math.max(0,value):0;
}
export function nextDay(date){return new Date(Date.parse(date+'T00:00:00Z')+86400000).toISOString().slice(0,10)}
export function conflictWith(events,{id,calendar_id,first_day,end_day}){
 return events.find(e=>e.id!==id&&e.calendar_id===calendar_id&&e.first_day<end_day&&first_day<e.end_day);
}
export function eventLabel(event,calendar){return isCustody(calendar)&&event.custodian?'Chez '+calendar.custody_parents[event.custodian]:event.title}
export function validateCustody(events,data,calendar){
 if(!nights(data.first_day,data.end_day))return 'Prévois au moins une nuit : le jour de retour doit suivre le jour de début.';
 if(!Object.hasOwn(calendar.custody_parents,data.custodian))return 'Choisis le parent chez qui l’enfant passe les nuits.';
 if(conflictWith(events,data))return 'Une garde existe déjà sur ces nuits. Ouvre-la pour la modifier ou choisis une autre période.';
 return '';
}
export function addDays(date,count){return new Date(Date.parse(date+'T00:00:00Z')+count*86400000).toISOString().slice(0,10)}
export function alternatingWeeks(calendar,first,end,parent,time='18:00'){
 const parents=Object.keys(calendar.custody_parents||{});
 if(parents.length!==2||!parents.includes(parent))throw new Error('Choisis le premier parent.');
 if(new Date(first+'T00:00:00Z').getUTCDay()!==5||new Date(end+'T00:00:00Z').getUTCDay()!==5)throw new Error('Le début et la fin de l’alternance doivent être des vendredis.');
 const count=nights(first,end);if(!count||count>735||count%7)throw new Error('Choisis une période de 1 à 105 semaines complètes.');
 return Array.from({length:count/7},(_,i)=>({calendar_id:calendar.id,custodian:i%2?parents.find(p=>p!==parent):parent,first_day:addDays(first,i*7),end_day:addDays(first,(i+1)*7),handoff_start:time||null,handoff_end:time||null,title:'Garde'}));
}
export function recurrencePreview(events,weeks){return {create:weeks.filter(w=>!conflictWith(events,w)),keep:weeks.filter(w=>conflictWith(events,w))}}
