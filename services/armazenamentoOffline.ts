import AsyncStorage from '@react-native-async-storage/async-storage';
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
 */
export const salvarSnapshotSessao = async (snapshot: SnapshotSessaoFoco) => {
  try {
    await AsyncStorage.multiSet([
      [SESSION_START_KEY, String(snapshot.inicioMs)],
      [SESSION_DATA_KEY, JSON.stringify(snapshot)],
    ]);
  } catch (erro) {
    console.warn('Erro ao salvar a sessão de foco em andamento:', erro);
  }
};

/**
 * Lê a sessão em andamento salva no aparelho, ou `null` quando não há nenhuma.
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

    const dados = JSON.parse(dadosSalvos) as Partial<SnapshotSessaoFoco>;
    const inicioMs = parseInt(inicioSalvo, 10);
    if (!Number.isFinite(inicioMs)) return null;

    return {
      subject: dados.subject || '',
      content: dados.content || '',
      isPublic: dados.isPublic ?? true,
      groupId: dados.groupId ?? null,
      modo: dados.modo === 'pomodoro' ? 'pomodoro' : 'cronometro',
      inicioMs,
      sessaoId: dados.sessaoId ?? null,
      sessaoGrupoId: dados.sessaoGrupoId ?? null,
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

export const salvarMeusGruposLocalmente = async (dadosGrupos: Grupo[]) => {
  try {
    const valorJson = JSON.stringify(dadosGrupos);
    await AsyncStorage.setItem(MY_GROUPS_KEY, valorJson);
  } catch (erro) {
    console.error('Erro ao salvar os meus grupos offline:', erro);
  }
};

export const carregarMeusGruposLocalmente = async (): Promise<Grupo[] | null> => {
  try {
    const valorJson = await AsyncStorage.getItem(MY_GROUPS_KEY);
    return valorJson != null ? JSON.parse(valorJson) : null;
  } catch (erro) {
    console.error('Erro ao ler os meus grupos offline:', erro);
    return null;
  }
};

export const salvarGruposPublicosLocalmente = async (dadosGrupos: GrupoPublico[]) => {
  try {
    const valorJson = JSON.stringify(dadosGrupos);
    await AsyncStorage.setItem(PUBLIC_GROUPS_KEY, valorJson);
  } catch (erro) {
    console.error('Erro ao salvar os grupos publicos offline:', erro);
  }
};

export const carregarGruposPublicosLocalmente = async (): Promise<GrupoPublico[] | null> => {
  try {
    const valorJson = await AsyncStorage.getItem(PUBLIC_GROUPS_KEY);
    return valorJson != null ? JSON.parse(valorJson) : null;
  } catch (erro) {
    console.error('Erro ao ler os grupos publicos offline:', erro);
    return null;
  }
};

export const salvarUltimoGrupoLocalmente = async (grupoId: string) => {
  try {
    await AsyncStorage.setItem(LAST_GROUP_KEY, grupoId);
  } catch (erro) {
    console.error('Erro ao salvar o ultimo grupo offline:', erro);
  }
};

// O último grupo é do aparelho, não da conta: ao trocar de conta o id antigo continua
// salvo e a nova conta caía direto nas tabs do grupo alheio. Quem lê valida a
// participação (ver useStatusMembroGrupo) e limpa por aqui quando não bate.
export const limparUltimoGrupoLocalmente = async () => {
  try {
    await AsyncStorage.removeItem(LAST_GROUP_KEY);
  } catch (erro) {
    console.error('Erro ao limpar o ultimo grupo offline:', erro);
  }
};

export const carregarUltimoGrupoLocalmente = async () => {
  try {
    return await AsyncStorage.getItem(LAST_GROUP_KEY);
  } catch (erro) {
    console.error('Erro ao ler o ultimo grupo offline:', erro);
    return null;
  }
};
