CREATE POLICY "Permitir_Uploads_Imagens"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'images');

INSERT INTO storage.buckets (id, name, public) 
VALUES ('images', 'images', true), ('vault', 'vault', true)
ON CONFLICT (id) DO NOTHING;

-- Liberar acesso para upload (Políticas de Segurança - RLS)
CREATE POLICY "Permitir Upload" ON storage.objects 
FOR INSERT WITH CHECK (bucket_id IN ('images', 'vault'));

CREATE POLICY "Permitir Ver" ON storage.objects 
FOR SELECT USING (bucket_id IN ('images', 'vault'));
