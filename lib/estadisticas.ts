// ============================================
// MOTOR DE ESTADÍSTICAS DE VOLEYSTATS
// ============================================

export interface AccionDB {
  jugador_id: string;
  set_numero: number;
  fundamento: string;
  valoracion: string;
  cantidad: number;
}

// Acciones positivas (para contar totales y saldo en recepción/defensa)
const ACCIONES_POSITIVAS: Record<string, string[]> = {
  saque: ["ace", "positivo_mas", "positivo"],
  recepcion: ["2x_positiva", "positiva"],
  ataque: ["punto"],
  bloqueo: ["punto", "positivo_mas", "positivo"],
  defensa: ["toque_positiva", "gran_def", "cobertura_positiva"],
};

// Acciones negativas (para contar totales y saldo en recepción/defensa)
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

// Puntos directos
const PUNTOS: Record<string, string[]> = {
  saque: ["ace"],
  recepcion: [],
  ataque: ["punto"],
  bloqueo: ["punto"],
  defensa: [],
};

// Errores (dan punto al rival)
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

export interface EstadisticasJugador {
  jugador_id: string;
  totalAcciones: number;
  totalPositivos: number;
  totalNegativos: number;
  totalPuntos: number;
  totalErrores: number;
  saldoTotal: number;
  porFundamento: Record<string, EstadisticasFundamento>;
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

export function calcularEstadisticasJugador(
  jugadorId: string,
  acciones: AccionDB[]
): EstadisticasJugador {
  const propias = acciones.filter((a) => a.jugador_id === jugadorId);

  const fundamentos = ["saque", "recepcion", "ataque", "bloqueo", "defensa"];
  const porFundamento: Record<string, EstadisticasFundamento> = {};

  let totalAcciones = 0;
  let totalPositivos = 0;
  let totalNegativos = 0;
  let totalPuntos = 0;
  let totalErrores = 0;
  let saldoTotal = 0;

  for (const fund of fundamentos) {
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

    // Saldo según regla del usuario
    let saldo: number;
    if (fund === "saque" || fund === "ataque" || fund === "bloqueo") {
      saldo = puntos - errores;
    } else {
      saldo = positivos - negativos;
    }

    const efectividad = total > 0 ? (saldo / total) * 100 : 0;

    porFundamento[fund] = {
      fundamento: fund,
      total,
      positivos,
      negativos,
      puntos,
      errores,
      saldo,
      efectividad,
    };

    totalAcciones += total;
    totalPositivos += positivos;
    totalNegativos += negativos;
    totalPuntos += puntos;
    totalErrores += errores;
    saldoTotal += saldo;
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
  };
}

export function calcularEstadisticasEquipo(
  jugadoresIds: string[],
  acciones: AccionDB[]
): {
  porJugador: Record<string, EstadisticasJugador>;
  totales: EstadisticasJugador;
} {
  const porJugador: Record<string, EstadisticasJugador> = {};
  const fundamentos = ["saque", "recepcion", "ataque", "bloqueo", "defensa"];

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
    const est = calcularEstadisticasJugador(id, acciones);
    porJugador[id] = est;

    totalesIniciales.totalAcciones += est.totalAcciones;
    totalesIniciales.totalPositivos += est.totalPositivos;
    totalesIniciales.totalNegativos += est.totalNegativos;
    totalesIniciales.totalPuntos += est.totalPuntos;
    totalesIniciales.totalErrores += est.totalErrores;
    totalesIniciales.saldoTotal += est.saldoTotal;

    for (const fund of fundamentos) {
      const ef = est.porFundamento[fund];
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