import AsyncStorage from "@react-native-async-storage/async-storage";

const CHAVE_MODO_TESTE = "@app_test_mode";

/**
 * Quanto tempo contabilizado vale um segundo de relógio real quando o modo de testes está
 * ligado: 10s reais viram 1h (3600s), ou seja, 360×.
 */
export const FATOR_MODO_TESTE = 360;

/*
  O fator fica em memória porque quase todo consumidor é síncrono: o card do feed, o
  cronômetro dos colegas e a prévia da sessão calculam o tempo ao vivo durante o render,
  onde não dá para esperar o AsyncStorage. `carregarModoTeste()` roda uma vez na
  inicialização do app e `definirModoTeste()` mantém o valor em dia quando o usuário mexe
  no botão das configurações.
*/
let fatorEmMemoria = 1;
let jaCarregou = false;

/** Lê a preferência persistida para a memória. Chamado na inicialização do app. */
export const carregarModoTeste = async () => {
    const valor = await AsyncStorage.getItem(CHAVE_MODO_TESTE);
    fatorEmMemoria = valor === "true" ? FATOR_MODO_TESTE : 1;
    jaCarregou = true;
    return fatorEmMemoria !== 1;
};

/** Liga/desliga o modo de testes, persistindo e atualizando a memória no mesmo passo. */
export const definirModoTeste = async (ativo: boolean) => {
    await AsyncStorage.setItem(CHAVE_MODO_TESTE, String(ativo));
    fatorEmMemoria = ativo ? FATOR_MODO_TESTE : 1;
    jaCarregou = true;
};

/** Garante que a preferência já foi lida antes de um cálculo que pode rodar cedo demais. */
export const garantirFatorCarregado = async () => {
    if (!jaCarregou) await carregarModoTeste();
    return fatorEmMemoria;
};

export const modoTesteAtivo = () => fatorEmMemoria !== 1;

/** Fator atual (1 em uso normal, 360 em modo de testes). */
export const fatorModoTeste = () => fatorEmMemoria;

/**
 * Converte segundos de relógio real nos segundos que o app contabiliza.
 *
 * Esta é a ÚNICA fronteira onde a escala do modo de testes é aplicada, e ela vale para
 * tudo que vai para o banco ou sai dele. O cronômetro da sessão em andamento é a exceção
 * deliberada: ele mostra o relógio real, sem escala.
 *
 * Aplicar a escala só na hora de gravar `tempo_minutos`, como era feito antes, misturava
 * unidades — o tempo ao vivo somava minutos já multiplicados com segundos reais, e o mesmo
 * estudo aparecia como 2h40 no timer e 962h no grupo.
 */
export const escalarSegundos = (segundosReais: number) => {
    const seguros = Number.isFinite(segundosReais) && segundosReais > 0 ? segundosReais : 0;
    return Math.round(seguros * fatorEmMemoria);
};
