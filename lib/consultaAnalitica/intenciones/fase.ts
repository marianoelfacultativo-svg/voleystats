// ============================================================
// INTENCIONES · FASE DEL RALLY
// ============================================================
// v1.3 (FASE 7.5 — fix B14):
//   + La entrada CONTRAATAQUE (que cubre break-point) suma
//     patrones para "estamos sacando": "sacando", "al saque",
//     "desde el saque", "desde nuestro saque", "en nuestro saque",
//     "en saque propio", "cuando sacamos", "cuando saca el
//     equipo".
//   + SIN agregar "sacamos" suelto, "en el saque" ni "en saque"
//     solos, para no colisionar con `SINONIMOS_TIPO.saque` ni con
//     la métrica `break_point_pct`.
//
// v1.2 (FASE 7.5 — ampliación coloquial + reorg):
//   + K1, K2, K3 y FREE-BALL ganan patrones coloquiales de la
//     jerga de vóley latinoamericana.
//   + Se mantiene el orden K1 → K2 → K3 → FREE-BALL → genérico
//     para que lo más específico gane primero.
//   + Comentarios por bloque explicando cuándo aplica cada uno.
//   + K3 suma "pelota que vuelve del bloqueo" / "rebote del
//     bloqueo" (semánticamente es cobertura tras ataque bloqueado).
//
// NOTAS DE USO:
//   - El parser normaliza ANTES de matchear (lowercase + NFD +
//     sin tildes + sin signos). Los patrones con tilde del archivo
//     son redundantes (nunca matchean por su forma acentuada) pero
//     no hacen daño y documentan la forma natural del término.
//   - El parser recorre las entradas EN ORDEN. La primera entrada
//     con CUALQUIER patrón que matchee gana. Por eso K1/K2/K3 van
//     ANTES que "contraataque" genérico: si el texto dice
//     "contraataque desde defensa", gana K2 (más específico) sobre
//     el genérico.
//   - Dentro de cada entrada, los patrones más largos ganan (el
//     parser hace `ordenarPorLargoDesc` automáticamente). Igual,
//     el campo `fase` resultante es el mismo, así que es solo un
//     detalle del fragmento que se reporta.
// ============================================================

export const SINONIMOS_FASE: { patrones: string[]; fase: string }[] = [
  // ----------------------------------------------------------
  // K1 — SIDE-OUT
  // ----------------------------------------------------------
  // El equipo arranca el rally RECIBIENDO el saque rival y
  // arma su primer ataque del punto. Complejo 1.
  // ----------------------------------------------------------
  {
    patrones: [
      // Formales
      "side-out", "side out", "sideout",
      "side-outs", "side outs", "sideouts",
      "k1", "k 1", "k-1", "ki",
      "complejo 1", "complejo uno", "primer complejo",

      // Con contexto
      "en side-out", "en side out", "en sideout", "en k1",
      "en el side-out", "en el side out", "en el k1",
      "puntos en side-out", "puntos en side out",
      "puntos en k1",
      "puntos ganados en side-out", "puntos ganados en k1",
      "puntos perdidos en side-out", "puntos perdidos en k1",
      "side-out %", "porcentaje de side-out",
      "porcentaje de side out", "porcentaje de sideout",

      // Recepción como inicio del rally
      "recibiendo", "en recepcion", "en recepción",
      "salida de recepcion", "salida de recepción",
      "pelota de recepcion", "pelota de recepción",
      "pelota tras recepcion", "pelota tras recepción",
      "ataque tras recepcion", "ataque tras recepciones",
      "ataque despues de recibir", "ataque después de recibir",
      "despues de la recepcion", "después de la recepción",

      // "Primer ataque / primer toque del equipo"
      "primer toque del equipo", "primer toque del rally",
      "primer ataque", "primera pelota",
      "primer ataque del rally", "primer ataque del equipo",
      "primera pelota del rally", "primera pelota del equipo",
      "primer contacto del equipo",
      "de primer toque", "de primera pelota",
      "en primer ataque", "en primera pelota",
    ],
    fase: "side-out",
  },

  // ----------------------------------------------------------
  // K2 — CONTRAATAQUE DESDE DEFENSA
  // ----------------------------------------------------------
  // El equipo defiende el ataque rival (sin cobertura) y
  // contraataca. Primer toque propio = defensa normal.
  // ----------------------------------------------------------
  {
    patrones: [
      // Formales
      "k2", "k 2", "k-2",
      "complejo 2", "complejo dos", "segundo complejo",
      "contraataque desde defensa",
      "contraataque de defensa",
      "contraataque defensivo",
      "contra ataque desde defensa",
      "contra-ataque desde defensa",

      // Coloquiales (contra + defensa)
      "contra desde defensa", "contra desde la defensa",
      "contra defensivo",
      "pelota de defensa",
      "ataque tras defender", "ataque después de defender",
      "pelota tras defender", "pelota después de defender",

      // Con contexto
      "en k2", "en el k2", "en k-2",
      "puntos en k2", "puntos en k 2",
      "puntos ganados en k2", "puntos perdidos en k2",
      "despues de defender", "después de defender",
      "despues de una defensa", "después de una defensa",
      "tras defender", "tras una defensa",
      "despues de la defensa", "después de la defensa",
      "viene de defensa",

      // Recupero (variante regional de "defensa")
      "ataque de recupero", "pelota de recupero",
      "ataque de recuperación", "pelota de recuperación",
      "de recupero", "de recuperación",
    ],
    fase: "k2",
  },

  // ----------------------------------------------------------
  // K3 — CONTRAATAQUE DESDE COBERTURA
  // ----------------------------------------------------------
  // El ataque propio fue bloqueado por el rival, el equipo
  // cubre (cobertura) y contraataca. Primer toque propio =
  // cobertura. La pelota que vuelve del bloqueo entra acá.
  // ----------------------------------------------------------
  {
    patrones: [
      // Formales
      "k3", "k 3", "k-3",
      "complejo 3", "complejo tres", "tercer complejo",
      "contraataque desde cobertura",
      "contraataque de cobertura",
      "contraataque cob",
      "contra ataque desde cobertura",
      "contra-ataque desde cobertura",

      // Coloquiales (contra + cobertura)
      "contra desde cobertura", "contra desde la cobertura",
      "pelota de cobertura",
      "pelota tras cubrir", "pelota después de cubrir",
      "pelota que vuelve del bloqueo",
      "pelota que vuelve del bloqueo rival",
      "rebote del bloqueo", "rebote del bloqueo rival",
      "pelota del rebote", "pelota tras el bloqueo rival",

      // Con contexto
      "en k3", "en el k3", "en k-3",
      "puntos en k3", "puntos en k 3",
      "puntos ganados en k3", "puntos perdidos en k3",
      "despues de cubrir", "después de cubrir",
      "despues de una cobertura", "después de una cobertura",
      "tras cubrir", "tras una cobertura",
      "despues de la cobertura", "después de la cobertura",
      "viene de cobertura",
    ],
    fase: "k3",
  },

  // ----------------------------------------------------------
  // FREE-BALL
  // ----------------------------------------------------------
  // El rival mandó una pelota "fácil" (libre) y el equipo
  // arma su ataque sin la presión de un saque o ataque rival
  // normal.
  // ----------------------------------------------------------
  {
    patrones: [
      // Formales
      "free-ball", "free ball", "freeball",
      "free-balls", "free balls", "freeballs",
      "pelota libre", "pelotas libres",
      "bola libre", "bolas libres",
      "balon libre", "balones libres",
      "en free-ball", "en free ball", "en freeball",
      "puntos en free-ball", "puntos en free ball",
      "puntos ganados en free-ball",
      "puntos perdidos en free-ball",
      "free ball rival", "pelota libre rival",

      // Coloquiales (entrega / regalo del rival)
      "entrega", "entregas",
      "entrega rival", "entregas del rival",
      "pelota de entrega", "bola de entrega",
      "pelota regalada", "pelota regalada por el rival",
      "bola regalada", "bola regalada por el rival",
      "pelota que entrega el rival",
      "pelota que regala el rival",

      // Con contexto
      "despues de una libre", "después de una libre",
      "despues de una pelota libre", "después de una pelota libre",
      "tras una libre",
    ],
    fase: "free-ball",
  },

  // ----------------------------------------------------------
  // CONTRAATAQUE — GENÉRICO (incluye break-point)
  // ----------------------------------------------------------
  // Cualquier ataque que ocurre SIN recepción previa: K2, K3,
  // break-point, después de un bloqueo, etc. Va AL FINAL para
  // que K1/K2/K3 específicos ganen primero.
  //
  // B14 (v1.3): break-point es "el que saca gana el punto".
  // Los patrones "sacando", "al saque", "desde el saque", etc.
  // describen EXACTAMENTE la situación de break-point desde la
  // perspectiva del equipo que mira. Antes no estaban y la
  // frase "cuántos puntos ganamos sacando" caía en `fase: null`.
  //
  // IMPORTANTE: no agregar "sacamos" suelto (colisiona con
  // SINONIMOS_TIPO.saque), ni "en el saque" / "en saque" solos
  // (colisionan con la métrica break_point_pct).
  // ----------------------------------------------------------
  {
    patrones: [
      // Formales
      "contraataque", "contraataques",
      "contra-ataque", "contra-ataques",
      "contra ataque", "contra ataques",
      "break-point", "break point", "breakpoint",
      "break-points", "break points", "breakpoints",
      "break-point %", "break point %", "breakpoint %",
      "porcentaje de break point",
      "porcentaje de break-point",
      "porcentaje de breakpoint",
      "efectividad sacando", "efectividad en saque",

      // Coloquiales / regionales
      "ataque de contra",
      "pelota de contra",
      "re-break", "rebreak",
      "re play", "replay",

      // Con contexto
      "en contraataque", "en contra-ataque",
      "en contra ataque",
      "puntos en contraataque",
      "puntos ganados en contraataque",
      "puntos perdidos en contraataque",
      "despues de bloquear", "después de bloquear",
      "despues de un bloqueo", "después de un bloqueo",
      "tras bloquear", "tras un bloqueo",

      // ----------------------------------------------------------
      // B14 (v1.3) — break-point desde la perspectiva de "sacando"
      // ----------------------------------------------------------
      // Estas formas describen la situación de break-point sin
      // mencionar el resultado (ace, error, etc.), por eso no
      // colisionan con `break_point_pct` (que es una MÉTRICA,
      // no un filtro de fase).
      // ----------------------------------------------------------
      "sacando",
      "al saque",
      "desde el saque",
      "desde nuestro saque",
      "en nuestro saque",
      "en saque propio",
      "cuando sacamos",
      "cuando saca el equipo",
    ],
    fase: "contraataque",
  },
];