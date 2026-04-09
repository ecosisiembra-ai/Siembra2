window.SiembraAdminContext = (function() {
  function syncResolvedSchool(ADM, ctx, escuela) {
    if (!ADM || !escuela) return;

    if (escuela.id) ADM.escuelaId = escuela.id;
    if (escuela.cct) ADM.escuelaCct = escuela.cct;
    if (escuela.nombre) ADM.escuelaNombre = escuela.nombre;

    const nivel = escuela.nivel_default || escuela.nivel || null;
    if (nivel) ADM.escuelaNivel = nivel;

    if (window.currentPerfil) {
      if (escuela.id) window.currentPerfil.escuela_id = escuela.id;
      if (escuela.cct) window.currentPerfil.escuela_cct = escuela.cct;
      if (escuela.nombre) window.currentPerfil.escuela_nombre = escuela.nombre;
    }

    if (ctx) {
      ctx.escuelaId = ADM.escuelaId || ctx.escuelaId;
      ctx.escuelaCct = ADM.escuelaCct || ctx.escuelaCct;
      ctx.escuelaNombre = ADM.escuelaNombre || ctx.escuelaNombre;
      ctx.escuelaNivel = ADM.escuelaNivel || ctx.escuelaNivel;
    }
  }

  async function resolveSchoolContext(ADM, options = {}) {
    const ctx = {
      sb: options.sb || window.sb || ADM?.sb || null,
      perfil: options.perfil || window.currentPerfil || ADM?.currentPerfil || null,
      escuelaId: options.escuelaId || ADM?.escuelaId || window.currentPerfil?.escuela_id || ADM?.currentPerfil?.escuela_id || null,
      escuelaCct: options.escuelaCct || ADM?.escuelaCct || window.currentPerfil?.escuela_cct || ADM?.currentPerfil?.escuela_cct || null,
      escuelaNombre: options.escuelaNombre || ADM?.escuelaNombre || window.currentPerfil?.escuela_nombre || ADM?.currentPerfil?.escuela_nombre || null,
      escuelaNivel: options.escuelaNivel || ADM?.escuelaNivel || window._admNivelActivo || window._nivelActivo || null,
    };

    if (!ctx.escuelaCct && ctx.escuelaId && ctx.sb) {
      try {
        const { data: escuela } = await ctx.sb
          .from('escuelas')
          .select('id,cct,nombre,nivel,nivel_default')
          .eq('id', ctx.escuelaId)
          .maybeSingle();
        syncResolvedSchool(ADM, ctx, escuela);
      } catch (error) {
        console.warn('[ADM] resolveSchoolContext:', error.message);
      }
    }

    return ctx;
  }

  return {
    resolveSchoolContext,
    syncResolvedSchool,
  };
})();
