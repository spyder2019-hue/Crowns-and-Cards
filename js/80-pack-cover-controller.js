/* Transparent undead & multirace hero cover art. Self-contained offline game. */
(function(){
  const COVER_UNDEAD = "assets/packs/undead-pack.webp";
  const COVER_HEROES = "assets/packs/heroes-pack.webp";
  if(typeof refreshPackUI!=='function')return;
  const baseRefresh=refreshPackUI;
  refreshPackUI=function(){
    baseRefresh();
    const art=document.getElementById('pack-feature-art');
    if(!art)return;
    art.classList.remove('pack-art-hero','pack-art-undead');
    if(packType==='heroes'){
      art.classList.add('pack-art-hero');
      art.style.backgroundImage='url("'+COVER_HEROES+'")';
    } else if(packType==='units'){
      art.classList.add('pack-art-undead');
      art.style.backgroundImage='url("'+COVER_UNDEAD+'")';
    }
  };
  refreshPackUI();
})();
