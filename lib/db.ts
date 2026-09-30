export async function guardarDetalles(
  partidoId: string,
  data: {
    rotaciones: (RotacionPunto & { partido_id: string })[];
    ataques: AtaqueRow[];
    defensas: DefensaRow[];
    bloqueos: BloqueoRow[];
    saques: SaqueRow[];
    recepciones: RecepcionRow[];
    cambios: CambioRow[];
  }
): Promise<{ ok: boolean; error?: string }> {
  const tablas = [
    "rotaciones",
    "ataques_detalle",
    "defensa_detalle",
    "bloqueo_detalle",
    "saque_detalle",
    "recepcion_detalle",
    "cambios_jugador",
  ] as const;

  for (const t of tablas) {
    const { error } = await supabase
      .from(t)
      .delete()
      .eq("partido_id", partidoId);
    if (error) return { ok: false, error: `Error borrando ${t}: ${error.message}` };
  }

  // Quita el campo id para que la DB lo genere
  const sinId = <T extends { id?: string }>(arr: T[]) =>
    arr.map(({ id, ...rest }) => rest);

  if (data.rotaciones.length > 0) {
    const filas = data.rotaciones.map((r) => ({
      partido_id: r.partido_id,
      set_numero: r.set_numero,
      punto_numero: r.punto_numero,
      saque_equipo: r.saque_equipo,
      posiciones: r.posiciones,
      liberos: r.liberos,
    }));
    const { error } = await supabase.from("rotaciones").insert(filas);
    if (error) return { ok: false, error: `rotaciones: ${error.message}` };
  }

  if (data.ataques.length > 0) {
    const { error } = await supabase
      .from("ataques_detalle")
      .insert(sinId(data.ataques));
    if (error) return { ok: false, error: `ataques: ${error.message}` };
  }

  if (data.defensas.length > 0) {
    const { error } = await supabase
      .from("defensa_detalle")
      .insert(sinId(data.defensas));
    if (error) return { ok: false, error: `defensas: ${error.message}` };
  }

  if (data.bloqueos.length > 0) {
    const { error } = await supabase
      .from("bloqueo_detalle")
      .insert(sinId(data.bloqueos));
    if (error) return { ok: false, error: `bloqueos: ${error.message}` };
  }

  if (data.saques.length > 0) {
    const { error } = await supabase
      .from("saque_detalle")
      .insert(sinId(data.saques));
    if (error) return { ok: false, error: `saques: ${error.message}` };
  }

  if (data.recepciones.length > 0) {
    const { error } = await supabase
      .from("recepcion_detalle")
      .insert(sinId(data.recepciones));
    if (error) return { ok: false, error: `recepciones: ${error.message}` };
  }

  if (data.cambios.length > 0) {
    const { error } = await supabase
      .from("cambios_jugador")
      .insert(sinId(data.cambios));
    if (error) return { ok: false, error: `cambios: ${error.message}` };
  }

  return { ok: true };
}