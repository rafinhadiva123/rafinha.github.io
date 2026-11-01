// Gera os arquivos SQL do simulador a partir da planta do site.
// Uso: npm run sql:escritorio
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { gerarSql, gerarSqlBackupCopiar, gerarSqlBackupRestaurar } from '../src/components/labs/escritorio/dados/sql.js'

const arquivos = {
  'escritorio.sql': gerarSql(),
  'escritorio-backup-copiar.sql': gerarSqlBackupCopiar(),
  'escritorio-backup-restaurar.sql': gerarSqlBackupRestaurar(),
}
for (const [nome, texto] of Object.entries(arquivos)) {
  writeFileSync(fileURLToPath(new URL(`../supabase/${nome}`, import.meta.url)), texto)
  console.log(`supabase/${nome} atualizado`)
}
