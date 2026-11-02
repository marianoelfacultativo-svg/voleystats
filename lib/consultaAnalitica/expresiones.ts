// ============================================================
// EXPRESIONES — AST determinista (capa 4)
// ============================================================
// Tipos de nodo del AST que el compilador produce y el motor
// ejecuta. TODO determinista: si el AST está armado, el
// resultado es el que tiene que ser.
//
// Nodos:
//   num     → número literal
//   var     → variable del semantic layer (path a VariablesPunto)
//   op      → operación aritmética (+, -, *, /)
//   cmp     → comparación (==, <, >, <=, >=)
//   and     → Y lógico
//   or      → O lógico
//   not     → negación
//   has     → ¿el array contiene el valor? (para tiposPresentes, etc.)
//   count   → longitud del array
//
// Reglas de tipado:
//   num, var(numérica), op → NUMÉRICA
//   var(booleana), cmp, and, or, not, has → BOOLEANA
//   count → NUMÉRICA
//
// Alias: `numero` es equivalente a `num` (compatibilidad con
// consumidores que usan la forma larga).
//
// v1.1 (FASE 7.5 — fix B2):
//   + CAMPOS_BOOLEANOS suma "setGanado" para que el filtro
//     "en sets ganados" compile como comparación de booleano.
// ============================================================

import type { VariablesPunto } from "./variablesPunto";

// ------------------------------------------------------------
// TIPOS DE NODO
// ------------------------------------------------------------

export type OpAritmetico = "+" | "-" | "*" | "/";
export type OpComparacion = "==" | "!=" | "<" | ">" | "<=" | ">=";

export type Expr =
  | ExprNum
  | ExprVar
  | ExprOp
  | ExprCmp
  | ExprAnd
  | ExprOr
  | ExprNot
  | ExprHas
  | ExprCount;

export interface ExprNum {
  kind: "num";
  value: number;
}

export interface ExprVar {
  kind: "var";
  path: string; // nombre de la propiedad en VariablesPunto
}

export interface ExprOp {
  kind: "op";
  op: OpAritmetico;
  l: Expr;
  r: Expr;
}

export interface ExprCmp {
  kind: "cmp";
  op: OpComparacion;
  l: Expr;
  r: Expr;
}

export interface ExprAnd {
  kind: "and";
  l: Expr;
  r: Expr;
}

export interface ExprOr {
  kind: "or";
  l: Expr;
  r: Expr;
}

export interface ExprNot {
  kind: "not";
  e: Expr;
}

export interface ExprHas {
  kind: "has";
  field: string; // nombre del array en VariablesPunto
  value: string; // valor a buscar
}

export interface ExprCount {
  kind: "count";
  field: string; // nombre del array en VariablesPunto
}

// ------------------------------------------------------------
// TIPO DE EXPRESIÓN (numérica vs booleana)
// ------------------------------------------------------------

export type TipoExpr = "numero" | "booleano";

const CAMPOS_BOOLEANOS: Set<string> = new Set([
  "ganoPropio",
  "esTieBreak",
  "setTerminado",
  "setGanado",
]);

const CAMPOS_ARRAY: Set<string> = new Set([
  "tiposPresentes",
  "resultadosPresentes",
  "jugadoresPresentes",
]);

export function tipoDe(e: Expr): TipoExpr {
  switch (e.kind) {
    case "num":
      return "numero";
    case "var":
      return CAMPOS_BOOLEANOS.has(e.path) ? "booleano" : "numero";
    case "op":
      return "numero";
    case "cmp":
    case "and":
    case "or":
    case "not":
    case "has":
      return "booleano";
    case "count":
      return "numero";
  }
}

// ------------------------------------------------------------
// CONSTRUCTORES
// ------------------------------------------------------------

export function num(value: number): ExprNum {
  return { kind: "num", value };
}

// Alias por compatibilidad con consumidores que usan `numero`
export const numero = num;

export function variable(path: string): ExprVar {
  return { kind: "var", path };
}

export function suma(l: Expr, r: Expr): ExprOp {
  return { kind: "op", op: "+", l, r };
}

export function resta(l: Expr, r: Expr): ExprOp {
  return { kind: "op", op: "-", l, r };
}

export function producto(l: Expr, r: Expr): ExprOp {
  return { kind: "op", op: "*", l, r };
}

export function division(l: Expr, r: Expr): ExprOp {
  return { kind: "op", op: "/", l, r };
}

export function igual(l: Expr, r: Expr): ExprCmp {
  return { kind: "cmp", op: "==", l, r };
}

export function distinto(l: Expr, r: Expr): ExprCmp {
  return { kind: "cmp", op: "!=", l, r };
}

export function menor(l: Expr, r: Expr): ExprCmp {
  return { kind: "cmp", op: "<", l, r };
}

export function mayor(l: Expr, r: Expr): ExprCmp {
  return { kind: "cmp", op: ">", l, r };
}

export function menorIgual(l: Expr, r: Expr): ExprCmp {
  return { kind: "cmp", op: "<=", l, r };
}

export function mayorIgual(l: Expr, r: Expr): ExprCmp {
  return { kind: "cmp", op: ">=", l, r };
}

export function y(l: Expr, r: Expr): ExprAnd {
  return { kind: "and", l, r };
}

export function o(l: Expr, r: Expr): ExprOr {
  return { kind: "or", l, r };
}

export function no(e: Expr): ExprNot {
  return { kind: "not", e };
}

export function contiene(field: string, value: string): ExprHas {
  return { kind: "has", field, value };
}

export function cantidad(field: string): ExprCount {
  return { kind: "count", field };
}

// ------------------------------------------------------------
// VALIDACIÓN
// ------------------------------------------------------------

export interface ResultadoValidacion {
  ok: boolean;
  error: string | null;
  variablesUsadas: string[];
}

/**
 * Valida que un Expr sea estructuralmente correcto:
 *   - `var` apunta a un campo existente en VariablesPunto.
 *   - `has` y `count` apuntan a un array existente.
 *   - `op` y `cmp` tienen operandos del tipo correcto.
 *   - La raíz (si se pide) es de tipo "booleano".
 */
export function validar(
  e: Expr,
  raizDebeSerBooleana = false
): ResultadoValidacion {
  const variables = new Set<string>();
  const errores: string[] = [];

  function caminar(n: Expr) {
    switch (n.kind) {
      case "num":
        return;
      case "var": {
        variables.add(n.path);
        return;
      }
      case "op": {
        if (tipoDe(n.l) !== "numero") {
          errores.push(`op(${n.op}) operand izquierdo debe ser numérico`);
        }
        if (tipoDe(n.r) !== "numero") {
          errores.push(`op(${n.op}) operand derecho debe ser numérico`);
        }
        caminar(n.l);
        caminar(n.r);
        return;
      }
      case "cmp": {
        if (tipoDe(n.l) !== tipoDe(n.r)) {
          errores.push(
            `cmp(${n.op}) operandos de distinto tipo: ${tipoDe(
              n.l
            )} vs ${tipoDe(n.r)}`
          );
        }
        caminar(n.l);
        caminar(n.r);
        return;
      }
      case "and":
      case "or": {
        if (tipoDe(n.l) !== "booleano" || tipoDe(n.r) !== "booleano") {
          errores.push(`${n.kind} requiere operandos booleanos`);
        }
        caminar(n.l);
        caminar(n.r);
        return;
      }
      case "not": {
        if (tipoDe(n.e) !== "booleano") {
          errores.push(`not requiere operando booleano`);
        }
        caminar(n.e);
        return;
      }
      case "has": {
        if (!CAMPOS_ARRAY.has(n.field)) {
          errores.push(`has: "${n.field}" no es un array conocido`);
        }
        return;
      }
      case "count": {
        if (!CAMPOS_ARRAY.has(n.field)) {
          errores.push(`count: "${n.field}" no es un array conocido`);
        }
        return;
      }
    }
  }

  caminar(e);

  if (raizDebeSerBooleana && tipoDe(e) !== "booleano") {
    errores.push(
      `La raíz del filtro debe ser booleana (es ${tipoDe(e)})`
    );
  }

  return {
    ok: errores.length === 0,
    error: errores.length > 0 ? errores[0] : null,
    variablesUsadas: Array.from(variables),
  };
}

// ------------------------------------------------------------
// SERIALIZACIÓN (para debug / logs)
// ------------------------------------------------------------

export function serializar(e: Expr): string {
  switch (e.kind) {
    case "num":
      return String(e.value);
    case "var":
      return e.path;
    case "op":
      return `(${serializar(e.l)} ${e.op} ${serializar(e.r)})`;
    case "cmp":
      return `(${serializar(e.l)} ${e.op} ${serializar(e.r)})`;
    case "and":
      return `(${serializar(e.l)} AND ${serializar(e.r)})`;
    case "or":
      return `(${serializar(e.l)} OR ${serializar(e.r)})`;
    case "not":
      return `NOT (${serializar(e.e)})`;
    case "has":
      return `has(${e.field}, "${e.value}")`;
    case "count":
      return `count(${e.field})`;
  }
}

// ------------------------------------------------------------
// EVALUACIÓN
// ------------------------------------------------------------
// La evaluación la hace el motor, no este archivo. Pero dejo acá
// un evaluador básico para que el motor de respuestas lo use.
// ------------------------------------------------------------

function leerCampo(
  vars: VariablesPunto,
  campo: string
): unknown {
  return (vars as unknown as Record<string, unknown>)[campo];
}

function compararNumeros(a: number, b: number, op: OpComparacion): boolean {
  switch (op) {
    case "==":
      return a === b;
    case "!=":
      return a !== b;
    case "<":
      return a < b;
    case ">":
      return a > b;
    case "<=":
      return a <= b;
    case ">=":
      return a >= b;
  }
}

export function evaluarNumero(e: Expr, vars: VariablesPunto): number {
  switch (e.kind) {
    case "num":
      return e.value;
    case "var": {
      const v = leerCampo(vars, e.path);
      if (typeof v === "number") return v;
      if (typeof v === "boolean") return v ? 1 : 0;
      return 0;
    }
    case "op": {
      const a = evaluarNumero(e.l, vars);
      const b = evaluarNumero(e.r, vars);
      switch (e.op) {
        case "+":
          return a + b;
        case "-":
          return a - b;
        case "*":
          return a * b;
        case "/":
          return b === 0 ? 0 : a / b;
      }
      return 0;
    }
    case "count": {
      const v = leerCampo(vars, e.field);
      return Array.isArray(v) ? v.length : 0;
    }
    default:
      return 0;
  }
}

export function evaluarBooleano(e: Expr, vars: VariablesPunto): boolean {
  switch (e.kind) {
    case "cmp": {
      const a = evaluarNumero(e.l, vars);
      const b = evaluarNumero(e.r, vars);
      return compararNumeros(a, b, e.op);
    }
    case "and":
      return (
        evaluarBooleano(e.l, vars) && evaluarBooleano(e.r, vars)
      );
    case "or":
      return (
        evaluarBooleano(e.l, vars) || evaluarBooleano(e.r, vars)
      );
    case "not":
      return !evaluarBooleano(e.e, vars);
    case "has": {
      const v = leerCampo(vars, e.field);
      if (!Array.isArray(v)) return false;
      return v.includes(e.value);
    }
    case "var": {
      const v = leerCampo(vars, e.path);
      if (typeof v === "boolean") return v;
      return Boolean(v);
    }
    case "num":
      return e.value !== 0;
    default:
      return false;
  }
}

/**
 * Evalúa una expresión devolviendo el tipo nativo.
 * Para usar en el ejecutor: el filtro siempre es booleano,
 * las métricas siempre son numéricas.
 */
export function evaluar(
  e: Expr,
  vars: VariablesPunto
): number | boolean {
  return tipoDe(e) === "booleano"
    ? evaluarBooleano(e, vars)
    : evaluarNumero(e, vars);
}