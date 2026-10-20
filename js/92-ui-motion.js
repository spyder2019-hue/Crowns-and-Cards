/* Cinematic polish for cards and packs; doesn't alter game state. */
(function(){
 'use strict';
 const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
 function enabled(){return !reduced.matches&&localStorage.getItem('cc-motion')!=='off'}
 const buy=document.getElementById('buy-pack');
 if(buy)buy.addEventListener('click',()=>{
   if(!enabled()||buy.disabled)return;
   const art=document.getElementById('pack-feature-art');
   if(!art)return;
   art.classList.remove('cc-pack-opening');void art.offsetWidth;art.classList.add('cc-pack-opening');
   window.setTimeout(()=>art.classList.remove('cc-pack-opening'),810);
 });
 const rewards=document.getElementById('pack-result');
 if(rewards){
   const observer=new MutationObserver(()=>{
     if(!enabled())return;
     const items=rewards.querySelectorAll('.preview-card');
     items.forEach((e,i)=>{e.style.setProperty('--cc-order',i);e.classList.add('cc-reward-enter')});
   });
   observer.observe(rewards,{childList:true});
 }
 const lab=document.getElementById('tab-lab');
 if(lab)lab.addEventListener('click',event=>{
   const merge=event.target.closest('.lab-merge');
   if(!merge||merge.disabled||!enabled())return;
   window.setTimeout(()=>{const card=lab.querySelector('.lab-card');if(!card)return;card.classList.remove('cc-fusion-glow');void card.offsetWidth;card.classList.add('cc-fusion-glow')},30);
 });
})();
