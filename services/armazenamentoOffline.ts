import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/repositories/supabase';
import type { Grupo, GrupoPublico } from '@/types/grupos';
import type { SnapshotSessaoFoco } from '@/types/foco';

const MY_GROUPS_KEY = '@my_groups_cache';
const PUBLIC_GROUPS_KEY = '@public_groups_cache';
const LAST_GROUP_KEY = '@last_group_id';
const AGENDA_KEY_PREFIX = '@agenda_cache';
// Mantidas com o nome antigo: uma sessão em andamento na hora da atualização do app
// continua sendo encontrada (ver `carregarSnapshotSessao`).
const SESSION_START_KEY = '@focus_session_start_time';
const SESSION_DATA_KEY = '@focus_session_data';

/**
 * Guarda no aparelho tudo que a sessão de foco precisa para ser reconstruída do zero.
 *
 * Antes daqui só a matéria, o conteúdo, o início e o modo eram salvos. A FILA do pomodoro
 * (os pomodoros e descansos que faltam, ou as matérias seguintes de um plano), a fase atual
 * e o vínculo com a linha do banco viviam apenas na memória — então, se o app fosse
 * fechado, ele voltava "em modo pomodoro" com fila vazia: o relógio corria para sempre, as
 * matérias restantes do plano sumiam e o tempo passava a ser contado por relógio de parede,
 * incluindo descanso e o tempo com o app fechado.
 *
 * O dono vai carimbado no próprio JSON (não na chave, que fica igual por compatibilidade —
 * ver comentário acima) pelo mesmo motivo do `LAST_GROUP_KEY`: sem ele, trocar de conta no
 * mesmo aparelho enquanto há um pomodoro em andamento fazia a conta nova herdar matéria,
 * fila e cronômetro da conta anterior — e ficava sem proteção justamente quando o snapshot
 * ainda não tem `sessaoId` (o instante entre o pomodoro começar e a linha ser gravada no
 * banco), porque aí a checagem de dono pela linha em `restoreSession` (focus.tsx) nem roda.
 */
export const salvarSnapshotSessao = async (snapshot: SnapshotSessaoFoco) => {
  try {
    const userId = await idDoUsuarioAtual();
    if (!userId) return;

    await AsyncStorage.multiSet([
      [SESSION_START_KEY, String(snapshot.inicioMs)],
      [SESSION_DATA_KEY, JSON.stringify({ ...snapshot, donoUserId: userId })],
    ]);
  } catch (erro) {
    console.warn('Erro ao salvar a sessão de foco em andamento:', erro);
  }
};

/**
 * Lê a sessão em andamento salva no aparelho, ou `null` quando não há nenhuma — inclusive
 * quando a que está salva é de outra conta que usou o aparelho antes.
 *
 * Snapshots gravados por versões anteriores do app não têm fila nem fase; os campos que
 * faltam voltam com o padrão de "não havia fila", que é exatamente como aquelas sessões
 * funcionavam. Nenhuma sessão em andamento se perde numa atualização por causa disso.
 */
export const carregarSnapshotSessao = async (): Promise<SnapshotSessaoFoco | null> => {
  try {
    const [[, inicioSalvo], [, dadosSalvos]] = await AsyncStorage.multiGet([
      SESSION_START_KEY,
      SESSION_DATA_KEY,
    ]);

    if (!inicioSalvo || !dadosSalvos) return null;

    const dados = JSON.parse(dadosSalvos) as Partial<SnapshotSessaoFoco> & { donoUserId?: string };
    const inicioMs = parseInt(inicioSalvo, 10);
    if (!Number.isFinite(inicioMs)) return null;

    // Sem dono carimbado (snapshot de versão antiga) ou dono diferente do usuário logado
    // agora: mesmo risco do `LAST_GROUP_KEY` antigo, mesma resposta — descarta a leitura em
    // vez de arriscar restaurar sessão de outra conta. Não apaga a chave: se for a própria
    // conta reabrindo em outro momento, o snapshot dela ainda está lá.
    const userId = await idDoUsuarioAtual();
    if (!userId || dados.donoUserId !== userId) return null;

    return {
      subject: dados.subject || '',
      content: dados.content || '',
      isPublic: dados.isPublic ?? true,
      groupId: dados.groupId ?? null,
      modo: dados.modo === 'pomodoro' ? 'pomodoro' : 'cronometro',
      inicioMs,
      sessaoId: dados.sessaoId ?? null,
      salaId: dados.salaId ?? null,
      ehConvidado: dados.ehConvidado ?? false,
      fila: dados.fila ?? [],
      indiceFila: dados.indiceFila ?? 0,
      fase: dados.fase ?? 'foco',
      faseInicioMs: dados.faseInicioMs ?? null,
      faseDuracaoSeg: dados.faseDuracaoSeg ?? 0,
      focoAcumuladoSeg: dados.focoAcumuladoSeg ?? 0,
      execucaoId: dados.execucaoId ?? null,
      contexto: dados.contexto ?? null,
      pausado: dados.pausado ?? false,
      pausadoSeg: dados.pausadoSeg ?? 0,
      pausadaEmMs: dados.pausadaEmMs ?? null,
    };
  } catch (erro) {
    console.warn('Erro ao ler a sessão de foco em andamento:', erro);
    return null;
  }
};

export const limparSnapshotSessao = async () => {
  try {
    await AsyncStorage.multiRemove([SESSION_START_KEY, SESSION_DATA_KEY]);
  } catch (erro) {
    console.warn('Erro ao limpar a sessão de foco em andamento:', erro);
  }
};

const FINALIZACAO_PENDENTE_KEY = '@sessoes_finalizacao_pendente';

type FinalizacaoSessaoPendente = {
  id: string;
  updates: Record<string, unknown>;
  criadaEm: number;
};

const listarFilaBruta = async (userId: string): Promise<FinalizacaoSessaoPendente[]> => {
  const valorJson = await AsyncStorage.getItem(`${FINALIZACAO_PENDENTE_KEY}:${userId}`);
  if (!valorJson) return [];

  try {
    const dados = JSON.parse(valorJson);
    return Array.isArray(dados) ? dados : [];
  } catch {
    return [];
  }
};

/**
 * Guarda no aparelho um UPDATE de finalização de sessão que falhou ao ser enviado ao banco,
 * para que outro momento (retomar o app, voltar do background) possa tentar de novo.
 *
 * `atualizarSessaoFoco` só faz UPDATE por `id` — nunca insere — então reaplicar o mesmo
 * payload várias vezes é seguro: a linha final é sempre a mesma, não importa quantas vezes
 * a fila tentar. Uma nova chamada para o mesmo `id` substitui a pendência anterior em vez de
 * empilhar (o payload mais recente é sempre o que vale).
 */
export const enfileirarFinalizacaoSessaoPendente = async (id: string, updates: Record<string, unknown>) => {
  try {
    const userId = await idDoUsuarioAtual();
    if (!userId) return;

    const fila = await listarFilaBruta(userId);
    const semDuplicata = fila.filter((item) => item.id !== id);
    semDuplicata.push({ id, updates, criadaEm: Date.now() });

    await AsyncStorage.setItem(`${FINALIZACAO_PENDENTE_KEY}:${userId}`, JSON.stringify(semDuplicata));
  } catch (erro) {
    console.error('Erro ao enfileirar finalização de sessão pendente:', erro);
  }
};

export const listarFinalizacoesSessaoPendentes = async (): Promise<FinalizacaoSessaoPendente[]> => {
  try {
    const userId = await idDoUsuarioAtual();
    if (!userId) return [];

    return await listarFilaBruta(userId);
  } catch (erro) {
    console.error('Erro ao ler a fila de finalizações de sessão pendentes:', erro);
    return [];
  }
};

export const removerFinalizacaoSessaoPendente = async (id: string) => {
  try {
    const userId = await idDoUsuarioAtual();
    if (!userId) return;

    const fila = await listarFilaBruta(userId);
    const restante = fila.filter((item) => item.id !== id);
    await AsyncStorage.setItem(`${FINALIZACAO_PENDENTE_KEY}:${userId}`, JSON.stringify(restante));
  } catch (erro) {
    console.error('Erro ao remover finalização de sessão pendente da fila:', erro);
  }
};

/**
 * Cache local da agenda já resolvida de um dia.
 *
 * A chave leva usuário e data porque a mesma instalação pode trocar de conta, e
 * a agenda de terça não serve para quarta. O cache é só uma ponte até a rede
 * responder: quem chega depois sempre sobrescreve.
 */
export const salvarAgendaLocalmente = async <T>(usuarioId: string, dataISO: string, agenda: T) => {
  try {
    await AsyncStorage.setItem(`${AGENDA_KEY_PREFIX}:${usuarioId}:${dataISO}`, JSON.stringify(agenda));
  } catch (erro) {
    console.error('Erro ao salvar a agenda offline:', erro);
  }
};

export const carregarAgendaLocalmente = async <T>(
  usuarioId: string,
  dataISO: string
): Promise<T | null> => {
  try {
    const valorJson = await AsyncStorage.getItem(`${AGENDA_KEY_PREFIX}:${usuarioId}:${dataISO}`);
    return valorJson != null ? (JSON.parse(valorJson) as T) : null;
  } catch (erro) {
    console.error('Erro ao ler a agenda offline:', erro);
    return null;
  }
};

// A chave leva o dono pelo mesmo motivo da agenda: sem ele, a semente offline reaparecia
// com os grupos da conta anterior ao trocar de conta no mesmo aparelho (ver `useMeusGrupos`).
export const salvarMeusGruposLocalmente = async (dadosGrupos: Grupo[]) => {
  try {
    const userId = await idDoUsuarioAtual();
    if (!userId) return;

    const valorJson = JSON.stringify(dadosGrupos);
    await AsyncStorage.setItem(`${MY_GROUPS_KEY}:${userId}`, valorJson);
  } catch (erro) {
    console.error('Erro ao salvar os meus grupos offline:', erro);
  }
};

export const carregarMeusGruposLocalmente = async (): Promise<Grupo[] | null> => {
  try {
    const userId = await idDoUsuarioAtual();
    if (!userId) return null;

    const valorJson = await AsyncStorage.getItem(`${MY_GROUPS_KEY}:${userId}`);
    return valorJson != null ? JSON.parse(valorJson) : null;
  } catch (erro) {
    console.error('Erro ao ler os meus grupos offline:', erro);
    return null;
  }
};

// Mesmo escopo por dono do `salvarMeusGruposLocalmente`: a lista já vem filtrada dos
// grupos em que o usuário logado ainda não está, então também muda de conta pra conta.
export const salvarGruposPublicosLocalmente = async (dadosGrupos: GrupoPublico[]) => {
  try {
    const userId = await idDoUsuarioAtual();
    if (!userId) return;

    const valorJson = JSON.stringify(dadosGrupos);
    await AsyncStorage.setItem(`${PUBLIC_GROUPS_KEY}:${userId}`, valorJson);
  } catch (erro) {
    console.error('Erro ao salvar os grupos publicos offline:', erro);
  }
};

export const carregarGruposPublicosLocalmente = async (): Promise<GrupoPublico[] | null> => {
  try {
    const userId = await idDoUsuarioAtual();
    if (!userId) return null;

    const valorJson = await AsyncStorage.getItem(`${PUBLIC_GROUPS_KEY}:${userId}`);
    return valorJson != null ? JSON.parse(valorJson) : null;
  } catch (erro) {
    console.error('Erro ao ler os grupos publicos offline:', erro);
    return null;
  }
};

/**
 * Dono do último grupo salvo. O AsyncStorage é do APARELHO, não da conta: guardar só o id
 * do grupo fazia com que, ao trocar de conta no mesmo aparelho, a conta nova herdasse o
 * grupo de quem usou o app antes. Isso não ficava só na navegação — a tela de foco usa
 * este id como fallback ao gravar `grupo_id` na sessão (ver app/(tabs)/focus.tsx), então
 * sessões de quem nunca entrou no grupo apareciam no feed e contavam para a meta semanal
 * dele. Gravando o dono junto, uma leitura de outra conta simplesmente não encontra nada.
 */
type UltimoGrupoSalvo = { userId: string; grupoId: string };

const idDoUsuarioAtual = async () => {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
};

export const salvarUltimoGrupoLocalmente = async (grupoId: string) => {
  try {
    const userId = await idDoUsuarioAtual();

    // Sem sessão não há dono para carimbar, e um registro sem dono é justamente o que
    // vazava entre contas — melhor não salvar nada.
    if (!userId) return;

    const registro: UltimoGrupoSalvo = { userId, grupoId };
    await AsyncStorage.setItem(LAST_GROUP_KEY, JSON.stringify(registro));
  } catch (erro) {
    console.error('Erro ao salvar o ultimo grupo offline:', erro);
  }
};

// Chamado no logout e por quem lê e descobre que a participação não bate mais
// (ver useStatusMembroGrupo).
export const limparUltimoGrupoLocalmente = async () => {
  try {
    await AsyncStorage.removeItem(LAST_GROUP_KEY);
  } catch (erro) {
    console.error('Erro ao limpar o ultimo grupo offline:', erro);
  }
};

export const carregarUltimoGrupoLocalmente = async () => {
  try {
    const bruto = await AsyncStorage.getItem(LAST_GROUP_KEY);
    if (!bruto) return null;

    const userId = await idDoUsuarioAtual();
    if (!userId) return null;

    /*
      Versões anteriores gravavam o id do grupo cru, sem dono. Como não dá para saber de
      quem ele era, é descartado: no pior caso a pessoa escolhe o grupo uma vez de novo,
      contra o risco de carimbar a sessão com o grupo de outra conta.
    */
    let registro: UltimoGrupoSalvo;
    try {
      registro = JSON.parse(bruto);
    } catch {
      await limparUltimoGrupoLocalmente();
      return null;
    }

    if (registro?.userId !== userId || !registro?.grupoId) return null;

    return registro.grupoId;
  } catch (erro) {
    console.error('Erro ao ler o ultimo grupo offline:', erro);
    return null;
  }
};
