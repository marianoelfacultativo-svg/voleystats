// ============================================
// MOTOR DE ESTADÍSTICAS DE VOLEYSTATS
// Sistema de puntaje: escala -2 a 10 (neutro 5)
// ============================================

export interface AccionDB {
  jugador_id: string;
  partido_id?: string;
  set_numero: number;
  punto_numero?: number;
  fundamento: string;
  valoracion: string;
  cantidad: number;
  puntaje?: number;
  puntajeBase?: number;
}

export const BASE_SCORES: Record<string, Record<string, number>> = {
  saque: {
    ace: 10,
    positivo_mas: 8,
    positivo: 6,
    neutro: 5,
    negativo: 2,
  },
  recepcion: {
    "2x_positiva": 10,
    positiva: 8,
    negativa: 5,
    "2x_negativa": 3,
    "3x_negativa": 1,
    ace_contra: 0,
  },
  ataque: {
    punto: 10,
    neutro: 2,
    error: 0,
  },
  bloqueo: {
    punto: 10,
    positivo_mas: 8,
    positivo: 6,
    use_rival: 3,
    filtrada: 2,
    red: 0,
  },
  defensa: {
    gran_def: 10,
    toque_positiva: 10,
    cobertura_positiva: 10,
    toque_negativa: 0,
    cobertura_negativa: 0,
    error_def: 0,
    errores_graves: 0,
    mala_libre: -2,
  },
  armados: {
    genial: 10,
    perfecto: 8,
    correcto: 6,
    flojo: 3,
    malo: 1,
    horrible: 0,
  },
  toque: {
    punto: 10,
    neutro: 5,
    error: 0,
  },
};

export const PUNTAJE_NEUTRO = 5;
export const PUNTAJE_MIN = -2;
export const PUNTAJE_MAX = 10;
export const FACTOR_CONTEXTO = 0.4;
export const MIN_ACCIONES_RADAR = 10;

export function puntajeBase(
  fundamento: string,
  valoracion: string
): number | null {
  const f = BASE_SCORES[fundamento];
  if (!f) return null;
  const v = f[valoracion];
  return v === undefined ? null : v;
}

export function ajustarPorContexto(
  base: number,
  anteriorBase: number | null
): number {
  if (anteriorBase === null) return base;
  const ajuste =
    base - FACTOR_CONTEXTO * (anteriorBase - PUNTAJE_NEUTRO);
  return Math.max(PUNTAJE_MIN, Math.min(PUNTAJE_MAX, ajuste));
}

export const VALORES_SAQUE = BASE_SCORES.saque;
export const VALORES_RECEPCION = BASE_SCORES.recepcion;
export const VALORES_ATAQUE = BASE_SCORES.ataque;
export const VALORES_BLOQUEO = BASE_SCORES.bloqueo;
export const VALORES_DEFENSA = BASE_SCORES.defensa;
export const VALORES_ARMADOS = BASE_SCORES.armados;
export const VALORES_TOQUE = BASE_SCORES.toque;
export const VALORES_POR_FUNDAMENTO = BASE_SCORES;

const ACCIONES_POSITIVAS: Record<string, string[]> = {
  saque: ["ace", "positivo_mas", "positivo"],
  recepcion: ["2x_positiva", "positiva"],
  ataque: ["punto"],
  bloqueo: ["punto", "positivo_mas", "positivo"],
  defensa: ["toque_positiva", "gran_def", "cobertura_positiva"],
};

const ACCIONES_NEGATIVAS: Record<string, string[]> = {
  saque: ["negativo"],
  recepcion: ["negativa", "2x_negativa", "3x_negativa", "ace_contra"],
  ataque: ["error"],
  bloqueo: ["use_rival", "red"],
  defensa: [
    "toque_negativa",
    "mala_libre",
    "error_def",
    "cobertura_negativa",
    "errores_graves",
  ],
};

const DISPLAY_PUNTOS: Record<string, string[]> = {
  saque: ["ace"],
  recepcion: [],
  ataque: ["punto"],
  bloqueo: ["punto"],
  defensa: [],
  toque: ["punto"],
};

const DISPLAY_ERRORES: Record<string, string[]> = {
  saque: ["negativo"],
  recepcion: ["ace_contra"],
  ataque: ["error"],
  bloqueo: ["use_rival", "red"],
  defensa: ["error_def", "errores_graves"],
  toque: ["error"],
};

const SALDO_POSITIVOS: Record<string, string[]> = {
  saque: ["ace"],
  recepcion: [],
  ataque: ["punto"],
  bloqueo: ["punto"],
  defensa: [],
  toque: ["punto"],
};

const SALDO_NEGATIVOS: Record<string, string[]> = {
  saque: ["negativo"],
  recepcion: ["ace_contra"],
  ataque: ["error"],
  bloqueo: ["red"],
  defensa: [],
  toque: ["error"],
};

const SALDO_DEF_POSITIVOS = [
  "toque_positiva",
  "gran_def",
  "cobertura_positiva",
];

const SALDO_DEF_NEGATIVOS = [
  "toque_negativa",
  "mala_libre",
  "error_def",
  "cobertura_negativa",
  "errores_graves",
];

const EXPONENTES_VOLUMEN: Record<string, number> = {
  saque: 1.0,
  bloqueo: 1.0,
};

const EXPONENTE_DEFAULT = 0.5;

function getExponente(fundamento: string): number {
  return EXPONENTES_VOLUMEN[fundamento] ?? EXPONENTE_DEFAULT;
}

function puntajeEfectivo(a: AccionDB): number | null {
  if (a.puntaje !== undefined) return a.puntaje;
  return puntajeBase(a.fundamento, a.valoracion);
}

function normalizarPuntaje(p: number): number {
  if (p <= PUNTAJE_NEUTRO) {
    if (p >= 0) return (p / 5) * 0.25;
    return (p / 2) * 0.25;
  }
  return ((p - 5) / 5) * 0.75 + 0.25;
}

export const ETIQUETAS_VALORACION: Record<string, string> = {
  ace: "Ace",
  positivo_mas: "Positivo +",
  positivo: "Positivo",
  neutro: "Neutro",
  negativo: "Negativo",
  "2x_positiva": "2x Positiva",
  positiva: "Positiva",
  negativa: "Negativa",
  "2x_negativa": "2x Negativa",
  "3x_negativa": "3x Negativa",
  ace_contra: "Ace en contra",
  punto: "Punto",
  error: "Error",
  use_rival: "Use Rival",
  red: "Red",
  filtrada: "Filtrada",
  toque_positiva: "Toque +",
  toque_negativa: "Toque -",
  mala_libre: "Mala Libre",
  error_def: "Error Def",
  gran_def: "Gran Def",
  cobertura_positiva: "Cobertura +",
  cobertura_negativa: "Cobertura -",
  errores_graves: "Err. Graves",
  horrible: "Horrible",
  malo: "Malo",
  flojo: "Flojo",
  correcto: "Correcto",
  perfecto: "Perfecto",
  genial: "Genial",
  zona_4: "Zona 4",
  zona_3: "Zona 3",
  zona_2: "Zona 2",
  zona_6: "Zona 6",
  zona_1: "Zona 1",
};

export interface EstadisticasFundamento {
  fundamento: string;
  total: number;
  positivos: number;
  negativos: number;
  puntos: number;
  errores: number;
  saldo: number;
  efectividad: number;
}

export interface DistribucionTendencia {
  zona_4: number;
  zona_3: number;
  zona_2: number;
  zona_6: number;
  zona_1: number;
  toque: number;
  total: number;
}

export interface PromedioPorSet {
  set: number;
  promedio: number;
  total: number;
}

export interface PromedioArmadosSet {
  set: number;
  promedio: number;
  totalArmados: number;
}

export interface PromedioRecepcionSet {
  set: number;
  promedio: number;
  totalRecepciones: number;
}

export interface EstadisticasArmador {
  distribucionTendencia: DistribucionTendencia;
  promediosArmados: PromedioArmadosSet[];
  promedioArmadosGlobal: number;
  toquesPunto: number;
  toquesError: number;
  toquesNeutro: number;
}

export interface EstadisticasJugador {
  jugador_id: string;
  totalAcciones: number;
  totalPositivos: number;
  totalNegativos: number;
  totalPuntos: number;
  totalErrores: number;
  saldoTotal: number;
  saldoDefensivo: number;
  valoracionMedia: number;
  valoracionPorFundamento: Record<string, number>;
  valoracionTotalPorFundamento: Record<string, number>;
  valoracionMediaNormalizada: number;
  valoracionPromedioNormalizado: Record<string, number>;
  valoracionPonderadaPorFundamento: Record<string, number>;
  factorVolumen: number;
  porFundamento: Record<string, EstadisticasFundamento>;
  armador?: EstadisticasArmador;
  recepcion?: {
    promediosPorSet: PromedioRecepcionSet[];
    promedioGlobal: number;
  };
}

export const MIN_SETS_RANKING = 10;

function contarPorValoraciones(
  acciones: AccionDB[],
  fundamento: string,
  valoraciones: string[]
): number {
  return acciones
    .filter(
      (a) =>
        a.fundamento === fundamento && valoraciones.includes(a.valoracion)
    )
    .reduce((suma, a) => suma + a.cantidad, 0);
}

function contarTotal(acciones: AccionDB[], fundamento: string): number {
  return acciones
    .filter((a) => a.fundamento === fundamento)
    .reduce((suma, a) => suma + a.cantidad, 0);
}

function calcularFundamentoNormal(
  propias: AccionDB[],
  fund: string
): EstadisticasFundamento {
  const total = contarTotal(propias, fund);
  const positivos = contarPorValoraciones(
    propias,
    fund,
    ACCIONES_POSITIVAS[fund] ?? []
  );
  const negativos = contarPorValoraciones(
    propias,
    fund,
    ACCIONES_NEGATIVAS[fund] ?? []
  );
  const puntos = contarPorValoraciones(
    propias,
    fund,
    DISPLAY_PUNTOS[fund] ?? []
  );
  const errores = contarPorValoraciones(
    propias,
    fund,
    DISPLAY_ERRORES[fund] ?? []
  );

  const saldoPos = contarPorValoraciones(
    propias,
    fund,
    SALDO_POSITIVOS[fund] ?? []
  );
  const saldoNeg = contarPorValoraciones(
    propias,
    fund,
    SALDO_NEGATIVOS[fund] ?? []
  );
  const saldo = saldoPos - saldoNeg;

  const efectividad = total > 0 ? (saldo / total) * 100 : 0;

  return {
    fundamento: fund,
    total,
    positivos,
    negativos,
    puntos,
    errores,
    saldo,
    efectividad,
  };
}

function calcularValoraciones(
  acciones: AccionDB[],
  fundamentos: string[]
): {
  promedioNormalizado: Record<string, number>;
  mediaNormalizadaBase: number;
  valoracionMediaCruda: number;
  totalPorFundamento: Record<string, number>;
  promedioPorFundamento: Record<string, number>;
} {
  const promedioNormalizado: Record<string, number> = {};
  const totalPorFundamento: Record<string, number> = {};
  const promedioPorFundamento: Record<string, number> = {};

  let sumaNormTotal = 0;
  let countNormTotal = 0;
  let sumaCrudaTotal = 0;
  let countCrudaTotal = 0;

  for (const fund of fundamentos) {
    const propias = acciones.filter((a) => a.fundamento === fund);
    let sumaCruda = 0;
    let sumaNorm = 0;
    let count = 0;

    for (const a of propias) {
      const p = puntajeEfectivo(a);
      if (p === null) continue;
      sumaCruda += p * a.cantidad;
      sumaNorm += normalizarPuntaje(p) * a.cantidad;
      count += a.cantidad;
    }

    if (count > 0) {
      totalPorFundamento[fund] = sumaCruda;
      promedioPorFundamento[fund] = sumaCruda / count;
      promedioNormalizado[fund] = (sumaNorm / count) * 10;
      sumaNormTotal += sumaNorm;
      countNormTotal += count;
      sumaCrudaTotal += sumaCruda;
      countCrudaTotal += count;
    }
  }

  return {
    promedioNormalizado,
    mediaNormalizadaBase:
      countNormTotal > 0 ? (sumaNormTotal / countNormTotal) * 10 : 0,
    valoracionMediaCruda:
      countCrudaTotal > 0 ? sumaCrudaTotal / countCrudaTotal : 0,
    totalPorFundamento,
    promedioPorFundamento,
  };
}

export function calcularMaxAccionesPorFundamento(
  acciones: AccionDB[],
  jugadoresIds: string[]
): Record<string, number> {
  const fundamentos = [
    "saque",
    "recepcion",
    "ataque",
    "bloqueo",
    "defensa",
    "armados",
    "toque",
  ];
  const max: Record<string, number> = {};
  for (const f of fundamentos) {
    let m = 1;
    for (const jid of jugadoresIds) {
      const cant = acciones
        .filter((a) => a.jugador_id === jid && a.fundamento === f)
        .reduce((s, a) => s + a.cantidad, 0);
      if (cant > m) m = cant;
    }
    max[f] = m;
  }
  return max;
}

export function calcularMaxAccionesPorSet(
  acciones: AccionDB[],
  jugadoresIds: string[],
  fundamento: string
): Record<number, number> {
  const maxPorSet: Record<number, number> = {};
  for (let s = 1; s <= 5; s++) maxPorSet[s] = 1;
  for (const jid of jugadoresIds) {
    for (let s = 1; s <= 5; s++) {
      const cant = acciones
        .filter(
          (a) =>
            a.jugador_id === jid &&
            a.fundamento === fundamento &&
            a.set_numero === s
        )
        .reduce((sum, a) => sum + a.cantidad, 0);
      if (cant > maxPorSet[s]) maxPorSet[s] = cant;
    }
  }
  return maxPorSet;
}

export function calcularPromedioPonderadoPorSet(
  jugadorId: string,
  todasAcciones: AccionDB[],
  jugadoresIdsEquipo: string[],
  fundamento: string,
  _valores: Record<string, number> = {}
): PromedioPorSet[] {
  const maxPorSet = calcularMaxAccionesPorSet(
    todasAcciones,
    jugadoresIdsEquipo,
    fundamento
  );
  const exp = getExponente(fundamento);
  const propias = todasAcciones.filter(
    (a) => a.jugador_id === jugadorId && a.fundamento === fundamento
  );
  const result: PromedioPorSet[] = [];
  for (let s = 1; s <= 5; s++) {
    const delSet = propias.filter((a) => a.set_numero === s);
    let suma = 0;
    let total = 0;
    for (const a of delSet) {
      const p = puntajeEfectivo(a);
      if (p === null) continue;
      suma += p * a.cantidad;
      total += a.cantidad;
    }
    const promedioBruto = total > 0 ? suma / total : 0;
    const max = maxPorSet[s] ?? 1;
    const factor = total > 0 ? Math.pow(total / max, exp) : 0;
    const valorVisual =
      total > 0 ? promedioBruto * factor + (1 - factor) * 5 : 0;
    result.push({ set: s, promedio: valorVisual, total });
  }
  return result;
}

export function calcularPromedioArmadosPonderadoPorSet(
  jugadorId: string,
  todasAcciones: AccionDB[],
  jugadoresIdsEquipo: string[]
): PromedioArmadosSet[] {
  const maxPorSet = calcularMaxAccionesPorSet(
    todasAcciones,
    jugadoresIdsEquipo,
    "armados"
  );
  const exp = getExponente("armados");
  const propias = todasAcciones.filter(
    (a) => a.jugador_id === jugadorId && a.fundamento === "armados"
  );
  const result: PromedioArmadosSet[] = [];
  for (let s = 1; s <= 5; s++) {
    const delSet = propias.filter((a) => a.set_numero === s);
    let suma = 0;
    let count = 0;
    for (const a of delSet) {
      const p = puntajeEfectivo(a);
      if (p === null) continue;
      suma += p * a.cantidad;
      count += a.cantidad;
    }
    const promedioBruto = count > 0 ? suma / count : 0;
    const max = maxPorSet[s] ?? 1;
    const factor = count > 0 ? Math.pow(count / max, exp) : 0;
    const valorVisual =
      count > 0 ? promedioBruto * factor + (1 - factor) * 5 : 0;
    result.push({
      set: s,
      promedio: valorVisual,
      totalArmados: count,
    });
  }
  return result;
}

function calcularEstadisticasArmador(
  propias: AccionDB[]
): EstadisticasArmador {
  const distribucionTendencia: DistribucionTendencia = {
    zona_4: contarPorValoraciones(propias, "tendencia", ["zona_4"]),
    zona_3: contarPorValoraciones(propias, "tendencia", ["zona_3"]),
    zona_2: contarPorValoraciones(propias, "tendencia", ["zona_2"]),
    zona_6: contarPorValoraciones(propias, "tendencia", ["zona_6"]),
    zona_1: contarPorValoraciones(propias, "tendencia", ["zona_1"]),
    toque:
      contarPorValoraciones(propias, "toque", ["punto"]) +
      contarPorValoraciones(propias, "toque", ["error"]) +
      contarPorValoraciones(propias, "toque", ["neutro"]),
    total: 0,
  };
  distribucionTendencia.total =
    distribucionTendencia.zona_4 +
    distribucionTendencia.zona_3 +
    distribucionTendencia.zona_2 +
    distribucionTendencia.zona_6 +
    distribucionTendencia.zona_1 +
    distribucionTendencia.toque;

  const toquesPunto = contarPorValoraciones(propias, "toque", ["punto"]);
  const toquesError = contarPorValoraciones(propias, "toque", ["error"]);
  const toquesNeutro = contarPorValoraciones(propias, "toque", ["neutro"]);

  const promediosArmados: PromedioArmadosSet[] = [];
  let sumaTotal = 0;
  let totalArmados = 0;
  for (let s = 1; s <= 5; s++) {
    const delSet = propias.filter(
      (a) => a.fundamento === "armados" && a.set_numero === s
    );
    let sumaSet = 0;
    let countSet = 0;
    for (const a of delSet) {
      const p = puntajeEfectivo(a);
      if (p === null) continue;
      sumaSet += p * a.cantidad;
      countSet += a.cantidad;
    }
    const promedio = countSet > 0 ? sumaSet / countSet : 0;
    promediosArmados.push({
      set: s,
      promedio,
      totalArmados: countSet,
    });
    sumaTotal += sumaSet;
    totalArmados += countSet;
  }
  const promedioArmadosGlobal =
    totalArmados > 0 ? sumaTotal / totalArmados : 0;

  return {
    distribucionTendencia,
    promediosArmados,
    promedioArmadosGlobal,
    toquesPunto,
    toquesError,
    toquesNeutro,
  };
}

function calcularEstadisticasRecepcion(propias: AccionDB[]) {
  const promediosPorSet: PromedioRecepcionSet[] = [];
  let sumaTotal = 0;
  let totalRecepciones = 0;
  for (let s = 1; s <= 5; s++) {
    const delSet = propias.filter(
      (a) => a.fundamento === "recepcion" && a.set_numero === s
    );
    let sumaSet = 0;
    let countSet = 0;
    for (const a of delSet) {
      const p = puntajeEfectivo(a);
      if (p === null) continue;
      sumaSet += p * a.cantidad;
      countSet += a.cantidad;
    }
    const promedio = countSet > 0 ? sumaSet / countSet : 0;
    promediosPorSet.push({
      set: s,
      promedio,
      totalRecepciones: countSet,
    });
    sumaTotal += sumaSet;
    totalRecepciones += countSet;
  }
  return {
    promediosPorSet,
    promedioGlobal:
      totalRecepciones > 0 ? sumaTotal / totalRecepciones : 0,
  };
}

export function calcularPromedioPorSet(
  jugadorId: string,
  acciones: AccionDB[],
  fundamento: string,
  _valores: Record<string, number> = {}
): PromedioPorSet[] {
  const propias = acciones.filter(
    (a) => a.jugador_id === jugadorId && a.fundamento === fundamento
  );
  const result: PromedioPorSet[] = [];
  for (let s = 1; s <= 5; s++) {
    const delSet = propias.filter((a) => a.set_numero === s);
    let suma = 0;
    let total = 0;
    for (const a of delSet) {
      const p = puntajeEfectivo(a);
      if (p === null) continue;
      suma += p * a.cantidad;
      total += a.cantidad;
    }
    result.push({
      set: s,
      promedio: total > 0 ? suma / total : 0,
      total,
    });
  }
  return result;
}

export function calcularEstadisticasJugador(
  jugadorId: string,
  acciones: AccionDB[],
  esArmador: boolean = false,
  maxAccionesPorFundamento?: Record<string, number>,
  maxAccionesEquipo?: number,
  minAccionesRadar: number = MIN_ACCIONES_RADAR
): EstadisticasJugador {
  const propias = acciones.filter((a) => a.jugador_id === jugadorId);

  const fundamentosDisplay = esArmador
    ? ["saque", "bloqueo", "defensa"]
    : ["saque", "recepcion", "ataque", "bloqueo", "defensa"];

  const fundamentosValoracion = esArmador
    ? ["saque", "bloqueo", "defensa", "armados", "toque"]
    : ["saque", "recepcion", "ataque", "bloqueo", "defensa"];

  const porFundamento: Record<string, EstadisticasFundamento> = {};
  let totalAcciones = 0;
  let totalPositivos = 0;
  let totalNegativos = 0;
  let totalPuntos = 0;
  let totalErrores = 0;
  let saldoTotal = 0;

  for (const fund of fundamentosDisplay) {
    const est = calcularFundamentoNormal(propias, fund);
    porFundamento[fund] = est;
    totalAcciones += est.total;
    totalPositivos += est.positivos;
    totalNegativos += est.negativos;
    totalPuntos += est.puntos;
    totalErrores += est.errores;
    saldoTotal += est.saldo;
  }

  let armador: EstadisticasArmador | undefined;
  if (esArmador) {
    armador = calcularEstadisticasArmador(propias);
    totalPuntos += armador.toquesPunto;
    totalErrores += armador.toquesError;
    saldoTotal += armador.toquesPunto - armador.toquesError;
    totalAcciones +=
      contarTotal(propias, "armados") +
      contarTotal(propias, "toque");
  }

  const saldoDefPos = contarPorValoraciones(
    propias,
    "defensa",
    SALDO_DEF_POSITIVOS
  );
  const saldoDefNeg = contarPorValoraciones(
    propias,
    "defensa",
    SALDO_DEF_NEGATIVOS
  );
  const saldoDefensivo = saldoDefPos - saldoDefNeg;

  const vals = calcularValoraciones(propias, fundamentosValoracion);

  let maxAcc: number;
  if (maxAccionesEquipo !== undefined) maxAcc = maxAccionesEquipo;
  else {
    const accPorJugador: Record<string, number> = {};
    for (const a of acciones) {
      accPorJugador[a.jugador_id] =
        (accPorJugador[a.jugador_id] ?? 0) + a.cantidad;
    }
    maxAcc = Math.max(...Object.values(accPorJugador), 1);
  }

  const factorVolumen =
    maxAcc > 0 && totalAcciones > 0
      ? Math.sqrt(totalAcciones / maxAcc)
      : 0;
  const valoracionMediaNormalizada =
    vals.mediaNormalizadaBase * factorVolumen;

  const valoracionPonderadaPorFundamento: Record<string, number> = {};
  const maxPorFund =
    maxAccionesPorFundamento ??
    calcularMaxAccionesPorFundamento(acciones, [jugadorId]);
  for (const f of fundamentosValoracion) {
    const accFund = contarTotal(propias, f);

    if (accFund < minAccionesRadar) {
      valoracionPonderadaPorFundamento[f] = 0;
      continue;
    }

    const propiasFund = propias.filter((a) => a.fundamento === f);
    let suma = 0;
    let count = 0;
    for (const a of propiasFund) {
      const p = puntajeEfectivo(a);
      if (p === null) continue;
      suma += p * a.cantidad;
      count += a.cantidad;
    }
    const promedio = count > 0 ? suma / count : 5;

    const maxFund = maxPorFund[f] ?? 1;
    const exp = getExponente(f);
    const factorVol = Math.pow(count / maxFund, exp);

    const valor = promedio * factorVol + 5 * (1 - factorVol);
    valoracionPonderadaPorFundamento[f] =
      Math.round(Math.max(0, Math.min(10, valor)) * 10) / 10;
  }

  let recepcion: EstadisticasJugador["recepcion"] | undefined;
  if (!esArmador) recepcion = calcularEstadisticasRecepcion(propias);

  return {
    jugador_id: jugadorId,
    totalAcciones,
    totalPositivos,
    totalNegativos,
    totalPuntos,
    totalErrores,
    saldoTotal,
    saldoDefensivo,
    valoracionMedia: vals.valoracionMediaCruda,
    valoracionPorFundamento: vals.promedioPorFundamento,
    valoracionTotalPorFundamento: vals.totalPorFundamento,
    valoracionMediaNormalizada,
    valoracionPromedioNormalizado: vals.promedioNormalizado,
    valoracionPonderadaPorFundamento,
    factorVolumen,
    porFundamento,
    armador,
    recepcion,
  };
}

export function calcularEstadisticasEquipo(
  jugadoresIds: string[],
  acciones: AccionDB[],
  jugadoresArmadores: Set<string> = new Set()
): {
  porJugador: Record<string, EstadisticasJugador>;
  totales: EstadisticasJugador;
} {
  const maxPorFund = calcularMaxAccionesPorFundamento(
    acciones,
    jugadoresIds
  );
  let maxAccionesEquipo = 1;
  for (const id of jugadoresIds) {
    const totalAcc = acciones
      .filter((a) => a.jugador_id === id)
      .reduce((suma, a) => suma + a.cantidad, 0);
    if (totalAcc > maxAccionesEquipo) maxAccionesEquipo = totalAcc;
  }

  const porJugador: Record<string, EstadisticasJugador> = {};
  const fundamentos = [
    "saque",
    "recepcion",
    "ataque",
    "bloqueo",
    "defensa",
  ];

  const totalesIniciales: EstadisticasJugador = {
    jugador_id: "TOTAL",
    totalAcciones: 0,
    totalPositivos: 0,
    totalNegativos: 0,
    totalPuntos: 0,
    totalErrores: 0,
    saldoTotal: 0,
    saldoDefensivo: 0,
    valoracionMedia: 0,
    valoracionPorFundamento: {},
    valoracionTotalPorFundamento: {},
    valoracionMediaNormalizada: 0,
    valoracionPromedioNormalizado: {},
    valoracionPonderadaPorFundamento: {},
    factorVolumen: 1,
    porFundamento: {},
  };

  for (const fund of fundamentos) {
    totalesIniciales.porFundamento[fund] = {
      fundamento: fund,
      total: 0,
      positivos: 0,
      negativos: 0,
      puntos: 0,
      errores: 0,
      saldo: 0,
      efectividad: 0,
    };
  }

  let sumaNormTotal = 0;
  let countNormTotal = 0;

  for (const id of jugadoresIds) {
    const est = calcularEstadisticasJugador(
      id,
      acciones,
      jugadoresArmadores.has(id),
      maxPorFund,
      maxAccionesEquipo
    );
    porJugador[id] = est;

    totalesIniciales.totalAcciones += est.totalAcciones;
    totalesIniciales.totalPositivos += est.totalPositivos;
    totalesIniciales.totalNegativos += est.totalNegativos;
    totalesIniciales.totalPuntos += est.totalPuntos;
    totalesIniciales.totalErrores += est.totalErrores;
    totalesIniciales.saldoTotal += est.saldoTotal;
    totalesIniciales.saldoDefensivo += est.saldoDefensivo;

    for (const [fund, val] of Object.entries(
      est.valoracionPromedioNormalizado
    )) {
      const totalFund = est.porFundamento[fund]?.total ?? 0;
      if (!totalesIniciales.valoracionPromedioNormalizado[fund]) {
        totalesIniciales.valoracionPromedioNormalizado[fund] = 0;
      }
      totalesIniciales.valoracionPromedioNormalizado[fund] +=
        val * totalFund;
      sumaNormTotal += val * totalFund;
      countNormTotal += totalFund;
    }

    for (const fund of fundamentos) {
      const ef = est.porFundamento[fund];
      if (!ef) continue;
      const tf = totalesIniciales.porFundamento[fund];
      tf.total += ef.total;
      tf.positivos += ef.positivos;
      tf.negativos += ef.negativos;
      tf.puntos += ef.puntos;
      tf.errores += ef.errores;
      tf.saldo += ef.saldo;
    }
  }

  for (const fund of fundamentos) {
    const tf = totalesIniciales.porFundamento[fund];
    tf.efectividad = tf.total > 0 ? (tf.saldo / tf.total) * 100 : 0;
    if (
      totalesIniciales.valoracionPromedioNormalizado[fund] !== undefined
    ) {
      totalesIniciales.valoracionPromedioNormalizado[fund] =
        tf.total > 0
          ? totalesIniciales.valoracionPromedioNormalizado[fund] / tf.total
          : 0;
    }
  }

  for (const fund of fundamentos) {
    let suma = 0;
    let count = 0;
    for (const id of jugadoresIds) {
      const val = porJugador[id]?.valoracionPonderadaPorFundamento[fund] ?? 0;
      if (val > 0) {
        suma += val;
        count += 1;
      }
    }
    totalesIniciales.valoracionPonderadaPorFundamento[fund] =
      count > 0 ? Math.round((suma / count) * 10) / 10 : 0;
  }

  totalesIniciales.valoracionMediaNormalizada =
    countNormTotal > 0 ? sumaNormTotal / countNormTotal : 0;

  return { porJugador, totales: totalesIniciales };
}

// ============================================
// RANKINGS
// ============================================

export interface RankingCompletoItem {
  jugador_id: string;
  valor: number;
  texto: string;
  positivas?: number;
  negativas?: number;
  balance?: number;
  eficacia?: number;
  efectividad?: number;
  puntos?: number;
  errores?: number;
}

export function contarSetsJugados(
  acciones: AccionDB[],
  jugadorId: string
): number {
  const sets = new Set<string>();
  for (const a of acciones) {
    if (a.jugador_id === jugadorId) {
      const key = `${a.partido_id ?? "sin-partido"}-${a.set_numero}`;
      sets.add(key);
    }
  }
  return sets.size;
}

function calificaParaRanking(
  acciones: AccionDB[],
  jugadorId: string
): boolean {
  return contarSetsJugados(acciones, jugadorId) >= MIN_SETS_RANKING;
}

export function rankingRecepcion(
  porJugador: Record<string, EstadisticasJugador>,
  acciones: AccionDB[]
): RankingCompletoItem[] {
  return Object.values(porJugador)
    .filter((est) => calificaParaRanking(acciones, est.jugador_id))
    .map((est) => {
      const propias = acciones.filter(
        (a) => a.jugador_id === est.jugador_id
      );
      const positivos = contarPorValoraciones(propias, "recepcion", [
        "2x_positiva",
        "positiva",
      ]);
      const total = contarTotal(propias, "recepcion");
      const sets = contarSetsJugados(acciones, est.jugador_id);
      const efectividad = total > 0 ? (positivos / total) * 100 : 0;
      const porSet = sets > 0 ? positivos / sets : 0;
      return {
        jugador_id: est.jugador_id,
        valor: porSet,
        texto: `${positivos} pases positivos / ${efectividad.toFixed(1)}% de efectividad en ${total} intentos / ${sets} sets (${porSet.toFixed(2)} por set)`,
      };
    })
    .filter((r) => r.valor > 0)
    .sort((a, b) => b.valor - a.valor);
}

export function rankingAtaque(
  porJugador: Record<string, EstadisticasJugador>,
  acciones: AccionDB[]
): RankingCompletoItem[] {
  return Object.values(porJugador)
    .filter((est) => calificaParaRanking(acciones, est.jugador_id))
    .map((est) => {
      const propias = acciones.filter(
        (a) => a.jugador_id === est.jugador_id && a.fundamento === "ataque"
      );

      const puntos = contarPorValoraciones(propias, "ataque", ["punto"]);
      const errores = contarPorValoraciones(propias, "ataque", ["error"]);
      const total = contarTotal(propias, "ataque");

      const eficacia = total > 0 ? (puntos / total) * 100 : 0;
      const efectividad =
        total > 0 ? ((puntos - errores) / total) * 100 : 0;

      const valor = (efectividad + eficacia / 2) / 2;

      return {
        jugador_id: est.jugador_id,
        valor,
        texto: `${puntos} puntos / ${errores} errores / ${total} ataques / Eficacia: ${eficacia.toFixed(1)}% / Efectividad: ${efectividad.toFixed(1)}% / Valor: ${valor.toFixed(1)}%`,
        puntos,
        errores,
        eficacia,
        efectividad,
      };
    })
    .filter((r) => r.valor !== 0 || (r.eficacia ?? 0) !== 0)
    .sort((a, b) => b.valor - a.valor);
}

export function rankingBloqueo(
  porJugador: Record<string, EstadisticasJugador>,
  acciones: AccionDB[]
): RankingCompletoItem[] {
  const ids = Object.keys(porJugador).filter((id) =>
    calificaParaRanking(acciones, id)
  );
  const exp = 1.5;

  const ratios: Record<string, number> = {};
  let maxRatio = 1;
  for (const id of ids) {
    const sets = contarSetsJugados(acciones, id);
    const total = acciones
      .filter((a) => a.jugador_id === id && a.fundamento === "bloqueo")
      .reduce((s, a) => s + a.cantidad, 0);
    const ratio = sets > 0 ? total / sets : 0;
    ratios[id] = ratio;
    if (ratio > maxRatio) maxRatio = ratio;
  }

  return Object.values(porJugador)
    .filter((est) => calificaParaRanking(acciones, est.jugador_id))
    .map((est) => {
      const propias = acciones.filter(
        (a) =>
          a.jugador_id === est.jugador_id && a.fundamento === "bloqueo"
      );
      const sets = contarSetsJugados(acciones, est.jugador_id);

      let sumaValores = 0;
      let total = 0;
      for (const a of propias) {
        const p = puntajeEfectivo(a);
        if (p === null) continue;
        sumaValores += p * a.cantidad;
        total += a.cantidad;
      }
      const promedioBruto = total > 0 ? sumaValores / total : 5;
      const calidadPorSet = sets > 0 ? (promedioBruto - 5) * sets : 0;
      const ratio = ratios[est.jugador_id] ?? 0;
      const factor = maxRatio > 0 ? Math.pow(ratio / maxRatio, exp) : 0;
      const valor = calidadPorSet * factor;

      const puntos = contarPorValoraciones(propias, "bloqueo", ["punto"]);
      const positivos = contarPorValoraciones(propias, "bloqueo", [
        "positivo_mas",
        "positivo",
      ]);
      const errores = contarPorValoraciones(propias, "bloqueo", [
        "use_rival",
        "red",
      ]);

      return {
        jugador_id: est.jugador_id,
        valor,
        texto: `${puntos} puntos / ${positivos} positivos / ${errores} errores / ${total} bloqueos en ${sets} sets / Promedio: ${promedioBruto.toFixed(2)}`,
      };
    })
    .filter((r) => r.valor !== 0)
    .sort((a, b) => b.valor - a.valor);
}

export function rankingSaque(
  porJugador: Record<string, EstadisticasJugador>,
  acciones: AccionDB[]
): RankingCompletoItem[] {
  return Object.values(porJugador)
    .filter((est) => calificaParaRanking(acciones, est.jugador_id))
    .map((est) => {
      const propias = acciones.filter(
        (a) => a.jugador_id === est.jugador_id && a.fundamento === "saque"
      );
      const sets = contarSetsJugados(acciones, est.jugador_id);

      let sumaValores = 0;
      let total = 0;
      for (const a of propias) {
        const p = puntajeEfectivo(a);
        if (p === null) continue;
        sumaValores += p * a.cantidad;
        total += a.cantidad;
      }
      const promedio = total > 0 ? sumaValores / total : 5;
      const valor = sets > 0 ? (promedio - 5) * sets : 0;

      const aces = contarPorValoraciones(propias, "saque", ["ace"]);
      const positivosMas = contarPorValoraciones(propias, "saque", [
        "positivo_mas",
      ]);
      const positivos = contarPorValoraciones(propias, "saque", [
        "positivo",
      ]);
      const errores = contarPorValoraciones(propias, "saque", ["negativo"]);

      return {
        jugador_id: est.jugador_id,
        valor,
        texto: `${aces} aces / ${positivosMas} pos+ / ${positivos} pos / ${errores} errores / Promedio: ${promedio.toFixed(2)} en ${sets} sets`,
      };
    })
    .filter((r) => r.valor !== 0)
    .sort((a, b) => b.valor - a.valor);
}

export function rankingDefensa(
  porJugador: Record<string, EstadisticasJugador>,
  acciones: AccionDB[]
): RankingCompletoItem[] {
  return Object.values(porJugador)
    .filter((est) => calificaParaRanking(acciones, est.jugador_id))
    .map((est) => {
      const propias = acciones.filter(
        (a) => a.jugador_id === est.jugador_id && a.fundamento === "defensa"
      );

      let sumaValores = 0;
      let total = 0;
      for (const a of propias) {
        const p = puntajeEfectivo(a);
        if (p === null) continue;
        sumaValores += p * a.cantidad;
        total += a.cantidad;
      }
      const promedio = total > 0 ? sumaValores / total : 5;
      const valor = promedio;

      const positivas = contarPorValoraciones(propias, "defensa", [
        "toque_positiva",
        "gran_def",
        "cobertura_positiva",
      ]);
      const negativas = contarPorValoraciones(propias, "defensa", [
        "toque_negativa",
        "mala_libre",
        "error_def",
        "cobertura_negativa",
        "errores_graves",
      ]);

      return {
        jugador_id: est.jugador_id,
        valor,
        texto: `${positivas} positivas / ${negativas} negativas / Promedio: ${promedio.toFixed(2)}`,
        positivas,
        negativas,
        balance: positivas - negativas,
      };
    })
    .filter((r) => r.valor !== 0)
    .sort((a, b) => b.valor - a.valor);
}

export function rankingConsistencia(
  porJugador: Record<string, EstadisticasJugador>,
  acciones: AccionDB[]
): RankingCompletoItem[] {
  const valoresPositivos = [
    "ace",
    "positivo_mas",
    "positivo",
    "2x_positiva",
    "positiva",
    "punto",
    "toque_positiva",
    "gran_def",
    "cobertura_positiva",
  ];
  const erroresNoForzados = [
    "negativo",
    "ace_contra",
    "error",
    "red",
    "error_def",
    "errores_graves",
    "mala_libre",
  ];
  return Object.values(porJugador)
    .filter((est) => calificaParaRanking(acciones, est.jugador_id))
    .map((est) => {
      const propias = acciones.filter(
        (a) => a.jugador_id === est.jugador_id
      );
      const positivas = propias
        .filter((a) => valoresPositivos.includes(a.valoracion))
        .reduce((s, a) => s + a.cantidad, 0);
      const errores = propias
        .filter((a) => erroresNoForzados.includes(a.valoracion))
        .reduce((s, a) => s + a.cantidad, 0);
      const ratio = errores > 0 ? positivas / errores : positivas;
      return {
        jugador_id: est.jugador_id,
        valor: ratio,
        texto: `Ratio de ${ratio.toFixed(2)} acciones positivas por cada error no forzado`,
      };
    })
    .filter((r) => r.valor > 0)
    .sort((a, b) => b.valor - a.valor);
}

export function calcularPodios(
  porJugador: Record<string, EstadisticasJugador>,
  acciones: AccionDB[]
): Record<string, Record<string, number>> {
  const resultado: Record<string, Record<string, number>> = {};

  const agregar = (fundamento: string, items: RankingCompletoItem[]) => {
    items.slice(0, 3).forEach((item, idx) => {
      if (!resultado[item.jugador_id]) resultado[item.jugador_id] = {};
      resultado[item.jugador_id][fundamento] = idx + 1;
    });
  };

  agregar("saque", rankingSaque(porJugador, acciones));
  agregar("recepcion", rankingRecepcion(porJugador, acciones));
  agregar("ataque", rankingAtaque(porJugador, acciones));
  agregar("bloqueo", rankingBloqueo(porJugador, acciones));
  agregar("defensa", rankingDefensa(porJugador, acciones));

  return resultado;
}

export function rankingDeJugador(
  jugadorId: string,
  porJugador: Record<string, EstadisticasJugador>,
  acciones: AccionDB[]
): Record<string, string> {
  const resultado: Record<string, string> = {};

  const buscar = (
    fundamento: string,
    items: RankingCompletoItem[]
  ) => {
    const item = items.find((i) => i.jugador_id === jugadorId);
    if (item) resultado[fundamento] = item.texto;
  };

  buscar("recepcion", rankingRecepcion(porJugador, acciones));
  buscar("ataque", rankingAtaque(porJugador, acciones));
  buscar("bloqueo", rankingBloqueo(porJugador, acciones));
  buscar("saque", rankingSaque(porJugador, acciones));
  buscar("defensa", rankingDefensa(porJugador, acciones));
  buscar("consistencia", rankingConsistencia(porJugador, acciones));

  return resultado;
}

export function calcularPromediosEquipoPorSet(
  acciones: AccionDB[],
  fundamento: string,
  _valores: Record<string, number> = {}
): PromedioPorSet[] {
  const result: PromedioPorSet[] = [];
  for (let s = 1; s <= 5; s++) {
    const delSet = acciones.filter(
      (a) => a.fundamento === fundamento && a.set_numero === s
    );
    let suma = 0;
    let total = 0;
    for (const a of delSet) {
      const p = puntajeEfectivo(a);
      if (p === null) continue;
      suma += p * a.cantidad;
      total += a.cantidad;
    }
    result.push({
      set: s,
      promedio: total > 0 ? suma / total : 0,
      total,
    });
  }
  return result;
}

export function calcularPromediosEquipoArmadosPorSet(
  acciones: AccionDB[]
): PromedioArmadosSet[] {
  const result: PromedioArmadosSet[] = [];
  for (let s = 1; s <= 5; s++) {
    const delSet = acciones.filter(
      (a) => a.fundamento === "armados" && a.set_numero === s
    );
    let suma = 0;
    let total = 0;
    for (const a of delSet) {
      const p = puntajeEfectivo(a);
      if (p === null) continue;
      suma += p * a.cantidad;
      total += a.cantidad;
    }
    result.push({
      set: s,
      promedio: total > 0 ? suma / total : 0,
      totalArmados: total,
    });
  }
  return result;
}

export interface RankingItem {
  jugador_id: string;
  valor: number;
}

export function top3(
  stats: Record<string, EstadisticasJugador>,
  metrica: (e: EstadisticasJugador) => number
): RankingItem[] {
  return Object.values(stats)
    .map((e) => ({ jugador_id: e.jugador_id, valor: metrica(e) }))
    .filter((r) => r.valor !== 0)
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 3);
}