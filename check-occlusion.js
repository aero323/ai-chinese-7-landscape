/* 她挡没挡住字 —— 去背立绘的遮挡检测器
   =================================================================
   用法（和 check-contrast.js 一样起服务）：
     cd "AI Chinese 5.0" && python3 -m http.server 8931 &
     cd ai-chinese-7-landscape && npm i playwright && npx playwright install chromium
     （从 7.1 拷来，只改了地址和视图键 cc.viewL；脸框按当前老师的 cutGeo 取）
     node check-occlusion.js cool pop/citrus pop/berry pop/matcha

   为什么要有这个：7.0 的立绘是一个羽化过的方框，左半边本来就压暗了，字压上去也看得见；
   7.1 的老师是不透明的真人抠像，站在板前（z 3），板上的粉笔字在她身后（z 2）。
   字写长了一点、她的手伸出来一点，字就被她挡住——而且只挡一个字的时候，
   逐屏看截图非常容易漏（「约 25 分钟」的「钟」被粉笔尖盖住，第一版就是这么漏的）。

   怎么判定：
   1. 把她的 WebP 画进 canvas 拿到 alpha，换算到屏幕坐标——判的是她真实的轮廓，不是图片的方框；
   2. 每个文字节点用 Range.getClientRects() 取到逐行的字形框，在框里每 3px 采一个点；
   3. 点落在她身上（alpha ≥ 128）时，用 elementsFromPoint 看这一点上谁在上面：
      她在字上面 = 「被挡」；字在她上面、中间又没垫任何底（卡片实色、毛玻璃、压暗罩都算垫了）
      = 「直接压在她身上」；
   4. 在她的脸框里采 9×9 个点，看有没有带底的东西盖在她脸上。
   三项都必须是 0。elementsFromPoint 会跳过 pointer-events:none 的元素，所以检测期间临时把所有元素的
   pointer-events 打开，测完恢复。
   ================================================================= */
const { chromium } = require('playwright');
const fs = require('fs');
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const launchOpts = fs.existsSync(CHROME) ? { executablePath: CHROME } : {};
const B = process.env.URL || 'http://127.0.0.1:8931/ai-chinese-7-landscape/index.html';
const seed = {'cc.teacher':process.env.TEACHER||'yang','cc.done':'1','cc.lang':process.env.UI_LANG||'zh','cc.lesson':'15','cc.min':'25',
 'cc.startLv':'1','cc.target':'4','cc.purpose':'work','cc.timeline':'exam1213',
 'cc.probe':'1,4,1','cc.taught':'0','cc.viewL':'frame','cc.prefDone':'1'};

const seg = (kind, ans) => async p => { await p.evaluate(([k,a])=>{
  const n = k==null ? 2 : SEGS().findIndex(s=>s.kind===k);
  V.lesson={seg:n,sub:0,ans:a||{},t0:Date.now()-6e5,tk:null}; render(); }, [kind, ans]); };
const talk = done => async p => {
  await p.evaluate(()=>{V.lesson={seg:0,sub:0,ans:{},t0:Date.now(),tk:null};render();});
  await p.waitForTimeout(300);
  await p.evaluate(d=>{ if(d) V.lesson.tk.done=true; else V.lesson.tk.i=3; V.lesson.tk.paused=true; render(); }, done);
};
/* 讲解的十一组板书各摆一遍：板书是最容易写长、最容易写到她身上的地方 */
const allTalks = async p => p.evaluate(()=>Object.keys(LC.TALKS));

const SCREENS = {
  '面谈开场': {store:{'cc.done':'0'}},
  '面谈提问': {store:{'cc.done':'0'}, go:async p=>{await p.click('#go');}},
  '判定屏':   {store:{'cc.done':'0'}, go:async p=>{await p.evaluate(()=>{
                 D={purpose:'work',timeline:'exam1213',audio:1,glyphs:[0,1,2],spoken:1,min:25};
                 V.intakeStep=7; render();});}},
  '今天':     {},
  '老师':     {go:async p=>{await p.click('[data-tab="teacher"]');}},
  '讲解':     {go:talk(false)},
  '段末一问': {go:talk(true)},
  '生词':     {go:seg(null)},
  '替换练习': {go:seg('drill')},
  '听力':     {go:seg('listen')},
  '字形卡':   {go:seg('shapes')},
  '声调实验室':{go:seg('tonefeet')},
  '跟读':     {go:seg('speak')},
  '小测':     {go:seg('quiz',{q0:1})},
  '结课':     {go:seg('result',{q0:0,q1:0,q2:0,q3:0,q4:0})},
};

async function measure(p){
  return p.evaluate(async () => {
    const img = document.querySelector('.dh:not(.dh-mini) > .dh-cut img');
    if (!img) return null;
    if (!img.complete || !img.naturalWidth)
      await new Promise(r=>{ img.addEventListener('load',r,{once:true}); setTimeout(r,4000); });
    if (!img.naturalWidth) return {error:'立绘没加载出来'};
    const nw=img.naturalWidth, nh=img.naturalHeight;
    const cv=document.createElement('canvas'); cv.width=nw; cv.height=nh;
    const cx=cv.getContext('2d'); cx.drawImage(img,0,0);
    const A=cx.getImageData(0,0,nw,nh).data;
    const r=img.getBoundingClientRect();
    const alphaAt=(x,y)=>{ const u=Math.floor((x-r.left)/r.width*nw), v=Math.floor((y-r.top)/r.height*nh);
      return (u<0||v<0||u>=nw||v>=nh) ? 0 : A[(v*nw+u)*4+3]; };
    const dev=document.querySelector('.device').getBoundingClientRect();
    const hidden = el => { for (let n=el; n && n!==document.documentElement; n=n.parentElement){
      const cs=getComputedStyle(n);
      if (cs.visibility==='hidden'||cs.display==='none'||+cs.opacity<.25||n.hasAttribute('hidden')) return true; }
      return false; };
    /* 被滚动容器裁掉的字不算 */
    const clipped = (el,x,y) => { for (let n=el.parentElement; n && n!==document.body; n=n.parentElement){
      const cs=getComputedStyle(n);
      if (/(auto|scroll|hidden)/.test(cs.overflowY+cs.overflowX)){
        const nr=n.getBoundingClientRect(); if (x<nr.left||x>nr.right||y<nr.top||y>nr.bottom) return true; } }
      return false; };

    const pe=document.createElement('style'); pe.textContent='*{pointer-events:auto!important}';
    document.head.appendChild(pe);
    const per=new Map();
    const tw=document.createTreeWalker(document.querySelector('.device'), NodeFilter.SHOW_TEXT);
    for (let t=tw.nextNode(); t; t=tw.nextNode()){
      if (!t.textContent.trim()) continue;
      const el=t.parentElement; if (!el || hidden(el) || el.closest('.dh-cut')) continue;
      const rg=document.createRange(); rg.selectNodeContents(t);
      for (const q of rg.getClientRects()){
        if (q.width<2||q.height<2) continue;
        if (q.right<r.left||q.left>r.right||q.bottom<r.top||q.top>r.bottom) continue;
        for (let y=q.top+2; y<q.bottom-1; y+=3) for (let x=q.left+1; x<q.right-1; x+=3){
          if (x<dev.left||x>dev.right||y<dev.top||y>dev.bottom) continue;
          if (alphaAt(x,y)<128 || clipped(el,x,y)) continue;
          const st=document.elementsFromPoint(x,y);
          const iImg=st.indexOf(img), iEl=st.indexOf(el);
          if (iImg<0||iEl<0) continue;
          const k=el; if (!per.has(k)) per.set(k,{under:0,over:0,bare:0});
          if (iImg<iEl){ per.get(k).under++; continue; }
          per.get(k).over++;
          /* 字在她上面时，中间隔没隔着一层底：卡片的实色、渐变压暗罩、毛玻璃都算隔着 */
          const backed = st.slice(iEl, iImg).some(n=>{
            const cs=getComputedStyle(n);
            const m=cs.backgroundColor.match(/rgba?\(([^)]+)\)/);
            const a=m ? (m[1].split(',')[3]===undefined ? 1 : +m[1].split(',')[3]) : 0;
            return a>=.5 || cs.backgroundImage!=='none' || (cs.backdropFilter&&cs.backdropFilter!=='none')
                   || (cs.webkitBackdropFilter&&cs.webkitBackdropFilter!=='none');
          });
          if (!backed) per.get(k).bare++;
        }
      }
    }
    pe.remove();
    /* 她的脸有没有被卡片 / 按钮 / 毛玻璃盖住：在立绘的脸框里均匀采 9×9 个点，看她上面有没有带底的东西。
       脸框按老师取（lesson-core.js 的 cutGeo.face）：林老师 宽 38%–66%、高 3.5%–14%；
       杨老师是 Q 版、头大脸低，宽 33%–76%、高 6%–20.5%。都是在 gen/*-cut.png 上量的。 */
    const [fx0,fx1,fy0,fy1] = (TE().cutGeo||{}).face || [.38,.66,.035,.14];
    const pe2=document.createElement('style'); pe2.textContent='*{pointer-events:auto!important}';
    document.head.appendChild(pe2);
    let faceN=0, faceHit=0; const faceBy=new Map();
    for (let i=0;i<9;i++) for (let j=0;j<9;j++){
      const x=r.left+r.width*(fx0+(fx1-fx0)*i/8), y=r.top+r.height*(fy0+(fy1-fy0)*j/8);
      if (x<dev.left||x>dev.right||y<dev.top||y>dev.bottom) continue;
      faceN++;
      const st=document.elementsFromPoint(x,y), iImg=st.indexOf(img);
      const cover = st.slice(0, iImg<0?0:iImg).find(n=>{
        if (n.classList.contains('room-scrim')) return false;      /* 出题态整屏压 10%，不算 */
        const cs=getComputedStyle(n);
        const m=cs.backgroundColor.match(/rgba?\(([^)]+)\)/);
        const a=m ? (m[1].split(',')[3]===undefined ? 1 : +m[1].split(',')[3]) : 0;
        return a>=.5 || cs.backgroundImage!=='none' || (cs.backdropFilter&&cs.backdropFilter!=='none');
      });
      if (cover){ faceHit++; const k=cover.tagName.toLowerCase()+'.'+(cover.className||'').toString().split(' ')[0];
                  faceBy.set(k,(faceBy.get(k)||0)+1); }
    }
    pe2.remove();
    const rows=[...per.entries()].map(([el,v])=>({
      t: el.textContent.trim().replace(/\s+/g,' ').slice(0,26),
      cls: (el.className||'').toString().slice(0,40), tag: el.tagName.toLowerCase(), ...v }));
    return {rows, face:{n:faceN, hit:faceHit, by:[...faceBy.entries()].map(([k,v])=>`${k}×${v}`).join(' ')}};
  });
}

(async () => {
  const combos = process.argv.slice(2).length ? process.argv.slice(2) : ['cool','pop/citrus','pop/berry','pop/matcha'];
  const b = await chromium.launch(launchOpts);
  const under=[], bare=[], faces=[];
  let screens=0, noCut=0, backedN=0;
  for (const combo of combos){
    const [theme, pal] = combo.split('/');
    const list = Object.entries(SCREENS);
    /* 讲解的每一组板书单独成一屏 */
    {
      const ctx=await b.newContext({viewport:{width:1280,height:1000}}); const p=await ctx.newPage();
      await p.addInitScript(s=>{for(const k in s)localStorage.setItem(k,s[k]);}, seed);
      await p.goto(`${B}?theme=${theme}`+(pal?`&pal=${pal}`:''), {waitUntil:'networkidle'});
      for (const id of await allTalks(p))
        list.push([`板书 ${id}`, {go:async p=>{ await p.evaluate(id=>{
          V.lesson={seg:0,sub:0,ans:{},t0:Date.now(),tk:null}; openTalk(id); V.lesson.tk.paused=true;
          V.lesson.tk.i=LC.TALKS[id].beats.length-1; renderTalk(); }, id); }}]);
      await ctx.close();
    }
    for (const [sname, cfg] of list){
      const ctx = await b.newContext({viewport:{width:1280,height:1000}});
      const p = await ctx.newPage();
      await p.addInitScript(s=>{for(const k in s)localStorage.setItem(k,s[k]);}, Object.assign({}, seed, cfg.store||{}));
      await p.goto(`${B}?theme=${theme}`+(pal?`&pal=${pal}`:''), {waitUntil:'networkidle'});
      if (cfg.go) await cfg.go(p);
      await p.waitForTimeout(900);          /* 板书「一笔一笔写出来」要先写完 */
      const res = await measure(p);
      screens++;
      if (res===null){ noCut++; await ctx.close(); continue; }
      if (res.error){ under.push({combo,screen:sname,t:res.error,cls:'',tag:'',under:1}); await ctx.close(); continue; }
      for (const it of res.rows){
        if (it.under) under.push({combo,screen:sname,...it});
        if (it.bare) bare.push({combo,screen:sname,...it});
        else if (it.over) backedN++;
      }
      if (res.face.hit) faces.push({combo,screen:sname,...res.face});
      await ctx.close();
    }
  }
  await b.close();
  console.log(`查了 ${screens} 屏（其中 ${noCut} 屏没有去背立绘，跳过）。`);
  if (!under.length) console.log('没有字被她挡住 ✓');
  else {
    console.log(`\n✗ ${under.length} 处字被她挡住（她在字上面）：`);
    for (const f of under) console.log(`  [${f.combo}] ${f.screen}  ${f.tag}.${f.cls}  「${f.t}」  被挡 ${f.under} 点`);
  }
  if (!bare.length) console.log(`没有字直接压在她身上 ✓（压在她身上但隔着卡片 / 毛玻璃 / 压暗罩的有 ${backedN} 处，不算）`);
  else {
    console.log(`\n✗ ${bare.length} 处字直接压在她身上，中间没有任何底：`);
    for (const f of bare) console.log(`  [${f.combo}] ${f.screen}  ${f.tag}.${f.cls}  「${f.t}」  ${f.bare} 点`);
  }
  if (!faces.length) console.log('她的脸在每一屏都露着 ✓');
  else {
    console.log(`\n✗ ${faces.length} 屏她的脸被盖住：`);
    for (const f of faces) console.log(`  [${f.combo}] ${f.screen}  ${f.hit}/${f.n} 个点被盖  ${f.by}`);
  }
  process.exitCode = (under.length||bare.length||faces.length) ? 1 : 0;
})();
