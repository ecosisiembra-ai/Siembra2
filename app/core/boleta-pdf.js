/**
 * SIEMBRA — Módulo de Boletas PDF / Impresión
 * Cubre 3 flujos:
 *   1. Portal docente  → imprimirBoleta() / exportarBoletaPDF()
 *   2. Portal padre    → padreBoltaImprimir() / padreBoltaDescargarPDF()
 *   3. Lote grupo      → bltGenerarTodasPDF()
 */

// ─── Utilidad: abrir ventana de impresión con HTML limpio ─────────────────────
function _bltAbrirVentanaImpresion(htmlContenido, titulo) {
  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) {
    hubToast('❌ El navegador bloqueó la ventana emergente. Permite ventanas emergentes para este sitio.', 'error');
    return null;
  }
  win.document.write(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${titulo || 'Boleta NEM — SIEMBRA'}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Arial', sans-serif;
      font-size: 12px;
      color: #111;
      background: white;
      padding: 12px;
    }
    @media print {
      body { padding: 0; }
      .no-print { display: none !important; }
      @page { size: A4 portrait; margin: 10mm; }
    }
    .boleta-wrap { max-width: 750px; margin: 0 auto; }
    .blt-header {
      background: #0d5c2f;
      color: white;
      padding: 14px 20px;
      display: flex;
      align-items: center;
      gap: 14px;
      border-radius: 8px 8px 0 0;
    }
    .blt-header-icon {
      width: 48px; height: 48px;
      background: rgba(255,255,255,.18);
      border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      font-size: 24px; flex-shrink: 0;
    }
    .blt-header h1 { font-size: 15px; font-weight: 800; margin-bottom: 2px; }
    .blt-header p  { font-size: 10px; opacity: .8; }
    .blt-trim-badge {
      margin-left: auto;
      background: rgba(255,255,255,.15);
      padding: 6px 14px;
      border-radius: 8px;
      text-align: center;
    }
    .blt-trim-badge .num { font-size: 26px; font-weight: 900; line-height: 1; }
    .blt-trim-badge .lbl { font-size: 9px; opacity: .8; }
    .blt-datos {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      padding: 10px 18px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4px 20px;
      font-size: 11px;
    }
    .blt-datos span { color: #64748b; }
    .blt-datos strong { color: #111; }
    .blt-tabla-wrap { padding: 14px 18px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th {
      background: #f1f5f9;
      padding: 7px 8px;
      text-align: left;
      font-size: 10px;
      font-weight: 700;
      color: #475569;
      border: 1px solid #e2e8f0;
    }
    td { padding: 6px 8px; border: 1px solid #e2e8f0; }
    .td-campo { background: #f0fdf4; font-weight: 700; font-size: 10px; color: #166534; vertical-align: middle; }
    .td-cal { text-align: center; font-weight: 800; font-size: 13px; }
    .cal-verde { color: #16a34a; }
    .cal-azul  { color: #2563eb; }
    .cal-amber { color: #d97706; }
    .cal-rojo  { color: #dc2626; }
    .blt-asist {
      margin-top: 10px;
      display: flex; gap: 18px;
      font-size: 11px; color: #64748b;
    }
    .blt-obs {
      margin-top: 10px;
      padding: 10px 12px;
      background: #fffbeb;
      border-radius: 6px;
      border-left: 3px solid #f59e0b;
      font-size: 11px;
      color: #92400e;
    }
    .blt-firmas {
      margin-top: 28px;
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 20px;
      padding-top: 10px;
    }
    .blt-firma-line {
      border-top: 1px solid #374151;
      padding-top: 6px;
      text-align: center;
      font-size: 9px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: .5px;
    }
    .blt-footer {
      margin-top: 16px;
      text-align: center;
      font-size: 9px;
      color: #94a3b8;
      padding-top: 8px;
      border-top: 1px solid #e2e8f0;
    }
    .btn-imprimir {
      display: block;
      margin: 16px auto 8px;
      padding: 10px 28px;
      background: #0d5c2f;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <button class="btn-imprimir no-print" onclick="window.print()">🖨️ Imprimir / Guardar PDF</button>
  ${htmlContenido}
  <script>
    // Auto-imprimir si viene con ?autoprint=1
    if (window.location.search.includes('autoprint')) {
      setTimeout(function(){ window.print(); }, 400);
    }
  <\/script>
</body>
</html>`);
  win.document.close();
  return win;
}

// ─── Generar HTML de boleta a partir de datos estructurados ──────────────────
function _bltGenerarHTML(datos) {
  const {
    escuela, cct, municipio, ciclo, trimestre, docente,
    alumno, curp, grado, folio,
    campos, asistencias, inasistJust, inasistInjust,
    obsGeneral
  } = datos;

  const calColor = v => v >= 9 ? 'cal-verde' : v >= 7 ? 'cal-azul' : v >= 6 ? 'cal-amber' : 'cal-rojo';

  let filasHtml = '';
  let totalCals = 0, sumCals = 0;
  for (const [campo, mats] of Object.entries(campos || {})) {
    if (!mats || !mats.length) continue;
    mats.forEach((m, i) => {
      const calVal = isNaN(m.cal) ? null : m.cal;
      if (calVal !== null) { sumCals += calVal; totalCals++; }
      filasHtml += `<tr>
        ${i === 0 ? `<td class="td-campo" rowspan="${mats.length}">${campo}</td>` : ''}
        <td>${m.materia}</td>
        <td class="td-cal ${calVal !== null ? calColor(calVal) : ''}">${calVal !== null ? calVal.toFixed(1) : '—'}</td>
      </tr>`;
    });
  }
  if (!filasHtml) {
    filasHtml = '<tr><td colspan="3" style="text-align:center;padding:16px;color:#94a3b8;">Sin calificaciones registradas para este trimestre</td></tr>';
  }

  const promedio = totalCals ? (sumCals / totalCals).toFixed(1) : '—';
  const asistHtml = (asistencias != null)
    ? `<div class="blt-asist">
        <span>Asistencias: <strong>${asistencias}</strong></span>
        <span>Inasist. justificadas: <strong>${inasistJust || 0}</strong></span>
        <span>Inasist. injustificadas: <strong>${inasistInjust || 0}</strong></span>
       </div>` : '';
  const obsHtml = obsGeneral
    ? `<div class="blt-obs"><strong>Observaciones del docente:</strong> ${obsGeneral}</div>` : '';

  return `
  <div class="boleta-wrap">
    <div class="blt-header">
      <div class="blt-header-icon">🌱</div>
      <div style="flex:1;">
        <h1>${escuela || 'Nombre de la escuela'}</h1>
        <p>Secretaría de Educación Pública · NEM Plan 2022 · CCT: ${cct || '—'} · ${municipio || ''}</p>
        <p>Ciclo escolar ${ciclo || '—'} · Docente: ${docente || '—'}</p>
      </div>
      <div class="blt-trim-badge">
        <div class="lbl">Trimestre</div>
        <div class="num">${trimestre}°</div>
      </div>
    </div>
    <div class="blt-datos">
      <div><span>Alumno(a): </span><strong>${alumno || '—'}</strong></div>
      <div><span>CURP: </span><strong style="font-family:monospace;">${curp || '—'}</strong></div>
      <div><span>Grado / Grupo: </span><strong>${grado || '—'}</strong></div>
      <div><span>Folio: </span><strong style="font-family:monospace;font-size:10px;">${folio || '—'}</strong></div>
    </div>
    <div class="blt-tabla-wrap">
      <table>
        <thead>
          <tr>
            <th style="width:30%;">Campo Formativo</th>
            <th>Materia / Asignatura</th>
            <th style="width:60px;text-align:center;">Cal.</th>
          </tr>
        </thead>
        <tbody>${filasHtml}</tbody>
        <tfoot>
          <tr style="background:#f0fdf4;">
            <td colspan="2" style="text-align:right;font-weight:700;font-size:11px;color:#166534;">Promedio general del trimestre</td>
            <td class="td-cal" style="font-size:15px;color:#0d5c2f;">${promedio}</td>
          </tr>
        </tfoot>
      </table>
      ${asistHtml}
      ${obsHtml}
      <div class="blt-firmas">
        <div class="blt-firma-line">Director(a)</div>
        <div class="blt-firma-line">Docente titular</div>
        <div class="blt-firma-line">Padre / Tutor</div>
      </div>
      <div class="blt-footer">
        Documento generado por SIEMBRA · Plataforma Educativa NEM 2022 · ${new Date().toLocaleDateString('es-MX', { year:'numeric', month:'long', day:'numeric' })}
      </div>
    </div>
  </div>`;
}

// ─── Portal DOCENTE: imprimir boleta actual ───────────────────────────────────
function imprimirBoleta() {
  const preview = document.getElementById('boleta-preview');
  if (!preview) { hubToast('❌ No se encontró la boleta', 'error'); return; }

  // Recoger datos del formulario
  const g = id => document.getElementById(id)?.value?.trim() || '';
  const datos = {
    escuela:   g('blt-escuela'),
    cct:       g('blt-cct'),
    municipio: g('blt-municipio'),
    ciclo:     g('blt-ciclo') || window.CICLO_ACTIVO,
    trimestre: g('blt-trimestre-sel') || '—',
    docente:   g('blt-docente'),
    alumno:    g('blt-alumno-sel'),
    curp:      g('blt-curp'),
    grado:     g('blt-grado'),
    folio:     g('blt-folio'),
    obsGeneral: g('blt-observacion'),
    campos:    _bltExtraerCamposDelDOM(),
    asistencias: null,
    inasistJust: null,
    inasistInjust: null,
  };

  const html = _bltGenerarHTML(datos);
  _bltAbrirVentanaImpresion(html, `Boleta ${datos.alumno} T${datos.trimestre}`);
}

// ─── Extraer calificaciones del DOM (boleta-preview) ─────────────────────────
function _bltExtraerCamposDelDOM() {
  const campos = {};
  const tbody = document.getElementById('boleta-body');
  if (!tbody) return campos;

  let campoActual = '';
  tbody.querySelectorAll('tr').forEach(tr => {
    const tds = tr.querySelectorAll('td');
    if (!tds.length) return;
    // Si la primera celda tiene rowspan, es un campo formativo
    let startIdx = 0;
    if (tds[0].hasAttribute('rowspan')) {
      campoActual = tds[0].textContent.trim();
      startIdx = 1;
    }
    const materia = tds[startIdx]?.textContent?.trim();
    const calText = tds[startIdx + 1]?.textContent?.trim();
    const cal = parseFloat(calText);
    if (!materia) return;
    if (!campos[campoActual]) campos[campoActual] = [];
    campos[campoActual].push({ materia, cal: isNaN(cal) ? null : cal });
  });
  return campos;
}

// ─── Portal DOCENTE: exportar PDF con html2canvas + jsPDF ────────────────────
async function exportarBoletaPDF() {
  const btn    = document.getElementById('blt-btn-pdf');
  const status = document.getElementById('blt-pdf-status');
  if (btn)    { btn.disabled = true; btn.textContent = '⏳ Generando…'; }
  if (status) status.style.display = 'block';

  try {
    await _bltCargarLibrerias();
    const g = id => document.getElementById(id)?.value?.trim() || '';
    const alumno  = g('blt-alumno-sel') || 'alumno';
    const trim    = g('blt-trimestre-sel') || '2';
    const ciclo   = (g('blt-ciclo') || window.CICLO_ACTIVO || '2025-2026').replace('–', '-');
    const datos   = {
      escuela: g('blt-escuela'), cct: g('blt-cct'), municipio: g('blt-municipio'),
      ciclo, trimestre: trim, docente: g('blt-docente'),
      alumno, curp: g('blt-curp'), grado: g('blt-grado'), folio: g('blt-folio'),
      obsGeneral: g('blt-observacion'),
      campos: _bltExtraerCamposDelDOM(),
    };

    await _bltGuardarPDFDesdeHTML(_bltGenerarHTML(datos), `Boleta_NEM_${alumno.replace(/\s+/g,'_')}_T${trim}_${ciclo}.pdf`);
    hubToast('✅ PDF descargado correctamente');
  } catch (e) {
    console.error('[BLT PDF]', e);
    hubToast('❌ Error al generar PDF. Usa "Imprimir" como alternativa.', 'error');
  } finally {
    if (btn)    { btn.disabled = false; btn.textContent = '⬇ Descargar PDF'; }
    if (status) status.style.display = 'none';
  }
}

// ─── Portal PADRE: imprimir boleta ───────────────────────────────────────────
async function padreBoltaImprimir() {
  const contenido = document.getElementById('p-boleta-contenido');
  if (!contenido || contenido.querySelector('[style*="color:#94a3b8"]')) {
    hubToast('⏳ Espera a que cargue la boleta primero', 'warn');
    return;
  }

  const alumno  = window._alumnoActivoPadre || window._alumnosPadre?.[0];
  const nombre  = alumno ? `${alumno.nombre} ${alumno.apellido_p || ''}`.trim() : 'alumno';
  const trim    = window._padreBolTrim || 1;
  const ciclo   = window.CICLO_ACTIVO || '2025-2026';

  // Extraer datos de la tabla que ya está en el DOM del padre
  const campos = {};
  contenido.querySelectorAll('tbody tr').forEach(tr => {
    const tds = tr.querySelectorAll('td');
    if (!tds.length) return;
    let campo = '', materia = '', calText = '';
    if (tds[0].hasAttribute('rowspan')) {
      campo    = tds[0].textContent.trim();
      materia  = tds[1]?.textContent?.trim();
      calText  = tds[2]?.textContent?.trim();
    } else {
      // La celda del campo está en la fila anterior con rowspan
      const prevCampoCell = contenido.querySelector('td[rowspan]');
      campo   = prevCampoCell?.textContent?.trim() || 'Sin campo';
      materia = tds[0]?.textContent?.trim();
      calText = tds[1]?.textContent?.trim();
    }
    const cal = parseFloat(calText);
    if (!campos[campo]) campos[campo] = [];
    if (materia) campos[campo].push({ materia, cal: isNaN(cal) ? null : cal });
  });

  // Leer asistencias del DOM
  const asistSpans = contenido.querySelectorAll('[style*="font-size:12px"] strong');
  const asistencias    = asistSpans[0] ? parseInt(asistSpans[0].textContent) : null;
  const inasistJust    = asistSpans[1] ? parseInt(asistSpans[1].textContent) : null;
  const inasistInjust  = asistSpans[2] ? parseInt(asistSpans[2].textContent) : null;

  // Leer datos del encabezado
  const headerDiv = contenido.querySelector('[style*="background:#0d5c2f"]');
  const headerLines = headerDiv?.querySelectorAll('div') || [];
  const escuela = window.currentPerfil?.escuela_nombre || '';
  const cct     = window.currentPerfil?.escuela_cct || '';

  // Leer datos del alumno del DOM (sección datos)
  const datosDiv = contenido.querySelectorAll('[style*="grid-template-columns"] div');
  const aluNombre = datosDiv[1]?.textContent?.trim() || nombre;
  const curp      = datosDiv[3]?.textContent?.trim() || '—';
  const grado     = datosDiv[5]?.textContent?.trim() || '—';
  const folio     = datosDiv[7]?.textContent?.trim() || '—';

  // Leer observaciones
  const obsDiv = contenido.querySelector('[style*="border-left:3px solid #f59e0b"]');
  const obs = obsDiv ? obsDiv.textContent.replace('Observaciones:', '').trim() : '';

  const datos = {
    escuela, cct, municipio: '', ciclo, trimestre: trim,
    docente: '—', alumno: aluNombre, curp, grado, folio,
    obsGeneral: obs, campos, asistencias, inasistJust, inasistInjust,
  };

  const html = _bltGenerarHTML(datos);
  _bltAbrirVentanaImpresion(html, `Boleta ${nombre} T${trim}`);
}

// ─── Portal PADRE: descargar PDF ─────────────────────────────────────────────
async function padreBoltaDescargarPDF() {
  const btn = document.getElementById('p-blt-btn-pdf');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Generando…'; }
  try {
    await _bltCargarLibrerias();
    const alumno = window._alumnoActivoPadre || window._alumnosPadre?.[0];
    const nombre = alumno ? `${alumno.nombre} ${alumno.apellido_p || ''}`.trim() : 'alumno';
    const trim   = window._padreBolTrim || 1;
    const ciclo  = (window.CICLO_ACTIVO || '2025-2026').replace('–', '-');

    // Reutilizar el HTML del contenido ya renderizado
    const contenido = document.getElementById('p-boleta-contenido');
    if (!contenido) throw new Error('sin contenido');

    await _bltGuardarPDFDesdeEl(contenido, `Boleta_${nombre.replace(/\s+/g,'_')}_T${trim}_${ciclo}.pdf`);
    hubToast('✅ PDF descargado correctamente');
  } catch (e) {
    console.error('[PADRE PDF]', e);
    hubToast('❌ Error al generar PDF. Usa "Imprimir" como alternativa.', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '⬇ Descargar PDF'; }
  }
}

// ─── Generar todas las boletas del grupo (multi-página) ──────────────────────
async function bltGenerarTodas() {
  if (typeof hubToast === 'function') hubToast('⏳ Preparando boletas del grupo…');
  const btn = document.getElementById('blt-gen-todas-btn');
  if (btn) btn.disabled = true;

  try {
    await _bltCargarLibrerias();
    const { jsPDF } = window.jspdf;
    const pdf     = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pdfW    = pdf.internal.pageSize.getWidth();
    const pdfH    = pdf.internal.pageSize.getHeight();
    const margin  = 10;

    // Usar alumnos del grupo activo de Supabase
    const grupoId   = window._grupoActivo;
    const ciclo     = window.CICLO_ACTIVO || '2025-2026';
    const trim      = parseInt(document.getElementById('blt-trimestre-sel')?.value || '2');
    const g         = id => document.getElementById(id)?.value?.trim() || '';

    let alumnosList = window._alumnosActivos || [];
    // Si no hay lista cargada, intentar traer del grupo
    if (!alumnosList.length && grupoId && window.sb) {
      const { data } = await window.sb
        .from('alumnos_grupos')
        .select('usuarios(id,nombre,apellido_p,apellido_m,curp,grado)')
        .eq('grupo_id', grupoId)
        .eq('ciclo_escolar', ciclo);
      alumnosList = (data || []).map(r => r.usuarios).filter(Boolean);
    }

    if (!alumnosList.length) {
      hubToast('⚠️ No hay alumnos en el grupo activo', 'warn');
      return;
    }

    let paginaActual = 0;
    for (const alu of alumnosList) {
      // Cargar calificaciones del alumno
      let campos = {};
      if (window.sb) {
        const { data: cals } = await window.sb
          .from('calificaciones')
          .select('materia,calificacion,campo_formativo')
          .eq('alumno_id', alu.id)
          .eq('ciclo', ciclo)
          .eq('trimestre', trim);
        (cals || []).forEach(c => {
          const campo = c.campo_formativo || 'Lenguajes';
          if (!campos[campo]) campos[campo] = [];
          campos[campo].push({ materia: c.materia, cal: parseFloat(c.calificacion) });
        });
      }

      // Cargar asistencias
      let asistencias = null, inasistJust = null, inasistInjust = null;
      if (window.sb) {
        const { data: boleta } = await window.sb
          .from('boletas_nem')
          .select('asistencias,inasist_j,inasist_i,obs_general,folio')
          .eq('alumno_id', alu.id)
          .eq('ciclo', ciclo)
          .eq('periodo', `T${trim}`)
          .maybeSingle();
        if (boleta) {
          asistencias  = boleta.asistencias;
          inasistJust  = boleta.inasist_j;
          inasistInjust = boleta.inasist_i;
        }
      }

      const escuelaCct = g('blt-cct') || window.ESCUELA_ACTIVA?.cct || '';
      const datos = {
        escuela:   g('blt-escuela') || window.ESCUELA_ACTIVA?.nombre || '',
        cct:       escuelaCct,
        municipio: g('blt-municipio'),
        ciclo, trimestre: trim,
        docente:   g('blt-docente') || window.currentPerfil?.nombre || '',
        alumno:    `${alu.nombre} ${alu.apellido_p || ''} ${alu.apellido_m || ''}`.trim(),
        curp:      alu.curp || '—',
        grado:     alu.grado || g('blt-grado'),
        folio:     `${escuelaCct}-${ciclo.replace(/\D/g,'').slice(0,4)}-${trim}-${String(alu.id).slice(0,4)}`,
        obsGeneral: '',
        campos, asistencias, inasistJust, inasistInjust,
      };

      // Renderizar en iframe oculto para captura
      const htmlPage = _bltGenerarHTML(datos);
      const canvas   = await _bltHtmlACanvas(htmlPage);
      const imgData  = canvas.toDataURL('image/jpeg', 0.92);
      const imgW     = pdfW - margin * 2;
      const imgH     = Math.min((canvas.height * imgW) / canvas.width, pdfH - margin * 2);

      if (paginaActual > 0) pdf.addPage();
      pdf.addImage(imgData, 'JPEG', margin, margin, imgW, imgH);
      paginaActual++;
    }

    const filename = `Boletas_Grupo_T${trim}_${ciclo.replace(/\D/g,'-')}.pdf`;
    pdf.save(filename);
    hubToast(`✅ ${paginaActual} boletas descargadas: ${filename}`);
  } catch (e) {
    console.error('[BLT TODAS]', e);
    hubToast('❌ Error al generar boletas. Intenta de nuevo.', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

// ─── Guardar PDF desde un elemento DOM ───────────────────────────────────────
async function _bltGuardarPDFDesdeEl(el, filename) {
  const { jsPDF } = window.jspdf;
  const pdf    = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pdfW   = pdf.internal.pageSize.getWidth();
  const pdfH   = pdf.internal.pageSize.getHeight();
  const margin = 10;

  const canvas  = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false });
  const imgData = canvas.toDataURL('image/jpeg', 0.92);
  const imgW    = pdfW - margin * 2;
  const imgH    = Math.min((canvas.height * imgW) / canvas.width, pdfH - margin * 2);
  pdf.addImage(imgData, 'JPEG', margin, margin, imgW, imgH);
  pdf.save(filename);
}

// ─── Guardar PDF desde HTML string (usa iframe temporal) ─────────────────────
async function _bltGuardarPDFDesdeHTML(htmlStr, filename) {
  const canvas  = await _bltHtmlACanvas(htmlStr);
  const { jsPDF } = window.jspdf;
  const pdf     = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pdfW    = pdf.internal.pageSize.getWidth();
  const pdfH    = pdf.internal.pageSize.getHeight();
  const margin  = 10;
  const imgData = canvas.toDataURL('image/jpeg', 0.92);
  const imgW    = pdfW - margin * 2;
  const imgH    = Math.min((canvas.height * imgW) / canvas.width, pdfH - margin * 2);
  pdf.addImage(imgData, 'JPEG', margin, margin, imgW, imgH);
  pdf.save(filename);
}

// ─── Renderizar HTML en canvas via iframe temporal ───────────────────────────
function _bltHtmlACanvas(htmlStr) {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:794px;height:1123px;border:none;';
    document.body.appendChild(iframe);

    iframe.onload = async () => {
      try {
        const canvas = await html2canvas(iframe.contentDocument.body, {
          scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false,
          width: 794, height: iframe.contentDocument.body.scrollHeight,
        });
        document.body.removeChild(iframe);
        resolve(canvas);
      } catch (e) {
        document.body.removeChild(iframe);
        reject(e);
      }
    };

    iframe.srcdoc = `<!DOCTYPE html><html><head><meta charset="UTF-8">
      <style>body{margin:0;padding:12px;font-family:Arial,sans-serif;background:white;}</style>
      </head><body>${htmlStr}</body></html>`;
  });
}

// ─── Carga lazy de librerías html2canvas + jsPDF ─────────────────────────────
function _bltCargarLibrerias() {
  return new Promise((resolve, reject) => {
    const libs = [];
    if (!window.html2canvas) libs.push('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
    if (!window.jspdf)       libs.push('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
    if (!libs.length) { resolve(); return; }
    let loaded = 0;
    libs.forEach(src => {
      const s = document.createElement('script');
      s.src = src;
      s.onload  = () => { if (++loaded === libs.length) resolve(); };
      s.onerror = () => reject(new Error('No se pudo cargar: ' + src));
      document.head.appendChild(s);
    });
  });
}

// Exponer globalmente
window.imprimirBoleta       = imprimirBoleta;
window.exportarBoletaPDF    = exportarBoletaPDF;
window.padreBoltaImprimir   = padreBoltaImprimir;
window.padreBoltaDescargarPDF = padreBoltaDescargarPDF;
window.bltGenerarTodas      = bltGenerarTodas;