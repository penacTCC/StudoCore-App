/** A grade da semana começa às 8h quando não há blocos; `inicioMin` é o offset a partir daí. */
export const GRADE_INICIO_HORA = 8;
export const GRADE_MIN_POR_PX = 180 / 140; // 140px = 3h (180min)

/** Converte um valor em minutos (relativo ao início da grade) para pixels. */
export function minParaPx(min: number) {
    return min / GRADE_MIN_POR_PX;
}

export const diasDaSemanaLista = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"];
