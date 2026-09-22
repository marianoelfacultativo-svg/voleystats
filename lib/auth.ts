export type Rol = 'admin' | 'club' | 'jugador';

export interface Sesion {
  codigo: string;
  tipo: Rol;
  club_id?: string;
  jugador_id?: string;
}

const CLAVE_SESION = 'voleystats_sesion';

export function guardarSesion(sesion: Sesion) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CLAVE_SESION, JSON.stringify(sesion));
}

export function obtenerSesion(): Sesion | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(CLAVE_SESION);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Sesion;
  } catch {
    return null;
  }
}

export function cerrarSesion() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(CLAVE_SESION);
}