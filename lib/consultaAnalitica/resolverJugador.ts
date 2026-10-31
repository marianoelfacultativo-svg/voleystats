// ============================================================
// RESOLVER JUGADOR — helper compartido
// ============================================================
// Dado un texto libre ("Joaquín", "Joaco", "Pérez", "Joaquín Pérez")
// y la lista de jugadores del equipo (con apodo, nombre y número),
// devuelve:
//   - { ids: [id], ambiguo: false, motivo: "unico" }           → match único
//   - { ids: [id1, id2], ambiguo: true, motivo: "ambiguo" }    → desambiguar
//   - { ids: [], ambiguo: false, motivo: "no_encontrado" }     → sin match
//
// Orden de resolución (el match más específico gana):
//   1. Apodo (exacto)
//   2. Nombre completo (exacto)
//   3. Nombre completo (por inclusión, priorizando el más largo)
//   4. Apellido solo (última palabra del nombre)
//   5. Nombre de pila solo (primera palabra del nombre)
//
// Si dos o más jugadores matchean por el mismo alias del mismo largo
// → ambiguo (ej: dos "Joaquín" distintos). El motor NO debe elegir
// uno al azar: la UI tiene que pedir "Joaquín Pérez" o "Joaco".
// ============================================================

// ------------------------------------------------------------
// TIPOS
// ------------------------------------------------------------

export interface JugadorParaResolver {
  id: string;
  nombre: string;
  apodo?: string | null;
  numero?: number | null;
}

export type MotivoResolucion = "unico" | "ambiguo" | "no_encontrado";

export interface ResultadoResolucion {
  /** IDs que matchearon. Vacío si no hubo match. */
  ids: string[];
  /** true si hay más de un candidato con el mismo alias más largo. */
  ambiguo: boolean;
  /** Candidatos que matchearon. Útil para mostrar en la UI. */
  candidatos: JugadorParaResolver[];
  motivo: MotivoResolucion;
  /** Texto exacto que se usó para matchear (para el aviso). */
  match: string | null;
}

// ------------------------------------------------------------
// NORMALIZACIÓN
// ------------------------------------------------------------

function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function esTokenValido(s: string): boolean {
  return normalizar(s).length >= 2;
}

// ------------------------------------------------------------
// ALIAS DE UN JUGADOR
// ------------------------------------------------------------
// Para un jugador, genera la lista de alias posibles:
//   - apodo (si tiene)
//   - nombre completo
//   - apellido (última palabra)
//   - nombre de pila (primera palabra, solo si el nombre tiene >1 palabra)
//
// Se descartan alias de < 2 caracteres para no matchear cualquier cosa.

function aliasDeJugador(j: JugadorParaResolver): string[] {
  const out: string[] = [];

  if (j.apodo) {
    const a = normalizar(j.apodo);
    if (esTokenValido(a)) out.push(a);
  }

  const nombreNorm = normalizar(j.nombre);
  if (esTokenValido(nombreNorm)) out.push(nombreNorm);

  const palabras = nombreNorm.split(/\s+/).filter(Boolean);
  if (palabras.length > 1) {
    const apellido = palabras[palabras.length - 1];
    if (esTokenValido(apellido)) out.push(apellido);

    const nombrePila = palabras[0];
    if (esTokenValido(nombrePila)) out.push(nombrePila);
  }

  return out;
}

// ------------------------------------------------------------
// RESOLUCIÓN
// ------------------------------------------------------------

export function resolverJugador(
  texto: string,
  jugadores: JugadorParaResolver[]
): ResultadoResolucion {
  const t = normalizar(texto);
  if (!t || jugadores.length === 0) {
    return {
      ids: [],
      ambiguo: false,
      candidatos: [],
      motivo: "no_encontrado",
      match: null,
    };
  }

  // 1. Recolectar todos los matches por jugador.
  //    Para cada jugador, guardamos el alias MÁS LARGO que matchea.
  const matchesPorJugador = new Map<
    string,
    { jugador: JugadorParaResolver; largo: number; alias: string }
  >();

  for (const j of jugadores) {
    const aliasList = aliasDeJugador(j);
    let mejor: { largo: number; alias: string } | null = null;
    for (const a of aliasList) {
      if (t.includes(a) || a.includes(t)) {
        if (!mejor || a.length > mejor.largo) {
          mejor = { largo: a.length, alias: a };
        }
      }
    }
    if (mejor) {
      matchesPorJugador.set(j.id, {
        jugador: j,
        largo: mejor.largo,
        alias: mejor.alias,
      });
    }
  }

  if (matchesPorJugador.size === 0) {
    return {
      ids: [],
      ambiguo: false,
      candidatos: [],
      motivo: "no_encontrado",
      match: null,
    };
  }

  // 2. Quedarnos con los matches del LARGO MÁXIMO.
  const matches = Array.from(matchesPorJugador.values());
  const largoMax = Math.max(...matches.map((m) => m.largo));
  const top = matches.filter((m) => m.largo === largoMax);

  // 3. Si el match máximo es único → resolvemos.
  if (top.length === 1) {
    return {
      ids: [top[0].jugador.id],
      ambiguo: false,
      candidatos: [top[0].jugador],
      motivo: "unico",
      match: top[0].alias,
    };
  }

  // 4. Si hay empate en el largo máximo → ambiguo.
  return {
    ids: top.map((m) => m.jugador.id),
    ambiguo: true,
    candidatos: top.map((m) => m.jugador),
    motivo: "ambiguo",
    match: top[0].alias,
  };
}

// ------------------------------------------------------------
// HELPERS DE COMPATIBILIDAD
// ------------------------------------------------------------

/**
 * Devuelve el ID si hay match único. `null` en cualquier otro caso
 * (ambiguo o no encontrado). Es la firma que usan
 * `parserBusqueda.ts` y `respuesta.ts` por defecto.
 */
export function resolverJugadorAId(
  texto: string,
  jugadores: JugadorParaResolver[]
): string | null {
  const r = resolverJugador(texto, jugadores);
  if (r.motivo === "unico") return r.ids[0];
  return null;
}

/**
 * Describe los candidatos en formato legible para el aviso de
 * desambiguación:
 *   "Joaquín Pérez (#7) | Joaquín González (#10)"
 */
export function describirCandidatos(
  candidatos: JugadorParaResolver[]
): string {
  return candidatos
    .map((j) => {
      const partes = [j.nombre];
      if (j.apodo) partes.push(`"${j.apodo}"`);
      if (j.numero !== null && j.numero !== undefined) {
        partes.push(`#${j.numero}`);
      }
      return partes.join(" ");
    })
    .join(" | ");
}