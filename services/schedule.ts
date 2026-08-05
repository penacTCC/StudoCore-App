import { supabase } from "@/repositories/supabase";
import { BlocoRotina, NovoBlocoRotina } from "@/types/cronograma"
import { sincronizarLembreteRotina, cancelarLembreteRotina } from "@/services/lembretes"

//Salvar bloco de estudos da rotina semanal
export const salvarBlocoRotina = async (bloco: NovoBlocoRotina) => {
    const result = await supabase
        .from('rotina_semanal_blocos')
        .insert(bloco)
        .select()
    const novoBloco = result.data?.[0] as BlocoRotina | undefined;
    if (novoBloco) sincronizarLembreteRotina(novoBloco);
    return result
}

//Editar bloco de estudos da rotina semanal
export const editarBlocoRotina = async (bloco: BlocoRotina) => {
    const result = await supabase
        .from('rotina_semanal_blocos')
        .update(bloco)
        .eq('id', bloco.id)
        .select()
    if (!result.error) sincronizarLembreteRotina(bloco);
    return result
}

export const buscarBlocosSemana = async (userId: string) => {
    const { data, error } = await supabase
        .from("rotina_semanal_blocos")
        .select("*")
        .eq("usuario_id", userId)
    return { data: data as BlocoRotina[] | null, error }
}

export const buscarBlocoPorId = async (blocoId: string) => {
    const { data, error } = await supabase
        .from("rotina_semanal_blocos")
        .select("*")
        .eq("id", blocoId)
        .single()
    return { data: data as BlocoRotina | null, error }
}

//Move um bloco pra outro dia da semana (usado pelo arrastar-e-soltar da aba Blocos)
export const moverBlocoRotina = async (blocoId: string, diaSemana: number) => {
    const { data, error } = await supabase
        .from('rotina_semanal_blocos')
        .update({ dia_semana: diaSemana })
        .eq('id', blocoId)
        .select()
        .single()
    if (!error && data) sincronizarLembreteRotina(data as BlocoRotina);
    return { error }
}

/** Empurra o horário de início do bloco em `minutos`, mantendo a duração. */
export const adiarBlocoRotina = async (blocoId: string, minutos: number) => {
    const { data: atual, error: erroBusca } = await buscarBlocoPorId(blocoId);
    if (erroBusca || !atual) return { error: erroBusca ?? new Error("Bloco não encontrado") };

    const [h, m] = atual.hora_inicio.split(":").map(Number);
    const totalMin = (h * 60 + m + minutos + 1440) % 1440;
    const hora_inicio = `${Math.floor(totalMin / 60).toString().padStart(2, "0")}:${(totalMin % 60)
        .toString()
        .padStart(2, "0")}`;

    const { error } = await supabase
        .from("rotina_semanal_blocos")
        .update({ hora_inicio })
        .eq("id", blocoId);

    if (!error) sincronizarLembreteRotina({ ...atual, hora_inicio });
    return { error };
};

//Excluir bloco de estudos da rotina semanal
export const excluirBlocoRotina = async (blocoId: string) => {
    const { error } = await supabase
        .from("rotina_semanal_blocos")
        .delete()
        .eq("id", blocoId)
    if (!error) cancelarLembreteRotina(blocoId);
    return { error }
}
