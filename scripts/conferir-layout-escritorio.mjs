// Mostra o que muda entre a planta do código e o layout publicado no banco
// (o supabase/escritorio.sql atual). Rode ANTES de npm run sql:escritorio.
// Uso: npm run layout:escritorio
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { LUGARES, LUGAR, descreverLugar } from '../src/components/labs/escritorio/planta/lugares.js'
import { FIXOS } from '../src/components/labs/escritorio/planta/fixos.js'
import { cadeirasDoSql, sqlPreviaLayout } from '../src/components/labs/escritorio/dados/sql.js'

const publicado = readFileSync(fileURLToPath(new URL('../supabase/escritorio.sql', import.meta.url)), 'utf8')
const antes = new Set(cadeirasDoSql(publicado))
const depois = new Set(LUGARES.map(l => l.id))
const removidas = [...antes].filter(id => !depois.has(id))
const novas = [...depois].filter(id => !antes.has(id))
const fixosSemCadeira = FIXOS.filter(f => !LUGAR.has(f.lugar))

console.log(`Publicado: ${antes.size} cadeiras · no código: ${depois.size}`)
console.log(`Cadeiras novas: ${novas.length}`)
for (const id of novas) console.log(`  + ${id}  (${descreverLugar(id)})`)
console.log(`Cadeiras que saem (ficam inativas, ninguém é apagado): ${removidas.length}`)
for (const id of removidas) console.log(`  - ${id}`)
if (fixosSemCadeira.length) {
  console.log(`\nPARE: fixo sem cadeira no layout novo → ${fixosSemCadeira.map(f => `${f.apelido} (${f.lugar})`).join(', ')}`)
  console.log('Mude o lugar dele em planta/fixos.js antes de seguir.')
  process.exitCode = 1
}
console.log('\nCole no SQL Editor para ver quem é afetado (só lê, não muda nada):\n')
console.log(sqlPreviaLayout(removidas))
