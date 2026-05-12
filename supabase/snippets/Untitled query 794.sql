CREATE POLICY "Permitir_Uploads_Imagens"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'images');