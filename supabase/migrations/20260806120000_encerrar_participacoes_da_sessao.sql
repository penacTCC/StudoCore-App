-- Fecha as participações que sobram quando uma sessão em grupo é encerrada.
--
-- O problema: quem entra numa sessão de outra pessoa tem a linha de `tab_sessao_membros`
-- amarrada à sessão do ANFITRIÃO (ver services/sessions.ts). Ao encerrar, o app fechava
-- apenas a participação de quem clicou (app/(tabs)/focus.tsx) e marcava `concluido_em` na
-- sessão. As linhas dos outros participantes ficavam `status = 'ativo'` para sempre.
--
-- Como `utils/tempo.ts -> tempoAoVivoDoMembro` soma "agora menos `ultimo_inicio`" para todo
-- membro ativo, a prévia mostrava uma sessão marcada como CONCLUÍDA com participantes ainda
-- em "Focando agora" e cronômetros de mais de cem horas, subindo indefinidamente.
--
-- A RLS de `tab_sessao_membros` só deixa cada pessoa atualizar a própria linha, então quem
-- encerra não consegue fechar a dos colegas: por isso isto é um RPC SECURITY DEFINER, o
-- mesmo caminho já usado por `transferir_anfitriao_sessao`.

CREATE OR REPLACE FUNCTION public.encerrar_participacoes_da_sessao(p_sessao_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_encerradas INTEGER;
  v_fim TIMESTAMPTZ;
BEGIN
  -- Só quem participa da sessão pode encerrá-la: sem isto, qualquer usuário logado
  -- derrubaria a sessão de qualquer grupo.
  IF NOT EXISTS (
    SELECT 1 FROM public.tab_sessao_membros
    WHERE sessao_id = p_sessao_id AND membro_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Apenas participantes podem encerrar as participações desta sessão.';
  END IF;

  SELECT COALESCE(concluido_em, now()) INTO v_fim
  FROM public.sessoes_foco
  WHERE id = p_sessao_id;

  /*
    O trecho em aberto é creditado antes de fechar, limitado ao instante em que a sala
    acabou — quem estava de fato focando não perde o tempo, e quem abandonou não ganha os
    dias em que o app ficou fechado. `GREATEST(...,0)` protege contra `ultimo_inicio` no
    futuro, que é o sintoma do fuso errado descrito em utils/tempo.ts.
  */
  UPDATE public.tab_sessao_membros
  SET
    status = 'concluido',
    tempo_segundos = tempo_segundos + CASE
      WHEN status = 'ativo' AND ultimo_inicio IS NOT NULL
        THEN GREATEST(0, LEAST(
          EXTRACT(EPOCH FROM (COALESCE(v_fim, now()) - ultimo_inicio)),
          12 * 3600  -- corte de abandono, igual ao HORAS_ATE_ABANDONO de utils/tempo.ts
        ))::INTEGER
      ELSE 0
    END
  WHERE sessao_id = p_sessao_id
    AND status <> 'concluido';

  GET DIAGNOSTICS v_encerradas = ROW_COUNT;
  RETURN v_encerradas;
END;
$$;

GRANT EXECUTE ON FUNCTION public.encerrar_participacoes_da_sessao(UUID) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Backfill: as sessões que já estão nesse estado no banco.
--
-- São as participações ainda abertas cuja sessão já foi concluída. Sem isto, os cards
-- quebrados que já existem continuariam contando para sempre, porque o RPC acima só age
-- em encerramentos futuros.
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE public.tab_sessao_membros AS m
SET
  status = 'concluido',
  tempo_segundos = m.tempo_segundos + CASE
    WHEN m.status = 'ativo' AND m.ultimo_inicio IS NOT NULL
      THEN GREATEST(0, LEAST(
        EXTRACT(EPOCH FROM (s.concluido_em - m.ultimo_inicio)),
        12 * 3600
      ))::INTEGER
    ELSE 0
  END
FROM public.sessoes_foco AS s
WHERE s.id = m.sessao_id
  AND m.status <> 'concluido'
  AND s.concluido_em IS NOT NULL;

-- Participações abandonadas cuja sessão nunca foi encerrada por ninguém: o app fechou à
-- força e a linha ficou "ativa". O corte de 12h é o mesmo de `buscarSessoesAoVivo`, que
-- já esconde essas sessões do feed — a participação precisava seguir a mesma régua.
UPDATE public.tab_sessao_membros
SET status = 'concluido'
WHERE status <> 'concluido'
  AND ultimo_inicio IS NOT NULL
  AND ultimo_inicio < now() - INTERVAL '12 hours';
