// ============================================
// MOTOR DE ESTADÍSTICAS DE VOLEYSTATS
// ============================================

export interface AccionDB {
  jugador_id: string;
  partido_id?: string;
  set_numero: number;
  fundamento: string;
  valoracion: string;
  cantidad: number;
}

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

export const VALORES_SAQUE: Record<string, number> = {
  ace: 5,
  positivo_mas: 4,
  positivo: 3,
  neutro: 1,
  negativo: -2,
};

export const VALORES_RECEPCION: Record<string, number> = {
  "2x_positiva": 5,
  positiva: 4,
  negativa: 3,
  "2x_negativa": 2,
  "3x_negativa": 1,
  ace_contra: 0,
};

export const VALORES_ATAQUE: Record<string, number> = {
  punto: 4,
  neutro: 0,
  error: -4,
};

export const VALORES_BLOQUEO: Record<string, number> = {
  punto: 4,
  positivo_mas: 2,
  positivo: 1,
  use_rival: -1,
  red: -2,
  filtrada: -1,
};

export const VALORES_DEFENSA: Record<string, number> = {
  toque_positiva: 4,
  toque_negativa: -4,
  mala_libre: -8,
  error_def: -4,
  gran_def: 4,
  cobertura_positiva: 4,
  cobertura_negativa: -4,
  errores_graves: -4,
};

export const VALORES_ARMADOS: Record<string, number> = {
  horrible: -1,
  malo: 2,
  flojo: 3,
  correcto: 4,
  perfecto: 5,
};

export const VALORES_TOQUE: Record<string, number> = {
  punto: 4,
  neutro: 0,
  error: -4,
};

export const VALORES_POR_FUNDAMENTO: Record<
  string,
  Record<string, number>
> = {
  saque: VALORES_SAQUE,
  recepcion: VALORES_RECEPCION,
  ataque: VALORES_ATAQUE,
  bloqueo: VALORES_BLOQUEO,
  defensa: VALORES_DEFENSA,
  armados: VALORES_ARMADOS,
  toque: VALORES_TOQUE,
};

const RANGOS: Record<string, { min: number; max: number }> = {
  saque: { min: -2, max: 5 },
  recepcion: { min: 0, max: 5 },
  ataque: { min: -4, max: 4 },
  bloqueo: { min: -2, max: 4 },
  defensa: { min: -8, max: 4 },
  armados: { min: -1, max: 5 },
  toque: { min: -4, max: 4 },
};

function normalizarValor(fundamento: string, valorCrudo: number): number {
  const r = RANGOS[fundamento];
  if (!r) return valorCrudo;
  const rango = r.max - r.min;
  if (rango === 0) return 0;
  return ((valorCrudo - r.min) / rango) * 2 - 1;
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
  zona_4: "Zona 4",
  zona_3: "Zona 3",
  zona_2: "Zona 2",
  zona_6: "Zona 6",
  zona_1: "Zona 1",
};

// ============================================
// TIPOS
// ============================================

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
  factorVolumen: number;
  porFundamento: Record<string, EstadisticasFundamento>;
  armador?: EstadisticasArmador;
  recepcion?: {
    promediosPorSet: PromedioRecepcionSet[];
    promedioGlobal: number;
  };
}

// ============================================
// HELPERS
// ============================================

function contarPorValoraciones(
  acciones: AccionDB[],
  fundamento: string,
  valoraciones: string[]
): number {
  return acciones
    .filter(
      (a) => a.fundamento === fundamento && valoraciones.includes(a.valoracion)
    )
    .reduce((suma, a) => suma + a.cantidad, 0);
}

function contarTotal(acciones: AccionDB[], fundamento: string): number {
  return acciones
    .filter((a) => a.fundamento === fundamento)
    .reduce((suma, a) => suma + a.cantidad, 0);
}

// ============================================
// FUNDAMENTO
// ============================================

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

// ============================================
// VALORACIONES (normalizadas -10 a +10)
// ============================================

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
    const valores = VALORES_POR_FUNDAMENTO[fund];
    if (!valores) continue;

    const propias = acciones.filter((a) => a.fundamento === fund);
    let sumaCruda = 0;
    let sumaNorm = 0;
    let count = 0;

    for (const a of propias) {
      const v = valores[a.valoracion];
      if (v === undefined) continue;
      sumaCruda += v * a.cantidad;
      sumaNorm += normalizarValor(fund, v) * a.cantidad;
      count += a.cantidad;
    }

    if (count > 0) {
      totalPorFundamento[fund] = sumaCruda;
      promedioPorFundamento[fund] = sumaCruda / count;
      // Escala ×10 => -10 a +10
      promedioNormalizado[fund] = (sumaNorm / count) * 10;
      sumaNormTotal += sumaNorm;
      countNormTotal += count;
      sumaCrudaTotal += sumaCruda;
      countCrudaTotal += count;
    }
  }

  return {
    promedioNormalizado,
    // Promedio simple normalizado ×10 => rango -10 a +10
    mediaNormalizadaBase:
      countNormTotal > 0 ? (sumaNormTotal / countNormTotal) * 10 : 0,
    valoracionMediaCruda:
      countCrudaTotal > 0 ? sumaCrudaTotal / countCrudaTotal : 0,
    totalPorFundamento,
    promedioPorFundamento,
  };
}

// ============================================
// ARMADOR
// ============================================

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
      const v = VALORES_ARMADOS[a.valoracion] ?? 0;
      sumaSet += v * a.cantidad;
      countSet += a.cantidad;
    }
    const promedio = countSet > 0 ? sumaSet / countSet : 0;
    promediosArmados.push({ set: s, promedio, totalArmados: countSet });
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

// ============================================
// RECEPCIÓN
// ============================================

function calcularEstadisticasRecepcion(propias: AccionDB[]): {
  promediosPorSet: PromedioRecepcionSet[];
  promedioGlobal: number;
} {
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
      const v = VALORES_RECEPCION[a.valoracion] ?? 0;
      sumaSet += v * a.cantidad;
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

  const promedioGlobal =
    totalRecepciones > 0 ? sumaTotal / totalRecepciones : 0;

  return { promediosPorSet, promedioGlobal };
}

// ============================================
// PROMEDIO POR SET (gráfico)
// ============================================

export function calcularPromedioPorSet(
  jugadorId: string,
  acciones: AccionDB[],
  fundamento: string,
  valores: Record<string, number>
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
      const v = valores[a.valoracion] ?? 0;
      suma += v * a.cantidad;
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

// ============================================
// ESTADÍSTICAS DE UN JUGADOR
// ============================================

export function calcularEstadisticasJugador(
  jugadorId: string,
  acciones: AccionDB[],
  esArmador: boolean = false,
  maxAccionesEquipo?: number
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
      armador.distribucionTendencia.total +
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

  // Factor de volumen
  let maxAcc: number;
  if (maxAccionesEquipo !== undefined) {
    maxAcc = maxAccionesEquipo;
  } else {
    const accPorJugador: Record<string, number> = {};
    for (const a of acciones) {
      accPorJugador[a.jugador_id] =
        (accPorJugador[a.jugador_id] ?? 0) + a.cantidad;
    }
    maxAcc = Math.max(...Object.values(accPorJugador), 1);
  }

  let factorVolumen = 1;
  if (maxAcc > 0 && totalAcciones > 0) {
    factorVolumen = Math.sqrt(totalAcciones / maxAcc);
  }

  const valoracionMediaNormalizada =
    vals.mediaNormalizadaBase * factorVolumen;

  let recepcion: EstadisticasJugador["recepcion"] | undefined;
  if (!esArmador) {
    recepcion = calcularEstadisticasRecepcion(propias);
  }

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
    factorVolumen,
    porFundamento,
    armador,
    recepcion,
  };
}

// ============================================
// EQUIPO
// ============================================

export function calcularEstadisticasEquipo(
  jugadoresIds: string[],
  acciones: AccionDB[],
  jugadoresArmadores: Set<string> = new Set()
): {
  porJugador: Record<string, EstadisticasJugador>;
  totales: EstadisticasJugador;
} {
  // Calcular el máximo de acciones del equipo para el factor de volumen
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
    if (totalesIniciales.valoracionPromedioNormalizado[fund] !== undefined) {
      totalesIniciales.valoracionPromedioNormalizado[fund] =
        tf.total > 0
          ? totalesIniciales.valoracionPromedioNormalizado[fund] / tf.total
          : 0;
    }
  }

  totalesIniciales.valoracionMediaNormalizada =
    countNormTotal > 0 ? sumaNormTotal / countNormTotal : 0;

  return { porJugador, totales: totalesIniciales };
}

// ============================================
// RANKINGS
// ============================================

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