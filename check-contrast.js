/* 低对比文字检测器
   =================================================================
   用法：
     cd "AI Chinese 5.0" && python3 -m http.server 8931 &
     cd ai-chinese-7-landscape && npm i playwright && npx playwright install chromium
     node check-contrast.js cool pop/citrus pop/berry pop/matcha
     （横屏版：从 7.0 拷来，改了地址、视图键、元素尺寸上限，并补了七个 7.0 没覆盖的状态，见 SCREENS 末尾）

   为什么要有这个：这套皮有两个主题三套配色，很多元素的底色吃 CSS 变量，
   换一套配色就可能让某处白字落到奶油墙上。靠肉眼逐屏看是漏的——
   第一次跑就在「先去看看剧场」「禁用态的下一题」「课后剧场整屏」上翻出了问题。

   怎么判定：把每个带文字的元素按坐标从整屏截图上裁下来（不触发滚动，
   所以遮挡和毛玻璃都算得进去），取亮度中位数当底色，看最显眼的 1% 像素
   偏离底色多少。偏离 < 0.25 就报出来。被祖先滚动容器裁掉的不算。

   改过配色或者新增屏之后跑一遍，应当输出「没有发现低对比的文字」。
   ================================================================= */

/* 低对比检测器
   不靠肉眼：把每个带文字的元素单独截图，量它的亮度分布。
   文字看不清 = 这块图里深浅差很小。按「最暗 5% 与最亮 5% 的亮度差」排序，
   差得越小越可疑。比算 CSS 配色可靠——渐变、毛玻璃、背景图都算得进去。 */
const { chromium } = require('playwright');
const fs = require('fs');
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const launchOpts = fs.existsSync(CHROME) ? { executablePath: CHROME } : {};
const B = process.env.URL || 'http://127.0.0.1:8931/ai-chinese-7-landscape/index.html';
/* 默认杨老师；TEACHER=lin 查林老师，TEACHER=fang 换回半身照的老师 */
const seed = {'cc.teacher':process.env.TEACHER || 'yang','cc.done':'1','cc.lang':process.env.UI_LANG || 'zh','cc.lesson':'15','cc.min':'25',
 'cc.startLv':'1','cc.target':'4','cc.purpose':'work','cc.timeline':'exam1213',
 'cc.probe':'1,4,1','cc.taught':'0','cc.viewL':'frame','cc.prefDone':'1'};

const SCREENS = {
  '选老师':   {store:{'cc.teacher':''}},
  '面谈开场': {store:{'cc.done':'0'}},
  '面谈提问': {store:{'cc.done':'0'}, go:async p=>{await p.click('#go');}},
  '判定屏':   {store:{'cc.done':'0'}, go:async p=>{await p.evaluate(()=>{
                 D={purpose:'work',timeline:'exam1213',audio:1,glyphs:[0,1,2],spoken:1,min:25};
                 V.intakeStep=7; render();});}},
  '今天':     {},
  '今天下滑': {go:async p=>{await p.evaluate(()=>{const s=document.getElementById('todayScreen');
                 s.scrollTop=700; s.onscroll&&s.onscroll();});}},
  '课程':     {go:async p=>{await p.click('[data-tab="course"]');}},
  '老师':     {go:async p=>{await p.click('[data-tab="teacher"]');}},
  '讲解':     {go:async p=>{await p.evaluate(()=>{V.lesson={seg:0,sub:0,ans:{},t0:Date.now(),tk:null};render();});
                 await p.waitForTimeout(300);
                 await p.evaluate(()=>{V.lesson.tk.i=3;V.lesson.tk.paused=true;render();});}},
  '段末一问': {go:async p=>{await p.evaluate(()=>{V.lesson={seg:0,sub:0,ans:{},t0:Date.now(),tk:null};render();});
                 await p.waitForTimeout(300);
                 await p.evaluate(()=>{V.lesson.tk.done=true;V.lesson.tk.paused=true;render();});}},
  '生词':     {go:async p=>{await p.evaluate(()=>{V.lesson={seg:2,sub:0,ans:{},t0:Date.now(),tk:null};render();});}},
  '替换练习': {go:async p=>{await p.evaluate(()=>{const n=SEGS().findIndex(s=>s.kind==='drill');
                 V.lesson={seg:n,sub:0,ans:{},t0:Date.now(),tk:null};render();});}},
  '听力':     {go:async p=>{await p.evaluate(()=>{const n=SEGS().findIndex(s=>s.kind==='listen');
                 V.lesson={seg:n,sub:0,ans:{},t0:Date.now(),tk:null};render();});}},
  '字形卡':   {go:async p=>{await p.evaluate(()=>{const n=SEGS().findIndex(s=>s.kind==='shapes');
                 V.lesson={seg:n,sub:0,ans:{},t0:Date.now(),tk:null};render();});}},
  '声调实验室':{go:async p=>{await p.evaluate(()=>{const n=SEGS().findIndex(s=>s.kind==='tonefeet');
                 V.lesson={seg:n,sub:0,ans:{},t0:Date.now(),tk:null};render();});}},
  '跟读':     {go:async p=>{await p.evaluate(()=>{const n=SEGS().findIndex(s=>s.kind==='speak');
                 V.lesson={seg:n,sub:0,ans:{},t0:Date.now(),tk:null};render();});}},
  '小测':     {go:async p=>{await p.evaluate(()=>{const n=SEGS().findIndex(s=>s.kind==='quiz');
                 V.lesson={seg:n,sub:0,ans:{q0:1},t0:Date.now(),tk:null};render();});}},
  '结课':     {go:async p=>{await p.evaluate(()=>{const n=SEGS().findIndex(s=>s.kind==='result');
                 V.lesson={seg:n,sub:0,ans:{q0:0,q1:0,q2:0,q3:0,q4:0},t0:Date.now()-6e5,tk:null};render();});}},
  '情景介绍': {store:{'cc.taught':'1','cc.scenarioDone':'0','cc.scenarioStarted':'0','cc.scenarioBeat':'0'},
                go:async p=>{await p.evaluate(()=>{V.lesson=null;V.theater=null;openAfterClassScenario(false);});}},
  '情景选择': {store:{'cc.taught':'1','cc.scenarioDone':'0','cc.scenarioStarted':'1','cc.scenarioBeat':'2'},
                go:async p=>{await p.evaluate(()=>{openAfterClassScenario(false);V.scenario.beat=2;V.scenario.picked=null;render();});}},
  '情景答错': {store:{'cc.taught':'1','cc.scenarioDone':'0','cc.scenarioStarted':'1','cc.scenarioBeat':'2'},
                go:async p=>{await p.evaluate(()=>{openAfterClassScenario(false);V.scenario.beat=2;V.scenario.picked=1;render();});}},
  '情景跟读': {store:{'cc.taught':'1','cc.scenarioDone':'0','cc.scenarioStarted':'1','cc.scenarioBeat':'9'},
                go:async p=>{await p.evaluate(()=>{openAfterClassScenario(false);V.scenario.beat=9;V.scenario.spoken=false;render();});}},
  '情景完成': {store:{'cc.taught':'1','cc.scenarioDone':'1','cc.scenarioStarted':'1','cc.scenarioBeat':'10'},
                go:async p=>{await p.evaluate(()=>{openAfterClassScenario(false);});}},
  '剧场':     {store:{'cc.taught':'1','cc.scenarioDone':'1'}, go:async p=>{await p.evaluate(()=>{openInAppTheater();});}},
  '剧场谢幕': {store:{'cc.taught':'1','cc.scenarioDone':'1'}, go:async p=>{await p.evaluate(()=>{openInAppTheater();
                 V.theater.act=THEATER_ACTS.length-1; V.theater.beat=0; V.theater.done=true; render();});}},
  /* —— 以下是横屏版补的：7.0 的清单没覆盖到、而这次真出过问题的状态 —— */
  '面谈第3问·已选':{store:{'cc.done':'0'}, go:async p=>{await p.evaluate(()=>{D.audio=1;V.intakeStep=3;render();});}},
  '面谈第6问':     {store:{'cc.done':'0'}, go:async p=>{await p.evaluate(()=>{V.intakeStep=6;render();});}},   /* 默认选中 25 分钟 */
  '段末一问·答完': {go:async p=>{await p.evaluate(()=>{V.lesson={seg:0,sub:0,ans:{},t0:Date.now(),tk:null};render();});
                     await p.waitForTimeout(300);
                     await p.evaluate(()=>{V.lesson.tk.done=true;V.lesson.tk.paused=true;V.lesson.tk.picked=1;render();});}},
  '讲解·讲完':     {go:async p=>{await p.evaluate(()=>{V.lesson={seg:0,sub:0,ans:{},t0:Date.now(),tk:null};openTalk('l0why');
                     V.lesson.tk.paused=true;V.lesson.tk.i=1;V.lesson.tk.done=true;renderTalk();});}},
  '自由表达':      {go:async p=>{await p.evaluate(()=>{const n=SEGS().findIndex(s=>s.kind==='speak');
                     V.lesson={seg:n,sub:1,ans:{freeFb:'听清了。时间词放在动词前面，这一点你做对了。下面是我会怎么说：'},t0:Date.now(),tk:null};render();});}},
  '听力·答错':     {go:async p=>{await p.evaluate(()=>{const n=SEGS().findIndex(s=>s.kind==='listen');
                     V.lesson={seg:n,sub:0,ans:{l0:0},t0:Date.now(),tk:null};render();});}},
  '老师·聊天中':   {store:{'cc.chat':JSON.stringify([{r:'u',t:'老师，明天几点上课？'},{r:'t',t:'今天就学这个：问钟点用「几点？」'}])},
                     go:async p=>{await p.click('[data-tab="teacher"]');}},
};

(async () => {
  const combos = process.argv.slice(2);
  const b = await chromium.launch(launchOpts);
  const found = [];
  /* ONLY=正则：只跑名字匹配的屏（屏多、组合多的时候分批跑） */
  const ONLY = process.env.ONLY ? new RegExp(process.env.ONLY) : null;
  for (const combo of combos){
    const [theme, pal] = combo.split('/');
    for (const [sname, cfg] of Object.entries(SCREENS)){
      if (ONLY && !ONLY.test(sname)) continue;
      const ctx = await b.newContext({viewport:{width:1280,height:1000}, deviceScaleFactor:2});
      const p = await ctx.newPage();
      await p.addInitScript(s=>{for(const k in s)localStorage.setItem(k,s[k]);},
        Object.assign({}, seed, cfg.store||{}));
      await p.goto(`${B}?theme=${theme}`+(pal?`&pal=${pal}`:''), {waitUntil:'networkidle'});
      if (cfg.go) await cfg.go(p);
      await p.waitForTimeout(600);

      /* 收集：自己直接含文字、祖先没被隐藏、在设备框内可见的元素 */
      const items = await p.evaluate(()=>{
        const out=[], dev=document.querySelector('.device').getBoundingClientRect();
        const hidden = el => {
          for (let n=el; n && n!==document.documentElement; n=n.parentElement){
            const cs=getComputedStyle(n);
            if (cs.visibility==='hidden'||cs.display==='none'||+cs.opacity<.25) return true;
            if (n.hasAttribute('hidden')) return true;
          }
          return false;
        };
        document.querySelectorAll('.device *').forEach(el=>{
          const own=[...el.childNodes].filter(n=>n.nodeType===3&&n.textContent.trim()).length;
          if(!own) return;
          const r=el.getBoundingClientRect();
          /* 横屏里字幕、标题能有 500px 宽；上限从 430 放到 880，仍然排除整块容器 */
          if(r.width<22||r.height<10||r.width>880||r.height>200) return;
          if(r.top<dev.top-1||r.bottom>dev.bottom+1||r.left<dev.left-1||r.right>dev.right+1) return;
          if(hidden(el)) return;
          /* 被某个滚动祖先裁掉的部分不算：那是滚动，不是配色 */
          let clipped=false;
          for (let n=el.parentElement; n && n!==document.body; n=n.parentElement){
            const cs=getComputedStyle(n);
            if (/(auto|scroll|hidden)/.test(cs.overflowY+cs.overflowX)){
              const nr=n.getBoundingClientRect();
              if (r.bottom>nr.bottom+1 || r.top<nr.top-1 || r.right>nr.right+1 || r.left<nr.left-1){ clipped=true; break; }
            }
          }
          if(clipped) return;
          const t=el.textContent.trim().replace(/\s+/g,' ').slice(0,24);
          if(!t) return;
          out.push({i:out.length, t, cls:(el.className||'').toString().slice(0,46),
                    tag:el.tagName.toLowerCase(),
                    box:{x:Math.round(r.x), y:Math.round(r.y), width:Math.round(r.width), height:Math.round(r.height)}});
        });
        return out;
      });

      /* 按坐标从整屏上裁 —— 不触发滚动，量到的就是用户真正看见的那块 */
      for (const it of items){
        let buf; try { buf = await p.screenshot({clip: it.box}); } catch(_) { continue; }
        const dev = maxDeviation(buf);
        if (dev !== null && dev < 0.25)
          found.push({combo, screen:sname, dev:+dev.toFixed(3), ...it});
      }
      await ctx.close();
    }
  }
  await b.close();

  found.sort((a,b)=>a.dev-b.dev);
  if (!found.length){ console.log('没有发现低对比的文字 ✓'); return; }
  console.log(`发现 ${found.length} 处可疑（文字与底色的最大亮度差 < 0.25，越小越看不清）：\n`);
  for (const f of found)
    console.log(`  ${f.dev.toFixed(3)}  [${f.combo}] ${f.screen}  ${f.tag}.${f.cls}  「${f.t}」`);
})();

/* 直接解 PNG 太重，交给 sharp 没有就用 pngjs；这里用最笨但可靠的办法：
   调 python 解码。改成在 node 里用 zlib 手解 PNG 扫描线。 */
const zlib = require('zlib');
function maxDeviation(buf){
  try{
    let pos = 8, w=0, h=0, bd=0, ct=0, idat=[];
    while (pos < buf.length){
      const len = buf.readUInt32BE(pos), type = buf.toString('ascii', pos+4, pos+8);
      const data = buf.slice(pos+8, pos+8+len);
      if (type==='IHDR'){ w=data.readUInt32BE(0); h=data.readUInt32BE(4); bd=data[8]; ct=data[9]; }
      else if (type==='IDAT') idat.push(data);
      else if (type==='IEND') break;
      pos += 12 + len;
    }
    if (bd!==8 || (ct!==6 && ct!==2) || !w || !h) return null;
    const ch = ct===6?4:3, raw = zlib.inflateSync(Buffer.concat(idat)), stride = w*ch;
    const lum = new Float32Array(w*h); let prev = Buffer.alloc(stride);
    for (let y=0; y<h; y++){
      const ft = raw[y*(stride+1)], line = Buffer.from(raw.slice(y*(stride+1)+1, y*(stride+1)+1+stride));
      for (let x=0; x<stride; x++){
        const a = x>=ch ? line[x-ch] : 0, bb = prev[x], c = x>=ch ? prev[x-ch] : 0;
        let v = line[x];
        if (ft===1) v += a; else if (ft===2) v += bb; else if (ft===3) v += (a+bb)>>1;
        else if (ft===4){ const pa=Math.abs(bb-c), pb=Math.abs(a-c), pc=Math.abs(a+bb-2*c);
          v += (pa<=pb&&pa<=pc)?a:(pb<=pc?bb:c); }
        line[x] = v & 255;
      }
      for (let x=0; x<w; x++){
        const o=x*ch;
        lum[y*w+x] = (0.2126*line[o] + 0.7152*line[o+1] + 0.0722*line[o+2])/255;
      }
      prev = line;
    }
    const sorted = Array.from(lum).sort((a,b)=>a-b);
    const med = sorted[sorted.length>>1];                 /* 底色 */
    const dev = Array.from(lum, v=>Math.abs(v-med)).sort((a,b)=>a-b);
    return dev[Math.floor(dev.length*0.99)];              /* 最显眼的那 1% 偏离底色多少 */
  }catch(_){ return null; }
}
