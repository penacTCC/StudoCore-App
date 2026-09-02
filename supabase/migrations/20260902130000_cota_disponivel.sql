-- Versão somente-leitura de `consumir_cota_ia`: responde "esse usuário pode?" sem gastar
-- uma unidade.
--
-- Existe por causa do chat de anexo, que tem duas etapas: o `upload` manda o PDF para a
-- Files API do Gemini (custa, mas não é a unidade cobrada) e a `mensagem` é o que consome
-- cota. Sem esta função, um usuário do plano Grátis — que nem tem chat — conseguiria subir
-- arquivos à vontade e só levaria 429 na pergunta, depois do custo já ter acontecido.

create or replace function public.cota_disponivel(p_tipo text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_plano   text;
  v_limites public.planos_limites;
  v_limite  integer;
  v_janela  text;
  v_usado   integer;
begin
  if v_uid is null then
    raise exception 'Sem usuário autenticado' using errcode = '28000';
  end if;

  v_plano := public.plano_do_usuario(v_uid);
  select * into v_limites from public.planos_limites where plano = v_plano;

  case p_tipo
    when 'quiz' then
      v_limite := v_limites.quiz_ia_por_dia;
      v_janela := to_char((now() at time zone 'America/Sao_Paulo')::date, 'YYYY-MM-DD');
    when 'anexo' then
      v_limite := v_limites.anexos_ia_por_mes;
      v_janela := to_char((now() at time zone 'America/Sao_Paulo')::date, 'YYYY-MM');
    when 'roadmap' then
      v_limite := v_limites.roadmap_ia_por_mes;
      v_janela := to_char((now() at time zone 'America/Sao_Paulo')::date, 'YYYY-MM');
    when 'chat' then
      v_limite := v_limites.chat_ia_por_mes;
      v_janela := to_char((now() at time zone 'America/Sao_Paulo')::date, 'YYYY-MM');
    else
      raise exception 'Tipo de cota desconhecido: %', p_tipo using errcode = '22023';
  end case;

  v_usado := public.consumo_na_janela(v_uid, p_tipo, v_janela);

  return jsonb_build_object(
    'permitido', v_limite is null or v_usado < v_limite,
    'usado', v_usado,
    'limite', v_limite,
    'janela', v_janela,
    'plano', v_plano,
    'motivo', case
      when v_limite = 0 then 'bloqueado_no_plano'
      when v_limite is not null and v_usado >= v_limite then 'cota_esgotada'
      else null
    end
  );
end;
$$;

revoke all on function public.cota_disponivel(text) from public, anon;
grant execute on function public.cota_disponivel(text) to authenticated;
