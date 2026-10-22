/* ============================================================
   lesson-core.js — 第 15 课（HSK 1 · 第三单元 · 时间）的课时内容
   被 mobile.html 与 index.html 共用。经典 script 标签加载，file:// 可用。
   这里只放数据与板书渲染，播放器与样式各端自己实现。
   ============================================================ */
(function (root) {

/* ---------- 0. 老师名单 ----------
   选老师不只是换形象：它决定讲解用哪种母语（lang）和老师说话的语气（tone）。
   形象文件一律 assets/t-<id>.jpg，1024×1536 竖幅，脸在上三分之一。
   有去背全身像的老师另给 cut：透明底 WebP，头顶到鞋底贴边裁，课堂里她直接站在板前；
   img 仍然要有，选老师页的大图和各处小头像用的是它。
   有 cut 就要有 cutGeo——每张立绘的比例不一样，站位和让位都按它算（量法见 gen/measure_cut.py）：
     ar    立绘宽高比（宽/高），.dh-cut 的 aspect-ratio
     chalk 粉笔尖离立绘左缘多远，以身高为单位——她按这个点对到板书 56% 线外
     hair  头发左缘在粉笔尖右边多远，以身高为单位——练习屏的卡片停在它左边 12px
     face  脸框 [左, 右, 上, 下]，占立绘宽/高的比例——check-occlusion.js 在这里采点看脸有没有被盖
   不写 cutGeo 时 CSS 按林老师的数退回。                                    */
const TEACHERS = [
  /* 杨老师：林老师的 3D 卡通版（Q 版软萌风，约五头身），7.1 第二轮加的。
     用户要「把 B 风格的数字人替换进去」，所以她排第一、成为默认老师；林老师留在名单里，选老师页还能换回去。
     衣服、姿势、粉笔和书都照林老师来，生成时拿林老师的绿幕图当参考改的（过程见 gen/prompts.md）。
     她头大、脸低：脸框下沿在 20.5%（林老师 14%），头发左缘离粉笔尖也更近，所以 cutGeo 和林老师的不一样。 */
  { id:'yang', img:'assets/t-yang.jpg', cut:'assets/t-yang-cut.webp', kind:'virtual',
    cutGeo:{ ar:'633/2172', chalk:.0082, hair:.0645, face:[.33,.76,.06,.205] },
    name:{zh:'杨老师',en:'Teacher Yang'}, native:'', sub:{zh:'对外汉语 · 3D 卡通形象',en:'Chinese as a second language · 3D cartoon'},
    trait:{zh:'陪你念、陪你写，念错了就再来一遍', en:'Reads and writes along with you — miss one, we just go again'},
    students:968, lang:'en', langName:{zh:'英语',en:'English'}, tone:'warm',
    intro:{ zh:'我是杨老师。板上写下的每一句，我都陪你念一遍——念错了没关系，我们再来一遍，直到你自己说得出口。',
            en:'I’m Teacher Yang. Every line that goes up on the board, we read together — get one wrong and that’s fine, we go again until you can say it on your own.' } },

  /* 林老师是 7.1 第一轮加的，专为黑板课堂出的真人形象（生成与抠像过程见 gen/）。
     第二轮杨老师排到了她前面；teacherById 找不到人时回落到名单第一位，现在是杨老师。 */
  { id:'lin', img:'assets/t-lin.jpg', cut:'assets/t-lin-cut.webp', kind:'real',
    cutGeo:{ ar:'617/2168', chalk:.0085, hair:.085, face:[.38,.66,.035,.14] },
    name:{zh:'林老师',en:'Teacher Lin'}, native:'', sub:{zh:'对外汉语 · 八年',en:'Chinese as a second language · 8 years'},
    trait:{zh:'讲一句、写一句', en:'Says a line, then writes it on the board'},
    students:1046, lang:'en', langName:{zh:'英语',en:'English'}, tone:'warm',
    intro:{ zh:'我是林老师。我讲一句，就在黑板上写一句——你跟着看、跟着念。下课的时候，板上的每一个字都是你的。',
            en:'I’m Teacher Lin. Every line I say goes up on the board — follow it with your eyes and say it with me. By the end of class, every word up there is yours.' } },

  { id:'fang', img:'assets/t-fang.jpg', kind:'real',
    name:{zh:'方老师',en:'Teacher Fang'}, native:'', sub:{zh:'对外汉语 · 十二年',en:'Chinese as a second language · 12 years'},
    trait:{zh:'沉稳克制、有分寸', en:'Measured, precise, never padded'},
    students:1284, lang:'en', langName:{zh:'英语',en:'English'}, tone:'steady',
    intro:{ zh:'我是方老师，教了十二年对外汉语。我的课不绕弯子：一节课只讲清楚一件事，然后让你自己说一遍。',
            en:'I’m Teacher Fang. Twelve years teaching Chinese as a second language. My lessons don’t wander: one thing made clear, then you say it back.' } },

  { id:'mo', img:'assets/t-mo.jpg', kind:'virtual',
    name:{zh:'阿墨',en:'Mò'}, native:'', sub:{zh:'学堂守门人 · 虚拟形象',en:'Keeper of the academy gate · virtual'},
    trait:{zh:'老顽童、爱讲冷笑话、吃饱就犯困', en:'An old rascal — bad jokes, naps after lunch'},
    students:2106, lang:'en', langName:{zh:'英语',en:'English'}, tone:'playful',
    intro:{ zh:'我是阿墨，在这学堂门口守了三百年。中文哪儿不懂你尽管问——不过我吃饱了就想睡，剩下的你得自己多练两遍。',
            en:'I’m Mò. I’ve watched this academy gate for three hundred years. Ask me anything about Chinese — though after a meal I get sleepy, so the drilling is on you.' } },

  { id:'yaya', img:'assets/t-yaya.jpg', kind:'real',
    name:{zh:'雅雅',en:'YaYa'}, native:'', sub:{zh:'北京工商大学',en:'Beijing Technology and Business University'},
    trait:{zh:'风趣亲和、循循善诱', en:'Funny, warm, leads you there step by step'},
    students:873, lang:'en', langName:{zh:'英语',en:'English'}, tone:'warm',
    intro:{ zh:'我是雅雅。不懂就问，答错也没关系——我的课堂是安全区，慢慢来，我陪着你。',
            en:'I’m YaYa. Ask anything, get it wrong freely — my classroom is a safe place. Take your time; I’ll stay with you.' } },

  { id:'zihan', img:'assets/t-zihan.jpg', kind:'real',
    name:{zh:'子涵',en:'Zihan'}, native:'', sub:{zh:'对外汉语 · 五年',en:'Chinese as a second language · 5 years'},
    trait:{zh:'沉稳有序、值得信赖', en:'Steady, orderly, dependable'},
    students:641, lang:'en', langName:{zh:'英语',en:'English'}, tone:'steady',
    intro:{ zh:'我是子涵。我会把每一步拆到你能跟上，确保你迈出去的每一步都踩实了。',
            en:'I’m Zihan. I break each step down until you can follow it, so every step you take is on solid ground.' } },

  { id:'wanbai', img:'assets/t-wanbai.jpg', kind:'real',
    name:{zh:'宛白',en:'WanBai'}, native:'', sub:{zh:'对外汉语 · 七年',en:'Chinese as a second language · 7 years'},
    trait:{zh:'感知敏锐、通情达理、纯粹明亮', en:'Perceptive, understanding, clear-hearted'},
    students:559, lang:'en', langName:{zh:'英语',en:'English'}, tone:'gentle',
    intro:{ zh:'你好呀，我是宛白。在我这儿你不必时刻绷着，按最舒服的节奏，去感受中文原本的样子。',
            en:'Hello — I’m WanBai. You don’t have to be tense with me. Go at whatever pace feels right and let Chinese be what it is.' } },

  { id:'supanee', img:'assets/t-supanee.jpg', kind:'real',
    name:{zh:'素帕妮',en:'Supanee'}, native:'สุพรรณี', sub:{zh:'泰语讲解',en:'Explains in Thai'},
    trait:{zh:'温柔而坚韧、包容随和', en:'Gentle but tough, easy to be around'},
    students:412, lang:'th', langName:{zh:'泰语',en:'Thai'}, tone:'gentle',
    intro:{ zh:'大家好呀，叫我素帕妮姐姐就行。学中文嘛，今天记住一个字，明天记住一个词——像煮一锅汤，火候到了，味道自然就出来了。',
            en:'Hello! Just call me Supanee. Learning Chinese is one character today, one word tomorrow — like a slow soup. Give it time and the taste comes.' } },

  { id:'karim', img:'assets/t-karim.jpg', kind:'real',
    name:{zh:'卡里姆',en:'Karim'}, native:'كريم', sub:{zh:'阿拉伯语讲解',en:'Explains in Arabic'},
    trait:{zh:'有些羞涩，却慷慨宽厚，真诚大方', en:'Shy at first, then generous and wholly sincere'},
    students:388, lang:'ar', langName:{zh:'阿拉伯语',en:'Arabic'}, tone:'warm',
    intro:{ zh:'我是卡里姆。中文和阿拉伯语一样，都像沙漠里的星星——越往深里看，越觉得美。这条长路，我们慢慢走。',
            en:'I’m Karim. Chinese is like Arabic — like stars over the desert. The longer you look, the more there is. Let’s walk this road slowly.' } },

  { id:'arjun', img:'assets/t-arjun.jpg', kind:'real',
    name:{zh:'阿琼',en:'Arjun'}, native:'अर्जुन', sub:{zh:'印地语 / 英语讲解',en:'Explains in Hindi or English'},
    trait:{zh:'节奏明快、例子特别多', en:'Brisk, and never short of an example'},
    students:496, lang:'hi', langName:{zh:'印地语',en:'Hindi'}, tone:'brisk',
    intro:{ zh:'我是阿琼。中文里每一条规律，我都能给你举三个例子——听不懂就打断我，我们换一个再来。',
            en:'I’m Arjun. For every rule in Chinese I’ve got three examples ready. Lost? Cut me off and we’ll try a different one.' } },

  { id:'wukong', img:'assets/t-wukong.jpg', kind:'virtual',
    name:{zh:'孙悟空',en:'Sun Wukong'}, native:'', sub:{zh:'齐天大圣 · 虚拟形象',en:'The Monkey King · virtual'},
    trait:{zh:'战斗！战无不胜！', en:'Fight! And never lose!'},
    students:1937, lang:'en', langName:{zh:'英语',en:'English'}, tone:'fierce',
    intro:{ zh:'俺乃齐天大圣孙悟空！手握如意金箍棒，学个中文算什么难事——跟俺念，错了就重来，再来一遍！',
            en:'I am Sun Wukong, Great Sage Equal of Heaven! With this staff in hand, what is a little Chinese? Repeat after me. Wrong? Again. Once more!' } }
];
const teacherById = id => TEACHERS.find(t=>t.id===id) || TEACHERS[0];

/* 语气：同一件事，不同老师说法不同。只在少数几处生效，够让选择有分量 */
const TONE = {
  steady:{
    greet:{ zh:(n,u)=>`今天是第 ${n} 课，${u}。学完这一课，时间你就能自己说出口。我们开始。`,
            en:(n,u)=>`Today is lesson ${n}, ${u}. By the end, time is something you can say on your own. Let’s begin.` },
    ok:{ zh:'声调对了，连读也顺。下一句。', en:'Tones right, runs smoothly. Next line.' },
    no:{ zh:'「几」要念成第二声，刚才你念成了第三声。再来一次。', en:'几 should be second tone; you said third. Once more.' } },
  warm:{
    greet:{ zh:(n,u)=>`第 ${n} 课啦，今天讲${u}。别紧张，这一课没有难的地方，我陪你走一遍。`,
            en:(n,u)=>`Lesson ${n} — today it’s ${u}. Nothing hard here, I promise. I’ll walk through it with you.` },
    ok:{ zh:'很好，这个声调你抓住了！接着来。', en:'Lovely — you caught that tone. Keep going.' },
    no:{ zh:'差一点点。「几」在这儿要往上挑，我们再来一次，不着急。', en:'Nearly. 几 rises here. Let’s try again — no rush.' } },
  gentle:{
    greet:{ zh:(n,u)=>`第 ${n} 课，${u}。慢慢来就好，这一课不长。`,
            en:(n,u)=>`Lesson ${n}, ${u}. Take it slowly — this one isn’t long.` },
    ok:{ zh:'对了。你听出来了，这很难得。', en:'That’s it. You heard the difference — that’s not easy.' },
    no:{ zh:'再听一次这个音就好，不要急着说对。', en:'Just listen to the sound once more. No hurry to get it right.' } },
  playful:{
    greet:{ zh:(n,u)=>`哟，第 ${n} 课！今天讲${u}——这个我熟，三百年前就天天用。`,
            en:(n,u)=>`Ah, lesson ${n}! Today it’s ${u} — I know this one. Used it daily three hundred years ago.` },
    ok:{ zh:'哈！这声调比我年轻时准。', en:'Ha! Better tones than I had at your age.' },
    no:{ zh:'哎，调儿滑下去了。「几」得往上挑——跟我来。', en:'Ah, the tone slid down. 几 goes up. Follow me.' } },
  brisk:{
    greet:{ zh:(n,u)=>`第 ${n} 课，${u}。直接讲，讲完马上练，别停。`,
            en:(n,u)=>`Lesson ${n}, ${u}. Straight in, then straight to practice. No stopping.` },
    ok:{ zh:'对。下一句，继续。', en:'Right. Next line, keep moving.' },
    no:{ zh:'声调错了。第二声，不是第三声。再来。', en:'Tone’s wrong. Second, not third. Again.' } },
  fierce:{
    greet:{ zh:(n,u)=>`第 ${n} 课！今日讲${u}——拿出精神来，跟俺念！`,
            en:(n,u)=>`Lesson ${n}! Today, ${u}. Chin up and repeat after me!` },
    ok:{ zh:'好！这一声喊得有底气。', en:'Good! That one had some force behind it.' },
    no:{ zh:'调子软了！「几」要挑起来——再来一遍！', en:'Too soft! 几 must rise. Again!' } }
};
const toneOf = t => TONE[(t&&t.tone)||'steady'] || TONE.steady;

/* ---------- 1. 生词 / 语法 / 听力 / 口语 / 小测 ---------- */
const L15 = {
  no: 15, unit: 3,
  goal: { zh:'能问时间、说出时间，并和人约一个时间',
          en:'Ask the time, tell the time, and arrange to meet someone' },
  syllabus: { zh:'HSK 1 · 话题「时间」；疑问代词「几」',
              en:'HSK 1 · topic “time”; the question word 几' },
  words: [
    { z:'点',   p:'diǎn',    pos:{zh:'量词',en:'measure word'}, m:{zh:'钟点',en:'o’clock'},
      eg:'现在八点。',       egp:'xiànzài bā diǎn.',        ege:'It’s eight o’clock.' },
    { z:'分',   p:'fēn',     pos:{zh:'量词',en:'measure word'}, m:{zh:'分钟',en:'minute'},
      eg:'八点十分。',       egp:'bā diǎn shí fēn.',        ege:'Ten past eight.' },
    { z:'几',   p:'jǐ',      pos:{zh:'代词',en:'pronoun'},      m:{zh:'多少（问数目）',en:'how many / what (number)'},
      eg:'你几点来？',       egp:'nǐ jǐ diǎn lái?',         ege:'What time are you coming?' },
    { z:'现在', p:'xiànzài', pos:{zh:'名词',en:'noun'},         m:{zh:'此刻',en:'now'},
      eg:'现在几点？',       egp:'xiànzài jǐ diǎn?',        ege:'What time is it now?' },
    { z:'今天', p:'jīntiān', pos:{zh:'名词',en:'noun'},         m:{zh:'这一天',en:'today'},
      eg:'今天星期三。',     egp:'jīntiān xīngqīsān.',      ege:'Today is Wednesday.' },
    { z:'明天', p:'míngtiān',pos:{zh:'名词',en:'noun'},         m:{zh:'下一天',en:'tomorrow'},
      eg:'明天下午见。',     egp:'míngtiān xiàwǔ jiàn.',    ege:'See you tomorrow afternoon.' },
    { z:'星期', p:'xīngqī',  pos:{zh:'名词',en:'noun'},         m:{zh:'一周；星期几',en:'week; day of the week'},
      eg:'星期六你有空吗？', egp:'xīngqīliù nǐ yǒu kòng ma?',ege:'Are you free on Saturday?' },
    { z:'号',   p:'hào',     pos:{zh:'量词',en:'measure word'}, m:{zh:'日（日期）',en:'day of the month'},
      eg:'今天几号？',       egp:'jīntiān jǐ hào?',         ege:'What’s the date today?' }
  ],
  grammar: [
    { t:{zh:'用「几」问数目和时间', en:'几 asks for a number or a time'},
      struct:'几 + 量词 / 名词',
      d:{ zh:'「几」用来问十以内的数目，问时间、日期时最常用。回答时把「几」换成数字就行。',
          en:'几 asks for a number, typically under ten, and is the standard way to ask times and dates. To answer, just replace 几 with the number.' },
      eg:[{z:'现在几点？',e:'What time is it now?'},{z:'今天几号？',e:'What’s the date today?'}],
      drill:{ q:['现在','点？'], blank:'几', pool:['几','号','分'],
              hint:{zh:'问钟点，用哪个字？',en:'Which word asks for the hour?'} } },
    { t:{zh:'时间词可以直接作谓语', en:'A time word can be the predicate on its own'},
      struct:'主语 + 时间词',
      d:{ zh:'说时间、日期、星期时，中间不用加「是」。加上也不算错，但口语里通常不加。',
          en:'With times, dates and weekdays you don’t need 是 in between. Adding it isn’t wrong, but it’s usually left out in speech.' },
      eg:[{z:'今天星期三。',e:'Today is Wednesday.'},{z:'明天十五号。',e:'Tomorrow is the 15th.'}],
      drill:{ q:['今天','三。'], blank:'星期', pool:['星期','现在','分'],
              hint:{zh:'说「星期三」要先说哪个词？',en:'Which word comes before 三 to mean Wednesday?'} } }
  ],
  listen: [
    { play:'现在几点？现在八点。', q:{zh:'现在几点？',en:'What time is it now?'},
      opts:[{t:'7:00'},{t:'8:00',ok:true},{t:'10:00'}] },
    { play:'今天几号？今天十五号。', q:{zh:'今天几号？',en:'What’s today’s date?'},
      opts:[{t:'5',sfx:{zh:'号',en:'th'}},{t:'10',sfx:{zh:'号',en:'th'}},{t:'15',sfx:{zh:'号',en:'th'},ok:true}] },
    { play:'明天星期几？明天星期三。', q:{zh:'明天星期几？',en:'What day is tomorrow?'},
      opts:[{t:'星期二',sub:'Tuesday'},{t:'星期三',sub:'Wednesday',ok:true},{t:'星期四',sub:'Thursday'}] }
  ],
  speak: [
    { kind:'repeat', lines:[
        { z:'现在几点？',   p:'xiànzài jǐ diǎn?',   e:'What time is it now?' },
        { z:'今天几号？',   p:'jīntiān jǐ hào?',    e:'What’s the date today?' },
        { z:'明天星期三。', p:'míngtiān xīngqīsān.',e:'Tomorrow is Wednesday.' } ] },
    { kind:'free',
      ask:  { z:'你明天几点有空？',       p:'nǐ míngtiān jǐ diǎn yǒu kòng?',        e:'What time are you free tomorrow?' },
      model:{ z:'我明天下午三点有空。',   p:'wǒ míngtiān xiàwǔ sān diǎn yǒu kòng.', e:'I’m free at three tomorrow afternoon.' } }
  ],
  quiz: [
    { t:{zh:'选一个词填进去：现在＿点？',en:'Fill the gap: 现在＿点？'}, zh:true,
      opts:[{t:'几',ok:true},{t:'号'},{t:'分'}],
      fb:{ ok:{zh:'对。问钟点用「几」。',en:'Right — 几 asks for the hour.'},
           no:{zh:'「号」问日期，「分」是分钟。问钟点用「几」。',en:'号 asks a date and 分 means minutes. The hour takes 几.'} } },
    { t:{zh:'听一句话，他说的是哪一天？',en:'Listen. Which day is he talking about?'}, play:'明天星期三。',
      opts:[{t:'今天',sub:'today'},{t:'明天',sub:'tomorrow',ok:true},{t:'星期六',sub:'Saturday'}],
      fb:{ ok:{zh:'对，是「明天」。',en:'Right — 明天, tomorrow.'},
           no:{zh:'再听一次：míng tiān，明天。',en:'Listen again: míng tiān — tomorrow.'} } },
    { t:{zh:'把这三个词排成一句话：见 / 明天 / 下午',en:'Put these in order: 见 / 明天 / 下午'}, order:true,
      answer:['明天','下午','见'], pool:['下午','见','明天'],
      fb:{ ok:{zh:'对。时间在前，动作在后。',en:'Right — time first, action last.'},
           no:{zh:'中文里时间词放在动词前面：明天下午见。',en:'In Chinese the time goes before the verb: 明天下午见。'} } },
    { t:{zh:'哪一句更自然？',en:'Which sounds more natural?'}, zh:true,
      opts:[{t:'今天星期三。',ok:true},{t:'今天是星期三的。'}],
      fb:{ ok:{zh:'对。说星期不用加「是」，也不用「的」。',en:'Right. Weekdays take no 是 and no 的.'},
           no:{zh:'「今天是星期三的」不成立。说时间直接「今天星期三」。',en:'“今天是星期三的” isn’t a sentence. Just say 今天星期三。'} } },
    { t:{zh:'别人问你「你几点来？」你怎么回答？',en:'Someone asks 你几点来？ How do you answer?'}, zh:true,
      opts:[{t:'我八点来。',ok:true},{t:'我星期三。'},{t:'现在几点？'}],
      fb:{ ok:{zh:'对。问几点，就答几点。',en:'Right — a 几点 question wants a time in reply.'},
           no:{zh:'他问的是钟点，不是星期，也不是反问。答「我八点来」。',en:'He asked for a clock time, not a weekday or a question back. Say 我八点来。'} } }
  ]
};

/* ---------- 2. 全屏讲解 ----------
   每段 = 若干 beat（一句话 + 当时的板书）+ 段末一问 check + 听不懂时的 again
   beat 不写 dur 时按字数估算播放时长                                   */
const TALKS = {

  t0: {
    tag:{zh:'导课',en:'Opening'},
    beats:[
      { zh:'今天这节课只讲一件事：时间。',
        en:'Today’s lesson is about one thing: time.' },
      { zh:'为什么先学它？因为在中国，你每天都要回答两个问题——几点，和哪天。',
        en:'Why first? Because in China you answer two questions every single day: what time, and which day.',
        board:{ t:'list', items:[{z:'几点？',en:'what time?'},{z:'哪天？',en:'which day?'}] } },
      { zh:'学完这一课，这样的话你能自己说出来。',
        en:'By the end of this lesson you can say something like this on your own.',
        board:{ t:'line', z:'明天下午三点，行吗？', py:'míngtiān xiàwǔ sān diǎn, xíng ma?',
                en:'Three tomorrow afternoon — all right?' } },
      { zh:'八个词，两个语法点。我们开始。',
        en:'Eight words, two grammar points. Let’s begin.',
        board:{ t:'kv', items:[['生词','8 个'],['语法点','2 个'],['时长','约 25 分钟']] } }
    ],
    again:[
      { zh:'换个说法：今天学时间。学完你能问几点、说几点、和人约时间。',
        en:'Put simply: today is about time. You’ll be able to ask it, say it, and arrange a time with someone.' }
    ],
    check:{
      q:{zh:'这节课学完，你应该能做到哪件事？',en:'By the end of this lesson, what should you be able to do?'},
      opts:[{t:{zh:'和人约一个时间',en:'Arrange a time with someone'},ok:true},
            {t:{zh:'写出八个汉字',en:'Write eight characters by hand'}},
            {t:{zh:'读懂一张菜单',en:'Read a menu'}}],
      ok:{zh:'对。这节课的目标是把时间说出口，不是写字。',en:'Right. The goal is saying time out loud, not writing.'},
      no:{zh:'不是。写字在 HSK 2 才考，菜单是第四单元。今天只管时间。',en:'No. Handwriting starts at HSK 2, menus are unit 4. Today is time only.'}
    }
  },

  t1: {
    tag:{zh:'生词总讲',en:'The eight words'},
    beats:[
      { zh:'这八个词，我把它们分成三组，你记起来会快很多。',
        en:'I’ll put these eight words into three groups — much easier to hold on to.' },
      { zh:'第一组管钟点：点、分、现在。',
        en:'Group one is clock time: 点, 分, 现在.',
        board:{ t:'group', groups:[
          { title:{zh:'钟点',en:'clock time'}, items:[{z:'点',p:'diǎn'},{z:'分',p:'fēn'},{z:'现在',p:'xiànzài'}] } ] } },
      { zh:'第二组管日子：今天、明天、星期、号。',
        en:'Group two is days: 今天, 明天, 星期, 号.',
        board:{ t:'group', groups:[
          { title:{zh:'钟点',en:'clock time'}, items:[{z:'点',p:'diǎn'},{z:'分',p:'fēn'},{z:'现在',p:'xiànzài'}] },
          { title:{zh:'日子',en:'days'}, items:[{z:'今天',p:'jīntiān'},{z:'明天',p:'míngtiān'},{z:'星期',p:'xīngqī'},{z:'号',p:'hào'}] } ] } },
      { zh:'最后一个字最关键——几。问钟点靠它，问日期也靠它。',
        en:'The last one matters most — 几. It asks the hour and it asks the date.',
        board:{ t:'group', groups:[
          { title:{zh:'钟点',en:'clock time'}, items:[{z:'点',p:'diǎn'},{z:'分',p:'fēn'},{z:'现在',p:'xiànzài'}] },
          { title:{zh:'日子',en:'days'}, items:[{z:'今天',p:'jīntiān'},{z:'明天',p:'míngtiān'},{z:'星期',p:'xīngqī'},{z:'号',p:'hào'}] },
          { title:{zh:'提问',en:'asking'}, hi:true, items:[{z:'几',p:'jǐ'}] } ] } },
      { zh:'三组立住，八个词就不是八个孤零零的字了。',
        en:'With the groups in place, these stop being eight loose characters.' }
    ],
    again:[
      { zh:'再说一次：三组。钟点一组，日子一组，「几」自己一组，它是用来提问的。',
        en:'Once more: three groups. Clock time, days, and 几 on its own — 几 is the question word.' }
    ],
    check:{
      q:{zh:'「号」是用来说什么的？',en:'What is 号 used for?'},
      opts:[{t:{zh:'日期（几月几号）',en:'The date (which day of the month)'},ok:true},
            {t:{zh:'钟点（几点钟）',en:'The hour'}},
            {t:{zh:'星期几',en:'The weekday'}}],
      ok:{zh:'对。号说的是一个月里的第几天。',en:'Right — 号 is the day of the month.'},
      no:{zh:'钟点是「点」，星期是「星期」。号专管日期：今天十五号。',en:'The hour is 点 and the weekday is 星期. 号 is the date: 今天十五号。'}
    }
  },

  t1b: {
    tag:{zh:'辨析 · 几 和 多少',en:'几 vs 多少'},
    beats:[
      { zh:'有个地方外国学生几乎都会错：中文问数目有两个词，几，和多少。',
        en:'Here’s a trap nearly every learner falls into: Chinese has two words for asking “how many” — 几 and 多少.' },
      { zh:'几，用在你估计数目不大的时候，一般十以内。几点、几号、几个人。',
        en:'几 is for numbers you expect to be small, usually under ten: 几点, 几号, 几个人.',
        board:{ t:'list', items:[{z:'几点？',en:'what time?'},{z:'几号？',en:'what date?'},{z:'几个人？',en:'how many people?'}] } },
      { zh:'多少，数目大小都行。所以问价钱必须用多少——钱可能很多。',
        en:'多少 works for any size. Prices always take 多少, because money can be a big number.',
        board:{ t:'rows', rows:[
          { mark:'✗', z:'这个几钱？' },
          { mark:'✓', z:'这个多少钱？', note:{zh:'问价钱只能用多少',en:'prices only take 多少'} } ] } },
      { zh:'一句话记住：问时间用几，问价钱用多少。',
        en:'One line to remember: 几 for time, 多少 for price.' }
    ],
    again:[
      { zh:'简单说：数目小，用几；数目可能很大，用多少。钱永远用多少。',
        en:'Short version: small number, use 几; possibly large, use 多少. Money is always 多少.' }
    ],
    check:{
      q:{zh:'问「这个多少钱」的时候，为什么不能用「几」？',en:'Why can’t you use 几 to ask a price?'},
      opts:[{t:{zh:'因为价钱可能是很大的数',en:'Because a price can be a large number'},ok:true},
            {t:{zh:'因为「几」不礼貌',en:'Because 几 is impolite'}},
            {t:{zh:'因为「钱」后面不能跟量词',en:'Because 钱 can’t take a measure word'}}],
      ok:{zh:'对。几预设了数目不大，价钱不能这么预设。',en:'Right. 几 presumes a small number, and a price can’t be presumed small.'},
      no:{zh:'跟礼貌和量词都没关系。只是因为几预设数目小，而价钱可能很大。',en:'Nothing to do with politeness or measure words. 几 presumes a small number; prices may be large.'}
    }
  },

  t2a: {
    tag:{zh:'语法点 1',en:'Grammar 1'},
    beats:[
      { zh:'第一个语法点。中文问数目，有一个很省事的做法。',
        en:'First grammar point — and Chinese makes this unusually easy.' },
      { zh:'你看这句陈述句：现在三点。',
        en:'Take this statement: 现在三点 — it’s three o’clock.',
        board:{ t:'slot', cells:[{z:'现在'},{z:'三'},{z:'点'}] } },
      { zh:'要把它变成问句，你不用调语序，也不用加任何词。只要把数字拿掉。',
        en:'To turn it into a question you don’t reorder anything and you don’t add a word. You only take the number out.',
        board:{ t:'slot', cells:[{z:'现在'},{z:'',slot:true},{z:'点'}] } },
      { zh:'换成「几」，就成了：现在几点？',
        en:'Put 几 in its place and you get 现在几点？',
        board:{ t:'slot', cells:[{z:'现在'},{z:'几',slot:true,fill:true},{z:'点'}],
                note:{zh:'语序一个字都没动',en:'not one word moved'} } },
      { zh:'日期也一样：今天十五号，问的时候就是今天几号。',
        en:'Dates work the same way: 今天十五号 becomes 今天几号.',
        board:{ t:'rows', rows:[
          { mark:'→', z:'今天十五号。', note:{zh:'陈述',en:'statement'} },
          { mark:'→', z:'今天几号？',   note:{zh:'提问',en:'question'} } ] } },
      { zh:'所以你只要会说一句陈述句，就自动会问它。',
        en:'So the moment you can state something, you can also ask about it.' }
    ],
    again:[
      { zh:'换个说法：把句子里的数字抠掉，填上「几」，就是问句。别的都不动。',
        en:'Simply: pull the number out of the sentence, drop 几 into the hole. Nothing else changes.' }
    ],
    check:{
      q:{zh:'「今天十五号」要问日期，该怎么说？',en:'To ask about the date in 今天十五号, what do you say?'},
      opts:[{t:{zh:'今天几号？',en:'今天几号？'},ok:true},
            {t:{zh:'今天什么号？',en:'今天什么号？'}},
            {t:{zh:'几今天号？',en:'几今天号？'}}],
      ok:{zh:'对。数字原来在哪儿，「几」就放哪儿。',en:'Right. 几 goes exactly where the number was.'},
      no:{zh:'「几」要放在原来数字的位置上，别的词都不动。今天几号？',en:'几 takes the number’s slot and nothing else moves: 今天几号？'}
    }
  },

  t2b: {
    tag:{zh:'语法点 2',en:'Grammar 2'},
    beats:[
      { zh:'第二个语法点。这个地方，母语是英语的人几乎都会多说一个字。',
        en:'Second grammar point. English speakers nearly always add one word too many here.' },
      { zh:'英文说 It IS three o’clock，中间有一个 is。中文说时间，不用「是」。',
        en:'English says “it IS three o’clock” — there’s an “is”. Chinese doesn’t use 是 for time.',
        board:{ t:'rows', rows:[
          { mark:'✗', z:'现在是三点。' },
          { mark:'✓', z:'现在三点。', note:{zh:'时间词自己就能当谓语',en:'the time word is the predicate'} } ] } },
      { zh:'我说清楚一点：加了「是」不算语法错误，也能听懂。但听起来会重，像在跟人争。',
        en:'To be precise: adding 是 isn’t ungrammatical and you’ll be understood. It just lands heavy, as if you were arguing.' },
      { zh:'日期、星期，全都一样。',
        en:'Dates and weekdays behave the same.',
        board:{ t:'list', items:[{z:'今天星期三。',en:'Today is Wednesday.'},{z:'明天十五号。',en:'Tomorrow is the 15th.'}] } },
      { zh:'少说一个字，反而更地道。中文里这样的地方不少。',
        en:'One word fewer sounds more native. Chinese has a lot of places like this.' }
    ],
    again:[
      { zh:'一句话：说时间别加「是」。现在三点，不是现在是三点。',
        en:'In a line: no 是 with time. 现在三点, not 现在是三点.' }
    ],
    check:{
      q:{zh:'哪一句更自然？',en:'Which sounds more natural?'},
      opts:[{t:{zh:'今天星期三。',en:'今天星期三。'},ok:true},
            {t:{zh:'今天是星期三的。',en:'今天是星期三的。'}},
            {t:{zh:'今天有星期三。',en:'今天有星期三。'}}],
      ok:{zh:'对。时间词直接跟在主语后面就行。',en:'Right — the time word follows the subject directly.'},
      no:{zh:'「的」和「有」在这里都不成立。说时间最短最自然：今天星期三。',E:'',en:'Neither 的 nor 有 works here. Shortest is most natural: 今天星期三。'}
    }
  },

  t3: {
    tag:{zh:'听力策略',en:'How to listen'},
    beats:[
      { zh:'接下来听三段。开始之前，我教你一个办法。',
        en:'Three clips coming up. First, a technique.' },
      { zh:'别想着每个字都翻译成你的母语——你来不及，一句话就过去了。',
        en:'Don’t translate word by word into your own language. You won’t keep up; the sentence is gone.' },
      { zh:'只抓两样东西：数字，和数字后面那一个字。',
        en:'Catch two things only: the number, and the one word right after it.',
        board:{ t:'line', z:'现在八点。', py:'xiànzài bā diǎn.', en:'It’s eight o’clock.', hi:['八','点'] } },
      { zh:'八加点，是钟点。十五加号，是日期。星期在前，数字在后，那是星期几。',
        en:'Eight plus 点 is a clock time. Fifteen plus 号 is a date. 星期 first then the number is a weekday.',
        board:{ t:'list', items:[
          {z:'八 + 点',  en:'8 o’clock'},
          {z:'十五 + 号',en:'the 15th'},
          {z:'星期 + 三',en:'Wednesday'} ] } },
      { zh:'抓住这两个字，整句就听懂了。其余的词现在可以先放掉。',
        en:'Catch those two and the sentence is yours. Everything else can wait.' }
    ],
    again:[
      { zh:'简单说：听数字，再听数字后面那个字。点是钟点，号是日期。',
        en:'Short version: listen for the number, then the word after it. 点 means hour, 号 means date.' }
    ],
    check:{
      q:{zh:'你听到「十五号」，他在说什么？',en:'You hear 十五号. What is he telling you?'},
      opts:[{t:{zh:'一个日期',en:'A date'},ok:true},
            {t:{zh:'一个钟点',en:'A clock time'}},
            {t:{zh:'一个人数',en:'A number of people'}}],
      ok:{zh:'对。号在数字后面，说明那是日期。',en:'Right — 号 after a number marks a date.'},
      no:{zh:'钟点要带「点」，人数要带「个」。带「号」的是日期。',en:'Hours take 点 and people take 个. 号 marks the date.'}
    }
  },

  t4: {
    tag:{zh:'发音 · 三声连读',en:'Third-tone sandhi'},
    beats:[
      { zh:'开口之前，有一个音我必须先纠。',
        en:'Before you speak, one sound needs fixing.' },
      { zh:'「几」是第三声，「点」也是第三声。',
        en:'几 is third tone. 点 is also third tone.',
        board:{ t:'tone', sylls:[{s:'jǐ',n:3,z:'几'},{s:'diǎn',n:3,z:'点'}] } },
      { zh:'两个第三声撞在一起，中国人不会都念成第三声——太费劲了。',
        en:'When two third tones collide, nobody actually says both as third tone. It’s too much work.' },
      { zh:'前面那个会变成第二声。这叫三声变调。',
        en:'The first one shifts to second tone. This is third-tone sandhi.',
        board:{ t:'tone', sylls:[{s:'jí',n:2,z:'几',morph:true},{s:'diǎn',n:3,z:'点'}],
                note:{zh:'第三声 → 第二声',en:'third tone → second tone'} } },
      { zh:'所以「几点」真读出来是 jí diǎn，不是 jǐ diǎn。写的时候还写第三声，读的时候变。',
        en:'So 几点 is actually said jí diǎn, not jǐ diǎn. It stays third tone in writing and changes only in speech.',
        board:{ t:'rows', rows:[
          { mark:'✗', z:'jǐ diǎn' },
          { mark:'✓', z:'jí diǎn', note:{zh:'这才是中国人说出来的声音',en:'this is what you actually hear'} } ] } },
      { zh:'这条规则在中文里到处都是。你先在这一个词上养成习惯。',
        en:'This rule is everywhere in Chinese. Build the habit on this one word first.' }
    ],
    again:[
      { zh:'记一句话：两个三声挨着，第一个念成第二声。几点 = jí diǎn。',
        en:'One line: two third tones in a row — the first becomes second tone. 几点 = jí diǎn.' }
    ],
    check:{
      q:{zh:'「几点」真读出来，「几」是第几声？',en:'When you actually say 几点, what tone is 几?'},
      opts:[{t:{zh:'第二声',en:'Second tone'},ok:true},
            {t:{zh:'第三声',en:'Third tone'}},
            {t:{zh:'第一声',en:'First tone'}}],
      ok:{zh:'对。写第三声，读第二声。',en:'Right — written third, spoken second.'},
      no:{zh:'拼音上写的是第三声，但后面跟着另一个第三声，实际要念成第二声。',en:'The pinyin shows third tone, but before another third tone it is said as second.'}
    }
  },

  t5: {
    tag:{zh:'小测讲评',en:'Going over the check'},
    beats:[
      { zh:'五题做完了。我说两个最常错的地方。',
        en:'Five items done. Two things people get wrong most often.' },
      { zh:'第一个：说时间多加了一个「是」。',
        en:'First: adding 是 to a time expression.',
        board:{ t:'rows', rows:[ { mark:'✗', z:'现在是三点。' }, { mark:'✓', z:'现在三点。' } ] } },
      { zh:'第二个：词序。中文的时间放在动词前面。',
        en:'Second: word order. In Chinese, time comes before the verb.',
        board:{ t:'rows', rows:[
          { mark:'✗', z:'见明天下午。' },
          { mark:'✓', z:'明天下午见。', note:{zh:'时间在前，动作在后',en:'time first, action last'} } ] } },
      { zh:'这两点明天开课我还会带一次。今天到这儿。',
        en:'I’ll bring both of these back at the start of tomorrow’s lesson. That’s it for today.' }
    ],
    again:[
      { zh:'两件事：时间别加「是」；时间放在动词前面。',
        en:'Two things: no 是 with time, and time goes before the verb.' }
    ],
    check:{
      q:{zh:'中文里时间词放在动词的哪一边？',en:'Which side of the verb does a time word go on?'},
      opts:[{t:{zh:'前面',en:'Before it'},ok:true},{t:{zh:'后面',en:'After it'}}],
      ok:{zh:'对。明天下午见。',en:'Right: 明天下午见。'},
      no:{zh:'中文是时间在前：明天下午见。英文习惯放后面，这里要改过来。',en:'Chinese puts time first: 明天下午见。English puts it last — that habit has to go.'}
    }
  },

  /* 听力答错时的即时重讲，短，不设段末一问 */
  l0why:{ tag:{zh:'再讲一次',en:'Once more'}, beats:[
    { zh:'再听一次这句：现在八点。数字是八，后面跟着「点」。',
      en:'Listen again: 现在八点. The number is eight, and the word after it is 点.',
      board:{ t:'line', z:'现在八点。', py:'xiànzài bā diǎn.', en:'It’s eight o’clock.', hi:['八','点'] } },
    { zh:'八 + 点，就是八点钟。七和十的音跟八差得很远，你再听会发现。',
      en:'Eight plus 点 means eight o’clock. Seven and ten sound nothing like it — listen once more and you’ll hear it.' } ] },
  l1why:{ tag:{zh:'再讲一次',en:'Once more'}, beats:[
    { zh:'这句是：今天十五号。关键在「十五」。',
      en:'The line is 今天十五号. The key is 十五.',
      board:{ t:'line', z:'今天十五号。', py:'jīntiān shíwǔ hào.', en:'Today is the 15th.', hi:['十','五','号'] } },
    { zh:'十五是 shí wǔ，两个音节。五是 wǔ，一个音节。听音节数就分得开。',
      en:'十五 is shí wǔ — two syllables. 五 alone is one. Counting syllables separates them.' } ] },
  l2why:{ tag:{zh:'再讲一次',en:'Once more'}, beats:[
    { zh:'这句是：明天星期三。星期后面那个数字就是星期几。',
      en:'The line is 明天星期三. The number after 星期 is the weekday.',
      board:{ t:'line', z:'明天星期三。', py:'míngtiān xīngqīsān.', en:'Tomorrow is Wednesday.', hi:['星','期','三'] } },
    { zh:'星期二是 èr，星期三是 sān，星期四是 sì。只差最后一个音。',
      en:'Tuesday is èr, Wednesday sān, Thursday sì. Only the last syllable differs.' } ] }
};

/* ---------- 3. 课时流程：讲解与练习交替 ---------- */
const SEGS = [
  { step:0, kind:'talk',  talk:'t0'  },
  { step:1, kind:'talk',  talk:'t1'  },
  { step:1, kind:'words'             },
  { step:1, kind:'talk',  talk:'t1b' },
  { step:2, kind:'talk',  talk:'t2a' },
  { step:2, kind:'drill', i:0        },
  { step:2, kind:'talk',  talk:'t2b' },
  { step:2, kind:'drill', i:1        },
  { step:3, kind:'talk',  talk:'t3'  },
  { step:3, kind:'listen'            },
  { step:4, kind:'talk',  talk:'t4'  },
  { step:4, kind:'speak'             },
  { step:5, kind:'quiz'              },
  { step:5, kind:'talk',  talk:'t5'  },
  { step:6, kind:'result'            }
];
const STEP_NAMES = [
  {zh:'本课目标',en:'Objective'}, {zh:'生词',en:'Vocabulary'}, {zh:'语法点',en:'Grammar'},
  {zh:'听力',en:'Listening'},     {zh:'跟读与口语',en:'Speaking'}, {zh:'当堂小测',en:'Check'},
  {zh:'结课',en:'Wrap-up'}
];

/* ---------- 4. 板书渲染 ----------
   产出带 bd-* 类名的结构，样式由各端按自己的配色实现               */
function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

const TONE_PATH = {
  1:'M5 9 H43',
  2:'M5 27 L43 7',
  3:'M5 10 Q 14 28 24 28 Q 34 28 43 8',
  4:'M5 7 L43 27',
  0:'M22 17 h4'
};
function toneSVG(n, cls){
  return '<svg class="bd-tc '+(cls||'')+'" viewBox="0 0 48 34" fill="none" stroke="currentColor" '
    + 'stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    + '<path d="'+(TONE_PATH[n]||TONE_PATH[1])+'"/></svg>';
}

/* zh=true 时取中文文案 */
function boardHTML(b, zh){
  if (!b) return '';
  const T = o => !o ? '' : esc(zh ? o.zh : o.en);
  const note = b.note ? '<div class="bd-note">'+T(b.note)+'</div>' : '';
  let inner = '';

  if (b.t === 'list'){
    inner = '<div class="bd-list">' + b.items.map((x,i)=>
      '<div class="bd-item" style="--d:'+(i*90)+'ms"><b>'+esc(x.z)+'</b>'
      + (x.en?'<span>'+esc(x.en)+'</span>':'') + '</div>').join('') + '</div>';
  }

  else if (b.t === 'kv'){
    inner = '<div class="bd-kv">' + b.items.map((x,i)=>
      '<div class="bd-kvr" style="--d:'+(i*90)+'ms"><span>'+esc(x[0])+'</span><b>'+esc(x[1])+'</b></div>'
      ).join('') + '</div>';
  }

  else if (b.t === 'line'){
    const hi = b.hi || [];
    const z = Array.from(String(b.z)).map(ch =>
      hi.indexOf(ch) >= 0 ? '<em>'+esc(ch)+'</em>' : esc(ch)).join('');
    inner = '<div class="bd-line"><div class="bd-z">'+z+'</div>'
      + (b.py?'<div class="bd-py">'+esc(b.py)+'</div>':'')
      + (b.en?'<div class="bd-en">'+esc(b.en)+'</div>':'') + '</div>';
  }

  else if (b.t === 'group'){
    inner = '<div class="bd-groups">' + b.groups.map((g,i)=>
      '<div class="bd-group'+(g.hi?' hi':'')+'" style="--d:'+(i*110)+'ms">'
      + '<div class="bd-gt">'+T(g.title)+'</div><div class="bd-gi">'
      + g.items.map(x=>'<span class="bd-w"><b>'+esc(x.z)+'</b><i>'+esc(x.p)+'</i></span>').join('')
      + '</div></div>').join('') + '</div>';
  }

  else if (b.t === 'slot'){
    inner = '<div class="bd-slot">' + b.cells.map((c,i)=>
      '<span class="bd-cell'+(c.slot?' slot':'')+(c.fill?' fill':'')+'" style="--d:'+(i*90)+'ms">'
      + esc(c.z || '') + '</span>').join('') + '</div>';
  }

  else if (b.t === 'rows'){
    inner = '<div class="bd-rows">' + b.rows.map((r,i)=>
      '<div class="bd-r '+(r.mark==='✓'?'good':r.mark==='✗'?'bad':'neu')+'" style="--d:'+(i*110)+'ms">'
      + '<span class="bd-mark">'+esc(r.mark)+'</span>'
      + '<span class="bd-rz">'+esc(r.z)+(r.note?'<i>'+T(r.note)+'</i>':'')+'</span></div>').join('')
      + '</div>';
  }

  else if (b.t === 'tone'){
    inner = '<div class="bd-tone">' + b.sylls.map((s,i)=>
      '<div class="bd-ts'+(s.morph?' morph':'')+'" style="--d:'+(i*120)+'ms">'
      + toneSVG(s.n) + '<b>'+esc(s.s)+'</b><i>'+esc(s.z)+'</i>'
      + '<u>'+(zh?('第'+['零','一','二','三','四'][s.n]+'声'):('tone '+s.n))+'</u></div>').join('')
      + '</div>';
  }

  return '<div class="bd bd-t-' + b.t + '">' + inner + note + '</div>';
}

/* 没写 dur 时按字数估一个播放时长 */
function beatDur(beat, zh, slow){
  if (beat.dur) return slow ? beat.dur * 1.5 : beat.dur;
  const n = String(zh ? beat.zh : beat.en).length;
  const base = Math.max(2000, Math.min(7200, n * (zh ? 195 : 72) + 700));
  return slow ? base * 1.5 : base;
}

/* ---------- 5. 冒烟测试辅助 ----------
   两端都支持 ?smoke=1：真点一次按钮，再把全部课时段与讲解段走一遍。
   这是为了防止「只截图看单屏、流程其实走不通」那类 bug。          */
function smokeReport(title, log){
  const bad = log.filter(x => x[0] === '\u2717');
  const head = title + ' ' + (bad.length ? ('\u2717 ' + bad.length + ' \u5904\u5931\u8d25') : '\u2713 \u5168\u90e8\u901a\u8fc7')
             + '\n\u5171 ' + log.length + ' \u9879\n\n';
  document.body.insertAdjacentHTML('afterbegin',
    '<pre style="position:fixed;z-index:9999;inset:0;margin:0;padding:22px;background:#fff;color:#141c22;'
    + 'font:13px/1.7 ui-monospace,SFMono-Regular,Menlo,monospace;overflow:auto;white-space:pre-wrap">'
    + head + log.join('\n') + '</pre>');
  return bad.length;
}
function smokeOn(){ try{ return /[?&]smoke=1/.test(location.search); }catch(_){ return false; } }

root.LessonCore = { L15, TALKS, SEGS, STEP_NAMES, boardHTML, toneSVG, beatDur, TEACHERS, teacherById, TONE, toneOf, smokeReport, smokeOn };

})(window);
