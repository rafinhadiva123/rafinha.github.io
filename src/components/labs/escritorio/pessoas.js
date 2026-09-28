// Os 15 lugares do escritório e onde cada um senta, em metros.
// 01-05 Mesa 1 lado A · 06-10 Mesa 1 lado B (de frente) · 11-15 Mesa 2
// status: mesa | call | cafe | reuniao | home
// cabelo: careca | curto | medio | longo | coque | chanel | topete | baguncado

export const PESSOAS = [
  /* --- MESA 1 · LADO A --- */
  {nome:"Gabriel Scarlatelli", cargo:"", status:"mesa", agora:"Na mesa.", pele:"#EFCDB0", cabelo:"curto",  cor:"#4A3322", camisa:"#3E5A7A", barba:"barbinha"},
  {nome:"André Shimono",       cargo:"", status:"mesa", agora:"Na mesa.", pele:"#F0D3B4", cabelo:"curto",  cor:"#15110F", camisa:"#F4F3EF", social:true, olhos:"puxados"},
  {nome:"Formiga",             cargo:"", status:"mesa", agora:"Na mesa.", pele:"#EAC6A6", cabelo:"curto",  cor:"#3A2A1E", camisa:"#4E7A5E", altura:1.09},
  {nome:"Marlin",              cargo:"", status:"mesa", agora:"Na mesa.", pele:"#EFCDB0", cabelo:"curto",  cor:"#D2B06E", camisa:"#4C5B4A", barba:"cheia", oculos:"normal"},
  {nome:"Matias",              cargo:"", status:"mesa", agora:"Na mesa.", pele:"#F2D4BA", cabelo:"curto",  cor:"#6B4A2E", camisa:"#33373C", altura:.93},

  /* --- MESA 1 · LADO B (de frente para o lado A) --- */
  {nome:"João",                cargo:"", status:"mesa", agora:"Na mesa.", pele:"#EDC9A9", cabelo:"curto",  cor:"#3B2A1D", camisa:"#6D7B8C", barba:"cheia", oculos:"normal"},
  {nome:"Higuinho",            cargo:"", status:"mesa", agora:"Na mesa.", pele:"#F0CFB2", cabelo:"curto",  cor:"#1E1712", camisa:"#B08A3E", oculos:"normal"},
  {nome:"Erik",                cargo:"", status:"mesa", agora:"Na mesa.", pele:"#F1D1B6", cabelo:"careca", cor:"#CDAA6E", camisa:"#2C3E50"},
  {nome:"Wendel",              cargo:"", status:"mesa", agora:"Na mesa.", pele:"#E9C4A2", cabelo:"curto",  cor:"#2B1E15", camisa:"#C4633F"},
  {nome:"Elton",               cargo:"", status:"mesa", agora:"Na mesa. Ou em algum lugar atrás da pilha de papel.", acumulador:true, pele:"#EFCCAE", cabelo:"curto",  cor:"#3E2B1D", camisa:"#4A5A6E"},

  /* --- MESA 2 · lado único (o outro lado é parede) --- */
  {nome:"Heitor",              cargo:"", status:"mesa", agora:"Na mesa.", pele:"#EBC7A7", cabelo:"topete", cor:"#5C3A22", camisa:"#3F4A5A"},
  {nome:"Sem sangue",          cargo:"", status:"mesa", agora:"Na mesa.", pele:"#F7E4D5", cabelo:"baguncado", cor:"#121010", camisa:"#B5B1A8", oculos:"redondo"},
  {nome:"Rafa",                cargo:"Analista de Dados · RH", status:"mesa", agora:"Desenhando um simulador do próprio escritório.",
                               pele:"#F1D2B8", cabelo:"medio",  cor:"#3A2517", camisa:"#2F6F5E", altura:.9, laco:"#E98AB0", mulher:true},
  {nome:"Lika",                cargo:"", status:"mesa", agora:"Na mesa.", pele:"#F2D6BC", cabelo:"coque",  cor:"#120E0C", camisa:"#8E5B7A", olhos:"puxados", mulher:true},
  {nome:"Jana",                cargo:"", status:"mesa", agora:"Na mesa.", pele:"#F0D0B4", cabelo:"chanel", cor:"#141112", camisa:"#3D5C46", mulher:true}
];
export const N = PESSOAS.length;
export const MESAS = [
  {nome:"Mesa 1", A:[0,1,2,3,4], B:[5,6,7,8,9]},
  {nome:"Mesa 2", A:[10,11,12,13,14], B:[], parede:true}
];
export const STATUS = {
  mesa:{rot:"Na mesa", cls:""}, call:{rot:"Em call", cls:"call"},
  cafe:{rot:"No cafezinho", cls:"fora"}, reuniao:{rot:"Em reunião", cls:"fora"},
  home:{rot:"Home office", cls:"fora"}
};
export const FORA = s => s === "cafe" || s === "reuniao" || s === "home";

export const COLS = [-2.8, -1.4, 0, 1.4, 2.8];
/* quem senta no lado A olha para +z; no lado B, para -z */
export const LUGAR = [];
MESAS[0].A.forEach((i,k) => LUGAR[i] = {x:COLS[k], z:-2.45, giro:0});          /* olha para +z */
MESAS[0].B.forEach((i,k) => LUGAR[i] = {x:COLS[k], z:0.45,  giro:Math.PI});    /* olha para -z */
MESAS[1].A.forEach((i,k) => LUGAR[i] = {x:COLS[k], z:2.55,  giro:0});          /* olha para +z (parede) */

