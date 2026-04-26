---------------------- UPLOAD DE IMAGEM ----------------------
CREATE POLICY "Permitir_Uploads_Imagens"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'images');
--------------------------------------------------------------


---------------------- ARQUIVOS ----------------------
--tira coluga group_id da tabela arquivos

-- Permite que o usuário logado delete apenas os seus próprios arquivos na tabela 'arquivos'
DROP POLICY IF EXISTS "Usuarios deletam seus proprios registros" ON "public"."arquivos";
create policy "Usuarios deletam seus proprios registros" on "public"."arquivos" to authenticated using ((auth.uid() = user_id));

-- politica para inserir
DROP POLICY IF EXISTS "Usuarios inserem seus proprios registros" ON "public"."arquivos";
create policy "Usuarios inserem seus proprios registros" on "public"."arquivos" to authenticated with check (auth.uid() = user_id);

-- politica para visualizar
DROP POLICY IF EXISTS "Usuarios veem seus proprios registros" ON "public"."arquivos";
create policy "Usuarios veem seus proprios registros" on "public"."arquivos" to authenticated using (auth.uid() = user_id);
--------------------------------------------------------


---------------------- ARQUIVOS_GRUPOS ----------------------
--política para deletar
DROP POLICY IF EXISTS "Usuarios deletam grupos de seus arquivos" ON "public"."arquivos_grupos";
create policy "Usuarios deletam grupos de seus arquivos" on "public"."arquivos_grupos" to authenticated using (
    (
    EXISTS (SELECT 1 FROM arquivos WHERE (arquivos.id = arquivos_grupos.arquivo_id) AND (arquivos.user_id = auth.uid()))
    )
);
--politica para inserir
DROP POLICY IF EXISTS "Usuarios inserem grupos em seus arquivos" ON "public"."arquivos_grupos";
create policy "Usuarios inserem grupos em seus arquivos" on "public"."arquivos_grupos" to authenticated with check (
    (
    EXISTS (SELECT 1 FROM arquivos WHERE (arquivos.id = arquivos_grupos.arquivo_id) AND (arquivos.user_id = auth.uid()))
    )
);
--politica para visualizar
DROP POLICY IF EXISTS "Usuarios veem grupos de seus arquivos" ON "public"."arquivos_grupos";
create policy "Usuarios veem grupos de seus arquivos" on "public"."arquivos_grupos" to authenticated using (
    (
    EXISTS (SELECT 1 FROM arquivos WHERE (arquivos.id = arquivos_grupos.arquivo_id) AND (arquivos.user_id = auth.uid()))
    )
);
--------------------------------------------------------------

---------------------- PROFILES ----------------------

-- Ativando o RLS (Segurança de Tela) para que apenas o próprio usuário veja e salve suas próprias sessões
ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;

-- Política para Permitir que o usuário insira a própria sessão
DROP POLICY IF EXISTS "Usuários podem inserir suas próprias sessões" ON "public"."study_sessions";
CREATE POLICY "Usuários podem inserir suas próprias sessões" 
ON study_sessions FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Política para Permitir que o usuário veja as próprias sessões (quando formos criar gráficos de histórico)
DROP POLICY IF EXISTS "Usuários podem ver suas próprias sessões" ON "public"."study_sessions";
CREATE POLICY "Usuários podem ver suas próprias sessões" 
ON study_sessions FOR SELECT 
USING (auth.uid() = user_id);
--------------------------------------------------------