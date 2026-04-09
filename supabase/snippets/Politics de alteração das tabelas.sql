--permite fazer upload no bucket images
CREATE POLICY "Permitir_Uploads_Imagens"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'images');

--TABELA arquivos

-- Permite que o usuário logado delete apenas os seus próprios arquivos na tabela 'arquivos'
create policy "Usuarios deletam seus proprios registros" on public.arquivos for delete to authenticated using (auth.uid() = user_id);

-- politica para inserir
create policy "Usuarios inserem seus proprios registros" on "public"."arquivos" to authenticated with check (auth.uid() = user_id);

-- politica para visualizar
create policy "Usuarios veem seus proprios registros" on "public"."arquivos" to authenticated using (auth.uid() = user_id);

-- ARQUIVOS_GRUPOS 
