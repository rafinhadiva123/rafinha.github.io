// Gera supabase/escritorio.sql a partir da planta do site.
// Uso: npm run sql:escritorio
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { gerarSql } from '../src/components/labs/escritorio/dados/sql.js'

const destino = fileURLToPath(new URL('../supabase/escritorio.sql', import.meta.url))
writeFileSync(destino, gerarSql())
console.log('supabase/escritorio.sql atualizado')
