/* Crowns & Cards v14 — universal creature-card renderer.
   Adds user-provided sleeve to existing interactive cards; source stats and game actions stay intact. */
(function(){
  'use strict';
  const targets=[
    '#cc-v09 .cc09-world-squad .cc09-unit:not(.empty)',
    '#cc-v09 .cc09-pick-card',
    '#cc-v09 .cc09-squad-slots .cc14-squad-choice',
    '#cc-v09 .cc7-card:not(.cc7-empty)',
    '#cc-v09 .cc7-option',
    '#cc-v09 .cc-pack-result figure.cc6-reward',
    '#cc-v09 .cc-item.cc6-row',
    '#collection-cards .undead-card',
    '.world-army-choices .undead-card'
  ].join(',');
  const levelFrom=node=>{
    const levelText=node.querySelector(':scope > .cc09-level, :scope > .cc6-level, :scope > .cc7-level, :scope > .cc09-pick-meta, .cc-item-detail .cc6-level, .cc-card-level')?.textContent||'';
    const match=levelText.match(/(?:УР\.?|Уровень)\s*(\d+)/i);
    if(match)return match[1];
    const cls=Array.from(node.classList).find(s=>/^cc-level-[1-5]$/.test(s));
    return cls?cls.substring(9):'1';
  };
  function decorate(node){
    if(!node||node.classList.contains('cc14-card-ready'))return;
    const stats=node.querySelector('.cc6-stats, .cc7-stats, .cc-stats-row');
    if(!stats)return;
    const attack=stats.querySelector('.cc6-attack b, .cc7-atk b, .cc-attack .cc-stat-number');
    const health=stats.querySelector('.cc6-health b, .cc7-hp b, .cc-health .cc-stat-number');
    if(!attack||!health)return;
    const attackValue=attack.textContent.trim(),healthValue=health.textContent.trim();
    if(!/^\d+$/.test(attackValue)||!/^\d+$/.test(healthValue))return;
    const src=node.querySelector(':scope > img, :scope > .cc09-pick-portrait img, :scope > .cc-art-frame img, :scope > span.cc-art-frame img, :scope > .cc-card-image');
    if(!src||!src.getAttribute('src'))return;
    const nameEl=node.querySelector(':scope > strong, :scope > figcaption, :scope > .cc09-pick-title, :scope > span > b, :scope > .cc-item-detail b, :scope > .cc-card-header .cc-card-name');
    const name=nameEl?.textContent.trim()||src.alt||'Существо';
    const skin=document.createElement('span');
    skin.className='cc14-card-skin';
    skin.setAttribute('aria-hidden','true');
    const portrait=document.createElement('span');portrait.className='cc14-portrait';
    const img=document.createElement('img');img.src=src.getAttribute('src');img.alt='';img.loading='lazy';img.decoding='async';
    portrait.append(img);
    const lvl=document.createElement('span');lvl.className='cc14-level';lvl.textContent='УР. '+levelFrom(node);
    const atk=document.createElement('span');atk.className='cc14-stat cc14-attack';atk.textContent=attackValue;
    const hp=document.createElement('span');hp.className='cc14-stat cc14-health';hp.textContent=healthValue;
    skin.append(portrait,lvl,atk,hp);
    node.prepend(skin);
    node.classList.add('cc14-card-ready');
    if(node.tagName==='BUTTON'&&!node.getAttribute('aria-label')){
      node.setAttribute('aria-label',name+', уровень '+levelFrom(node)+', урон '+attackValue+', здоровье '+healthValue);
    }
  }
  function scan(scope){
    if(!scope||!scope.querySelectorAll)return;
    if(scope.matches?.(targets))decorate(scope);
    scope.querySelectorAll(targets).forEach(decorate);
  }
  function setup(){
    const roots=[document.getElementById('cc-v09'),document.getElementById('collection-cards'),
      document.querySelector('.world-army-choices')].filter(Boolean);
    if(!roots.length)return;
    for(const root of roots){
      scan(root);
      // Cards are regenerated after every game action: reapply the same sleeve to new cards.
      const observer=new MutationObserver(records=>{
        let hasNew=false;
        for(const record of records){if(record.addedNodes.length){hasNew=true;break}}
        if(hasNew)scan(root);
      });
      observer.observe(root,{childList:true,subtree:true});
    }
    window.CrownsOrnateCards={refresh:()=>roots.forEach(scan)};
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});
  else setup();
})();