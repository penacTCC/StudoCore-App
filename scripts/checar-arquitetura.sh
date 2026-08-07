#!/bin/sh

status=0

echo "Checando regras de arquitetura..."

# `rg` nem sempre esta instalado (maquina nova, CI enxuto). Sem este fallback o
# `if rg ...` saia 127, que o shell le como "nenhuma ocorrencia" — e o script imprimia
# "Arquitetura OK" sem ter olhado uma linha sequer. Um checador que passa sempre e pior
# que checador nenhum, porque da a impressao de que a regra esta sendo cumprida.
if command -v rg >/dev/null 2>&1; then
  buscar() {
    padrao=$1
    shift
    rg -n "$padrao" "$@" -g '*.ts' -g '*.tsx'
  }
else
  buscar() {
    padrao=$1
    shift
    grep -rnE "$padrao" "$@" --include='*.ts' --include='*.tsx' --exclude-dir=node_modules
  }
fi

# Imprime as ocorrencias e devolve 0 (sucesso) quando a regra FOI violada — a forma que
# o `if` embaixo espera.
#
# rg e grep usam a mesma convencao: 0 = achou, 1 = nao achou, acima disso = a busca
# falhou. So o 1 e aprovacao; qualquer outro codigo reprova, senao um diretorio que
# sumiu ou um padrao invalido voltaria a passar despercebido.
violou() {
  padrao=$1
  shift

  saida=$(buscar "$padrao" "$@")
  codigo=$?

  if [ "$codigo" -gt 1 ]; then
    echo "Erro: a busca falhou (codigo $codigo) — a regra nao foi verificada."
    status=1
    return 1
  fi

  [ -n "$saida" ] || return 1
  echo "$saida"
  return 0
}

if violou '@/lib/supabase|\.\./lib/supabase' app components hooks services; then
  echo "Erro: app/components/hooks/services nao devem importar lib/supabase diretamente."
  echo "Use services nos apps/hooks/componentes e repositories/supabase dentro dos services."
  status=1
fi

if violou 'supabase\.' app components hooks; then
  echo "Erro: app/components/hooks nao devem chamar Supabase diretamente."
  echo "Mova a regra para services ou repositories."
  status=1
fi

if violou '@/repositories/|\.\./repositories/' app components hooks; then
  echo "Erro: app/components/hooks nao devem importar repositories diretamente."
  echo "Use services como fachada da regra de negocio."
  status=1
fi

if [ "$status" -eq 0 ]; then
  echo "Arquitetura OK."
fi

exit "$status"
