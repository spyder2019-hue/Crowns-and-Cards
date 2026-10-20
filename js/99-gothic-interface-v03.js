/* Crowns & Cards v0.3 — presentation only. Does not change combat, economy or saved-game rules. */
(function(){
  'use strict';
  const motionOK=()=>!window.matchMedia('(prefers-reduced-motion: reduce)').matches&&localStorage.getItem('cc-motion')!=='off';

  // Replace loose text glyphs with tidy, aligned navigation emblems.
  document.querySelectorAll('.gothic-sidebar button[data-tab]').forEach(button=>{
    if(button.querySelector('.cc-nav-icon'))return;
    const node=[...button.childNodes].find(child=>child.nodeType===Node.TEXT_NODE&&child.textContent.trim());
    if(!node)return;
    const mark=node.textContent.trim();
    const icon=document.createElement('span');icon.className='cc-nav-icon';icon.setAttribute('aria-hidden','true');icon.textContent=mark;
    node.replaceWith(icon);
  });
  const sidebar=document.querySelector('.gothic-sidebar');
  if(sidebar&&!sidebar.querySelector('.cc-build-label')){
    const label=document.createElement('div');label.className='cc-build-label';label.innerHTML='<span>THE OBSIDIAN COURT</span><b>v0.3</b>';sidebar.append(label);
  }

  // Replace emoji placeholders in actual purchasable creatures by their owned artwork.
  const shopImages={boneguard:'assets/creatures/boneguard.webp',skeletal_archer:'assets/creatures/skeletal-archer.webp',gravedigger:'assets/creatures/gravedigger.webp'};
  document.querySelectorAll('#tab-shop .shop-item').forEach(card=>{
    const button=card.querySelector('button[onclick]');
    if(!button)return;
    const key=(button.getAttribute('onclick')||'').match(/purchaseShopUnit\(['"]([^'"]+)/)?.[1];
    const icon=card.querySelector('.shop-item-icon');
    if(!icon||!key||!shopImages[key])return;
    const image=document.createElement('img');image.className='cc-shop-creature-art';image.src=shopImages[key];image.alt='';image.loading='lazy';
    icon.replaceChildren(image);
  });

  // Light notifications — game state continues to be managed by the existing handlers.
  const holder=document.createElement('div');holder.className='cc-toast-stack';holder.setAttribute('aria-live','polite');document.body.append(holder);
  let lastMessage='',lastAt=0;
  function toast(message){
    if(!message||!motionOK())return;
    const now=Date.now();if(message===lastMessage&&now-lastAt<1300)return;lastMessage=message;lastAt=now;
    const node=document.createElement('div');node.className='cc-toast';node.textContent=message;holder.append(node);
    while(holder.childElementCount>2)holder.firstElementChild.remove();
    setTimeout(()=>{node.classList.add('cc-toast-leave');setTimeout(()=>node.remove(),430)},2900);
  }
  const shopNotice=document.getElementById('shop-status');
  if(shopNotice)new MutationObserver(()=>{
    const message=shopNotice.textContent.trim();if(message)toast(message);
  }).observe(shopNotice,{childList:true,characterData:true,subtree:true});

  // Small reveal effect when a bestiary is chosen, and a softer page transition.
  document.querySelectorAll('#tab-collection .bestiary-choice').forEach(button=>{
    button.addEventListener('click',()=>{
      const panel=document.querySelector('#tab-collection[data-bestiary-view="undead"] .collection-panel');
      if(panel){panel.classList.remove('cc-reveal-once');void panel.offsetWidth;panel.classList.add('cc-reveal-once')}
    });
  });

  const main=document.querySelector('.app main');
  if(main){
    main.addEventListener('click',e=>{
      const button=e.target.closest('button');
      if(!button||button.disabled||!motionOK())return;
      // Subtle visual press; all original click handlers remain in charge.
      button.classList.remove('cc-click-flash');void button.offsetWidth;button.classList.add('cc-click-flash');
      setTimeout(()=>button.classList.remove('cc-click-flash'),360);
    },{passive:true});
  }
})();