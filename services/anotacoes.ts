import { supabase } from "@/repositories/supabase";
import { ANOTACOES_VAZIAS, type AnotacoesSessao } from "@/types/anotacoes";

/*
  As anotações são colunas de `sessoes_foco`, então tecnicamente dava pra ler junto com a
  sessão. Ficam num service próprio porque a tela de detalhes e a etapa pós-quiz só querem
  esses quatro campos, e assim o autosave do editor não precisa carregar a linha inteira.
*/

const COLUNAS =
    "anotacao_estudo, anotacao_concentracao, anotacao_pendente, anotacao_proximo_passo, anotacoes_atualizado_em";

export async function buscarAnotacoes(sessaoId: string): Promise<AnotacoesSessao> {
    const { data, error } = await supabase
        .from("sessoes_foco")
        .select(COLUNAS)
        .eq("id", sessaoId)
        .maybeSingle();

    if (error || !data) {
        if (error) console.error("Erro ao buscar anotações da sessão:", error.message);
        return ANOTACOES_VAZIAS;
    }

    const linha = data as Record<string, string | null>;
    return {
        estudo: linha.anotacao_estudo ?? "",
        concentracao: linha.anotacao_concentracao ?? "",
        pendente: linha.anotacao_pendente ?? "",
        proximoPasso: linha.anotacao_proximo_passo ?? "",
    };
}

/**
 * Grava os quatro campos de uma vez. Campo em branco vira NULL em vez de string vazia,
 * pra tela de detalhes conseguir distinguir "não escreveu" de "escreveu e apagou".
 */
export async function salvarAnotacoes(
    sessaoId: string,
    anotacoes: AnotacoesSessao
): Promise<{ sucesso: boolean; erro?: string }> {
    const limpar = (valor: string) => {
        const texto = valor.trim();
        return texto.length > 0 ? texto : null;
    };

    const { error } = await supabase
        .from("sessoes_foco")
        .update({
            anotacao_estudo: limpar(anotacoes.estudo),
            anotacao_concentracao: limpar(anotacoes.concentracao),
            anotacao_pendente: limpar(anotacoes.pendente),
            anotacao_proximo_passo: limpar(anotacoes.proximoPasso),
            anotacoes_atualizado_em: new Date().toISOString(),
        })
        .eq("id", sessaoId);

    if (error) {
        console.error("Erro ao salvar anotações da sessão:", error.message);
        return { sucesso: false, erro: "Não foi possível salvar suas anotações." };
    }

    return { sucesso: true };
}
