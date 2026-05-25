#!/bin/sh

status=0

echo "Checando regras de arquitetura..."

if rg -n "@/lib/supabase|\\.\\./lib/supabase" app components hooks services -g '*.ts' -g '*.tsx'; then
  echo "Erro: app/components/hooks/services nao devem importar lib/supabase diretamente."
  echo "Use services nos apps/hooks/componentes e repositories/supabase dentro dos services."
  status=1
fi

if rg -n "supabase\\." app components hooks -g '*.ts' -g '*.tsx'; then
  echo "Erro: app/components/hooks nao devem chamar Supabase diretamente."
  echo "Mova a regra para services ou repositories."
  status=1
fi

if rg -n "@/repositories/|\\.\\./repositories/" app components hooks -g '*.ts' -g '*.tsx'; then
  echo "Erro: app/components/hooks nao devem importar repositories diretamente."
  echo "Use services como fachada da regra de negocio."
  status=1
fi

if [ "$status" -eq 0 ]; then
  echo "Arquitetura OK."
fi

exit "$status"
