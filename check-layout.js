/* 横屏布局检测器
   =================================================================
   用法：
     cd "AI Chinese 5.0" && python3 -m http.server 8931 &
     cd ai-chinese-7-landscape && npm i playwright && npx playwright install chromium
     node check-layout.js cool pop/citrus                       # 手机框（屏幕 884×404）
     SIZES=667x375,844x390,932x430 node check-layout.js cool     # 再加几种真机横屏（铺满视图）

   为什么要有这个：横过来以后屏幕只有 400px 上下高，最容易出的事都是截图评审看不出来的——
   按钮掉到折线以下要滚才看得见、两块玻璃叠在一起点不到下面那块、按钮压到灵动岛底下。
   这和 7.0 那个「点上课没反应」是同一类问题：必须真的量。

   每块屏查四件事：
   1. 够不着：可点的东西（按钮、输入框、链接）有没有落到安全区外面——灵动岛那一侧、屏幕边缘。
   2. 被盖住：在它中心点做一次 elementFromPoint，拿到的必须是它自己或它里面的东西。
   3. 主按钮掉到折线下：每屏的主操作（下一题 / 继续 / 上课 / 开始…）不用滚就必须完整可见。
   4. 老师的脸被挡：她站位框上部那一块（脸的大致位置）被卡片、按钮盖住不能超过 15%。
   另外把「写字区要滚动」的屏列出来当提示，不算失败——长内容（字形卡、声调实验室）本来就该能滚。

   被祖先滚动容器裁掉的元素不查 1、2：那是滚动，不是布局错误。弹层打开时只查弹层里面的东西。
   ================================================================= */
const { chromium } = require('playwright');
const fs = require('fs');
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const launchOpts = fs.existsSync(CHROME) ? { executablePath: CHROME } : {};
const B = process.env.URL || 'http://127.0.0.1:8931/ai-chinese-7-landscape/index.html';
const SIZES = (process.env.SIZES || '').split(',').filter(Boolean);
/* 默认杨老师（去背全身像）；TEACHER=lin 查林老师，TEACHER=fang 换成半身照站位框的老师 */
const seed = {'cc.teacher':process.env.TEACHER || 'yang','cc.done':'1','cc.lang':process.env.LANG_UI || 'zh','cc.lesson':'15','cc.min':'25',
 'cc.startLv':'1','cc.target':'4','cc.purpose':'work','cc.timeline':'exam1213',
 'cc.probe':'1,4,1','cc.taught':'0','cc.prefDone':'1'};

const seg = (k, sub, ans) => async p => p.evaluate(([k,sub,ans])=>{
  const n=SEGS().findIndex(s=>s.kind===k); V.lesson={seg:n,sub:sub||0,ans:ans||{},t0:Date.now()-6e5,tk:null}; render(); }, [k,sub,ans]);
const talk = (id, i, done, picked) => async p => p.evaluate(([id,i,done,picked])=>{
  V.lesson={seg:0,sub:0,ans:{},t0:Date.now(),tk:null}; openTalk(id); const t=V.lesson.tk;
  t.paused=true; t.i=i; if(done) t.done=true; if(picked!=null) t.picked=picked; renderTalk(); }, [id,i,done,picked]);
const step = (n, d) => async p => p.evaluate(([n,d])=>{ if(d) Object.assign(D,d); V.intakeStep=n; render(); }, [n,d]);

const SCREENS = {
  '选老师':      {store:{'cc.teacher':''}},
  '面谈开场':    {store:{'cc.done':'0'}},
  '面谈第1问':   {store:{'cc.done':'0'}, go:step(1)},
  '面谈第2问':   {store:{'cc.done':'0'}, go:step(2)},
  '面谈第3问·已选':{store:{'cc.done':'0'}, go:step(3,{audio:1})},
  '面谈第4问':   {store:{'cc.done':'0'}, go:step(4,{glyphs:[0,1,3]})},
  '面谈第5问':   {store:{'cc.done':'0'}, go:step(5)},
  '面谈第6问':   {store:{'cc.done':'0'}, go:step(6)},
  '判定屏':      {store:{'cc.done':'0'}, go:step(7,{purpose:'work',timeline:'exam1213',audio:1,glyphs:[0,1,2],spoken:1,min:25})},
  '今天':        {},
  '今天·剧场门': {store:{'cc.taught':'1','cc.prefPending':'1','cc.prefDone':''}},
  '今天下滑':    {go:async p=>{await p.evaluate(()=>{const s=document.getElementById('todayScreen');s.scrollTop=s.scrollHeight;s.onscroll&&s.onscroll();});}},
  '课程':        {go:async p=>{await p.click('[data-tab="course"]');}},
  '老师':        {go:async p=>{await p.click('[data-tab="teacher"]');}},
  '老师·聊天中': {store:{'cc.chat':JSON.stringify([{r:'u',t:'老师，明天几点上课？'},{r:'t',t:'今天就学这个：问钟点用「几点？」——现在几点？你明天几点上课？「星期几」问的是哪一天，别混。'},{r:'u',t:'「几」和「多少」有什么不一样？'},{r:'t',t:'「几」问小的数目，后面要跟量词：几点、几个、几个星期。「多少」问大数目，后面不用量词：多少人、多少钱。'}])},
                  go:async p=>{await p.click('[data-tab="teacher"]');}},
  '讲解·list':   {go:talk('t0',1)},
  '讲解·kv':     {go:talk('t0',3)},
  '讲解·group':  {go:talk('t1',3)},
  '讲解·slot':   {go:talk('t2a',3)},
  '讲解·rows':   {go:talk('t1b',2)},
  '讲解·tone':   {go:talk('t4',3)},
  '讲解·长字幕': {go:talk('t4',4)},
  '讲解·讲完':   {go:talk('l0why',1,true)},
  '段末一问':    {go:talk('t1b',3,true)},
  '段末一问·答完':{go:talk('t1b',3,true,2)},
  '生词':        {go:seg('words',0)},
  '生词·第4个':  {go:seg('words',3)},
  '字形卡':      {go:seg('shapes')},
  '替换练习':    {go:seg('drill',0,{g0:'号'})},
  '听力·答错':   {go:seg('listen',0,{l0:0})},
  '声调实验室':  {go:seg('tonefeet',0,{tf:1})},
  '跟读':        {go:seg('speak',0,{rep:3,repFb:{ok:false,t:'「几」要读成第二声；刚才你读成了第三声。再来一次。'}})},
  '自由表达':    {go:seg('speak',1,{freeFb:'听清了。时间词放在动词前面，这一点你做对了。下面是我会怎么说：'})},
  '小测·听音':   {go:async p=>{await p.evaluate(()=>{const n=SEGS().findIndex(s=>s.kind==='quiz');
                  const k=L15.quiz.findIndex(q=>q.play); V.lesson={seg:n,sub:Math.max(0,k),ans:{['q'+Math.max(0,k)]:0},t0:Date.now(),tk:null};render();});}},
  '小测·排序':   {go:seg('quiz',2,{o2:['明天','下午','见']})},
  '结课':        {go:seg('result',0,{q0:0,q1:0,q2:0,q3:0,q4:0})},
  '结课·首次':   {store:{'cc.prefDone':''}, go:seg('result',0,{q0:0,q1:1,q2:0,q3:0,q4:0})},
  '情景介绍':   {store:{'cc.taught':'1','cc.scenarioDone':'0','cc.scenarioStarted':'0','cc.scenarioBeat':'0'},
                  go:async p=>{await p.evaluate(()=>{V.lesson=null;V.theater=null;openAfterClassScenario(false);});}},
  '情景对白':   {store:{'cc.taught':'1','cc.scenarioDone':'0','cc.scenarioStarted':'1','cc.scenarioBeat':'0'},
                  go:async p=>{await p.evaluate(()=>{openAfterClassScenario(false);V.scenario.beat=0;render();});}},
  '情景选择':   {store:{'cc.taught':'1','cc.scenarioDone':'0','cc.scenarioStarted':'1','cc.scenarioBeat':'2'},
                  go:async p=>{await p.evaluate(()=>{openAfterClassScenario(false);V.scenario.beat=2;V.scenario.picked=null;render();});}},
  '情景答错':   {store:{'cc.taught':'1','cc.scenarioDone':'0','cc.scenarioStarted':'1','cc.scenarioBeat':'2'},
                  go:async p=>{await p.evaluate(()=>{openAfterClassScenario(false);V.scenario.beat=2;V.scenario.picked=1;render();});}},
  '情景答对':   {store:{'cc.taught':'1','cc.scenarioDone':'0','cc.scenarioStarted':'1','cc.scenarioBeat':'2'},
                  go:async p=>{await p.evaluate(()=>{openAfterClassScenario(false);V.scenario.beat=2;V.scenario.picked=0;render();});}},
  '情景跟读':   {store:{'cc.taught':'1','cc.scenarioDone':'0','cc.scenarioStarted':'1','cc.scenarioBeat':'9'},
                  go:async p=>{await p.evaluate(()=>{openAfterClassScenario(false);V.scenario.beat=9;V.scenario.spoken=false;render();});}},
  '情景完成':   {store:{'cc.taught':'1','cc.scenarioDone':'1','cc.scenarioStarted':'1','cc.scenarioBeat':'10'},
                  go:async p=>{await p.evaluate(()=>{openAfterClassScenario(false);});}},
  '剧场·转场':   {store:{'cc.taught':'1','cc.scenarioDone':'1'}, go:async p=>{await p.evaluate(()=>{openInAppTheater();});}},
  '剧场·选择':   {store:{'cc.taught':'1','cc.scenarioDone':'1'}, go:async p=>{await p.evaluate(()=>{openInAppTheater();
                  const a=THEATER_ACTS.findIndex(x=>x.beats.some(b=>b.type==='choice'));
                  V.theater.act=a; V.theater.beat=THEATER_ACTS[a].beats.findIndex(b=>b.type==='choice'); render();});}},
  '剧场·谢幕':   {store:{'cc.taught':'1','cc.scenarioDone':'1'}, go:async p=>{await p.evaluate(()=>{openInAppTheater();
                  V.theater.act=THEATER_ACTS.length-1; V.theater.beat=0; V.theater.done=true; render();});}},
  '弹层':        {go:async p=>{await p.click('[data-tab="course"]'); await p.click('#std');}},
  '弹层·剧场求助':{store:{'cc.taught':'1','cc.scenarioDone':'1'}, go:async p=>{await p.evaluate(()=>{openInAppTheater();}); await p.click('[data-theater-help]');}},
  '弹层·街区经历':{store:{'cc.theaterRounds':'1','cc.theaterLastDone':'1'}, go:async p=>{await p.evaluate(()=>{streetExperienceSheet();});}},
  '今天下滑·街区':{store:{'cc.theaterRounds':'1','cc.theaterLastDone':'1'},
                  go:async p=>{await p.evaluate(()=>{const s=document.getElementById('todayScreen');s.scrollTop=s.scrollHeight;s.onscroll&&s.onscroll();});}},
};

/* 每屏的主操作：存在就必须完整可见、不被盖住 */
const PRIMARY = ['#go','#start','#pickGo','#tkGo','#goScenario','#answerPrefs','.stage-act [data-open-theater]',
  '.talk-ctl button','.theater-act','#theaterFinish','#chatSend','#chatIn','.tab','#mic'];
/* 会挡脸的东西：卡片、玻璃条、按钮 */
const COVERS = ['.opt','.qopt','.cap','.talk-cap','.chk','.verdict','.result','.thumb > *','.talk-ctl button',
  '.cls-act > *','.stage-act > *','.mode','.chatbar','.chatthread','.chatquick','.audio','.glyph','.chip','.wcard-eg',
  '.handoff','.fb','.gpill','.dh-state','.talk-tag','.bd-say','.lh-x','.talk-x','.tfbtn','.stage-chip'];

(async () => {
  const combos = process.argv.slice(2).length ? process.argv.slice(2) : ['cool'];
  /* NOFRAME=1：只跑 SIZES 里的真机尺寸，不跑手机框（分批跑的时候用） */
  const modes = [...(process.env.NOFRAME ? [] : ['frame']), ...SIZES];
  const b = await chromium.launch(launchOpts);
  const fails = [], hints = [];
  let n = 0;
  /* ONLY=正则：只跑名字匹配的屏 */
  const ONLY = process.env.ONLY ? new RegExp(process.env.ONLY) : null;
  for (const combo of combos) for (const mode of modes) for (const [sname, cfg] of Object.entries(SCREENS)){
    if (ONLY && !ONLY.test(sname)) continue;
    const [theme, pal] = combo.split('/');
    const opt = mode==='frame' ? {viewport:{width:1280,height:800}}
      : (([w,h]) => ({viewport:{width:w,height:h}, isMobile:true, hasTouch:true}))(mode.split('x').map(Number));
    const ctx = await b.newContext(opt);
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(s=>{ for (const k in s) localStorage.setItem(k, s[k]); },
      Object.assign({'cc.viewL': mode==='frame' ? 'frame' : 'bleed'}, seed, cfg.store||{}));
    await p.goto(`${B}?theme=${theme}`+(pal?`&pal=${pal}`:''), {waitUntil:'networkidle'});
    if (cfg.go) await cfg.go(p);
    await p.waitForTimeout(650);   /* 等进场动画（键帽弹一下、板书划出来）落定 */
    n++;

    const r = await p.evaluate(([PRIMARY, COVERS]) => {
      const dev = document.querySelector('.device');
      const D = dev.getBoundingClientRect();
      const bw = parseFloat(getComputedStyle(dev).borderLeftWidth) || 0;
      /* 安全区：用一个探针元素把 --sl/--sr/--st/--sb 解析成像素（铺满视图里它们是 max(env(),…)） */
      const probe = document.createElement('div');
      probe.style.cssText = 'position:absolute;visibility:hidden;width:0;height:0;margin:var(--st) var(--sr) var(--sb) var(--sl)';
      dev.appendChild(probe);
      const cs0 = getComputedStyle(probe);
      const sl = parseFloat(cs0.marginLeft), st = parseFloat(cs0.marginTop), sr = parseFloat(cs0.marginRight), sb = parseFloat(cs0.marginBottom);
      probe.remove();
      /* 手机框里 zoom 可能不是 1：getBoundingClientRect 已经是缩放后的值，安全区也按同样比例 */
      const z = parseFloat(dev.style.zoom || '1') || 1;
      const SAFE = { l: D.left + (bw + sl)*z - 1, t: D.top + (bw + st)*z - 1, r: D.right - (bw + sr)*z + 1, b: D.bottom - (bw + sb)*z + 1 };
      const sheetOn = document.querySelector('.sheet.on');

      const hidden = el => {
        for (let x = el; x && x !== document.documentElement; x = x.parentElement){
          const cs = getComputedStyle(x);
          if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < .1 || x.hasAttribute('hidden')) return true;
        }
        return false;
      };
      /* 被哪个滚动祖先裁掉了：返回那个祖先（没有就 null）。
         只看「包含块链」上的祖先：绝对定位的元素跳过中间那些没定位的祖先，它们的 overflow 裁不到它
         （选老师屏的「开始」就是这样——DOM 上在介绍栏里，实际相对整屏定位）。 */
      const chain = el => {
        const s = new Set();
        for (let cur = el; cur && cur !== dev; ){
          const pos = getComputedStyle(cur).position;
          if (pos === 'fixed') break;
          let nx = cur.parentElement;
          if (pos === 'absolute') while (nx && nx !== dev && getComputedStyle(nx).position === 'static') nx = nx.parentElement;
          if (nx) s.add(nx);
          cur = nx;
        }
        return s;
      };
      const clipper = (el, pageToo) => {
        const r = el.getBoundingClientRect(), cb = chain(el);
        for (let x = el.parentElement; x && x !== dev; x = x.parentElement){
          if (!cb.has(x)) continue;
          /* 整页滚动（今天 / 课程那种 .screen）不算「埋在滚动区里」 */
          if (!pageToo && x.classList.contains('screen')) continue;
          const cs = getComputedStyle(x);
          if (/(auto|scroll|hidden)/.test(cs.overflowX + cs.overflowY)){
            const q = x.getBoundingClientRect();
            if (r.bottom > q.bottom + 1 || r.top < q.top - 1 || r.right > q.right + 1 || r.left < q.left - 1) return x;
          }
        }
        return null;
      };
      const name = el => {
        const t = (el.getAttribute('aria-label') || el.textContent || el.value || el.placeholder || '').trim().replace(/\s+/g,' ').slice(0,16);
        return el.tagName.toLowerCase() + (el.id ? '#'+el.id : '') + (el.className && typeof el.className === 'string' ? '.'+el.className.trim().split(/\s+/).slice(0,2).join('.') : '') + (t ? '「'+t+'」' : '');
      };
      const out = { fail:[], hint:[] };
      const scope = sheetOn ? sheetOn.querySelector('.sheet-c') : dev;

      /* 1 + 2：所有可点的东西 */
      const scrollsY = el => { for (let x = el.parentElement; x && x !== dev; x = x.parentElement){
        const cs = getComputedStyle(x); if (/(auto|scroll)/.test(cs.overflowY) && x.scrollHeight > x.clientHeight + 2) return true; } return false; };
      scope.querySelectorAll('button, a[href], input').forEach(el => {
        if (hidden(el)) return;
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) return;
        if (clipper(el, true)) return;
        /* 在可滚动的容器里、只是上下越界：滚一下就进安全区了，不算（左右越界照样算） */
        const vOnly = scrollsY(el);
        if (r.left < SAFE.l || r.right > SAFE.r || (!vOnly && (r.top < SAFE.t || r.bottom > SAFE.b)))
          out.fail.push(`够不着：${name(el)} 出了安全区（${[r.left<SAFE.l?'左 '+Math.round(SAFE.l-r.left):'', r.right>SAFE.r?'右 '+Math.round(r.right-SAFE.r):'', r.top<SAFE.t?'上 '+Math.round(SAFE.t-r.top):'', r.bottom>SAFE.b?'下 '+Math.round(r.bottom-SAFE.b):''].filter(Boolean).join(' ')} px）`);
        const cx = r.left + r.width/2, cy = r.top + r.height/2;
        const hit = document.elementFromPoint(cx, cy);
        if (hit && hit !== el && !el.contains(hit) && !hit.contains(el)){
          /* 压在上面的是吸底的按钮条（剧场面板那种 position:sticky）：内容能滚出来，记成提示 */
          let sticky = false;
          for (let x = hit; x && x !== dev; x = x.parentElement) if (getComputedStyle(x).position === 'sticky'){ sticky = true; break; }
          if (sticky) out.hint.push(`${name(el)} 有一部分压在吸底按钮条下面，要滚一下才露全`);
          else out.fail.push(`被盖住：${name(el)} 的中心点上面压着 ${name(hit)}`);
        }
      });

      /* 3：主操作不用滚就完整可见 */
      if (!sheetOn) PRIMARY.forEach(sel => document.querySelectorAll('#screens '+sel+', #dock '+sel+', #tabbar '+sel).forEach(el => {
        if (hidden(el)) return;
        const c = clipper(el, false);
        if (c) out.fail.push(`掉到折线下：主操作 ${name(el)} 要在 ${name(c)} 里滚动才看得全`);
      }));

      /* 4：她的脸。按立绘实际渲染的位置算：object-fit:cover + object-position 换算出图片在站位框里的真实位置，
         再取脸在原图里的大致范围（九张立绘都是 1024×1536 半身照，脸在横向 35%–64%、纵向 11%–31%）。
         有去背全身像（.dh-cut）时用它：整张图就是她，脸框按当前老师的 cutGeo.face 取。 */
      const cutImg = document.querySelector('#screens .dh:not(.dh-mini) > .dh-cut img');
      const art = document.querySelector('#screens .dh:not(.dh-mini) > .dh-art');
      const img = art && art.querySelector('img');
      let F = null;
      if (cutImg && !sheetOn && !hidden(cutImg) && cutImg.naturalWidth){
        const a = cutImg.getBoundingClientRect();
        const [fx0,fx1,fy0,fy1] = (TE().cutGeo||{}).face || [.38,.66,.035,.14];
        F = { l: a.left + a.width*fx0, r: a.left + a.width*fx1, t: a.top + a.height*fy0, b: a.top + a.height*fy1 };
      } else if (art && img && !sheetOn && !hidden(art) && img.style.display !== 'none' && img.naturalWidth){
        const a = img.getBoundingClientRect();
        const s = Math.max(a.width/img.naturalWidth, a.height/img.naturalHeight);
        const w = img.naturalWidth*s, h = img.naturalHeight*s;
        const [px, py] = getComputedStyle(img).objectPosition.split(' ').map(v => parseFloat(v)/100);
        const ox = a.left + (a.width - w)*px, oy = a.top + (a.height - h)*py;
        F = { l: ox + w*.35, r: ox + w*.64, t: oy + h*.11, b: oy + h*.31 };
      }
      if (F){
        const area = (F.r-F.l)*(F.b-F.t);
        let cov = 0; const who = [];
        document.querySelectorAll(COVERS.map(s=>'#screens '+s+', #dock '+s).join(',')).forEach(el => {
          if (hidden(el) || clipper(el, true)) return;
          const r = el.getBoundingClientRect();
          const w = Math.min(r.right,F.r) - Math.max(r.left,F.l), h = Math.min(r.bottom,F.b) - Math.max(r.top,F.t);
          if (w > 0 && h > 0){ cov += w*h; who.push(name(el)); }
        });
        if (cov/area > .15) out.fail.push(`挡脸：她脸部区域被盖住 ${Math.round(cov/area*100)}%（${who.slice(0,4).join('、')}）`);
      }

      /* 提示：写字区要滚动 */
      document.querySelectorAll('#screens :is(.board-wrap,.lbody,.ask-body,.chk,.pick-info,.theater-panel,.today-body)').forEach(el => {
        if (hidden(el)) return;
        const over = el.scrollHeight - el.clientHeight;
        if (over > 6 && getComputedStyle(el).overflowY !== 'visible') out.hint.push(`${name(el).split('「')[0]} 内容比可见区高 ${over}px，要滚动`);
      });
      return out;
    }, [PRIMARY, COVERS]);

    const tag = `[${combo}${mode==='frame'?'':' · '+mode}] ${sname}`;
    errs.forEach(e => fails.push(`${tag}  脚本错误：${e}`));
    r.fail.forEach(f => fails.push(`${tag}  ${f}`));
    r.hint.forEach(h => hints.push(`${tag}  ${h}`));
    await ctx.close();
  }
  await b.close();

  console.log(`查了 ${n} 屏（${combos.join(' / ')} × ${modes.join(' / ')}）\n`);
  if (hints.length){ console.log(`提示（不算失败）：\n${[...new Set(hints)].map(h=>'  · '+h).join('\n')}\n`); }
  if (!fails.length){ console.log('没有发现布局问题 ✓'); return; }
  console.log(`发现 ${fails.length} 处问题：\n${fails.map(f=>'  ✗ '+f).join('\n')}`);
  process.exitCode = 1;
})();
