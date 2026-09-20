// Gera favicon.ico, favicon-16/32.png, apple-touch-icon.png e icon-192/512.png
// a partir de icone.png (na raiz do repositório) e escreve tudo em public/.
//
// Não entra no build — é rodado manualmente quando icone.png muda:
//   node scripts/gerar-favicons.mjs

import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import sharp from 'sharp'
import pngToIco from 'png-to-ico'

const raiz = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const origem = path.join(raiz, 'icone.png')
const publicDir = path.join(raiz, 'public')

// Recorte amplo: quadrado 948×948 a partir de (46, 0) — o coelho inteiro,
// asas, arco-íris e corações. Fonte pro app icon (aparece pequeno, mas
// precisa "respirar" ao redor do bicho).
const RECORTE_AMPLO = { left: 46, top: 0, width: 948, height: 948 }

// Recorte fechado: quadrado 400×400 a partir de (330, 95) — cabeça, as duas
// orelhas e o chifre inteiro. Fonte pro favicon (16/32 px): em tamanho de
// aba de navegador, o fundo estrelado vira mancha rosa e o coelho some se
// não aproximarmos bem no rosto.
const RECORTE_FECHADO = { left: 330, top: 95, width: 400, height: 400 }

async function corDeFundo(imagem) {
  // Amostra os quatro cantos da imagem original (fora do coelho, das asas
  // e do arco-íris) e tira a média — mais robusto que escolher um pixel só,
  // que podia cair bem em cima de uma estrela ou de um coração.
  const metadata = await imagem.metadata()
  const tamanho = 30
  const cantos = [
    { left: 0, top: 0 },
    { left: metadata.width - tamanho, top: 0 },
    { left: 0, top: metadata.height - tamanho },
    { left: metadata.width - tamanho, top: metadata.height - tamanho },
  ]

  const medias = await Promise.all(
    cantos.map(async ({ left, top }) => {
      const { channels } = await imagem
        .clone()
        .extract({ left, top, width: tamanho, height: tamanho })
        .stats()
      return { r: channels[0].mean, g: channels[1].mean, b: channels[2].mean }
    }),
  )

  const media = (chave) => Math.round(medias.reduce((soma, m) => soma + m[chave], 0) / medias.length)
  return { r: media('r'), g: media('g'), b: media('b') }
}

async function main() {
  const buffer = await readFile(origem)
  const original = sharp(buffer)
  const metadata = await original.metadata()
  console.log(`icone.png: ${metadata.width}×${metadata.height}, ${metadata.channels} canais`)

  const fundo = await corDeFundo(original)
  console.log('Cor de fundo amostrada (cantos):', fundo)

  const amplo = sharp(buffer).extract(RECORTE_AMPLO)
  const fechado = sharp(buffer).extract(RECORTE_FECHADO)

  // -- ícones de app (mantêm transparência) --------------------------------
  await amplo.clone().resize(192, 192).png().toFile(path.join(publicDir, 'icon-192.png'))
  await amplo.clone().resize(512, 512).png().toFile(path.join(publicDir, 'icon-512.png'))

  // -- apple-touch-icon: iOS não lida bem com alfa, então achata no fundo --
  await amplo
    .clone()
    .resize(180, 180)
    .flatten({ background: fundo })
    .png()
    .toFile(path.join(publicDir, 'apple-touch-icon.png'))

  // -- favicons: recorte fechado, três tamanhos ----------------------------
  await fechado.clone().resize(16, 16).png().toFile(path.join(publicDir, 'favicon-16.png'))
  await fechado.clone().resize(32, 32).png().toFile(path.join(publicDir, 'favicon-32.png'))
  const buffer48 = await fechado.clone().resize(48, 48).png().toBuffer()
  const buffer32 = await fechado.clone().resize(32, 32).png().toBuffer()
  const buffer16 = await fechado.clone().resize(16, 16).png().toBuffer()

  const ico = await pngToIco([buffer16, buffer32, buffer48])
  await writeFile(path.join(publicDir, 'favicon.ico'), ico)

  // -- web manifest ---------------------------------------------------------
  const manifest = {
    name: 'rafinha.xyz',
    short_name: 'rafinha.xyz',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    theme_color: `rgb(${fundo.r}, ${fundo.g}, ${fundo.b})`,
    background_color: `rgb(${fundo.r}, ${fundo.g}, ${fundo.b})`,
    display: 'standalone',
  }
  await writeFile(path.join(publicDir, 'site.webmanifest'), `${JSON.stringify(manifest, null, 2)}\n`)

  console.log('Gerado em public/: icon-192.png, icon-512.png, apple-touch-icon.png, favicon-16.png, favicon-32.png, favicon.ico, site.webmanifest')
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
