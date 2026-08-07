import { DeviceEventEmitter } from "react-native";
import { invalidarCache } from "@/lib/cache";

/**
 * Liga os avisos de mutação que o app já emitia ao cache de navegação.
 *
 * Sem isto, o cache seria correto só para o que revalida a cada foco. As listas com janela
 * fresca longa — meus grupos, membros, ranking — continuariam mostrando o estado anterior
 * depois de entrar ou sair de um grupo, porque para elas nada teria mudado ainda.
 *
 * Invalidar não busca nada: só marca as chaves como vencidas, para que a próxima tela que
 * as use revalide ao ganhar foco. O conteúdo antigo segue na tela nesse meio tempo.
 */

/** Tudo que deixa de valer quando o usuário entra, sai ou é removido de um grupo. */
const CHAVES_DE_GRUPO = [
    "meus-grupos",
    "grupos-publicos",
    "membros-grupo:",
    "membros-dos-grupos:",
    "detalhes-grupo:",
    "grupo-home:",
    "config-grupo:",
    "ranking-horas:",
    "sessoes-grupo:",
    "totais-foco-grupo:",
];

let ligado = false;

/** Registra os ouvintes uma única vez, na subida do app. */
export function ligarInvalidacaoDeCache() {
    if (ligado) return;
    ligado = true;

    DeviceEventEmitter.addListener("groupMembershipChanged", () => {
        CHAVES_DE_GRUPO.forEach((prefixo) => invalidarCache(prefixo));
    });

    // Desbloquear medalha muda as estatísticas do perfil e a galeria de medalhas.
    DeviceEventEmitter.addListener("badgesUnlocked", () => {
        invalidarCache("perfil-completo:");
        invalidarCache("estatisticas-perfil");
    });
}
