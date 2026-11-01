// Cenário fixo do andar, portado da "Planta 3D do escritório": paredes,
// piso, recepção, copa, arquibancada, lounges, salas e armários. É tudo
// estático: depois de montado, estatico.js junta as peças por material.
// As bancadas e cadeiras não estão aqui; vêm de planta/dados.js e são
// desenhadas em moveis.js.
import * as THREE from 'three';
import { LOGO_PNG } from './logo.js';

export function montarCenario(world) {
const W=67, D=41.6;
let seed=7; const rnd=()=>{seed=(seed*16807)%2147483647;return (seed-1)/2147483646;};
const L=(c,o)=>new THREE.MeshLambertMaterial(Object.assign({color:c},o||{}));
const M={
  concrete:L(0xd2cfc9), wood:L(0xb8956a), woodLight:L(0xd6c09c), woodDark:L(0x4e3626),
  white:L(0xf3f3f1), navy:L(0x1b4034), dark:L(0x2a2c31), chair:L(0x2b2d33),
  beige:L(0xb8ab84), sofa:L(0xc9c6c0), cushion:L(0xdedbd5), green:L(0x4d8546), green2:L(0x6a9a4d),
  rug:L(0xbfbab0), rug2:L(0xa69f93), core:L(0xdedcd8), wall:L(0xf1f0ed),
  glass:L(0x9fc4d8,{transparent:true,opacity:.2,depthWrite:false,side:THREE.DoubleSide}),
  smoke:L(0x26303b,{transparent:true,opacity:.6,depthWrite:false}),
  rail:L(0xcfe3ec,{transparent:true,opacity:.35,depthWrite:false}),
  screen:new THREE.MeshBasicMaterial({color:0x2d6fb0}),
  light:new THREE.MeshBasicMaterial({color:0xfdfbf2}),
  exitSign:new THREE.MeshBasicMaterial({color:0x1f9d55}),
  leather:L(0x141518),
  grayWall:L(0xa4a5a8),
  steel:L(0xc3c8cc),
  gold:L(0xc9a227),
  wb:L(0xfafafa), sill:L(0xe8e7e3)
};

const geoCache={};
function bgeo(w,h,d){const k=w+'_'+h+'_'+d;return geoCache[k]||(geoCache[k]=new THREE.BoxGeometry(w,h,d));}
function box(parent,w,h,d,mat,x,y,z,ry,noShadow){
  const m=new THREE.Mesh(bgeo(w,h,d),mat);
  m.position.set(x,y+h/2,z); if(ry) m.rotation.y=ry;
  if(!noShadow){m.castShadow=true;m.receiveShadow=true;}
  parent.add(m); return m;
}
function cyl(parent,r,h,mat,x,y,z,seg){
  const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,seg||20),mat);
  m.position.set(x,y+h/2,z); m.castShadow=true; m.receiveShadow=true; parent.add(m); return m;
}

/* piso */
const floor=new THREE.Mesh(new THREE.BoxGeometry(W,0.1,D),M.concrete);
floor.position.set(W/2,-0.05,D/2); floor.receiveShadow=true; world.add(floor);
{ // grade de 2 m
  const pts=[];
  for(let x=0;x<=W;x+=2){pts.push(x,0.006,0,x,0.006,D);}
  for(let z=0;z<=D;z+=2){pts.push(0,0.006,z,W,0.006,z);}
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));
  world.add(new THREE.LineSegments(g,new THREE.LineBasicMaterial({color:0x000000,transparent:true,opacity:.06})));
}
function patch(x0,z0,x1,z1,mat,y){
  const m=new THREE.Mesh(new THREE.PlaneGeometry(x1-x0,z1-z0),mat);
  m.rotation.x=-Math.PI/2; m.position.set((x0+x1)/2,y||0.01,(z0+z1)/2); m.receiveShadow=true; world.add(m); return m;
}
/* corredor de madeira (faixa curva) */
function ribbon(pts,width,mat,y){
  const curve=new THREE.CatmullRomCurve3(pts.map(p=>new THREE.Vector3(p[0],0,p[1])));
  const n=120, pos=[], idx=[];
  for(let i=0;i<=n;i++){
    const t=i/n, p=curve.getPointAt(t), tg=curve.getTangentAt(t);
    const nx=-tg.z, nz=tg.x;
    pos.push(p.x+nx*width/2,y,p.z+nz*width/2, p.x-nx*width/2,y,p.z-nz*width/2);
    if(i<n){const a=i*2;idx.push(a,a+2,a+1,a+1,a+2,a+3);}
  }
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  g.setIndex(idx); g.computeVertexNormals();
  const m=new THREE.Mesh(g,mat); m.receiveShadow=true; world.add(m);
}
const woodFloor=L(0xb99a72,{side:THREE.DoubleSide});
ribbon([[0.6,13.3],[8,13.4],[13.5,13.2],[17,12.3],[21,11.9],[29,12],[33,11.5],[34.8,8.5],[34.8,3],[34.4,-0.2],[34,-1.6]],2.6,woodFloor,0.012);

/* paredes do perímetro */
box(world,24,3.2,0.3,M.wall,12,0,0.15);
function glassWall(x0,z0,x1,z1){
  const len=Math.hypot(x1-x0,z1-z0), ang=Math.atan2(z1-z0,x1-x0);
  const cx=(x0+x1)/2, cz=(z0+z1)/2;
  box(world,len,0.35,0.25,M.sill,cx,0,cz,-ang);
  const g=box(world,len,2.85,0.04,M.glass,cx,0.35,cz,-ang,true);
  const steps=Math.round(len/2.5);
  for(let i=0;i<=steps;i++){
    const t=i/steps; box(world,0.08,2.85,0.1,M.dark,x0+(x1-x0)*t,0.35,z0+(z1-z0)*t,-ang,true);
  }
}
glassWall(0,D,W,D); glassWall(W,0,W,D); glassWall(0,0.3,0,11.9); glassWall(0,14.7,0,21.5); glassWall(0,23,0,D); // vãos de porta: recepção (na ponta do corredor de madeira) e sala executiva
/* recepção: cômodo vazio a oeste do andar, entre a parede do fundo e a sala executiva */
{
  const x0=-18.5, x1=0, z0=-3.6, z1=16.5;
  // piso com vão para as escadas rolantes
  const hx0=-8.3, hx1=-4.7, hz0=1.9, hz1=8.6;
  const slab=(ax,az,bx,bz)=>{ const f=new THREE.Mesh(new THREE.BoxGeometry(bx-ax,0.1,bz-az),M.concrete); f.position.set((ax+bx)/2,-0.05,(az+bz)/2); f.receiveShadow=true; world.add(f); };
  slab(x0,z0,x1,hz0); slab(x0,hz1,x1,z1); slab(x0,hz0,hx0,hz1); slab(hx1,hz0,x1,hz1);
  const pts=[]; for(let x=x0;x<=x1;x+=2){ if(x>hx0&&x<hx1){pts.push(x,0.006,z0,x,0.006,hz0, x,0.006,hz1,x,0.006,z1);} else pts.push(x,0.006,z0,x,0.006,z1);} for(let z=z0;z<=z1;z+=2){ if(z>hz0&&z<hz1){pts.push(x0,0.006,z,hx0,0.006,z, hx1,0.006,z,x1,0.006,z);} else pts.push(x0,0.006,z,x1,0.006,z);}
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));
  world.add(new THREE.LineSegments(g,new THREE.LineBasicMaterial({color:0x000000,transparent:true,opacity:.06})));
  box(world,x1-x0+.25,3.2,.25,M.wall,(x0+x1)/2,0,z0);
  box(world,-10-x0,3.2,.25,M.wall,(x0-10)/2,0,z1);
  glassWall(x0,z0,x0,z1);
  // balcão de recepção em madeira, do canto norte até perto da sala executiva
  box(world,.9,1.05,14.6,M.woodLight,-10.6,0,3.7);
  box(world,1.1,.05,14.8,M.woodLight,-10.55,1.05,3.7);
  // duas cadeiras de recepcionista atrás do balcão, viradas para o lado das escadas rolantes
  for(const zc of [7.5,4.3]){ const g=new THREE.Group(); g.position.set(-11.7,0,zc); g.rotation.y=-Math.PI/2; chair(g,0,0,1); world.add(g); }
  // duas portas de elevador na parede sul da recepção
  for(const xc of [-7.1,-10.8]){
    box(world,1.4,2.45,.06,M.dark,xc,0,16.34);
    box(world,1.2,2.25,.04,M.steel,xc,0,16.3,0,true);
    box(world,.02,2.25,.02,M.dark,xc,0,16.27,0,true);
    box(world,.3,.1,.03,M.exitSign,xc,2.55,16.33,0,true);
  }
  // lounge da recepção: tapete com 4 poltronas em volta de uma mesa de centro, entre o balcão e a fachada
  { const cx=-15.2, cz=4.45;
    patch(-17.7,0,-12.7,8.9,M.rug,0.016);
    for(const [px,pz] of [[-13.9,7.7],[-16.5,7.7],[-13.9,1.2],[-16.5,1.2]]){
      const g=new THREE.Group(); g.position.set(px,0,pz); g.rotation.y=Math.atan2(px-cx,pz-cz);
      box(g,.9,.42,.85,M.sofa,0,0,0); box(g,.9,.55,.15,M.sofa,0,.42,.35); box(g,.12,.25,.85,M.sofa,-.45,.42,0); box(g,.12,.25,.85,M.sofa,.45,.42,0);
      world.add(g);
    }
    box(world,1.4,.4,2.4,M.woodLight,cx,0,cz);
    planter(-17.9,9.6,1.1);
  }
  // duas escadas rolantes ligando a recepção ao andar de baixo: a do leste chega na recepção, a do oeste sai dela
  { const run=6.5, rise=3, L=Math.hypot(run,rise), ang=-Math.atan2(rise,run);
    // poço do vão
    box(world,3.6,.05,6.7,M.dark,-6.5,-3.05,5.25);
    box(world,.06,3,6.7,M.grayWall,-8.3,-3,5.25); box(world,.06,3,6.7,M.grayWall,-4.7,-3,5.25); box(world,3.6,3,.06,M.grayWall,-6.5,-3,1.9);
    // guarda-corpo de vidro em volta do vão, aberto do lado do embarque
    box(world,.04,1,6.7,M.glass,-8.3,0,5.25,0,true); box(world,.04,1,6.7,M.glass,-4.7,0,5.25,0,true); box(world,3.6,1,.04,M.glass,-6.5,0,1.9,0,true);
    box(world,.08,.05,6.7,M.dark,-8.3,1,5.25); box(world,.08,.05,6.7,M.dark,-4.7,1,5.25); box(world,3.6,.05,.08,M.dark,-6.5,1,1.9);
    for(const [xc,lbl] of [[-7.4,'desce'],[-5.6,'sobe']]){
      const g=new THREE.Group(); g.position.set(xc,0,8.4); world.add(g);
      const add=(geo,mat,x,y,z,shadow)=>{ const m=new THREE.Mesh(geo,mat); m.position.set(x,y,z); m.rotation.x=ang; if(shadow!==false){m.castShadow=true;m.receiveShadow=true;} g.add(m); return m; };
      const cy=-rise/2, cz=-run/2;
      add(new THREE.BoxGeometry(1.0,.08,L),M.steel,0,cy+.05,cz);
      add(new THREE.BoxGeometry(1.3,.5,L),M.dark,0,cy-.24,cz);
      for(let i=1;i<24;i++){ const t=i/24; const st=new THREE.Mesh(bgeo(1.0,.02,.04),M.dark); st.position.set(0,-rise*t+.1,-run*t); g.add(st); }
      for(const sx of [-.6,.6]){
        add(new THREE.BoxGeometry(.03,.9,L),M.glass,sx,cy+.5,cz,false);
        add(new THREE.BoxGeometry(.1,.06,L+.3),M.dark,sx,cy+.97,cz);
      }
      box(g,1.3,.04,1.2,M.steel,0,0,.6);
    }
  }
}


/* colunas e vasos */
function planter(x,z,s){s=s||1;cyl(world,.28*s,.5*s,M.dark,x,0,z);
  const f=new THREE.Mesh(new THREE.IcosahedronGeometry(.48*s,0),M.green); f.position.set(x,.5*s+.42*s,z); f.castShadow=true; world.add(f);
  const f2=new THREE.Mesh(new THREE.IcosahedronGeometry(.32*s,0),M.green2); f2.position.set(x+.15*s,.5*s+.85*s,z-.1*s); f2.castShadow=true; world.add(f2);}
[8,16,24,32,40,48,56].forEach(x=>[15.6,23.8].forEach(z=>{
  if(z<16 && x<=32) planter(x-.95,z-.3);
}));

/* bancadas de trabalho */
function chair(g,x,z,dir){ // dir: +1 cadeira ao sul da mesa, olhando para o norte
  cyl(g,.28,.04,M.chair,x,.05,z,10);
  cyl(g,.03,.38,M.chair,x,.08,z,6);
  box(g,.5,.08,.5,M.chair,x,.44,z);
  box(g,.48,.55,.06,M.chair,x,.55,z+dir*.26);
}
/* núcleo de apoio (não filmado) */
box(world,12.8,3.2,6.7,M.core,20.4,0,3.65);
/* parede cinza no canto noroeste, entre a fachada oeste e o núcleo da copa */
box(world,13.85,3.2,6.7,M.grayWall,7.08,0,3.65);
/* caminho de madeira dentro da ala do fundo, na passagem em frente aos armários de parede */
patch(0.15,-2.4,1.9,0,woodFloor,0.012);
patch(1.9,-2.4,34,-0.6,woodFloor,0.012);
/* logo da EQI na face da parede cinza voltada para o corredor */
{ const tex=new THREE.TextureLoader().load(LOGO_PNG);
  tex.anisotropy=4;
  const lw=5.2, lh=lw*348/640;
  const m=new THREE.Mesh(new THREE.PlaneGeometry(lw,lh),new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false}));
  m.position.set(7.08,1.75,7.02); world.add(m); }
box(world,6.2,3.2,8.7,M.core,29.9,0,4.65);
box(world,.35,3.2,4.2,M.navy,14.2,0,9.1);
/* copa */
box(world,3,.9,.65,M.wood,16.9+1.1,0,7.35);
box(world,3,.8,.38,M.wood,18,1.7,7.2);
box(world,.6,1.9,.6,M.white,15.2+.3,0,7.4);
box(world,.12,3.2,4,M.white,19.6,0,9);
/* duas salas com vidro fumê */
for(const x0 of [19.6,23.2]){
  box(world,.12,3.2,3.6,M.white,x0+3.6,0,8.8);
  box(world,3.6,2.7,.06,M.smoke,x0+1.8,0,10.6,0,true);
  box(world,3.6,.5,.12,M.white,x0+1.8,2.7,10.6);
  box(world,.06,2.7,.1,M.dark,x0+.9,0,10.62); box(world,.06,2.7,.1,M.dark,x0+1.8,0,10.62);
  cyl(world,.5,.04,M.woodLight,x0+1.8,.72,8.8); cyl(world,.05,.72,M.dark,x0+1.8,0,8.8);
  chair(world,x0+1.1,8.8,0); chair(world,x0+2.5,8.8,0);
}
/* armários */
box(world,6,2.3,.6,M.woodLight,29.9,0,9.3);
box(world,6.3,.15,.7,M.navy,29.9,2.3,9.3);
box(world,.15,2.45,.7,M.navy,26.8,0,9.3); box(world,.15,2.45,.7,M.navy,33,0,9.3);
for(let i=1;i<10;i++) box(world,.02,2.3,.02,M.dark,26.9+i*.6,0,9.61,0,true);
/* arquibancada */
for(let i=0;i<4;i++){ // degraus sobem para o oeste, de frente para o lounge dos sofás
  const h=(i+1)*.42, x1=43.5-i*1.75;
  box(world,1.75,h,9.5,M.wood,x1-.875,0,5.65);
  box(world,1.75,1,.04,M.rail,x1-.875,h,0.92,0,true);
}
box(world,.5,.3,9.3,M.green,36.8,1.68,5.65);
// bebedouro industrial em inox, encostado na lateral sul da arquibancada
box(world,.6,1.45,.5,M.steel,37.1,0,10.67);
box(world,.5,.06,.18,M.dark,37.1,.95,10.98);
box(world,.05,.12,.05,M.dark,36.95,1.2,10.94); box(world,.05,.12,.05,M.dark,37.25,1.2,10.94);
// copa embutida na parte de trás da arquibancada, voltada para o corredor:
// armários de madeira em cima, bancada com cafeteiras saindo por baixo deles
box(world,.6,.88,9.4,M.woodLight,36.2,0,5.65);
box(world,.75,.05,9.5,M.wood,36.13,.88,5.65);
box(world,.38,.85,9.4,M.woodLight,36.31,1.35,5.65);
for(let i=1;i<16;i++){ const z=0.95+i*0.5875; box(world,.02,.88,.02,M.dark,35.89,0,z,0,true); box(world,.02,.85,.02,M.dark,36.11,1.35,z,0,true); }
for(const z of [3.2,6.0,8.4]){ box(world,.38,.48,.34,M.dark,36.1,.93,z); box(world,.12,.1,.12,M.white,35.98,.93,z); }
/* praça central */
function roundTable(x,z){
  cyl(world,.6,.04,M.woodLight,x,.72,z,28); cyl(world,.05,.72,M.dark,x,0,z,8); cyl(world,.25,.03,M.dark,x,0,z,12);
  for(let k=0;k<4;k++){
    const a=k*Math.PI/2+Math.PI/4, cxp=x+Math.cos(a)*.95, czp=z+Math.sin(a)*.95;
    const g=new THREE.Group(); g.position.set(cxp,0,czp); g.rotation.y=-a+Math.PI/2;
    box(g,.52,.1,.5,M.beige,0,.42,0);
    box(g,.56,.5,.1,M.beige,0,.5,.24);
    for(const lx of [-.2,.2]) for(const lz of [-.2,.2]) box(g,.04,.42,.04,M.woodDark,lx,0,lz);
    world.add(g);
  }
}
roundTable(37.6,12.3); roundTable(41.3,12.4);
planter(39,14.4,1.3);
/* lounge da escultura oval: palco hexagonal com tapete e poltronas em cima */
{ const cx=51.5, cz=16, R=4.6, h=.25;
  const st=new THREE.Mesh(new THREE.CylinderGeometry(R,R,h,6),M.wood); st.position.set(cx,h/2,cz); st.castShadow=true; st.receiveShadow=true; world.add(st);
  const rug=new THREE.Mesh(new THREE.CylinderGeometry(R*.72,R*.72,.02,6),M.rug); rug.position.set(cx,h+.01,cz); rug.receiveShadow=true; world.add(rug);
  function armchair(x,z,ry){ const g=new THREE.Group(); g.position.set(x,h,z); g.rotation.y=ry;
    box(g,.9,.42,.85,M.sofa,0,0,0); box(g,.9,.55,.15,M.sofa,0,.42,.35); box(g,.12,.25,.85,M.sofa,-.45,.42,0); box(g,.12,.25,.85,M.sofa,.45,.42,0); world.add(g); }
  for(let i=0;i<6;i++){ const a=i*Math.PI/3+Math.PI/6, r=2.35; armchair(cx+Math.sin(a)*r, cz+Math.cos(a)*r, a+Math.PI); }
  cyl(world,.55,.04,M.woodLight,cx,h+.42,cz,6); cyl(world,.05,.42,M.woodDark,cx,h,cz,6);
  planter(cx+R*.86,cz-R*.5+.3,1.1);
}
/* lounge dos sofás, ao lado da arquibancada */
patch(44,0.9,55.6,10.4,M.rug,0.016);
function sofa(x,z,ry){
  const g=new THREE.Group(); g.position.set(x,0,z); g.rotation.y=ry||0;
  box(g,2.3,.42,.9,M.sofa,0,0,0);
  box(g,2.3,.82,.16,M.sofa,0,.42,-.37);
  box(g,.14,.28,.9,M.sofa,-1.08,.42,0); box(g,.14,.28,.9,M.sofa,1.08,.42,0);
  box(g,.7,.4,.14,M.cushion,-.55,.5,-.22); box(g,.7,.4,.14,M.cushion,.55,.5,-.22);
  world.add(g);
}
// um sofá comprido de cada lado, frente a frente
function longSofa(x,z,ry,len){
  const g=new THREE.Group(); g.position.set(x,0,z); g.rotation.y=ry||0;
  box(g,len,.42,.9,M.sofa,0,0,0);
  box(g,len,.82,.16,M.sofa,0,.42,-.37);
  box(g,.14,.28,.9,M.sofa,-len/2+.07,.42,0); box(g,.14,.28,.9,M.sofa,len/2-.07,.42,0);
  const n=Math.round(len/1.1); for(let i=0;i<n;i++) box(g,.75,.4,.14,M.cushion,-len/2+.55+i*(len-1.1)/(n-1),.5,-.22);
  world.add(g);
}
longSofa(49.8,2.6,0,8.4); longSofa(49.8,8.8,Math.PI,8.4);
box(world,4.2,.4,.9,M.woodLight,49.8,0,5.7);
planter(54.9,5.7,1.2); planter(44.6,5.7,1.1);
/* sala executiva: cômodo extra anexo à parede oeste */
{
  const f=new THREE.Mesh(new THREE.BoxGeometry(10,0.1,11.5),M.concrete); f.position.set(-5,-0.05,22.25); f.receiveShadow=true; world.add(f);
  patch(-10,16.5,0,28,woodFloor,0.011);
  patch(-7.8,23.6,-2.2,27.2,M.rug2,0.016);
  box(world,10.25,3.2,.25,M.wall,-5,0,16.5); box(world,10.25,3.2,.25,M.wall,-5,0,28);
  glassWall(-10,16.5,-10,28);
  // armário de prêmios na parede sul, mesa à frente dele; tudo virado para o quadro branco (parede norte)
  box(world,2.4,.06,1.1,M.woodDark,-5,.72,24.9);
  box(world,.08,.72,1.05,M.woodDark,-6.15,0,24.9); box(world,.08,.72,1.05,M.woodDark,-3.85,0,24.9);
  box(world,2.3,.5,.04,M.woodDark,-5,.22,24.38);
  box(world,.55,.34,.03,M.dark,-4.6,.98,25.15); box(world,.06,.2,.06,M.dark,-4.6,.78,25.15);
  // cadeira de couro preto, encosto alto, de costas para o armário e de frente para o quadro
  const g=new THREE.Group(); g.position.set(-5,0,26.1);
  cyl(g,.32,.04,M.chair,0,.05,0,10); cyl(g,.035,.38,M.chair,0,.08,0,6);
  box(g,.62,.14,.6,M.leather,0,.44,0);
  box(g,.6,1.0,.14,M.leather,0,.56,.3);
  box(g,.08,.22,.5,M.leather,-.33,.58,0); box(g,.08,.22,.5,M.leather,.33,.58,0);
  world.add(g);
  // armário decorativo na parede sul, com nichos abertos para prêmios e portas embaixo
  { const z0=27.6, len=5.2, xc=-5, H=2.2;
    box(world,len,H,.05,M.woodDark,xc,0,27.83);
    box(world,len,.6,.45,M.woodDark,xc,0,z0);
    for(let i=1;i<6;i++) box(world,.02,.58,.02,M.wood,xc-len/2+i*len/6,0,z0-.23,0,true);
    for(const y of [.6,1.13,1.66,H-.04]) box(world,len,.04,.45,M.woodDark,xc,y,z0);
    for(let i=0;i<=5;i++) box(world,.04,H-.6,.45,M.woodDark,xc-len/2+i*len/5,.6,z0);
    let k=0;
    for(const y of [.64,1.17,1.70]) for(let i=0;i<5;i++){
      const x=xc-len/2+len/10+i*len/5; k++;
      if(k%3===0) continue;
      if(k%2){ cyl(world,.06,.08,M.gold,x,y,z0,10); cyl(world,.025,.16,M.gold,x,y+.08,z0,8); cyl(world,.11,.12,M.gold,x,y+.24,z0,12); }
      else { box(world,.22,.3,.05,M.gold,x,y,z0-.05); box(world,.26,.04,.1,M.woodDark,x,y,z0-.05); }
    }
  }
  // quadro branco na parede norte
  box(world,3.2,1.2,.04,M.wb,-5,1.0,16.65,0,true);
  box(world,3.3,.05,.12,M.dark,-5,.95,16.7);
  planter(-9.2,17.4,1.2);

}
/* fundo do andar: ala do fundo (vídeo 3), ala do quadro e TV (vídeo 2) e fileira da parede leste.
   Área de x 0 a 67, parede do fundo em z=-20. Bancadas espaçadas a cada ~5 m. */
{
  const f=new THREE.Mesh(new THREE.BoxGeometry(67,0.1,20),M.concrete); f.position.set(33.5,-0.05,-10); f.receiveShadow=true; world.add(f);
  const pts=[]; for(let x=0;x<=66;x+=2){pts.push(x,0.006,-20,x,0.006,0);} for(let z=-20;z<=0;z+=2){pts.push(0,0.006,z,67,0.006,z);}
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));
  world.add(new THREE.LineSegments(g,new THREE.LineBasicMaterial({color:0x000000,transparent:true,opacity:.06})));
}
box(world,.25,3.2,20,M.wall,0,0,-10);
box(world,67.25,3.2,.25,M.wall,33.5,0,-20);
box(world,.25,3.2,20,M.wall,67,0,-10);
// no lugar da parede entre a ala do fundo e a ala do quadro e TV: armário de madeira na metade da altura, portas dos dois lados
box(world,.5,1.6,13,M.woodLight,50.2,0,-13.5);
box(world,.54,.06,13.04,M.navy,50.2,1.6,-13.5);
for(let i=1;i<22;i++){ const z=-20+i*(13/22); box(world,.02,1.6,.02,M.dark,49.94,0,z,0,true); box(world,.02,1.6,.02,M.dark,50.46,0,z,0,true); }
function yColumn(x,z){ box(world,.6,2.7,.6,M.white,x,0,z); box(world,.6,.5,2.2,M.white,x,2.7,z); }
/* ala do fundo: 2 fileiras de 7 bancadas, a cada 5 m; passagem livre junto à copa (z de -2,5 a 0) */
box(world,24.8,1.1,.5,M.white,13.4,0,-19.6); box(world,10,1.1,.5,M.white,44,0,-19.6);
for(let i=1;i<48;i++){ const x=1+i; if(x>25.7&&x<39.1) continue; box(world,.02,1.1,.02,M.dark,x,0,-19.34,0,true); }
/* saída do andar, junto à parede do fundo */
box(world,12.8,3.2,9.78,M.core,32.4,0,-14.99);
box(world,1.4,2.2,.06,M.dark,36.9,0,-10.07);
box(world,.7,.25,.04,M.exitSign,36.9,2.35,-10.06,0,true);
/* três salas fechadas iguais às da copa, frente de vidro fumê para o sul */
function room(x0,w,zb,zf){
  const d=zf-zb, zm=(zb+zf)/2, xm=x0+w/2;
  box(world,w,3.2,.12,M.white,xm,0,zb);
  box(world,.12,3.2,d,M.white,x0,0,zm); box(world,.12,3.2,d,M.white,x0+w,0,zm);
  box(world,w,2.7,.06,M.smoke,xm,0,zf,0,true);
  box(world,w,.5,.12,M.white,xm,2.7,zf);
  box(world,.06,2.7,.1,M.dark,x0+w*.3,0,zf+.02); box(world,.06,2.7,.1,M.dark,x0+w*.55,0,zf+.02);
  cyl(world,.5,.04,M.woodLight,xm,.72,zm); cyl(world,.05,.72,M.dark,xm,0,zm);
  chair(world,xm-.7,zm,0); chair(world,xm+.7,zm,0);
}
room(26,3,-9.9,-6.3); room(29,3,-9.9,-6.3); room(32,3,-9.9,-6.3);
/* armários de madeira entre a 2ª e a 3ª coluna de bancadas da ala do fundo, da parede do fundo até a 2ª fileira */
box(world,.5,1.4,14.1,M.woodLight,11,0,-12.3);
box(world,.54,.06,14.14,M.navy,11,1.4,-12.3);
for(let i=1;i<24;i++){ const z=-19.35+i*0.5875; box(world,.02,1.4,.02,M.dark,10.74,0,z,0,true); box(world,.02,1.4,.02,M.dark,11.26,0,z,0,true); }
/* armários de parede ao longo da passagem, encostados na copa e na parede sul da ala do fundo */
box(world,30.3,2.3,.6,M.woodLight,17.75,0,-0.3);
box(world,30.5,.12,.66,M.navy,17.75,2.3,-0.3);
for(let i=1;i<54;i++){ const x=0.3+i*0.6; if(x>2.65) box(world,.02,2.3,.02,M.dark,x,0,-0.61,0,true); }
// bebedouro industrial em inox, no início dos armários de parede, ao lado da passagem
box(world,.6,1.45,.5,M.steel,2.2,0,-0.27);
box(world,.5,.06,.18,M.dark,2.2,.95,-0.58);
box(world,.05,.12,.05,M.dark,2.05,1.2,-0.54); box(world,.05,.12,.05,M.dark,2.35,1.2,-0.54);
/* ala do quadro e TV: 2 fileiras a 4,6 m, com 2,2 m livres até a fileira da parede leste (mesmo vão da ala do fundo) — 5 lugares de cada lado junto ao quadro, 4 perto da passagem */
box(world,6.5,1.25,.04,M.wb,54.15,.95,-19.85,0,true);
/* TVs de parede: uma na ponta de cada bancada encostada em parede sólida */
function tvBack(x){ box(world,1.25,.72,.06,M.dark,x,1.45,-19.82); box(world,1.12,.62,.02,M.screen,x,1.5,-19.78,0,true); }
function tvEast(z){ box(world,.06,.72,1.25,M.dark,66.85,1.45,z); box(world,.02,.62,1.12,M.screen,66.8,1.5,z,0,true); }
// só na parede leste e na fachada sul: uma TV na ponta de cada bancada
function tvSouth(x){ box(world,1.25,.72,.06,M.dark,x,1.45,D-.16); box(world,1.12,.62,.02,M.screen,x,1.5,D-.2,0,true); }
[-18.2,-13.2,-8.2,-3.2,1.8,6.8,11.8].forEach(tvEast);
for(let i=0;i<10;i++) tvSouth(3.5+i*60/9);
// TV na fachada oeste, logo ao sul da sala executiva, virada para dentro do andar
box(world,.06,.72,1.25,M.dark,0.16,1.45,29.8); box(world,.02,.62,1.12,M.screen,0.2,1.5,29.8,0,true);
/* armário alto de duas portas na parede leste, entre as duas primeiras bancadas */
box(world,.5,2,1.1,M.woodLight,66.6,0,-15.7);
box(world,.02,1.96,.02,M.dark,66.34,.02,-15.7,0,true);
box(world,.03,.22,.03,M.dark,66.33,.95,-15.82,0,true); box(world,.03,.22,.03,M.dark,66.33,.95,-15.58,0,true);
/* parede leste: 7 bancadas padrão (5 lugares de cada lado), a cada 5 m, começando junto à parede do fundo */
/* quadro branco na parede norte, atrás do lado norte da 1ª bancada da zona Leste */
box(world,6.6,1.25,.04,M.wb,63.35,.95,-19.85,0,true);
box(world,6.7,.05,.1,M.steel,63.35,.9,-19.82); box(world,6.7,.05,.1,M.steel,63.35,2.2,-19.82);
box(world,.05,1.35,.1,M.steel,60.03,.9,-19.82); box(world,.05,1.35,.1,M.steel,66.67,.9,-19.82);


/* sem linhas de grade no piso */
world.children.filter(o=>o.isLineSegments).forEach(o=>world.remove(o));
return { M, chair, planter };
}
