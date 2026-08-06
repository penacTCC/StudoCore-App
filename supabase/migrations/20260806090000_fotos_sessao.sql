-- Foto da sessão de foco ("registre esse momento", ver components/sessao/EtapaFotoSessao.tsx).
--
-- A foto NÃO valida a sessão: quem valida é o cronômetro. Ela é memória e prova social,
-- por isso é 100% opcional e nunca bloqueia o save da sessão.
--
-- Mora na própria linha de `sessoes_foco`, igual às anotações — é 1:1 com a sessão e não
-- justifica tabela nova. Numa execução de plano com várias matérias (mesmo `execucao_id`),
-- o app grava o MESMO `foto_path` em todas as linhas e a galeria deduplica por execução;
-- a foto é do momento de estudo, não de uma matéria específica.
ALTER TABLE public.sessoes_foco
  ADD COLUMN IF NOT EXISTS foto_path TEXT,
  ADD COLUMN IF NOT EXISTS foto_legenda TEXT,
  ADD COLUMN IF NOT EXISTS foto_criada_em TIMESTAMP WITH TIME ZONE;

-- Usado pela policy de SELECT do bucket, que casa o objeto do storage com a sessão dona
-- dele a cada leitura. Sem índice, cada signed URL viraria um seq scan em `sessoes_foco`.
CREATE INDEX IF NOT EXISTS sessoes_foco_foto_path_idx
  ON public.sessoes_foco (foto_path)
  WHERE foto_path IS NOT NULL;

-- Switch "Foto ao fim da sessão" (app/(modals)/settings.tsx), irmão de `anotar_apos_quiz`.
-- Ligado por padrão: a etapa é pulável, então o custo de quem não quiser é um toque.
ALTER TABLE public.preferencias_cronograma
  ADD COLUMN IF NOT EXISTS foto_apos_sessao BOOLEAN NOT NULL DEFAULT TRUE;

-- ─────────────────────────────────────────────────────────────────────────────
-- Bucket privado.
--
-- Diferente do bucket `images` (avatares, capas de grupo), que é público: a foto aqui é
-- do quarto/mesa de estudo de uma pessoa que pode ser menor de idade. URL pública seria
-- permanente e indexável mesmo depois de a sessão virar privada. Leitura passa por
-- signed URL de curta validade (ver services/fotosSessao.ts).
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'sessao-fotos',
  'sessao-fotos',
  FALSE,
  5242880, -- 5 MB: o app já redimensiona pra ~1080px antes de subir
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- O caminho é sempre `${user_id}/${sessao_id}.jpg`, então a primeira pasta identifica o dono.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Enviar foto na própria pasta de sessão'
  ) THEN
    CREATE POLICY "Enviar foto na própria pasta de sessão"
      ON storage.objects FOR INSERT
      WITH CHECK (
        bucket_id = 'sessao-fotos'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;

  -- O upload usa upsert (refazer a foto da mesma sessão sobrescreve o arquivo).
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Substituir a própria foto de sessão'
  ) THEN
    CREATE POLICY "Substituir a própria foto de sessão"
      ON storage.objects FOR UPDATE
      USING (
        bucket_id = 'sessao-fotos'
        AND (storage.foldername(name))[1] = auth.uid()::text
      )
      WITH CHECK (
        bucket_id = 'sessao-fotos'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Apagar a própria foto de sessão'
  ) THEN
    CREATE POLICY "Apagar a própria foto de sessão"
      ON storage.objects FOR DELETE
      USING (
        bucket_id = 'sessao-fotos'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;

  /*
    Leitura: o dono sempre vê a própria foto. Outra pessoa só consegue gerar signed URL
    se existir uma sessão apontando pra esse arquivo que seja pública E de um perfil
    público — as mesmas duas chaves que a aba Galeria respeita na interface. Tornar a
    sessão privada depois deixa de valer imediatamente, porque a checagem acontece na
    hora de assinar a URL, não na hora de subir o arquivo.
  */
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Ver foto de sessão própria ou pública'
  ) THEN
    CREATE POLICY "Ver foto de sessão própria ou pública"
      ON storage.objects FOR SELECT
      USING (
        bucket_id = 'sessao-fotos'
        AND (
          (storage.foldername(name))[1] = auth.uid()::text
          OR EXISTS (
            SELECT 1
            FROM public.sessoes_foco s
            JOIN public.profiles p ON p.id = s.user_id
            WHERE s.foto_path = storage.objects.name
              AND s.is_public
              AND COALESCE(p.perfil_publico, TRUE)
          )
        )
      );
  END IF;
END $$;
