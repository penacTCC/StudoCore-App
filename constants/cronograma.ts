/** A grade da semana começa às 8h quando não há blocos; `inicioMin` é o offset a partir daí. */
export const GRADE_INICIO_HORA = 8;
export const GRADE_MIN_POR_PX = 180 / 140; // 140px = 3h (180min)

/** Converte um valor em minutos (relativo ao início da grade) para pixels. */
export function minParaPx(min: number) {
    return min / GRADE_MIN_POR_PX;
}

export const diasDaSemanaLista = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"];

/*
  Pisos e tetos de duração do cronograma.

  Moram aqui porque três telas dependem deles e cada uma tinha o seu: a roda de duração do
  novo bloco parava em 25/120, o piso do bloco único era 30, e os steppers das
  configurações deixavam descer a 5min e subir a 180. Como a preferência é a MESMA
  (`focoMin`, `duracaoPadraoBlocoMin`), dava para configurar um pomodoro de 5min que o
  cronograma silenciosamente arredondava para 25 na hora de usar.
*/

/** Abaixo disto o pomodoro não rende — é o piso do método. */
export const DURACAO_POMODORO_MIN = 25;
export const DURACAO_POMODORO_MAX = 120;

/** Piso de duração de um bloco de plano ou rotina. */
export const DURACAO_BLOCO_UNICO_MIN = 30;
export const DURACAO_BLOCO_UNICO_MAX = 240;
