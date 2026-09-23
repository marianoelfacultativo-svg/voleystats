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

// ============================================
// DEFINICIONES PARA JUGADOR NORMAL
// ============================================

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

const PUNTOS: Record<string, string[]> = {
  saque: ["ace"],
  recepcion: [],
  ataque: ["punto"],
  bloqueo: ["punto"],
  defensa: [],
};

const ERRORES: Record<string, string[]> = {
  saque: ["negativo"],
  recepcion: ["ace_contra"],
  ataque: ["error"],
  bloqueo: ["use_rival"],
  defensa: ["error_def", "errores_graves"],
};

// ============================================
// TIPOS DE RESULTADO
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
  porFundamento: Record<string, EstadisticasFundamento>;
  armador?: EstadisticasArmador;
  recepcion?: {
    promediosPorSet: PromedioRecepcionSet[];
    promedioGlobal: number;
  };
}

// ============================================
// FUNCIONES DE CÁLCULO
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
  const puntos = contarPorValoraciones(propias, fund, PUNTOS[fund] ?? []);
  const errores = contarPorValoraciones(propias, fund, ERRORES[fund] ?? []);

  let saldo: number;
  if (fund === "saque" || fund === "ataque" || fund === "bloqueo") {
    saldo = puntos - errores;
  } else {
    saldo = positivos - negativos;
  }

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

  const VALORES: Record<string, number> = {
    horrible: 1,
    malo: 2,
    flojo: 3,
    correcto: 4,
    perfecto: 5,
  };

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
      const v = VALORES[a.valoracion] ?? 0;
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

function calcularEstadisticasRecepcion(propias: AccionDB[]): {
  promediosPorSet: PromedioRecepcionSet[];
  promedioGlobal: number;
} {
  const VALORES: Record<string, number> = {
    "2x_positiva": 5,
    positiva: 4,
    negativa: 3,
    "2x_negativa": 2,
    "3x_negativa": 1,
    ace_contra: 0,
  };

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
      const v = VALORES[a.valoracion] ?? 0;
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

export function calcularEstadisticasJugador(
  jugadorId: string,
  acciones: AccionDB[],
  esArmador: boolean = false
): EstadisticasJugador {
  const propias = acciones.filter((a) => a.jugador_id === jugadorId);

  const fundamentos = esArmador
    ? ["saque", "bloqueo", "defensa"]
    : ["saque", "recepcion", "ataque", "bloqueo", "defensa"];

  const porFundamento: Record<string, EstadisticasFundamento> = {};

  let totalAcciones = 0;
  let totalPositivos = 0;
  let totalNegativos = 0;
  let totalPuntos = 0;
  let totalErrores = 0;
  let saldoTotal = 0;

  for (const fund of fundamentos) {
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
      armador.distribucionTendencia.total + contarTotal(propias, "armados");
  }

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

  for (const id of jugadoresIds) {
    const est = calcularEstadisticasJugador(
      id,
      acciones,
      jugadoresArmadores.has(id)
    );
    porJugador[id] = est;

    totalesIniciales.totalAcciones += est.totalAcciones;
    totalesIniciales.totalPositivos += est.totalPositivos;
    totalesIniciales.totalNegativos += est.totalNegativos;
    totalesIniciales.totalPuntos += est.totalPuntos;
    totalesIniciales.totalErrores += est.totalErrores;
    totalesIniciales.saldoTotal += est.saldoTotal;

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
  }

  return { porJugador, totales: totalesIniciales };
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