// Que palmeira é você? Teste de personalidade: 10 perguntas, 10 palmeiras.
// Telas: intro, perguntas, desempate (só se precisar), resultado e galeria.
// Redesenha o painel com innerHTML, igual ao Ateliê de Notas.
import { PALMS, QS, FOTOS } from './dados.js'

const byId = Object.fromEntries(PALMS.map(p => [p.id, p]));
const STYLE = {
  imp:{c:'#1f6b47',leaf:'#1f6b47',trunk:'#b9b2a4'}, tam:{c:'#a9691a',leaf:'#4f6b2a',trunk:'#9b7b4f'},
  pal:{c:'#5b3a82',leaf:'#2f6a4a',trunk:'#8b8575'}, rab:{c:'#c0551f',leaf:'#2e7a3f',trunk:'#a7a29a'},
  gar:{c:'#2c7b86',leaf:'#2f7a52',trunk:'#a49a8c'}, tri:{c:'#2a62a8',leaf:'#2d7a58',trunk:'#9c9486'},
  bar:{c:'#8a5527',leaf:'#3c7a34',trunk:'#a98c68'}, are:{c:'#a88a10',leaf:'#4c8a2e',trunk:'#d3b441'},
  was:{c:'#5a7a1e',leaf:'#4a7a22',trunk:'#a8a091'}, bat:{c:'#bb2438',leaf:'#2a7a3a',trunk:'#c43a44'}
};

/* ---------- desenho das palmeiras (SVG gerado) ---------- */
const rad = d => d*Math.PI/180, F = p => p[0].toFixed(1)+' '+p[1].toFixed(1);
const bez = (a,b,c,t) => { const u=1-t; return [u*u*a[0]+2*u*t*b[0]+t*t*c[0], u*u*a[1]+2*u*t*b[1]+t*t*c[1]]; };
const tan = (a,b,c,t) => [2*(1-t)*(b[0]-a[0])+2*t*(c[0]-b[0]), 2*(1-t)*(b[1]-a[1])+2*t*(c[1]-b[1])];
function pinnate(cx,cy,a,len,o,col,rcol){
  const A=rad(a), lift=(o.lift??.35)*len, droop=o.droop??20;
  const P0=[cx,cy], P1=[cx+Math.cos(A)*len*.55, cy+Math.sin(A)*len*.55-lift], P2=[cx+Math.cos(A)*len, cy+Math.sin(A)*len+droop];
  let lv=''; const n=o.n||14;
  for(let i=0;i<n;i++){
    const t=.14+.84*i/(n-1), B=bez(P0,P1,P2,t), T=tan(P0,P1,P2,t), ta=Math.atan2(T[1],T[0]);
    const size=o.ll*(.35+.65*Math.sin(Math.PI*Math.min(1,t*.95+.05)));
    for(const s of [-1,1]) for(const k of (o.bushy?[1,.55,.1]:[1])){
      const la=ta+s*rad(o.la)*k;
      lv+=`M${F(B)}l${(Math.cos(la)*size).toFixed(1)} ${(Math.sin(la)*size+(o.sag||0)*size*.5).toFixed(1)}`;
    }
  }
  return `<path d="M${F(P0)}Q${F(P1)} ${F(P2)}" stroke="${rcol||col}" stroke-width="2.2" fill="none"/><path d="${lv}" stroke="${col}" stroke-width="${o.w||1.3}" fill="none"/>`;
}
function fan(cx,cy,a,pet,r,spread,n,col){
  const A=rad(a), ex=cx+Math.cos(A)*pet, ey=cy+Math.sin(A)*pet; let ribs='',tips=[];
  for(let i=0;i<n;i++){ const th=rad(a-spread/2+spread*i/(n-1)); const tp=[ex+Math.cos(th)*r, ey+Math.sin(th)*r]; tips.push(tp); ribs+=`M${F([ex,ey])}L${F(tp)}`; }
  const poly=`M${F([ex,ey])}`+tips.map(t=>'L'+F(t)).join('')+'Z';
  return `<path d="M${cx} ${cy}L${F([ex,ey])}" stroke="${col}" stroke-width="2" fill="none"/><path d="${poly}" fill="${col}" fill-opacity=".22" stroke="${col}" stroke-width="1.1" stroke-linejoin="round"/><path d="${ribs}" stroke="${col}" stroke-width=".9" fill="none"/>`;
}
const trunkP = (d,s) => `<path d="${d}" fill="${s.trunk}" fill-opacity=".85" stroke="#04202a" stroke-opacity=".55" stroke-width="1.2" stroke-linejoin="round"/>`;
const rings = (x1,x2,y1,y2,step,col='#04202a') => { let d=''; for(let y=y1;y<y2;y+=step) d+=`M${x1} ${y}q${(x2-x1)/2} 3 ${x2-x1} 0`; return `<path d="${d}" stroke="${col}" stroke-opacity=".4" stroke-width="1" fill="none"/>`; };
function crown(cx,cy,angs,len,o,s,rcol){ return angs.map((a,i)=>pinnate(cx,cy,a,len*(o.vary?(1-.1*(i%2)):1),o,s.leaf,rcol)).join(''); }

const DRAW = {
  imp:s=>trunkP('M90 262C94 240 95 200 95.5 100L104.5 100C105 200 106 240 110 262Z',s)+rings(95,105,110,255,14)
    +`<path d="M94 100L94 80Q100 75 106 80L106 100Z" fill="${s.leaf}" fill-opacity=".55" stroke="#04202a" stroke-opacity=".5" stroke-width="1.1"/>`
    +crown(100,80,[-170,-145,-118,-90,-62,-35,-10,-178,-2],64,{droop:30,lift:.3,ll:20,la:60,sag:.5,n:14,vary:1},s),
  tam:s=>trunkP('M84 262C90 240 92 190 93 132L107 132C108 190 110 240 116 262Z',s)
    +(()=>{let d='';for(let y=142;y<255;y+=13)d+=`M93 ${y}l7 6l7-6`;return `<path d="${d}" stroke="#04202a" stroke-opacity=".45" fill="none" stroke-width="1"/>`})()
    +crown(100,130,[-165,-140,-115,-90,-65,-40,-15,-178,-2],68,{droop:8,lift:.42,ll:16,la:34,sag:.1,n:16,w:1.5},s)
    +[[90,142],[94,147],[88,150],[110,142],[106,148],[112,151]].map(p=>`<circle cx="${p[0]}" cy="${p[1]}" r="2.4" fill="#c9701f"/>`).join(''),
  pal:s=>trunkP('M96 262C97 220 98 160 98.5 112L103 112C103.5 160 104 220 105 262Z',s)+rings(98,104,126,255,10)
    +`<path d="M98 112L98.5 94Q100.5 91 103 94L103 112Z" fill="#5b3a82" fill-opacity=".7" stroke="#04202a" stroke-opacity=".5" stroke-width="1"/>`
    +crown(100.5,94,[-168,-140,-115,-90,-65,-40,-12,-178],66,{droop:42,lift:.28,ll:17,la:72,sag:.8,n:14,vary:1},s)
    +[[96,106],[100,110],[104,106],[98,115],[102,114],[100,121],[97,123],[104,122]].map(p=>`<circle cx="${p[0]}" cy="${p[1]}" r="2.5" fill="#3b1f5e"/>`).join(''),
  rab:s=>trunkP('M91 262C95 230 96 170 96.5 118L103.5 118C104 170 105 230 109 262Z',s)+rings(96,104,128,255,10)
    +`<path d="M96 118L96 100Q100 96 104 100L104 118Z" fill="${s.leaf}" fill-opacity=".4" stroke="#04202a" stroke-opacity=".5" stroke-width="1"/>`
    +crown(100,100,[-165,-138,-112,-90,-68,-42,-15],66,{droop:26,lift:.38,ll:15,la:52,sag:.3,n:17,bushy:1,w:1.1},s),
  gar:s=>trunkP('M66 262C60 236 76 208 90 176C96 160 97 142 98 128L102 128C103 142 104 160 110 176C124 208 140 236 134 262Z',s)+rings(88,112,150,180,12)
    +crown(100,126,[-160,-125,-90,-55,-20,-176],52,{droop:24,lift:.3,ll:14,la:60,sag:.6,n:12},s),
  tri:s=>`<path d="M100 22L30 150L170 150Z" fill="none" stroke="${s.leaf}" stroke-opacity=".4" stroke-dasharray="4 5" stroke-width="1.2"/>`
    +trunkP('M88 262C92 240 93 200 94 152L106 152C107 200 108 240 112 262Z',s)+rings(94,106,162,255,13)
    +crown(100,150,[-108,-72,-135,-45,-160,-20],62,{droop:6,lift:.5,ll:15,la:36,sag:0,n:15,w:1.4},s),
  bar:s=>trunkP('M92 262C92 242 77 226 76 195C75 165 90 150 93 128L107 128C110 150 125 165 124 195C123 226 108 242 108 262Z',s)+rings(80,120,160,230,16)
    +[-168,-135,-105,-75,-45,-12].map(a=>fan(100,126,a,22,30,66,9,s.leaf)).join(''),
  are:s=>[[82,60,128],[91,80,100],[100,100,84],[109,120,100],[118,140,128]].map(([bx,tx,ty])=>{
      const mx=(bx+tx)/2, my=(262+ty)/2;
      return `<path d="M${bx} 262Q${mx} ${my+6} ${tx} ${ty}" stroke="${s.trunk}" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M${bx} 262Q${mx} ${my+6} ${tx} ${ty}" stroke="#04202a" stroke-opacity=".35" stroke-width="1" fill="none" stroke-dasharray="1 9"/>`
      +[-150,-110,-70,-30].map(a=>pinnate(tx,ty,a,36,{droop:20,lift:.25,ll:11,la:60,sag:.6,n:8,w:1.1},s.leaf)).join('');}).join(''),
  was:s=>trunkP('M95.5 262C96.5 200 97 140 97.5 92L103.5 92C103.5 140 104 200 104.5 262Z',s)+rings(97,104,150,255,12)
    +(()=>{let d='';for(let i=0;i<13;i++){const dx=-22+i*3.7, y=96+(i%3)*4;d+=`M${100+dx*.25} ${y}L${100+dx} ${146+((i*7)%3)*5}`;}return `<path d="${d}" stroke="#7a5a2c" stroke-width="2" stroke-linecap="round" fill="none"/>`})()
    +[-175,-150,-125,-100,-80,-55,-30,-5].map(a=>fan(100,90,a,20,30,58,8,s.leaf)).join(''),
  bat:s=>[[94,74,132],[100,100,98],[106,128,140]].map(([bx,tx,ty])=>{
      const mx=(bx+tx)/2, my=(262+ty)/2;
      return `<path d="M${bx} 262Q${mx} ${my+8} ${tx} ${ty}" stroke="${s.trunk}" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M${bx} 262Q${mx} ${my+8} ${tx} ${ty}" stroke="#04202a" stroke-opacity=".3" stroke-width="1" fill="none" stroke-dasharray="1 8"/>`
      +[-165,-125,-90,-55,-15].map(a=>pinnate(tx,ty,a,44,{droop:24,lift:.3,ll:13,la:58,sag:.5,n:9,w:1.2},s.leaf,'#bb2438')).join('');}).join('')
};
function palmSVG(id,{vb='0 0 200 270',label=''}={}){
  const s=STYLE[id];
  return `<svg viewBox="${vb}" role="img" aria-label="${label||'Ilustração: '+byId[id].nome}" stroke-linecap="round" fill="none">${DRAW[id](s)}<path d="M52 262H148" stroke="#04202a" stroke-opacity=".5" stroke-width="1.2"/></svg>`;
}
function visual(id,svgOpts){
  const f=FOTOS[id], svg=palmSVG(id,svgOpts||{});
  if(!f||!f.src) return svg;
  return `<span class="ph"><img src="${f.src}" style="object-position:${f.pos||'50% 50%'}" alt="Foto: ${byId[id].nome}" loading="lazy" onerror="this.parentNode.classList.add('bad')"><span class="fb">${svg}</span></span>`;
}

const shuffle = a => { a=a.slice(); for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; };

export function iniciar(raiz){
  /* ---------- estado e lógica ---------- */
  const st = { screen:'intro', qi:0, ans:[], order:[], tieOpts:null, winner:null, shared:false, toast:'' };

  function tally(ans){
    // chave = pontos*16 + acertos primários (desempate). Primária = 2 pts; secundária = 1 pt.
    const pts=Object.fromEntries(PALMS.map(p=>[p.id,0])), prim=Object.fromEntries(PALMS.map(p=>[p.id,0]));
    ans.forEach((j,qi)=>{ const o=QS[qi].o[j]; pts[o.p]+=2; prim[o.p]+=1; pts[o.s]+=1; });
    const rows=PALMS.map(p=>({id:p.id, pts:pts[p.id], prim:prim[p.id], key:pts[p.id]*16+prim[p.id]}));
    rows.sort((a,b)=>b.key-a.key);
    return rows;
  }
  function finish(){
    const rows=tally(st.ans), top=rows.filter(r=>r.key===rows[0].key);
    if(top.length>1){ st.tieOpts=shuffle(top).slice(0,3).map(r=>r.id); st.screen='tie'; }
    else { st.winner=rows[0].id; st.screen='result'; }
    render();
  }
  function start(){ st.screen='quiz'; st.qi=0; st.ans=[]; st.winner=null; st.tieOpts=null; st.shared=false; st.fromGallery=false; st.order=QS.map(q=>shuffle([0,1,2,3,4])); try{ if(location.hash) history.replaceState(null,'',location.pathname+location.search); }catch(e){} render(); }
  function choose(j){ st.ans[st.qi]=j; if(st.qi<QS.length-1){ st.qi++; render(); } else finish(); }
  function back(){ if(st.qi>0){ st.qi--; st.ans.length=st.qi; render(); } }
  function pickTie(id){ st.winner=id; st.screen='result'; render(); }
  function openPalm(id){ st.winner=id; st.shared=true; st.screen='result'; st.fromGallery=true; render(); }
  function share(){
    const p=byId[st.winner]; let base=''; try{ base=location.href.split('#')[0]; }catch(e){} const url=base+'#palmeira='+p.id;
    const text=`Fiz o teste e sou ${p.nome}: ${p.tagline}. Qual palmeira é você?`;
    const done=m=>{ st.toast=m; render(false); setTimeout(()=>{ st.toast=''; render(false); },2600); };
    if(navigator.share){ navigator.share({title:'Que palmeira é você?',text,url}).catch(()=>{}); return; }
    const full=text+' '+url;
    (navigator.clipboard?navigator.clipboard.writeText(full):Promise.reject()).then(()=>done('Texto copiado!')).catch(()=>{
      const ta=document.createElement('textarea'); ta.value=full; document.body.appendChild(ta); ta.select();
      try{ document.execCommand('copy'); done('Texto copiado!'); }catch(e){ done('Não consegui copiar. Link: '+url); }
      ta.remove();
    });
  }

  /* ---------- telas ---------- */
  function introHTML(){
    return `<section class="screen">
      <div class="hero">
        <div style="display:flex;flex-direction:column;gap:16px">
          <span class="eyebrow">Teste de personalidade</span>
          <p class="lede">São 10 perguntas rápidas e 10 palmeiras possíveis, da imperial à palmeira batom. No final, você descobre qual delas combina com o seu jeito, com direito a um fato botânico de verdade.</p>
          <div class="row"><button class="btn" id="go">Começar o teste</button><button class="link" id="gal">Conhecer as 10 palmeiras</button></div>
        </div>
        <div class="art" aria-hidden="true">${['imp','bar','was','bat'].map(id=>`<span>${palmSVG(id)}</span>`).join('')}</div>
      </div>
    </section>`;
  }
  function quizHTML(){
    const q=QS[st.qi], ord=st.order[st.qi];
    return `<section class="screen" aria-labelledby="qt">
      <div class="progress" role="img" aria-label="Pergunta ${st.qi+1} de ${QS.length}">${QS.map((_,i)=>`<i class="${i<=st.qi?'on':''}"></i>`).join('')}</div>
      <span class="step">Pergunta ${st.qi+1} de ${QS.length}</span>
      <h2 id="qt">${q.q}</h2>
      <ul class="opts">${ord.map((j,k)=>`<li><button class="opt" data-j="${j}"><span class="n">${k+1}</span><span>${q.o[j].x}</span></button></li>`).join('')}</ul>
      <div class="row">${st.qi>0?'<button class="link" id="back">← Voltar</button>':''}<button class="link" id="restart">Recomeçar</button></div>
    </section>`;
  }
  function tieHTML(){
    return `<section class="screen" aria-labelledby="qt">
      <span class="step">Desempate</span>
      <h2 id="qt">Empatou! Qual destas frases soa mais como você hoje?</h2>
      <p class="lede">Suas respostas combinaram com mais de uma palmeira. Escolha a frase que mais bate.</p>
      <ul class="opts">${st.tieOpts.map((id,k)=>`<li><button class="opt tie" data-id="${id}"><span class="nm" style="color:${STYLE[id].c}">${byId[id].tagline}</span></button></li>`).join('')}</ul>
    </section>`;
  }
  function resultHTML(){
    const p=byId[st.winner], s=STYLE[p.id];
    let rows=null, also='';
    if(!st.shared){
      rows=tally(st.ans); rows.sort((a,b)=>(b.id===p.id)-(a.id===p.id)); const rest=rows.filter(r=>r.id!==p.id);
      also=`<h3 class="sec-title">Você também tem um pouco de…</h3><div class="also">${rest.slice(0,2).map(r=>`<button class="chip" data-open="${r.id}" style="--c:${STYLE[r.id].c}">${palmSVG(r.id,{vb:'30 40 140 230'})}<span class="nm">${byId[r.id].nome}</span></button>`).join('')}</div>`;
    }
    const bars=rows?`<h3 class="sec-title">Quanto você combina com cada palmeira</h3><ul class="bars" aria-label="Afinidade com cada palmeira">${rows.map(r=>`<li style="--c:${STYLE[r.id].c}"><span class="nm">${byId[r.id].nome}</span><span class="track"><span class="fill" style="width:${Math.round(r.pts/15*100)}%"></span></span><span class="pc">${Math.round(r.pts/15*100)}%</span></li>`).join('')}</ul>`:'';
    return `<section class="screen" style="--c:${s.c}">
      ${st.shared?`<span class="eyebrow">${st.fromGallery?'Conheça as palmeiras':'Alguém te mandou este resultado'}</span>`:'<span class="eyebrow">Seu resultado</span>'}
      <div class="res-hero">
        <div class="art ${FOTOS[p.id]&&FOTOS[p.id].src?'has-photo':''}">${visual(p.id)}</div>
        <div class="who"><span class="tag">${st.shared?'Palmeira':'Você é a'}</span><h2 class="nome">${p.nome}</h2><p class="sci">${p.sci}</p><p class="tl">${p.tagline}</p><p class="fact-in"><b>Fato botânico</b>${p.fato}</p></div>
      </div>
      <div class="topics">${p.topicos.map(t=>`<article class="topic"><h3>${t.t}</h3><p>${t.x}</p></article>`).join('')}</div>
      ${also}${bars}
      <div class="row">
        ${st.shared?'<button class="btn" id="go">Descobrir a minha</button><button class="btn ghost" id="gal">Ver todas</button>':'<button class="btn" id="share">Compartilhar resultado</button><button class="btn ghost" id="go">Refazer o teste</button><button class="btn ghost" id="gal">Ver todas as palmeiras</button>'}
        ${st.toast?`<span class="toast" role="status">${st.toast}</span>`:''}
      </div>
    </section>`;
  }
  function galleryHTML(){
    return `<section class="screen"><span class="eyebrow">Galeria</span><h2>As 10 palmeiras</h2>
      <p class="lede">Toque numa palmeira para ver a descrição completa.</p>
      <div class="gallery">${PALMS.map(p=>`<button class="gcard" data-open="${p.id}" style="--c:${STYLE[p.id].c}">${visual(p.id,{vb:'30 20 140 250'})}<span><span class="nm">${p.nome}</span><span class="ds">${p.tagline}</span></span></button>`).join('')}</div>
      <div class="row"><button class="btn" id="go">Fazer o teste</button><button class="link" id="home">← Início</button></div></section>`;
  }

  function render(focus=true){
    const app=raiz.querySelector('[data-app]');
    app.innerHTML = st.screen==='intro'?introHTML() : st.screen==='quiz'?quizHTML() : st.screen==='tie'?tieHTML() : st.screen==='gallery'?galleryHTML() : resultHTML();
    const $=sel=>app.querySelector(sel), $$=sel=>app.querySelectorAll(sel);
    $$('.opt[data-j]').forEach(b=>b.addEventListener('click',()=>choose(+b.dataset.j)));
    $$('.opt[data-id]').forEach(b=>b.addEventListener('click',()=>pickTie(b.dataset.id)));
    $$('[data-open]').forEach(b=>b.addEventListener('click',()=>openPalm(b.dataset.open)));
    [['#go',start],['#back',back],['#restart',()=>{st.screen='intro';render();}],['#share',share],['#home',()=>{st.screen='intro';render();}],['#gal',()=>{st.screen='gallery';render();}]].forEach(([s,fn])=>{ const el=$(s); if(el) el.addEventListener('click',fn); });
    if(focus){ window.scrollTo({top:0}); const h=app.querySelector('h2'); if(h){ h.setAttribute('tabindex','-1'); h.focus({preventScroll:true}); } }
  }
  document.addEventListener('keydown',e=>{
    if(st.screen!=='quiz'||e.metaKey||e.ctrlKey||e.altKey) return;
    const k=parseInt(e.key,10); if(k>=1&&k<=5){ choose(st.order[st.qi][k-1]); }
  });
  const m=location.hash.match(/palmeira=(\w+)/);
  if(m&&byId[m[1]]){ st.winner=m[1]; st.shared=true; st.screen='result'; }
  render(false);
}
