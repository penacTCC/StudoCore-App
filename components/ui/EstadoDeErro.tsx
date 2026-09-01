import type { StyleProp, ViewStyle } from "react-native";
import { CloudOff, RefreshCw } from "@/components/ui/icons";
import { EmptyState } from "@/components/ui/EmptyState";
import { ehErroDeRede } from "@/utils/erroDeRede";

type EstadoDeErroProps = {
    erro: unknown;
    /** Chamado ao tocar em "Tentar de novo" — normalmente o `recarregar()` do hook de cache. */
    onTentarNovamente: () => void;
    compact?: boolean;
    style?: StyleProp<ViewStyle>;
};

/**
 * Estado de "não deu pra carregar" para telas que usam `useDadosCache`/`useMeusGrupos` e
 * afins. Cobre o primeiro carregamento falhando sem nada em cache pra mostrar — o caso que
 * hoje fica preso em skeleton pra sempre quando não há internet.
 *
 * A mensagem muda pra "sem conexão" quando o erro é de rede (ver `utils/erroDeRede.ts`);
 * qualquer outra falha (RLS, 4xx) mostra um aviso genérico em vez de mentir sobre a causa.
 */
export function EstadoDeErro({ erro, onTentarNovamente, compact, style }: EstadoDeErroProps) {
    const semConexao = ehErroDeRede(erro);

    return (
        <EmptyState
            icon={semConexao ? CloudOff : RefreshCw}
            title={semConexao ? "Sem conexão com a internet" : "Não foi possível carregar"}
            subtitle={
                semConexao
                    ? "Verifique sua conexão e tente de novo."
                    : "Algo deu errado. Tente novamente em instantes."
            }
            actionLabel="Tentar de novo"
            onAction={onTentarNovamente}
            compact={compact}
            style={style}
        />
    );
}
