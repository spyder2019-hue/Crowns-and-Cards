/* Browser smoke checks and screenshots for all six visual sections. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');

(async function main(){
  fs.mkdirSync('screenshots', { recursive:true });
  const browser = await chromium.launch({headless:true,args:['--no-sandbox']});
  const resolutions = [
    {label:'desktop',width:1280,height:900,isMobile:false},
    {label:'mobile',width:390,height:844,isMobile:true},
    {label:'small-mobile',width:320,height:700,isMobile:true}
  ];
  for (const layout of resolutions) {
    const page = await browser.newPage({viewport:{width:layout.width,height:layout.height},deviceScaleFactor:1,isMobile:layout.isMobile,hasTouch:layout.isMobile});
    const failures=[];
    page.on('pageerror',error=>failures.push(error.message));
    // index.html includes a production <base href> for GitHub Pages. Redirect
    // that *only in this test* so all CSS, JS and artwork load from the branch.
    await page.route('http://127.0.0.1:8765/',route=>{
      const original=fs.readFileSync('index.html','utf8');
      const local=original.replace('<base href="https://spyder2019-hue.github.io/Crowns-and-Cards/">',
        '<base href="http://127.0.0.1:8765/">');
      route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:local});
    });
    await page.goto('http://127.0.0.1:8765/',{waitUntil:'load',timeout:45000});
    await page.waitForSelector('#cc-v09 .cc09-world-stage',{timeout:30000});
    const tabs = await page.locator('#cc-v09 .cc09-tabs [data-cc-tab]').count();
    assert.equal(tabs,5,layout.label+' bottom navigation');
    assert.equal(await page.locator('#cc-v09 .cc09-slot').count(),6,layout.label+' equipment');
    assert.equal(await page.locator('#cc-v09 .cc09-action-row button[data-cmd="map"]').count(),1,layout.label+' battle CTA');
    await page.waitForSelector('#cc09-world .cc09-unit.cc14-card-ready .cc14-card-skin',{timeout:10000});
    const ornate=await page.locator('#cc09-world .cc09-unit.cc14-card-ready').first().evaluate(el=>{
      const frame=el.querySelector('.cc14-card-skin');
      const sword=el.querySelector('.cc14-attack'),heart=el.querySelector('.cc14-health');
      const box=frame.getBoundingClientRect(),a=sword.getBoundingClientRect(),h=heart.getBoundingClientRect();
      return {width:box.width,height:box.height,attack:sword.textContent.trim(),health:heart.textContent.trim(),
        inside:a.left>=box.left && a.right<=box.right && h.left>=box.left && h.right<=box.right,
        frame:getComputedStyle(frame).backgroundImage};
    });
    assert(ornate.frame.includes('ornate-creature-frame-v14.webp'),layout.label+' ornate card background missing');
    assert(ornate.inside,layout.label+' stats outside card frame: '+JSON.stringify(ornate));
    assert(Number.isFinite(Number(ornate.attack))&&Number.isFinite(Number(ornate.health)),
      layout.label+' stats missing from skin');
    const asset=await page.request.get('http://127.0.0.1:8765/assets/cards/ornate-creature-frame-v14.webp');
    assert.equal(asset.status(),200,layout.label+' ornate art missing');
    const xp=await page.locator('#cc09-world .cc14-hero-top-exp').evaluate(el=>{
      const stage=el.closest('.cc09-world-stage').getBoundingClientRect(),r=el.getBoundingClientRect();
      return {top:r.top,bottom:r.bottom,stageTop:stage.top,stageHeight:stage.height};
    });
    assert(xp.top>=xp.stageTop && xp.bottom<=xp.stageTop+xp.stageHeight/3,layout.label+' XP bar not above hero');
    await page.locator('#cc09-world .cc09-unit.cc14-card-ready').first().click();
    await page.waitForSelector('#cc-v09 .cc09-pick-card.cc14-card-ready .cc14-card-skin',{timeout:10000});
    await page.locator('#cc-v09 .cc09-dialog-close').click();
    const stage=await page.locator('#cc-v09 .cc09-world-stage').evaluate(el=>({
      background:getComputedStyle(el).backgroundImage,
      width:el.getBoundingClientRect().width
    }));
    assert(stage.background.includes('winter-castle-v10.webp'),layout.label+' winter background rule');
    assert(stage.width>245,layout.label+' stage too small');
    const backdrop=await page.request.get('http://127.0.0.1:8765/assets/backgrounds/winter-castle-v10.webp');
    assert.equal(backdrop.status(),200,'winter asset missing');
    const shell=await page.locator('#cc-v09 .cc09-shell').evaluate(el=>el.getBoundingClientRect().width);
    assert(shell<=layout.width+1,layout.label+' shell overflows viewport');
    if(layout.label!=='small-mobile') await page.screenshot({path:'screenshots/'+layout.label+'-world.png'});

    await page.locator('#cc-v09 [data-cc-tab="lab"]').click();
    await page.waitForSelector('#cc09-lab .cc7-equation',{timeout:5000});
    const labColumns=await page.locator('#cc09-lab .cc7-equation').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length);
    if(layout.isMobile)assert.equal(labColumns,2,layout.label+' lab 2-column layout');
    if(layout.label!=='small-mobile') await page.screenshot({path:'screenshots/'+layout.label+'-lab.png'});

    await page.locator('#cc-v09 [data-cc-tab="packs"]').click();
    await page.waitForSelector('#cc09-packs .cc09-pack-card img',{timeout:5000});
    // Pack covers are lazy-loaded in production: explicitly load all three before checking pixels.
    await page.locator('#cc09-packs .cc09-pack-card img').evaluateAll(images=>images.forEach(img=>img.loading='eager'));
    await page.waitForFunction(()=>Array.from(document.querySelectorAll('#cc09-packs .cc09-pack-card img')).every(img=>img.complete && img.naturalWidth>0),null,{timeout:15000});
    const packs=await page.locator('#cc09-packs .cc09-pack-card').evaluateAll(nodes=>nodes.map(node=>({
      action:node.dataset.cmd,loaded:node.querySelector('img')?.naturalWidth||0,src:node.querySelector('img')?.getAttribute('src')
    })));
    assert.equal(packs.length,3,'pack count');
    assert(packs.every(x=>x.loaded>0),layout.label+' broken pack images '+JSON.stringify(packs));
    assert(packs.some(x=>x.action==='pack:units'&&x.src.includes('pack-special-new.webp')),'undead should be green');
    assert(packs.some(x=>x.action==='pack:future'&&x.src.includes('pack-undead-new.webp')),'special should be blue');
    if(layout.label!=='small-mobile') await page.screenshot({path:'screenshots/'+layout.label+'-packs.png'});

    await page.locator('#cc-v09 [data-cc-tab="shop"]').click();
    await page.waitForSelector('#cc09-shop .cc09-product',{timeout:5000});
    assert.equal(await page.locator('#cc09-shop .cc09-product').count(),3,layout.label+' shop products');
    if(layout.label==='desktop')await page.screenshot({path:'screenshots/desktop-shop.png'});

    await page.locator('#cc-v09 [data-cc-tab="map"]').click();
    await page.waitForSelector('#cc09-map .cc-campaign-canvas',{timeout:5000});
    assert.equal(await page.locator('#cc09-map .cc-campaign-island').count(),9,'territory hit areas');
    assert.equal(await page.locator('#cc09-map .cc-campaign-map-footer span').count(),0,layout.label+' map caption still shown');
    const mapFit=await page.locator('#cc-campaign-scroll').evaluate(el=>{
      const canvas=el.querySelector('.cc-campaign-canvas');
      const box=el.getBoundingClientRect();
      return {frameWidth:box.width,canvasWidth:canvas.getBoundingClientRect().width,
        frameHeight:box.height,scrollWidth:el.scrollWidth,clientWidth:el.clientWidth,
        visibleBottom:box.bottom,windowHeight:window.innerHeight,
        scrollStyle:getComputedStyle(el).overflowX};
    });
    assert(mapFit.canvasWidth<=mapFit.frameWidth+1,layout.label+' map wider than its frame: '+JSON.stringify(mapFit));
    assert(mapFit.scrollWidth<=mapFit.clientWidth+1,layout.label+' map still scrolls sideways: '+JSON.stringify(mapFit));
    assert(mapFit.visibleBottom<=mapFit.windowHeight-40,layout.label+' full map does not fit vertically: '+JSON.stringify(mapFit));
    if(layout.label==='desktop')await page.screenshot({path:'screenshots/desktop-map.png'});
    if(layout.isMobile && layout.label==='mobile')await page.screenshot({path:'screenshots/mobile-map.png'});
    assert.deepEqual(failures,[],layout.label+' uncaught JavaScript errors');
    await page.close();
    console.log('PASS: '+layout.label+' '+layout.width+'x'+layout.height);
  }
  await browser.close();
})().catch(err=>{console.error(err);process.exit(1);});
