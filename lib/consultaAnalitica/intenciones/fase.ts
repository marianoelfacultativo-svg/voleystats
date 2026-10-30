// ============================================================
// INTENCIONES · FASE DEL RALLY
// ============================================================
// Cat. 5 del plan "Consultas Analíticas Libres".
//
// Diccionario para extraer la fase del rally como CONDICIÓN
// de la consulta. El parser recorre estos patrones y, si los
// encuentra en el texto normalizado (minúsculas, sin tildes,
// pero conservando guiones), agrega:
//
//   intencion.condicion.fase = "<fase>"
//
// Ejemplos:
//   "cuántos puntos ganamos en side-out"   → fase: "side-out"
//   "cuál es el side-out %"                → fase: "side-out"
//   "break-point %"                        → fase: "contraataque"
//   "puntos ganados en k2"                 → fase: "k2"
//   "puntos ganados en k3"                 → fase: "k3"
//   "cuántos puntos en free-ball"          → fase: "free-ball"
//   "puntos en contraataque"               → fase: "contraataque"
//
// ------------------------------------------------------------------
// ¿Por qué "break point" → "contraataque" y no "k2"?
// ------------------------------------------------------------------
// En el motor, la fase "contraataque" (legacy) matchea k2 y k3
// (ver lib/analisis/contexto.ts → matcheaFase). Así que
// "break-point %" filtra por fase "contraataque" y agarra tanto
// K2 (contraataque desde defensa) como K3 (contraataque desde
// cobertura). Es la única forma de cubrir las dos con un solo
// sinónimo sin pedirle al usuario que elija.
//
// Si el usuario dice explícitamente "k2" o "k3", el filtro es
// exacto a esa fase.
//
// ------------------------------------------------------------------
// Orden de evaluación
// ------------------------------------------------------------------
// Los patrones más LARGOS van primero. Así "en contraataque
// desde cobertura" no queda matcheado antes por "contraataque"
// y pierde información. Igual el parser normaliza y hace
// includes() — no regex — así que "k2" no matchearía "k20"
// porque buscamos la palabra completa con contains + word check.
// ============================================================

// ------------------------------------------------------------
// DICCIONARIO PRINCIPAL
// ------------------------------------------------------------

export const SINONIMOS_FASE: { patrones: string[]; fase: string }[] = [
  // ----------------------------------------------------------
  // SIDE-OUT / K1
  // ----------------------------------------------------------
  {
    patrones: [
      // Formas explícitas
      "side-out", "side out", "sideout",
      "side-outs", "side outs", "sideouts",
      "k1", "k 1", "k-1",
      "complejo 1", "complejo uno",
      // Frases de pregunta
      "en side-out", "en side out", "en sideout", "en k1",
      "en el side-out", "en el side out", "en el k1",
      "puntos en side-out", "puntos en side out",
      "puntos en k1",
      "puntos ganados en side-out", "puntos ganados en k1",
      "puntos perdidos en side-out", "puntos perdidos en k1",
      "side-out %", "side-out %", "porcentaje de side-out",
      "porcentaje de side out", "porcentaje de sideout",
      // Recepción / primer toque
      "recibiendo", "en recepcion", "en recepción",
      "primer toque del equipo",
    ],
    fase: "side-out",
  },

  // ----------------------------------------------------------
  // K2 — contraataque desde defensa
  // ----------------------------------------------------------
  {
    patrones: [
      "k2", "k 2", "k-2",
      "complejo 2", "complejo dos",
      "contraataque desde defensa",
      "contraataque de defensa",
      "contraataque defensivo",
      "contra ataque desde defensa",
      "contra-ataque desde defensa",
      "en k2", "en el k2", "en k-2",
      "puntos en k2", "puntos en k 2",
      "puntos ganados en k2", "puntos perdidos en k2",
    ],
    fase: "k2",
  },

  // ----------------------------------------------------------
  // K3 — contraataque desde cobertura
  // ----------------------------------------------------------
  {
    patrones: [
      "k3", "k 3", "k-3",
      "complejo 3", "complejo tres",
      "contraataque desde cobertura",
      "contraataque de cobertura",
      "contraataque cob",
      "contra ataque desde cobertura",
      "contra-ataque desde cobertura",
      "en k3", "en el k3", "en k-3",
      "puntos en k3", "puntos en k 3",
      "puntos ganados en k3", "puntos perdidos en k3",
    ],
    fase: "k3",
  },

  // ----------------------------------------------------------
  // FREE-BALL
  // ----------------------------------------------------------
  {
    patrones: [
      "free-ball", "free ball", "freeball",
      "free-balls", "free balls", "freeballs",
      "pelota libre", "pelotas libres",
      "bola libre", "bolas libres",
      "en free-ball", "en free ball", "en freeball",
      "puntos en free-ball", "puntos en free ball",
      "puntos ganados en free-ball",
      "puntos perdidos en free-ball",
      "free ball rival", "pelota libre rival",
      "entrega", "entregas",
      "entrega rival", "entregas del rival",
    ],
    fase: "free-ball",
  },

  // ----------------------------------------------------------
  // CONTRAATAQUE GENÉRICO
  // ----------------------------------------------------------
  {
    patrones: [
      "contraataque", "contraataques",
      "contra-ataque", "contra-ataques",
      "contra ataque", "contra ataques",
      // break-point matchea K2 + K3 (contraataque legacy)
      "break-point", "break point", "breakpoint",
      "break-points", "break points", "breakpoints",
      "break-point %", "break point %", "breakpoint %",
      "porcentaje de break point", "porcentaje de break-point",
      "porcentaje de breakpoint",
      "efectividad sacando", "efectividad en saque",
      "en contraataque", "en contra-ataque", "en contra ataque",
      "puntos en contraataque",
      "puntos ganados en contraataque",
      "puntos perdidos en contraataque",
    ],
    fase: "contraataque",
  },
];