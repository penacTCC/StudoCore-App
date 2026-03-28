-- Cria a tabela study_sessions para guardar o histórico do pomodoro/cronômetro
CREATE TABLE IF NOT EXISTS study_sessions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    subject text NOT NULL,
    duration integer NOT NULL, -- será guardado em segundos
    questions_solved integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);

-- Ativando o RLS (Segurança de Tela) para que apenas o próprio usuário veja e salve suas próprias sessões
ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;

-- Política para Permitir que o usuário insira a própria sessão
CREATE POLICY "Usuários podem inserir suas próprias sessões" 
ON study_sessions FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Política para Permitir que o usuário veja as próprias sessões (quando formos criar gráficos de histórico)
CREATE POLICY "Usuários podem ver suas próprias sessões" 
ON study_sessions FOR SELECT 
USING (auth.uid() = user_id);
