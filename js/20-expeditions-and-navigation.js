function startSelectedExpedition(){
 const btn=document.querySelector('#world-locations button.selected')||document.querySelector('#world-locations button');
 if(!btn)return;
 const region=btn.getAttribute('data-region');
 if(typeof chooseRegion==='function')chooseRegion(region);
 if(typeof startBattle==='function'){startBattle(region);return;}
 const candidate=document.querySelector('#region-details button');
 if(candidate)candidate.click();
 else alert('Выбери поход справа.');
}

document.addEventListener('click',function(e){
 const b=e.target.closest('.gothic-sidebar [data-tab], .nav [data-tab]');
 if(b)document.querySelectorAll('.gothic-sidebar [data-tab], .nav [data-tab]').forEach(x=>x.classList.toggle('active',x.dataset.tab===b.dataset.tab));
});
