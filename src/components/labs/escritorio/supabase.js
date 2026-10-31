// Conexão do simulador de escritório com o Supabase.
//
// Cole aqui a "Project URL" e a chave "anon public" do seu projeto
// (Supabase → Project Settings → API). Essa chave é pública por natureza:
// quem protege os dados são as regras de RLS do supabase/escritorio.sql,
// que só deixam ler e sentar, nunca editar ou apagar.
//
// Enquanto os dois campos estiverem vazios, o simulador roda em modo de
// teste e guarda os personagens só no navegador de quem criou.

export const SUPABASE_URL = '';
export const SUPABASE_ANON_KEY = '';
