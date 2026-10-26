/* Crowns & Cards — Nine Kingdoms Campaign v1.
   Uses the existing tactical battle and state.won save data; no parallel economy. */
(function () {
  'use strict';
  if (typeof PLACES === 'undefined' || typeof state === 'undefined') return;

  const territories = [
    {
      id: 'human', name: 'Королевство людей', icon: '🏰', color: '#f7d27d', level: 1,
      desc: 'Начало пути: защити столицу и собери свой первый отряд.',
      spot: [33, 29, 38, 35],
      missions: [
        ['Дозор у ворот', 'Отрази нападение на городские ворота.', ['boneguard','skeletal_archer','gravedigger']],
        ['Путь каравана', 'Очисти торговую дорогу от нежити.', ['boneguard','undeadwarrior','skeletal_archer']],
        ['Осаждённая крепость', 'Прорвись к защитникам крепости.', ['undeadwarrior','deathmage','boneconstruct']],
        ['Босс: Падший рыцарь', 'Победи командира мёртвого войска.', ['undeadwarrior','boneconstruct','necromancer']]
      ]
    },
    {
      id: 'elf', name: 'Эльфийские земли', icon: '🌳', color: '#87f1ae', level: 2,
      desc: 'Древний лес прячет исчезнувшие тропы и магические руины.',
      spot: [0, 29, 33, 35],
      missions: [
        ['Тропа светлячков','Найди пропавший эльфийский патруль.',['skeletal_archer','boneguard','skeletal_archer']],
        ['Осквернённая роща','Уничтожь нежить среди древних деревьев.',['gravedigger','undeadwarrior','deathmage']],
        ['Хранители источника','Освободи волшебный источник.',['boneconstruct','deathmage','necromancer']],
        ['Босс: Теневой друид','Останови порчу лесного сердца.',['deathmage','ghoststeed','necromancer']]
      ]
    },
    {
      id: 'north', name: 'Северные земли', icon: '❄️', color: '#9eeeff', level: 3,
      desc: 'Ледяные крепости и забытая армия за снежными перевалами.',
      spot: [0, 0, 40, 29],
      missions: [
        ['Ледяной дозор','Пробейся через метель на перевал.',['boneguard','boneconstruct','skeletal_archer']],
        ['Замёрзшие шахты','Освободи шахтёрский поселок.',['gravedigger','boneconstruct','deathmage']],
        ['Цитадель инея','Штурмуй крепость снежных теней.',['undeadwarrior','boneconstruct','ghoststeed']],
        ['Босс: Ледяной владыка','Сокруши правителя северной цитадели.',['necromancer','boneconstruct','lichlord']]
      ]
    },
    {
      id: 'desert', name: 'Пустынные земли', icon: '☀️', color: '#ffcc78', level: 4,
      desc: 'Песчаные города, гробницы и сокровища древних царей.',
      spot: [0, 64, 40, 36],
      missions: [
        ['Песчаный тракт','Найди безопасный путь сквозь барханы.',['gravedigger','skeletal_archer','undeadwarrior']],
        ['Забытый оазис','Разведай оазис с опасными развалинами.',['boneguard','deathmage','ghoststeed']],
        ['Пирамида печатей','Сними печати с подземной гробницы.',['boneconstruct','necromancer','deathmage']],
        ['Босс: Царь праха','Победи пробуждённого владыку гробниц.',['boneconstruct','ghoststeed','lichlord']]
      ]
    },
    {
      id: 'cursed', name: 'Проклятые земли', icon: '🔮', color: '#e2abff', level: 5,
      desc: 'Горные колдовские башни и нестабильные порталы.',
      spot: [39, 0, 35, 30],
      missions: [
        ['Шёпот скал','Исследуй разлом на границе проклятия.',['deathmage','undeadwarrior','skeletal_archer']],
        ['Фиолетовый портал','Закрой разлом магической силы.',['necromancer','deathmage','ghoststeed']],
        ['Башня рун','Найди источник тёмных чар.',['boneconstruct','deathmage','lichlord']],
        ['Босс: Архимаг бездны','Разруши его связь с порталом.',['necromancer','ghoststeed','lichlord']]
      ]
    },
    {
      id: 'fire', name: 'Огненные земли', icon: '🔥', color: '#ff9d76', level: 6,
      desc: 'Лавовые поля и вулканическая крепость у края мира.',
      spot: [74, 0, 26, 36],
      missions: [
        ['Каменный берег','Пройди через обжигающее ущелье.',['undeadwarrior','boneguard','deathmage']],
        ['Лавовый проход','Уничтожь гарнизон на пути к вулкану.',['boneconstruct','ghoststeed','undeadwarrior']],
        ['Огненная башня','Возьми под контроль главную башню.',['necromancer','deathmage','lichlord']],
        ['Босс: Магмовый король','Победи стража вулканической крепости.',['boneconstruct','ghoststeed','lichlord']]
      ]
    },
    {
      id: 'forgotten', name: 'Забытые земли', icon: '🗝️', color: '#b5e9d0', level: 7,
      desc: 'Остров руин, где всё ещё горят древние маяки.',
      spot: [73, 36, 27, 32],
      missions: [
        ['Покинутый порт','Высадись на берег исчезнувшей цивилизации.',['gravedigger','undeadwarrior','ghoststeed']],
        ['Зал сломанных клятв','Найди летопись погибшего королевства.',['skeletal_archer','necromancer','deathmage']],
        ['Подземный архив','Раскрой тайну запечатанного архива.',['boneconstruct','ghoststeed','lichlord']],
        ['Босс: Вечный страж','Заверши древнее испытание.',['necromancer','boneconstruct','lichlord']]
      ]
    },
    {
      id: 'dark', name: 'Тёмные земли', icon: '🌑', color: '#cd9cff', level: 8,
      desc: 'Острые чёрные пики и столица теневых властителей.',
      spot: [39, 66, 35, 34],
      missions: [
        ['Чёрный перевал','Пройди мимо дозорных теневой армии.',['deathmage','ghoststeed','skeletal_archer']],
        ['Тропа обсидиана','Сокруши тёмных рыцарей у ворот.',['undeadwarrior','necromancer','boneconstruct']],
        ['Осквернённый трон','Преодолей элитную охрану дворца.',['ghoststeed','lichlord','deathmage']],
        ['Босс: Король теней','Срази повелителя ночи.',['lichlord','ghoststeed','necromancer']]
      ]
    },
    {
      id: 'dead', name: 'Мёртвые земли', icon: '☠️', color: '#87fce6', level: 9,
      desc: 'Последний некрополь. Здесь заканчивается первая кампания.',
      spot: [73, 67, 27, 33],
      missions: [
        ['Туман погибших','Проложи дорогу через кладбищенские поля.',['boneconstruct','ghoststeed','necromancer']],
        ['Долина костей','Разбей главную армию некрополя.',['undeadwarrior','lichlord','boneconstruct']],
        ['Врата вечности','Прорви защиту магов смерти.',['necromancer','lichlord','deathmage']],
        ['Финальный босс: Король-лич','Заверши кампанию и освободи королевства.',['lichlord','lichlord','ghoststeed']]
      ]
    }
  ];
  const MISSIONS=[];
  territories.forEach((region,ridx)=>{
    region.missions=region.missions.map(([name,desc,enemies],midx)=>{
      const boss=midx===3, elite=midx===2, id=`camp_${region.id}_${midx+1}`;
      const mission={id,region:region.id,name,desc,enemies,boss,elite,
        gold:85+ridx*45+midx*38+(boss?170:0), xp:32+ridx*16+midx*20+(boss?75:0),
        hpMult:1+0.085*ridx+(boss?.20:elite?.10:0), enemyBonus:Math.floor(ridx/3)+(boss?1:0)};
      MISSIONS.push(mission);
      if(!PLACES.some(x=>x.id===id)) PLACES.push(mission);
      return mission;
    });
  });
  let current='human';
  const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&quot;'}[c]));
  const beaten=mission=>Boolean(state.won&&state.won[mission.id]);
  const isRegionOpen=index=>index===0||beaten(territories[index-1].missions.at(-1));
  const isMissionOpen=(regionIndex,index)=>isRegionOpen(regionIndex)&&(index===0||beaten(territories[regionIndex].missions[index-1]));
  const totals=()=>territories.reduce((n,r)=>n+r.missions.filter(beaten).length,0);
  const select=id=>{if(territories.some(r=>r.id===id))current=id;};
  const getMission=id=>MISSIONS.find(m=>m.id===id);
  const canStart=id=>{const m=getMission(id);if(!m)return false;const ri=territories.findIndex(r=>r.id===m.region);return isMissionOpen(ri,territories[ri].missions.indexOf(m));};


  // Shoreline silhouettes on the original map: one real region hit-area per island.
  // ViewBox coordinates correspond to the 1536x1024 source illustration.
  const COASTS={
  "north": "20,172 45,142 92,137 125,105 174,115 210,60 264,77 318,0 360,43 414,31 455,79 498,110 540,90 561,142 615,170 663,195 661,236 611,259 575,271 545,292 483,306 443,300 405,325 360,320 322,315 289,289 230,304 178,289 135,282 95,262 41,255 2,240 0,207",
  "cursed": "567,79 608,49 663,40 705,8 753,18 807,2 852,19 911,9 956,33 1003,4 1062,43 1135,85 1121,140 1080,180 1104,221 1072,252 1022,270 974,280 926,308 874,315 823,303 762,325 707,310 650,303 612,280 582,250 584,200 550,167 577,110",
  "fire": "1110,96 1150,91 1214,47 1280,0 1344,12 1391,0 1451,34 1500,32 1536,64 1536,328 1500,325 1462,352 1432,350 1389,373 1353,366 1302,388 1259,364 1200,369 1160,343 1124,305 1101,254 1111,203 1094,150",
  "elf": "0,248 60,235 107,245 155,226 205,260 261,283 288,321 339,326 370,342 415,373 436,422 405,477 429,519 381,554 352,563 335,590 270,599 236,608 180,583 141,592 93,568 60,558 21,526 0,482",
  "human": "478,305 537,274 589,266 632,277 677,266 729,281 771,286 836,298 899,322 938,354 988,372 1051,408 1090,473 1059,524 1053,564 1009,603 951,610 903,645 848,654 795,625 733,619 679,625 647,604 587,594 540,582 490,567 473,531 427,531 401,499 439,475 465,446 433,412 443,360",
  "forgotten": "1514,303 1536,330 1536,604 1510,625 1450,640 1420,627 1370,649 1325,636 1274,624 1207,632 1166,604 1125,608 1097,569 1102,520 1123,478 1172,454 1174,424 1214,411 1243,363 1284,339 1332,327 1363,288 1415,280 1466,280",
  "desert": "0,669 50,638 118,630 164,618 212,607 287,603 346,619 401,602 453,604 500,633 545,649 557,699 547,737 547,797 530,851 494,871 474,904 428,944 397,960 353,982 300,992 228,989 173,1005 105,981 74,947 26,922 0,886",
  "dark": "558,680 590,657 644,674 701,654 764,647 829,669 875,668 930,700 960,697 1000,722 1033,779 1082,803 1090,864 1070,922 1027,972 964,997 903,1002 836,1014 780,1005 722,1024 647,1004 596,993 552,962 539,921 524,868 540,819 530,761",
  "dead": "1058,718 1081,673 1125,658 1168,626 1229,645 1273,637 1333,659 1390,670 1445,647 1503,674 1536,700 1536,946 1486,972 1440,1000 1363,990 1301,1000 1251,992 1192,968 1142,979 1108,958 1071,927 1030,898 1025,843 1000,810 1023,766"
};
  function details(id) {
    const r=territories.find(x=>x.id===id);
    if(!r)return null;
    const idx=territories.indexOf(r),open=isRegionOpen(idx),done=r.missions.filter(beaten).length;
    const missionList=r.missions.map((m,i)=>{
      const cleared=beaten(m),available=isMissionOpen(idx,i);
      const tag=cleared?'✓ Пройдено':available?'⚔ В бой':'🔒 Закрыто';
      return `<div class="cc-campaign-mission ${cleared?'is-cleared':''} ${available?'':'is-locked'}">
        <div class="cc-campaign-mission-icon">${m.boss?'👑':m.elite?'⚔️':String(i+1)}</div>
        <div class="cc-campaign-mission-info"><strong>${escape(m.name)}</strong><p>${escape(m.desc)}</p><small>🪙 ${m.gold} золота · ⭐ ${m.xp} опыта · ${m.boss?'Босс':m.elite?'Элитное':'Обычное'}</small></div>
        <button type="button" class="cc-campaign-start" data-cmd="campaign:${m.id}" ${available?'':'disabled'}>${tag}</button>
      </div>`;
    }).join('');
    const hint=!open
      ?`Откроется после победы над боссом региона «${escape(territories[idx-1].name)}».`
      :done===4?'Все задания выполнены. Бои можно повторять ради наград.':'Пройди задания по порядку, чтобы открыть следующую битву.';
    return {
      title:r.icon+' '+r.name,
      html:`<section class="cc-campaign-detail cc-campaign-popup" aria-label="Задания выбранной земли" style="--campaign-color:${r.color}">
        <div class="cc-campaign-detail-head"><div>
          <div class="cc-campaign-region-label">${open?'ДОСТУПНО':'ЗАКРЫТО'} · РЕК. УР. ${r.level}+</div>
          <p class="cc-campaign-description">${escape(r.desc)}</p>
        </div><span class="cc-campaign-counter">${done}/4</span></div>
        <div class="cc-campaign-progress"><span style="width:${done*25}%"></span></div>
        <p class="cc-campaign-hint">${hint}</p>
        <div class="cc-campaign-missions">${missionList}</div>
      </section>`
    };
  }
  function draw() {
    const number=totals();
    const coastline=territories.map((r,i)=>{
      const done=r.missions.filter(beaten).length,opened=isRegionOpen(i);
      const label=`${r.name}. ${opened?'Доступно':'Закрыто'}. Выполнено ${done} из 4. Нажми для просмотра заданий.`;
      const d='M'+COASTS[r.id].trim().split(/\s+/).join(' L')+' Z';
      return `<path class="cc-campaign-island ${opened?'is-open':'is-locked'} ${current===r.id?'is-current':''}"
        data-cmd="region:${r.id}" tabindex="0" role="button" focusable="true"
        aria-label="${escape(label)}" style="--region-color:${r.color}" d="${d}"><title>${escape(label)}</title></path>`;
    }).join('');
    const finished=number===MISSIONS.length;
    const result=`<div class="cc-campaign-page">
      <div class="cc-campaign-scroll" id="cc-campaign-scroll" aria-label="Карта земель, прокручивается горизонтально"><div class="cc-campaign-canvas">
        <img src="assets/maps/nine-kingdoms-campaign.webp?v=2" draggable="false" alt="Девять отдельных фантастических островов">
        <svg class="cc-campaign-outline-map" viewBox="0 0 1536 1024" preserveAspectRatio="none" role="group" aria-label="Нажми на контур выбранной земли">${coastline}</svg>
      </div></div>
      <div class="cc-campaign-map-footer">
        <span>↔ Двигай карту и нажимай на землю — задания откроются отдельно.</span>
        <strong>🏆 ${number}/${MISSIONS.length}</strong>
      </div>
      ${finished?'<div class="cc-campaign-finale">👑 Кампания пройдена! Все девять земель освобождены.</div>':''}
    </div>`;
    Promise.resolve().then(()=>{
      const el=document.getElementById('cc-campaign-scroll');
      if(!el)return;
      const marker=el.querySelector('.cc-campaign-island.is-current');
      if(!marker)return;
      const box=marker.getBBox();
      const desired=(box.x+box.width/2)*el.scrollWidth/1536-el.clientWidth/2;
      el.scrollLeft=Math.max(0,Math.min(el.scrollWidth-el.clientWidth,desired));
    });
    return result;
  }
  // SVG areas are keyboard accessible on PCs as well as clickable/tappable.
  document.addEventListener('keydown',event=>{
    const target=event.target.closest?.('#cc-v09 .cc-campaign-island');
    if(!target || (event.key!=='Enter'&&event.key!==' '))return;
    event.preventDefault();
    target.dispatchEvent(new MouseEvent('click',{bubbles:true}));
  });
  window.CrownsCampaign={render:draw,details,select,getMission,canStart,regions:territories,missions:MISSIONS,completed:totals};
})();