// ============================================================
// RESULTADOS DISPONIBLES POR TIPO
// ============================================================
// Extraído de lib/analisisConsecuencias.ts (v9).
// ============================================================

import type { TipoDisparador } from "./tipos";

export function resultadosPorTipoAnalisis(tipo: TipoDisparador): string[] {
  switch (tipo) {
    case "saque":
      return [
        "cualquiera",
        "ace",
        "positivo_mas",
        "positivo",
        "neutro",
        "negativo",
        "error_rival",
      ];
    case "recepcion":
      return [
        "cualquiera",
        "perfecta",
        "positiva",
        "intermedia",
        "negativa",
        "doble_negativa",
        "overpass",
        "error_directo",
      ];
    case "armado":
      return ["cualquiera", "1", "2", "3", "4", "5", "6", "R"];
    case "ataque":
      return [
        "cualquiera",
        "punto",
        "neutro",
        "error",
        "error_afuera_ataque",
        "error_red_ataque",
        "gorro_ataque",
        "use_rival_ataque",
        "buena_rival",
        "peligroso",
        "simple",
        "libre",
      ];
    case "bloqueo":
      return [
        "cualquiera",
        "punto",
        "positivo_mas",
        "positivo",
        "neutro",
        "use_rival",
        "red",
        "filtrada",
      ];
    case "defensa":
      return [
        "cualquiera",
        "toque_positiva",
        "toque_negativa",
        "gran_def",
        "error_def",
        "mala_libre",
        "cobertura_positiva",
        "cobertura_negativa",
        "errores_graves",
        "neutro",
      ];
    case "libre":
      return ["cualquiera", "toque", "libre"];
    case "roce-red":
      return [
        "cualquiera",
        "ofensivo-propio",
        "invasion-zaguero",
        "invasion-delantero",
        "roce-red-rival",
      ];
    default:
      return ["cualquiera"];
  }
}