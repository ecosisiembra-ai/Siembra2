/**
 * SIEMBRA — Capa de Servicios v1.0
 * Archivo: siembra-services.js
 * Cargar ANTES de cualquier lógica de negocio en todos los portales.
 *
 * Uso:
 *   <script src="siembra-services.js"></script>
 *
 * Expone el objeto global `SIEMBRA` con todos los servicios.
 */

(function (global) {
  'use strict';

  // ─── Utilidades internas ──────────────────────────────────────────────────

  function _err(fn, e) {
    console.error(`[SIEMBRA:${fn}]`, e?.message || e);
    return { data: null, error: e };
  }

  function _ok(data) {
    return { data, error: null };
  }

  /** Toast universal — usa hubToast si existe, sino alert */
  function toast(msg, tipo = 'ok') {
    if (typeof hubToast === 'function') return hubToast(msg, tipo);
    if (typeof window._toast === 'function') return window._toast(msg, tipo);
    console.log(`[${tipo.toUpperCase()}] ${msg}`);
  }

  /** Genera token alfanumérico */
  function genToken(len = 32) {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    const arr = crypto.getRandomValues(new Uint8Array(len));
    return Array.from(arr, b => chars[b % chars.length]).join('');
  }

  /** Ciclo activo global */
  function cicloActivo() {
    return window.CICLO_ACTIVO || '2025-2026';
  }

  /** Obtener cliente Supabase */
  function sb() {
    if (!window.sb) throw new Error('Supabase no inicializado.');
    return window.sb;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTH SERVICE
  // ═══════════════════════════════════════════════════════════════════════════
  const authService = {

    /**
     * Login con email + contraseña.
     * Retorna { data: perfil, error }
     */
    async login(email, password, rolEsperado = null) {
      try {
        const { data, error } = await sb().auth.signInWithPassword({ email, password });
        if (error) throw error;

        const { data: perfil, error: pe } = await sb()
          .from('usuarios')
          .select('*')
          .eq('auth_id', data.user.id)
          .maybeSingle();

        if (pe) throw pe;
        if (!perfil) throw new Error('Perfil no encontrado. Contacta al director.');

        // Validar rol si se especifica
        if (rolEsperado) {
          const alias = { tutor: 'docente', superadmin: 'admin' };
          const rolReal = alias[perfil.rol] || perfil.rol;
          if (rolReal !== rolEsperado) {
            await sb().auth.signOut();
            throw new Error(`Esta cuenta es "${perfil.rol}", no "${rolEsperado}".`);
          }
        }

        // Actualizar último acceso
        try { await sb().from('usuarios').update({ ultimo_acceso: new Date().toISOString() }).eq('id', perfil.id); } catch(_){} 

        sessionStorage.setItem('siembra_login_ts', Date.now().toString());
        sessionStorage.setItem('siembra_last_activity', Date.now().toString());

        window.currentPerfil = perfil;
        window.currentUser   = data.user;

        return _ok(perfil);
      } catch (e) {
        const msg = e.message === 'Invalid login credentials'
          ? 'Correo o contraseña incorrectos.'
          : e.message;
        return _err('authService.login', { message: msg });
      }
    },

    /** Logout completo */
    async logout() {
      try {
        await sb().auth.signOut();
      } catch (e) { /* ignorar */ }
      window.currentPerfil = null;
      window.currentUser   = null;
      sessionStorage.clear();
    },

    /** Sesión activa → perfil del usuario */
    async sesionActual() {
      try {
        const { data: { user } } = await sb().auth.getUser();
        if (!user) return _ok(null);

        const { data: perfil } = await sb()
          .from('usuarios')
          .select('*')
          .eq('auth_id', user.id)
          .maybeSingle();

        window.currentUser   = user;
        window.currentPerfil = perfil;
        return _ok(perfil);
      } catch (e) {
        return _err('authService.sesionActual', e);
      }
    },

    /**
     * Registro de usuario nuevo con token de invitación.
     * Flujo: validar token → signUp → insertar perfil → marcar token usado
     */
    async registrarConToken(token, nombre, email, password) {
      try {
        if (!token) throw new Error('Token requerido.');
        if (!nombre?.trim()) throw new Error('Ingresa tu nombre completo.');
        if (!email?.trim()) throw new Error('Ingresa tu correo electrónico.');
        if (password?.length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres.');

        // 1. Leer invitación
        const { data: inv, error: ie } = await sb()
          .from('invitaciones')
          .select('*')
          .eq('token', token)
          .maybeSingle();

        if (ie) throw ie;
        if (!inv) throw new Error('Token inválido o no encontrado.');
        if (inv.estado === 'usado') throw new Error('Esta invitación ya fue utilizada.');
        if (inv.expira_at && new Date(inv.expira_at) < new Date()) throw new Error('Esta invitación ha expirado.');

        // 2. Crear cuenta Auth
        const { data: authData, error: ae } = await sb().auth.signUp({ email, password });
        // Manejar email ya registrado (409 o mensaje de error)
        if (ae) {
          const alreadyExists = ae.status === 409 || 
            (ae.message || '').toLowerCase().includes('already registered') ||
            (ae.message || '').toLowerCase().includes('already exists') ||
            (ae.message || '').toLowerCase().includes('user already');
          if (alreadyExists) {
            const { data: sData, error: sErr } = await sb().auth.signInWithPassword({ email, password });
            if (sErr) throw new Error('El correo ya está registrado con otra contraseña. Usa la contraseña original o pide nueva invitación.');
            const authUser = sData.user;
            try { await sb().from('usuarios').update({ activo: true, escuela_cct: inv.escuela_cct||null }).eq('auth_id', authUser.id); } catch(_){}
            await sb().from('invitaciones').update({ estado: 'usado', usado_at: new Date().toISOString() }).eq('token', token);
            // Auto-link si la invitación tenía alumno_id
            if (inv.rol === 'padre' && inv.alumno_id) {
              try {
                const { data: perfilPadre } = await sb().from('usuarios')
                  .select('id').eq('auth_id', authUser.id).maybeSingle();
                if (perfilPadre?.id) {
                  const { data: yaVinc } = await sb().from('padres_alumnos')
                    .select('id').eq('padre_id', perfilPadre.id).eq('alumno_id', inv.alumno_id).maybeSingle();
                  if (!yaVinc) {
                    await sb().from('padres_alumnos').insert({
                      padre_id:   perfilPadre.id,
                      alumno_id:  inv.alumno_id,
                      escuela_id: inv.escuela_id || null,
                      activo:     true,
                    });
                  }
                }
              } catch(eLinkEx) { console.warn('[auth] auto-link existing padre:', eLinkEx.message); }
            }
            return _ok({ authUser, perfil: { rol: inv.rol } });
          }
          throw ae;
        }
        const authUser = authData.user;
        if (!authUser) throw new Error('No se pudo crear la cuenta. Intenta de nuevo.');

        // 3. Obtener escuela
        let escuelaId  = inv.escuela_id  || null;
        let escuelaCct = inv.escuela_cct || null;

        if (!escuelaCct && escuelaId) {
          const { data: esc } = await sb().from('escuelas').select('cct').eq('id', escuelaId).maybeSingle();
          escuelaCct = esc?.cct || null;
        }

        // 4. Insertar perfil en usuarios
        const partes = nombre.trim().split(/\s+/);
        const perfilPayload = {
          auth_id:    authUser.id,
          email:      email.toLowerCase().trim(),
          nombre:     partes[0] || nombre,
          apellido_p: partes[1] || '',
          apellido_m: partes[2] || '',
          rol:        inv.rol,
          escuela_id:  escuelaId,
          escuela_cct: escuelaCct,
          activo:     true,
        };

        const { error: pi } = await sb().from('usuarios').insert(perfilPayload);
        if (pi && !pi.message.includes('duplicate')) throw pi;

        // Si ya existía, actualizar auth_id
        if (pi?.message.includes('duplicate')) {
          await sb().from('usuarios').update({ auth_id: authUser.id, activo: true })
            .eq('email', email);
        }

        // 5. Marcar invitación como usada
        await sb().from('invitaciones')
          .update({ estado: 'usado', usado_at: new Date().toISOString() })
          .eq('token', token);

        // 6. Si la invitación tenía alumno_id (padre invitado desde padrón), crear vínculo automático
        if (inv.rol === 'padre' && inv.alumno_id) {
          try {
            const { data: perfilPadre } = await sb().from('usuarios')
              .select('id').eq('auth_id', authUser.id).maybeSingle();
            const padreId = perfilPadre?.id;
            if (padreId) {
              const { data: yaVinc } = await sb().from('padres_alumnos')
                .select('id').eq('padre_id', padreId).eq('alumno_id', inv.alumno_id).maybeSingle();
              if (!yaVinc) {
                await sb().from('padres_alumnos').insert({
                  padre_id:   padreId,
                  alumno_id:  inv.alumno_id,
                  escuela_id: inv.escuela_id || null,
                  activo:     true,
                });
              }
            }
          } catch(eLinkAuto) { console.warn('[auth] auto-link padres_alumnos:', eLinkAuto.message); }
        }

        return _ok({ authUser, perfil: perfilPayload });
      } catch (e) {
        return _err('authService.registrarConToken', e);
      }
    },

    /** Cambiar contraseña */
    async cambiarPassword(passwordNuevo) {
      try {
        const { error } = await sb().auth.updateUser({ password: passwordNuevo });
        if (error) throw error;
        return _ok(true);
      } catch (e) {
        return _err('authService.cambiarPassword', e);
      }
    },
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // ESCUELA SERVICE
  // ═══════════════════════════════════════════════════════════════════════════
  const escuelaService = {

    /** Crear escuela + generar invitación para director */
    async crearEscuela({ nombre, cct, municipio, estado, nivel, limite, dirNombre, dirEmail, dirRol }) {
      try {
        if (!nombre?.trim()) throw new Error('El nombre de la escuela es requerido.');
        if (!cct?.trim())    throw new Error('La CCT es requerida.');
        if (!dirEmail?.trim()) throw new Error('El email del director es requerido.');

        // 1. Crear escuela
        const { data: esc, error: ee } = await sb()
          .from('escuelas')
          .insert({
            nombre: nombre.trim(),
            cct:    cct.trim().toUpperCase(),
            municipio: municipio?.trim() || null,
            estado: estado || 'Nuevo León',
            nivel:  nivel  || 'primaria',
            limite_alumnos: limite || 500,
            activa: true,
          })
          .select('id, cct')
          .single();

        if (ee) throw ee;

        // 2. Generar token de invitación
        const token   = genToken();
        const expira  = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

        const { error: ie } = await sb().from('invitaciones').insert({
          token,
          escuela_id:     esc.id,
          escuela_cct:    esc.cct,
          rol:            dirRol || 'director',
          email_destino:  dirEmail.trim().toLowerCase(),
          nombre_destino: dirNombre?.trim() || '',
          estado:         'pendiente',
          expira_at:      expira,
        });

        if (ie) throw ie;

        const link = `${location.origin}/index.html?invite=${token}`;
        return _ok({ escuela: esc, token, link });
      } catch (e) {
        return _err('escuelaService.crearEscuela', e);
      }
    },

    /** Listar todas las escuelas (superadmin) */
    async listar() {
      try {
        const { data, error } = await sb()
          .from('escuelas')
          .select('id, cct, nombre, nivel, municipio, estado, zona_escolar, turno, ciclo_actual, activa, creado_en')
          .order('creado_en', { ascending: false });
        if (error) throw error;
        return _ok(data || []);
      } catch (e) {
        return _err('escuelaService.listar', e);
      }
    },

    /** Activar / suspender escuela */
    async toggleActiva(escuelaId, activa) {
      try {
        const { error } = await sb()
          .from('escuelas')
          .update({ activa })
          .eq('id', escuelaId);
        if (error) throw error;
        return _ok(true);
      } catch (e) {
        return _err('escuelaService.toggleActiva', e);
      }
    },

    /** Generar invitación para escuela existente */
    async generarInvitacion({ escuelaId, escuelaCct, rol, emailDestino, nombreDestino, dias = 7 }) {
      try {
        const token  = genToken();
        const expira = new Date(Date.now() + dias * 24 * 60 * 60 * 1000).toISOString();

        const { error } = await sb().from('invitaciones').insert({
          token,
          escuela_id:     escuelaId  || null,
          escuela_cct:    escuelaCct || null,
          rol,
          email_destino:  emailDestino?.toLowerCase().trim() || null,
          nombre_destino: nombreDestino?.trim() || null,
          estado:         'pendiente',
          expira_at:      expira,
        });

        if (error) throw error;
        const link = `${location.origin}/index.html?invite=${token}`;
        return _ok({ token, link });
      } catch (e) {
        return _err('escuelaService.generarInvitacion', e);
      }
    },
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // GRUPO SERVICE
  // ═══════════════════════════════════════════════════════════════════════════
  const grupoService = {

    /** Listar grupos de la escuela del usuario actual */
    async listar(escuelaCct, ciclo) {
      try {
        const cct = escuelaCct || window.currentPerfil?.escuela_cct;
        if (!cct) throw new Error('Sin CCT de escuela.');

        const { data, error } = await sb()
          .from('grupos')
          .select('id, nombre, grado, seccion, nivel, turno, ciclo, activo, docente_guia, docente_titular_id')
          .eq('escuela_cct', cct)
          .eq('ciclo', ciclo || cicloActivo())
          .eq('activo', true)
          .order('grado')
          .order('seccion');

        if (error) throw error;
        return _ok(data || []);
      } catch (e) {
        return _err('grupoService.listar', e);
      }
    },

    /** Crear grupo */
    async crear({ nombre, grado, seccion, nivel, turno, escuelaCct, docenteId }) {
      try {
        if (!nombre?.trim() && !grado) throw new Error('Nombre o grado requerido.');
        const cct = escuelaCct || window.currentPerfil?.escuela_cct;
        if (!cct) throw new Error('Sin CCT de escuela.');

        const nombreFinal = nombre?.trim() || `${grado}°${seccion || 'A'}`;

        const { data, error } = await sb()
          .from('grupos')
          .insert({
            nombre:      nombreFinal,
            grado:       parseInt(grado) || 1,
            seccion:     seccion || 'A',
            nivel:       nivel   || 'primaria',
            turno:       turno   || 'matutino',
            escuela_cct: cct,
            docente_guia:        docenteId || null,
            docente_titular_id:  docenteId || null,
            ciclo:  cicloActivo(),
            activo: true,
          })
          .select('id, nombre')
          .single();

        if (error) throw error;
        return _ok(data);
      } catch (e) {
        return _err('grupoService.crear', e);
      }
    },

    /** Grupos asignados a un docente */
    async deDocente(docenteId) {
      try {
        const id = docenteId || window.currentPerfil?.id;
        if (!id) throw new Error('Sin docente_id.');

        const { data, error } = await sb()
          .from('docente_grupos')
          .select('id, grupo_id, materia, ciclo, activo, grupos(id, nombre, grado, seccion, nivel, turno, escuela_cct)')
          .eq('docente_id', id)
          .eq('activo', true)
          .eq('ciclo', cicloActivo());

        if (error) throw error;
        return _ok(data || []);
      } catch (e) {
        return _err('grupoService.deDocente', e);
      }
    },

    /** Asignar docente a grupo + materia */
    async asignarDocente({ docenteId, grupoId, materia, esTitular = false }) {
      try {
        if (!docenteId || !grupoId) throw new Error('docenteId y grupoId requeridos.');

        const { error } = await sb()
          .from('docente_grupos')
          .upsert({
            docente_id: docenteId,
            grupo_id:   grupoId,
            materia:    materia || null,
            es_titular: esTitular,
            ciclo:      cicloActivo(),
            activo:     true,
          }, { onConflict: 'docente_id,grupo_id,materia,ciclo' });

        if (error) throw error;
        return _ok(true);
      } catch (e) {
        return _err('grupoService.asignarDocente', e);
      }
    },

    /** Alumnos de un grupo */
    async alumnos(grupoId) {
      try {
        if (!grupoId) throw new Error('grupoId requerido.');

        // alumnos_grupos → usuarios (algunos sistemas tienen tabla alumnos separada)
        const { data, error } = await sb()
          .from('alumnos_grupos')
          .select('alumno_id, activo, usuarios!alumno_id(id, nombre, apellido_p, apellido_m, curp)')
          .eq('grupo_id', grupoId)
          .eq('activo', true);

        if (error) throw error;

        // Si no hay join con usuarios, intentar con tabla alumnos
        const conPerfil = (data || []).filter(r => r.usuarios);
        if (!conPerfil.length && data?.length) {
          const ids = data.map(r => r.alumno_id);
          const { data: alumnos } = await sb()
            .from('alumnos')
            .select('id, nombre, curp, escuela_cct')
            .in('id', ids);
          return _ok(alumnos || []);
        }

        return _ok(conPerfil.map(r => ({ id: r.alumno_id, ...r.usuarios })));
      } catch (e) {
        return _err('grupoService.alumnos', e);
      }
    },

    /** Inscribir alumno a grupo */
    async inscribirAlumno({ alumnoId, grupoId }) {
      try {
        if (!alumnoId || !grupoId) throw new Error('alumnoId y grupoId requeridos.');

        const { error } = await sb()
          .from('alumnos_grupos')
          .upsert({
            alumno_id:     alumnoId,
            grupo_id:      grupoId,
            ciclo_escolar: cicloActivo(),
            ciclo:         cicloActivo(),
            activo:        true,
          }, { onConflict: 'alumno_id,grupo_id,ciclo_escolar' });

        if (error) throw error;
        return _ok(true);
      } catch (e) {
        return _err('grupoService.inscribirAlumno', e);
      }
    },
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // ALUMNO SERVICE
  // ═══════════════════════════════════════════════════════════════════════════
  const alumnoService = {

    /** Crear alumno (sin cuenta auth) */
    async crear({ nombre, apellidoP, apellidoM, curp, fechaNac, grupoId, escuelaCct, escuelaId }) {
      try {
        if (!nombre?.trim())    throw new Error('Nombre requerido.');
        if (!apellidoP?.trim()) throw new Error('Apellido paterno requerido.');

        const cct = escuelaCct || window.currentPerfil?.escuela_cct;
        const eid = escuelaId  || window.currentPerfil?.escuela_id;

        // 1. Insertar en usuarios
        const { data: usr, error: ue } = await sb()
          .from('usuarios')
          .insert({
            nombre:     nombre.trim(),
            apellido_p: apellidoP.trim(),
            apellido_m: apellidoM?.trim() || '',
            curp:       curp?.trim().toUpperCase() || null,
            fecha_nac:  fechaNac || null,
            rol:        'alumno',
            escuela_cct: cct,
            escuela_id:  eid,
            activo:     true,
          })
          .select('id')
          .single();

        if (ue) throw ue;

        // 2. Inscribir a grupo
        if (grupoId && usr?.id) {
          await grupoService.inscribirAlumno({ alumnoId: usr.id, grupoId });

          // 3. Crear perfil XP
          try { await sb().from('perfil_alumno').insert({ alumno_id: usr.id, xp_total: 0, racha_dias: 0, nivel: 1, nivel_planta: 1 }); } catch(_){}
        }

        return _ok(usr);
      } catch (e) {
        return _err('alumnoService.crear', e);
      }
    },

    /** Perfil completo del alumno */
    async perfil(alumnoId) {
      try {
        const id = alumnoId || window.currentPerfil?.id;
        if (!id) throw new Error('alumnoId requerido.');

        const [{ data: usuario }, { data: xp }, { data: logros }] = await Promise.all([
          sb().from('usuarios').select('*').eq('id', id).maybeSingle(),
          sb().from('perfil_alumno').select('*').eq('alumno_id', id).maybeSingle(),
          sb().from('xp_eventos_alumno').select('cantidad, motivo, fecha')
            .eq('alumno_id', id).order('created_at', { ascending: false }).limit(20),
        ]);

        return _ok({ usuario, xp, logros: logros || [] });
      } catch (e) {
        return _err('alumnoService.perfil', e);
      }
    },

    /** Calificaciones del alumno */
    async calificaciones(alumnoId, ciclo) {
      try {
        const id = alumnoId || window.currentPerfil?.id;
        if (!id) throw new Error('alumnoId requerido.');

        const { data, error } = await sb()
          .from('calificaciones')
          .select('materia, trimestre, aspecto, calificacion, observacion')
          .eq('alumno_id', id)
          .eq('ciclo', ciclo || cicloActivo())
          .order('materia')
          .order('trimestre');

        if (error) throw error;
        return _ok(data || []);
      } catch (e) {
        return _err('alumnoService.calificaciones', e);
      }
    },

    /** Asistencia del alumno */
    async asistencia(alumnoId, diasAtras = 30) {
      try {
        const id = alumnoId || window.currentPerfil?.id;
        if (!id) throw new Error('alumnoId requerido.');
        const desde = new Date(Date.now() - diasAtras * 24 * 60 * 60 * 1000)
          .toISOString().split('T')[0];

        const { data, error } = await sb()
          .from('asistencia')
          .select('fecha, estado, nota')
          .eq('alumno_id', id)
          .gte('fecha', desde)
          .order('fecha', { ascending: false });

        if (error) throw error;
        return _ok(data || []);
      } catch (e) {
        return _err('alumnoService.asistencia', e);
      }
    },

    /** Sumar XP al alumno */
    async sumarXP(alumnoId, cantidad, motivo) {
      try {
        const id = alumnoId || window.currentPerfil?.id;
        if (!id) throw new Error('alumnoId requerido.');
        if (!cantidad || cantidad <= 0) throw new Error('Cantidad de XP inválida.');

        await sb().from('historial_xp').insert({
          alumno_id: id,
          cantidad,
          puntos: cantidad,
          motivo: motivo || 'Actividad completada',
        });

        // Actualizar total en perfil_alumno
        const { data: pf } = await sb()
          .from('perfil_alumno').select('xp_total').eq('alumno_id', id).maybeSingle();

        await sb().from('perfil_alumno')
          .upsert({ alumno_id: id, xp_total: (pf?.xp_total || 0) + cantidad },
            { onConflict: 'alumno_id' });

        return _ok(true);
      } catch (e) {
        return _err('alumnoService.sumarXP', e);
      }
    },

    /** Tareas del alumno */
    async tareas(alumnoId) {
      try {
        const id = alumnoId || window.currentPerfil?.id;
        if (!id) throw new Error('alumnoId requerido.');

        // Obtener grupos del alumno
        const { data: grupos } = await sb()
          .from('alumnos_grupos')
          .select('grupo_id')
          .eq('alumno_id', id)
          .eq('activo', true);

        if (!grupos?.length) return _ok([]);
        const grupoIds = grupos.map(g => g.grupo_id);

        const { data, error } = await sb()
          .from('tareas_docente')
          .select(`
            id, titulo, materia, fecha_entrega, instrucciones, trimestre,
            tareas_entregas!inner(alumno_id, estado, calificacion)
          `)
          .in('grupo_id', grupoIds)
          .eq('ciclo', cicloActivo())
          .order('fecha_entrega', { ascending: true });

        if (error) {
          // Sin join, obtener tareas sin estado de entrega
          const { data: t2 } = await sb()
            .from('tareas_docente')
            .select('id, titulo, materia, fecha_entrega, instrucciones, trimestre')
            .in('grupo_id', grupoIds)
            .eq('ciclo', cicloActivo())
            .order('fecha_entrega');
          return _ok(t2 || []);
        }

        return _ok(data || []);
      } catch (e) {
        return _err('alumnoService.tareas', e);
      }
    },
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // DOCENTE SERVICE
  // ═══════════════════════════════════════════════════════════════════════════
  const docenteService = {

    /** Guardar asistencia de un alumno */
    async guardarAsistencia({ alumnoId, grupoId, estado, fecha, nota }) {
      try {
        if (!alumnoId || !grupoId) throw new Error('alumnoId y grupoId requeridos.');
        const estados = ['presente', 'ausente', 'justificada', 'retardo'];
        if (!estados.includes(estado)) throw new Error(`Estado inválido: ${estado}`);

        const { error } = await sb()
          .from('asistencia')
          .upsert({
            alumno_id:  alumnoId,
            grupo_id:   grupoId,
            docente_id: window.currentPerfil?.id || null,
            fecha:      fecha || new Date().toISOString().split('T')[0],
            estado,
            nota:       nota || null,
          }, { onConflict: 'alumno_id,grupo_id,fecha' });

        if (error) throw error;
        return _ok(true);
      } catch (e) {
        return _err('docenteService.guardarAsistencia', e);
      }
    },

    /** Asistencia de hoy de un grupo */
    async asistenciaHoy(grupoId) {
      try {
        if (!grupoId) throw new Error('grupoId requerido.');
        const hoy = new Date().toISOString().split('T')[0];

        const { data, error } = await sb()
          .from('asistencia')
          .select('alumno_id, estado, nota')
          .eq('grupo_id', grupoId)
          .eq('fecha', hoy);

        if (error) throw error;
        // Mapa alumnoId → estado
        const mapa = {};
        (data || []).forEach(r => { mapa[r.alumno_id] = r.estado; });
        return _ok(mapa);
      } catch (e) {
        return _err('docenteService.asistenciaHoy', e);
      }
    },

    /** Guardar / actualizar calificación */
    async guardarCalificacion({ alumnoId, grupoId, materia, aspecto, trimestre, calificacion, observacion }) {
      try {
        if (!alumnoId || !grupoId || !materia || !trimestre)
          throw new Error('alumnoId, grupoId, materia y trimestre son requeridos.');

        const cal = parseFloat(calificacion);
        if (isNaN(cal) || cal < 0 || cal > 10)
          throw new Error('Calificación debe estar entre 0 y 10.');

        const { error } = await sb()
          .from('calificaciones')
          .upsert({
            alumno_id:   alumnoId,
            grupo_id:    grupoId,
            docente_id:  window.currentPerfil?.id || null,
            materia,
            aspecto:     aspecto || 'general',
            trimestre:   parseInt(trimestre),
            calificacion: cal,
            ciclo:       cicloActivo(),
            observacion: observacion || null,
          }, { onConflict: 'alumno_id,grupo_id,materia,aspecto,trimestre,ciclo' });

        if (error) throw error;
        return _ok(true);
      } catch (e) {
        return _err('docenteService.guardarCalificacion', e);
      }
    },

    /** Guardar lote de calificaciones (array) */
    async guardarCalificaciones(rows) {
      try {
        if (!rows?.length) return _ok(0);

        const payload = rows.map(r => ({
          alumno_id:    r.alumno_id,
          grupo_id:     r.grupo_id,
          docente_id:   r.docente_id || window.currentPerfil?.id || null,
          materia:      r.materia,
          aspecto:      r.aspecto    || 'general',
          trimestre:    parseInt(r.trimestre),
          calificacion: parseFloat(r.calificacion),
          ciclo:        r.ciclo || cicloActivo(),
          observacion:  r.observacion || null,
        })).filter(r => !isNaN(r.calificacion) && !isNaN(r.trimestre));

        const { error } = await sb()
          .from('calificaciones')
          .upsert(payload, { onConflict: 'alumno_id,grupo_id,materia,aspecto,trimestre,ciclo' });

        if (error) throw error;
        return _ok(payload.length);
      } catch (e) {
        return _err('docenteService.guardarCalificaciones', e);
      }
    },

    /** Calificaciones de un grupo */
    async calificacionesGrupo(grupoId, trimestre, ciclo) {
      try {
        if (!grupoId) throw new Error('grupoId requerido.');

        let q = sb()
          .from('calificaciones')
          .select('alumno_id, materia, aspecto, trimestre, calificacion, observacion')
          .eq('grupo_id', grupoId)
          .eq('ciclo', ciclo || cicloActivo());

        if (trimestre) q = q.eq('trimestre', parseInt(trimestre));

        const { data, error } = await q.order('alumno_id').order('materia');
        if (error) throw error;
        return _ok(data || []);
      } catch (e) {
        return _err('docenteService.calificacionesGrupo', e);
      }
    },
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // TAREA SERVICE
  // ═══════════════════════════════════════════════════════════════════════════
  const tareaService = {

    /** Crear tarea */
    async crear({ titulo, materia, grupoId, fechaEntrega, instrucciones, trimestre, tipo }) {
      try {
        if (!titulo?.trim())  throw new Error('Título requerido.');
        if (!grupoId)         throw new Error('Grupo requerido.');

        const { data, error } = await sb()
          .from('tareas_docente')
          .insert({
            titulo:       titulo.trim(),
            materia:      materia || null,
            grupo_id:     grupoId,
            docente_id:   window.currentPerfil?.id,
            fecha_entrega: fechaEntrega || null,
            instrucciones: instrucciones?.trim() || null,
            trimestre:    trimestre ? parseInt(trimestre) : 1,
            tipo:         tipo || 'tarea',
            ciclo:        cicloActivo(),
          })
          .select('id')
          .single();

        if (error) throw error;

        // Crear registros de entrega para cada alumno del grupo
        await tareaService._crearEntregas(data.id, grupoId);

        return _ok(data);
      } catch (e) {
        return _err('tareaService.crear', e);
      }
    },

    /** Crear entradas en tareas_entregas para todos los alumnos del grupo */
    async _crearEntregas(tareaId, grupoId) {
      try {
        const { data: alumnos } = await sb()
          .from('alumnos_grupos')
          .select('alumno_id')
          .eq('grupo_id', grupoId)
          .eq('activo', true);

        if (!alumnos?.length) return;

        const rows = alumnos.map(a => ({
          tarea_id:  tareaId,
          alumno_id: a.alumno_id,
          estado:    'pendiente',
          entregada: false,
        }));

        try { await sb().from('tareas_entregas').upsert(rows, { onConflict: 'tarea_id,alumno_id' }); } catch(_){}
      } catch (e) {
        console.warn('[tareaService._crearEntregas]', e.message);
      }
    },

    /** Listar tareas del docente por grupo */
    async listar(grupoId, docenteId) {
      try {
        if (!grupoId) throw new Error('grupoId requerido.');
        const did = docenteId || window.currentPerfil?.id;

        const { data, error } = await sb()
          .from('tareas_docente')
          .select('id, titulo, materia, fecha_entrega, instrucciones, trimestre, tipo, created_at, tareas_entregas(alumno_id, estado, calificacion)')
          .eq('grupo_id', grupoId)
          .eq('docente_id', did)
          .eq('ciclo', cicloActivo())
          .order('created_at', { ascending: false });

        if (error) throw error;
        return _ok(data || []);
      } catch (e) {
        return _err('tareaService.listar', e);
      }
    },

    /** Actualizar estado de entrega de un alumno */
    async actualizarEntrega({ tareaId, alumnoId, estado, calificacion, comentario }) {
      try {
        if (!tareaId || !alumnoId) throw new Error('tareaId y alumnoId requeridos.');
        const estadosValidos = ['pendiente', 'entregada', 'tarde', 'no_entregada'];
        if (estado && !estadosValidos.includes(estado))
          throw new Error(`Estado inválido: ${estado}`);

        const payload = {
          tarea_id:  tareaId,
          alumno_id: alumnoId,
          estado:    estado || 'entregada',
          entregada: estado === 'entregada' || estado === 'tarde',
          updated_at: new Date().toISOString(),
        };
        if (calificacion !== undefined) payload.calificacion = parseFloat(calificacion);
        if (comentario !== undefined)   payload.comentario_docente = comentario;
        if (estado === 'entregada' || estado === 'tarde') {
          payload.fecha_entrega = new Date().toISOString();
        }

        const { error } = await sb()
          .from('tareas_entregas')
          .upsert(payload, { onConflict: 'tarea_id,alumno_id' });

        if (error) throw error;
        return _ok(true);
      } catch (e) {
        return _err('tareaService.actualizarEntrega', e);
      }
    },

    /** Crear examen */
    async crearExamen({ titulo, materia, grupoId, fecha, puntosMax, trimestre, descripcion }) {
      try {
        if (!titulo?.trim()) throw new Error('Título requerido.');
        if (!grupoId)        throw new Error('Grupo requerido.');

        const { data, error } = await sb()
          .from('examenes_docente')
          .insert({
            nombre:          titulo.trim(),
            materia:         materia || '',
            grupo_id:        grupoId,
            docente_id:      window.currentPerfil?.id,
            fecha_aplicacion: fecha || null,
            valor_maximo:    puntosMax || 10,
            trimestre:       trimestre ? parseInt(trimestre) : 1,
            descripcion:     descripcion?.trim() || null,
            ciclo:           cicloActivo(),
          })
          .select('id')
          .single();

        if (error) throw error;
        return _ok(data);
      } catch (e) {
        return _err('tareaService.crearExamen', e);
      }
    },

    /** Guardar calificaciones de examen */
    async guardarCalifExamen({ examenId, grupoId, calificaciones }) {
      try {
        if (!examenId || !calificaciones?.length)
          throw new Error('examenId y calificaciones requeridos.');

        const rows = calificaciones.map(c => ({
          examen_id:   examenId,
          alumno_id:   c.alumno_id,
          grupo_id:    grupoId || null,
          docente_id:  window.currentPerfil?.id || null,
          calificacion: parseFloat(c.calificacion),
          comentario:  c.comentario || null,
          ciclo:       cicloActivo(),
        })).filter(r => !isNaN(r.calificacion));

        const { error } = await sb()
          .from('examenes_calificaciones')
          .upsert(rows, { onConflict: 'examen_id,alumno_id' });

        if (error) throw error;
        return _ok(rows.length);
      } catch (e) {
        return _err('tareaService.guardarCalifExamen', e);
      }
    },
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // PADRE SERVICE
  // ═══════════════════════════════════════════════════════════════════════════
  const padreService = {

    /** Hijos vinculados al padre */
    async hijos(padreId) {
      try {
        const id = padreId || window.currentPerfil?.id;
        if (!id) throw new Error('padreId requerido.');

        // Intentar con padres_alumnos primero
        const { data: vinculos, error: ve } = await sb()
          .from('padres_alumnos')
          .select('alumno_id, activo')
          .eq('padre_id', id)
          .eq('activo', true);

        if (ve) throw ve;
        if (!vinculos?.length) return _ok([]);

        const alumnoIds = vinculos.map(v => v.alumno_id);

        // Buscar en usuarios primero
        const { data: usrs } = await sb()
          .from('usuarios')
          .select('id, nombre, apellido_p, apellido_m, curp, escuela_cct')
          .in('id', alumnoIds);

        if (usrs?.length) return _ok(usrs);

        // Fallback: tabla alumnos separada
        const { data: alumnos } = await sb()
          .from('alumnos')
          .select('id, nombre, curp, escuela_cct')
          .in('id', alumnoIds);

        return _ok(alumnos || []);
      } catch (e) {
        return _err('padreService.hijos', e);
      }
    },

    /** Vincular padre con alumno usando código */
    async vincularConCodigo(codigo, padreId) {
      try {
        const id = padreId || window.currentPerfil?.id;
        if (!id)     throw new Error('padreId requerido.');
        if (!codigo) throw new Error('Código requerido.');

        // Buscar en vinculos_padre por token o codigo
        const { data: vinc, error: ve } = await sb()
          .from('vinculos_padre')
          .select('*')
          .or(`token.eq.${codigo},codigo.eq.${codigo}`)
          .eq('usado', false)
          .maybeSingle();

        if (ve) throw ve;
        if (!vinc) throw new Error('Código inválido o ya utilizado.');
        if (vinc.expira_at && new Date(vinc.expira_at) < new Date())
          throw new Error('Este código ha expirado.');

        // Vincular
        const { error: pe } = await sb()
          .from('padres_alumnos')
          .upsert({
            padre_id:  id,
            alumno_id: vinc.alumno_id,
            activo:    true,
          }, { onConflict: 'padre_id,alumno_id' });

        if (pe) throw pe;

        // Marcar código como usado
        await sb().from('vinculos_padre')
          .update({ usado: true, padre_id: id })
          .eq('id', vinc.id);

        return _ok(vinc.alumno_id);
      } catch (e) {
        return _err('padreService.vincularConCodigo', e);
      }
    },

    /** Progreso completo de un hijo */
    async progresoHijo(alumnoId, ciclo) {
      try {
        if (!alumnoId) throw new Error('alumnoId requerido.');

        const c = ciclo || cicloActivo();

        const [cals, asist, perfil, tareas] = await Promise.all([
          sb().from('calificaciones')
            .select('materia, trimestre, aspecto, calificacion')
            .eq('alumno_id', alumnoId).eq('ciclo', c),
          sb().from('asistencia')
            .select('fecha, estado')
            .eq('alumno_id', alumnoId)
            .gte('fecha', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
            .order('fecha', { ascending: false }),
          sb().from('perfil_alumno')
            .select('xp_total, racha_dias, nivel, nivel_planta')
            .eq('alumno_id', alumnoId).maybeSingle(),
          sb().from('tareas_entregas')
            .select('estado, tarea_id')
            .eq('alumno_id', alumnoId),
        ]);

        // Calcular promedio general
        const calData = cals.data || [];
        const promedio = calData.length
          ? (calData.reduce((s, c) => s + parseFloat(c.calificacion || 0), 0) / calData.length).toFixed(1)
          : null;

        // Porcentaje de asistencia
        const asistData = asist.data || [];
        const presentes = asistData.filter(a => a.estado === 'presente').length;
        const pctAsist  = asistData.length
          ? Math.round((presentes / asistData.length) * 100)
          : null;

        // Tareas entregadas
        const tareasData = tareas.data || [];
        const entregadas = tareasData.filter(t => t.estado === 'entregada' || t.estado === 'tarde').length;

        return _ok({
          calificaciones: calData,
          asistencia:     asistData,
          perfil:         perfil.data,
          promedio,
          pct_asistencia: pctAsist,
          tareas_total:    tareasData.length,
          tareas_entregadas: entregadas,
        });
      } catch (e) {
        return _err('padreService.progresoHijo', e);
      }
    },

    /** Generar código de vinculación para un alumno (admin/docente) */
    async generarCodigoVinculacion(alumnoId, escuelaId) {
      try {
        if (!alumnoId) throw new Error('alumnoId requerido.');
        const codigo = genToken(8).toUpperCase();
        const expira = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

        const { error } = await sb().from('vinculos_padre').insert({
          codigo,
          token:     codigo,
          alumno_id: alumnoId,
          escuela_id: escuelaId || null,
          usado:     false,
          expira_at: expira,
        });

        if (error) throw error;
        return _ok(codigo);
      } catch (e) {
        return _err('padreService.generarCodigoVinculacion', e);
      }
    },
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // BILLING SERVICE — Conekta
  // Métodos de alto nivel para cobros, historial y estado de suscripción.
  // Los cobros reales pasan por la Edge Function conekta-checkout.
  // ═══════════════════════════════════════════════════════════════════════════
  const billingService = {

    /**
     * Inicia un cobro para una escuela.
     * Llama a la Edge Function conekta-checkout y devuelve los datos
     * necesarios para que el frontend muestre el link / referencia.
     *
     * @param {object} opts
     * @param {string} opts.escuelaId  - UUID de la escuela
     * @param {string} opts.planId     - 'basico' | 'estandar' | 'premium'
     * @param {string} opts.metodo     - 'card' | 'oxxo' | 'spei'
     * @returns {{ data, error }}
     */
    async crearOrden({ escuelaId, planId, metodo = 'card' }) {
      try {
        const { data: { session } } = await sb().auth.getSession();
        const jwt = session?.access_token;
        if (!jwt) throw new Error('Sin sesión activa');

        const supabaseUrl = window.SUPABASE_URL || sb().supabaseUrl;
        const edgeUrl = supabaseUrl + '/functions/v1/conekta-checkout';

        const res = await fetch(edgeUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${jwt}`,
          },
          body: JSON.stringify({ escuela_id: escuelaId, plan_id: planId, metodo }),
        });

        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || `Error ${res.status}`);
        return _ok(data);
      } catch (e) {
        return _err('billingService.crearOrden', e);
      }
    },

    /**
     * Obtiene el historial de pagos de una escuela.
     * @param {string} escuelaId
     */
    async historialEscuela(escuelaId) {
      try {
        const { data, error } = await sb()
          .from('pagos')
          .select('id,plan_id,monto_mxn,metodo,estado,periodo_inicio,periodo_fin,creado_at,conekta_order_id')
          .eq('escuela_id', escuelaId)
          .order('creado_at', { ascending: false })
          .limit(24);

        if (error) throw error;
        return _ok(data || []);
      } catch (e) {
        return _err('billingService.historialEscuela', e);
      }
    },

    /**
     * Verifica si una escuela tiene suscripción activa.
     * Retorna { activa: bool, plan, vence_en_dias }
     * @param {string} escuelaCct
     */
    async verificarSuscripcion(escuelaCct) {
      try {
        const { data, error } = await sb()
          .from('escuelas')
          .select('plan_suscripcion,estado_suscripcion,fecha_vencimiento')
          .eq('cct', escuelaCct)
          .maybeSingle();

        if (error) throw error;
        if (!data) return _ok({ activa: false, plan: null, vence_en_dias: null });

        const hoy = new Date();
        const vence = data.fecha_vencimiento ? new Date(data.fecha_vencimiento) : null;
        const diasRestantes = vence ? Math.ceil((vence - hoy) / 86400000) : null;

        return _ok({
          activa:       data.estado_suscripcion === 'activa' && (diasRestantes === null || diasRestantes > 0),
          plan:         data.plan_suscripcion,
          estado:       data.estado_suscripcion,
          vence_en_dias: diasRestantes,
        });
      } catch (e) {
        return _err('billingService.verificarSuscripcion', e);
      }
    },

    /**
     * Obtiene todos los pagos (para el panel de superadmin).
     * @param {{ limite, estado }} opts
     */
    async todosPagos({ limite = 100, estado = null } = {}) {
      try {
        let query = sb()
          .from('pagos')
          .select('*')
          .order('creado_at', { ascending: false })
          .limit(limite);

        if (estado) query = query.eq('estado', estado);

        const { data, error } = await query;
        if (error) throw error;
        return _ok(data || []);
      } catch (e) {
        return _err('billingService.todosPagos', e);
      }
    },
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // SESSION WATCHER — onAuthStateChange
  // Detecta token expirado, logout externo (otra pestaña) y refresco de sesión.
  // Emite eventos custom para que cada portal reaccione sin acoplamiento.
  //
  // Eventos emitidos en window:
  //   siembra:session_expired  → token expirado o revocado
  //   siembra:session_restored → token refrescado automáticamente
  //   siembra:signed_out       → logout desde otra pestaña/ventana
  // ═══════════════════════════════════════════════════════════════════════════
  const sessionWatcher = {
    _unsub: null,
    _started: false,

    /**
     * Inicia el listener. Llamar UNA VEZ después de que Supabase esté listo.
     * Si ya está corriendo, no hace nada (idempotente).
     */
    start() {
      if (this._started) return;
      this._started = true;

      try {
        const client = sb();
        this._unsub = client.auth.onAuthStateChange((event, session) => {
          switch (event) {

            // Token JWT refrescado automáticamente por el SDK
            case 'TOKEN_REFRESHED':
              if (session?.user) {
                window.currentUser = session.user;
                window.dispatchEvent(new CustomEvent('siembra:session_restored', {
                  detail: { user: session.user }
                }));
                console.info('[SIEMBRA] Token refrescado correctamente.');
              }
              break;

            // Sesión cerrada: puede ser logout explícito, token revocado
            // o cierre de sesión desde otra pestaña/dispositivo
            case 'SIGNED_OUT':
              // Si no hay usuario activo en esta pestaña, ignorar (ya se hizo logout local)
              if (!window.currentPerfil && !window.currentUser) break;

              console.warn('[SIEMBRA] Sesión cerrada externamente (SIGNED_OUT).');
              window.currentUser   = null;
              window.currentPerfil = null;
              sessionStorage.clear();

              // Notificar al portal activo para que muestre el login
              window.dispatchEvent(new CustomEvent('siembra:signed_out', {
                detail: { reason: 'external' }
              }));
              break;

            // El usuario inició sesión en otra pestaña — actualizar estado local
            case 'SIGNED_IN':
              if (session?.user && !window.currentUser) {
                window.currentUser = session.user;
                // El perfil se carga bajo demanda desde el portal
                window.dispatchEvent(new CustomEvent('siembra:session_restored', {
                  detail: { user: session.user }
                }));
              }
              break;

            // Cualquier error de sesión (token inválido, expirado sin refresh posible)
            case 'USER_UPDATED':
              // Actualizar usuario si cambió (ej. cambio de email confirmado)
              if (session?.user) window.currentUser = session.user;
              break;

            default:
              break;
          }
        });

        console.info('[SIEMBRA] sessionWatcher activo — escuchando cambios de sesión.');
      } catch (e) {
        console.warn('[SIEMBRA] sessionWatcher no pudo iniciarse:', e.message);
      }
    },

    /** Detiene el listener (útil en tests o unmount de SPA) */
    stop() {
      if (this._unsub?.data?.subscription) {
        this._unsub.data.subscription.unsubscribe();
      }
      this._unsub  = null;
      this._started = false;
    },
  };

  // ── Handler global para siembra:signed_out ──────────────────────────────
  // Escucha el evento y redirige al login usando la función hubLogout si existe
  // (definida en index.html), o recarga la página como fallback seguro.
  window.addEventListener('siembra:signed_out', () => {
    toast('🔒 Tu sesión fue cerrada en otro dispositivo. Inicia sesión de nuevo.', 'err');
    setTimeout(() => {
      if (typeof hubLogout === 'function') {
        hubLogout();
      } else {
        // Fallback para alumno.html u otros portales sin hubLogout
        sessionStorage.clear();
        try { localStorage.removeItem('siembra_alumno_token'); } catch(e) {}
        window.location.href = '/index.html';
      }
    }, 2000);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPORTAR
  // ═══════════════════════════════════════════════════════════════════════════
  global.SIEMBRA = {
    auth:           authService,
    billing:        billingService,
    escuela:        escuelaService,
    grupo:          grupoService,
    alumno:         alumnoService,
    docente:        docenteService,
    tarea:          tareaService,
    padre:          padreService,
    sessionWatcher: sessionWatcher,
    // Utilidades públicas
    utils: { genToken, cicloActivo, toast },
  };

  console.info('[SIEMBRA] Servicios v1.0 listos ✓');

})(window);
