const offeredKey='julyanabt-install-offered',mobile=()=>matchMedia('(max-width:900px)').matches;
const standalone=()=>matchMedia('(display-mode:standalone)').matches||navigator.standalone===true;
let nativePrompt=null;
function installed(){let saved=false;try{saved=localStorage.getItem('julyanabt-installed')==='1';}catch{}return standalone()||saved;}
function syncInstalled(){if(standalone()){try{localStorage.setItem('julyanabt-installed','1');}catch{}}document.documentElement.classList.toggle('is-installed',installed());if(installed())hide();}
syncInstalled();
function hide(){document.querySelector('.main-install-banner')?.remove();}
function guide(){let dialog=document.getElementById('main-install-guide');if(!dialog){dialog=document.createElement('dialog');dialog.id='main-install-guide';dialog.setAttribute('aria-labelledby','main-install-title');document.body.append(dialog);}
 const apple=/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
 const steps=standalone()?'<p>JulyanaBT est déjà ouvert depuis votre écran d’accueil.</p>':apple?'<ol><li>Ouvrez JulyanaBT dans <strong>Safari</strong>.</li><li>Touchez <strong>Partager</strong>.</li><li>Choisissez <strong>Sur l’écran d’accueil</strong>.</li><li>Activez <strong>Ouvrir comme app web</strong> si proposé, puis touchez <strong>Ajouter</strong>.</li></ol>':'<ol><li>Ouvrez le menu de votre navigateur.</li><li>Choisissez <strong>Installer l’application</strong> ou <strong>Ajouter à l’écran d’accueil</strong>.</li><li>Confirmez l’ajout de <strong>JulyanaBT</strong>.</li></ol>';
 dialog.innerHTML='<h2 id="main-install-title">JulyanaBT sur votre écran d’accueil</h2>'+steps+'<form method="dialog"><button>Compris</button></form>';dialog.showModal();}
async function install(){hide();if(nativePrompt){const prompt=nativePrompt;nativePrompt=null;try{await prompt.prompt();await prompt.userChoice;return;}catch{}}guide();}
document.addEventListener('click',e=>{if(e.target.closest('[data-main-install]'))install();});
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();nativePrompt=event;});
window.addEventListener('appinstalled',()=>{try{localStorage.setItem('julyanabt-installed','1');}catch{}syncInstalled();});
if(mobile()&&!installed()){
 let seen=false;try{seen=sessionStorage.getItem(offeredKey)==='1';}catch{}
 if(!seen){try{sessionStorage.setItem(offeredKey,'1');}catch{}
 const banner=document.createElement('aside');banner.className='main-install-banner';banner.setAttribute('aria-label','Installer JulyanaBT');banner.innerHTML='<img src="assets/img/app-icon.png" alt=""><div><strong>JulyanaBT sur votre écran d’accueil</strong><div class="main-install-actions"><button type="button" data-main-install>Ajouter</button><button type="button" class="install-later">Plus tard</button></div></div>';banner.querySelector('.install-later').onclick=hide;document.body.append(banner);}
}
