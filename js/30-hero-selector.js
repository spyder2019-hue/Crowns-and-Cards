function renderHeroShowcase(){
 const target=document.getElementById('hero-showcase-card');if(!target)return;
 const h=state.hero;const image=typeof heroPicture==='function'?heroPicture(h.id):'';
 target.innerHTML='<img alt="Портрет героя" src="'+image+'"><div class="hero-showcase-info"><strong></strong><small></small></div>';
 target.querySelector('strong').textContent=h.name;
 target.querySelector('small').textContent=(h.title||'Герой')+' · Уровень '+state.level;
}
function showHeroPicker(){
 const p=document.getElementById('hero-picker');p.hidden=!p.hidden;if(p.hidden)return;
 const available=[{...state.hero,current:true},...(state.heroes||[]).filter(h=>h.id!==state.hero.id||h.name!==state.hero.name)];
 p.innerHTML='';available.forEach((h,i)=>{let b=document.createElement('button');b.textContent=h.name+' — '+(h.title||'Герой')+(h.current?' ✓':'');b.disabled=!!h.current;b.onclick=()=>{
 const previous={...state.hero,level:state.level,xp:state.xp};
 state.heroes=(state.heroes||[]).filter(x=>x.id!==h.id||x.name!==h.name);
 state.heroes.push(previous);
 state.hero={...h};delete state.hero.current;
 state.level=h.level||1;state.xp=h.xp||0;state.hero.points??=0;state.hero.attack??=0;
 p.hidden=true;save();renderHeroShowcase();
 };p.append(b)});
}
function purchaseShopUnit(key,price){let el=document.getElementById('shop-status');if(state.gold<price){el.textContent='Недостаточно золота';return}state.gold-=price;addUnit(key);save();el.textContent='Карта «'+CREATURES[key].name+'» добавлена в коллекцию.'}
document.getElementById('select-hero-btn').onclick=showHeroPicker;
document.getElementById('develop-hero-btn').onclick=()=>{const d=document.querySelector('#tab-world .hero-upgrade-menu');if(d){d.open=true;d.scrollIntoView({behavior:'smooth',block:'center'})}};
document.querySelectorAll('.gothic-sidebar [data-tab]').forEach(b=>b.onclick=()=>{showTab(b.dataset.tab);document.querySelectorAll('.gothic-sidebar [data-tab]').forEach(x=>x.classList.toggle('active',x===b));if(b.dataset.tab==='world')renderHeroShowcase()});
const originalRenderAll=renderAll;renderAll=function(){originalRenderAll();renderHeroShowcase()};
renderHeroShowcase();
