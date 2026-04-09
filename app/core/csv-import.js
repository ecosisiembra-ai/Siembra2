/**
 * SIEMBRA — CSV Import Global
 * Expone abrirImportadorCSV() accesible desde cualquier portal.
 * El motor real (admLeerArchivo, admConfirmarImport, etc.) vive en action-engine.js.
 * Este módulo agrega el modal flotante y el soporte de drag-and-drop.
 */

(function () {
  // ── Estilos del modal ──────────────────────────────────────────────────────
  const CSS = `
  #csv-modal-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,.55);
    display: flex; align-items: center; justify-content: center;
    z-index: 10000; padding: 20px; animation: csvFadeIn .2s ease;
  }
  @keyframes csvFadeIn { from { opacity:0 } to { opacity:1 } }
  #csv-modal {
    background: white; border-radius: 20px; width: 100%; max-width: 620px;
    max-height: 90vh; overflow-y: auto;
    box-shadow: 0 32px 96px rgba(0,0,0,.22);
    font-family: 'Sora', sans-serif;
  }
  #csv-modal .csv-head {
    background: linear-gradient(135deg, #0d5c2f, #16a34a);
    padding: 20px 24px; border-radius: 20px 20px 0 0;
    display: flex; align-items: center; justify-content: space-between;
  }
  #csv-modal .csv-head h2 { color: white; font-size: 16px; font-weight: 800; }
  #csv-modal .csv-head button {
    background: rgba(255,255,255,.2); border: none; border-radius: 8px;
    color: white; font-size: 18px; width: 32px; height: 32px; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
  }
  #csv-modal .csv-body { padding: 24px; }
  .csv-tabs { display: flex; gap: 8px; margin-bottom: 20px; }
  .csv-tab {
    flex: 1; padding: 10px; border-radius: 10px; border: 1.5px solid #e2e8f0;
    background: white; font-family: 'Sora',sans-serif; font-size: 13px;
    font-weight: 700; cursor: pointer; transition: .15s; text-align: center;
  }
  .csv-tab.active { background: #0d5c2f; color: white; border-color: #0d5c2f; }
  .csv-dropzone {
    border: 2px dashed #cbd5e1; border-radius: 14px; padding: 32px 20px;
    text-align: center; cursor: pointer; transition: .2s; background: #f8fafc;
  }
  .csv-dropzone.dragover { border-color: #0d5c2f; background: #f0fdf4; }
  .csv-dropzone .dz-ico { font-size: 36px; margin-bottom: 10px; }
  .csv-dropzone p { font-size: 14px; font-weight: 700; color: #334155; margin-bottom: 4px; }
  .csv-dropzone small { font-size: 11px; color: #94a3b8; }
  .csv-plantilla-row { display: flex; gap: 8px; margin-top: 14px; }
  .csv-btn-plant {
    flex: 1; padding: 9px 12px; border-radius: 9px; border: 1.5px solid #e2e8f0;
    background: white; font-family: 'Sora',sans-serif; font-size: 12px;
    font-weight: 700; cursor: pointer; transition: .15s;
  }
  .csv-btn-plant:hover { border-color: #0d5c2f; background: #f0fdf4; }
  `;

  function _injectCSS() {
    if (document.getElementById('csv-import-css')) return;
    const s = document.createElement('style');
    s.id = 'csv-import-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  // ── Abrir modal ───────────────────────────────────────────────────────────
  window.abrirImportadorCSV = function (tipoInicial) {
    _injectCSS();
    if (document.getElementById('csv-modal-overlay')) return;

    let tipoActivo = tipoInicial || 'alumnos';

    const overlay = document.createElement('div');
    overlay.id = 'csv-modal-overlay';
    overlay.innerHTML = `
      <div id="csv-modal">
        <div class="csv-head">
          <h2>📥 Importar datos a SIEMBRA</h2>
          <button onclick="cerrarImportadorCSV()" aria-label="Cerrar">✕</button>
        </div>
        <div class="csv-body">
          <div class="csv-tabs">
            <button class="csv-tab ${tipoActivo==='alumnos'?'active':''}" onclick="csvCambiarTipo('alumnos')">👨‍🎓 Alumnos</button>
            <button class="csv-tab ${tipoActivo==='docentes'?'active':''}" onclick="csvCambiarTipo('docentes')">👩‍🏫 Docentes</button>
          </div>

          <!-- Dropzone -->
          <div class="csv-dropzone" id="csv-dz"
            ondragover="event.preventDefault();this.classList.add('dragover')"
            ondragleave="this.classList.remove('dragover')"
            ondrop="csvHandleDrop(event)"
            onclick="document.getElementById('csv-file-inp').click()">
            <div class="dz-ico">📂</div>
            <p>Arrastra tu archivo aquí o haz clic para seleccionar</p>
            <small>.csv · .xlsx · .xls · También acepta imágenes (PDF o foto del formato SEP)</small>
          </div>
          <input type="file" id="csv-file-inp" accept=".csv,.xlsx,.xls,.pdf,.png,.jpg,.jpeg,.webp"
            style="display:none" onchange="csvFileSeleccionado(this)">

          <!-- Descargar plantilla -->
          <div class="csv-plantilla-row">
            <button class="csv-btn-plant" onclick="admDescargarPlantilla(window._csvTipoActivo,'csv')">⬇ Plantilla CSV</button>
            <button class="csv-btn-plant" onclick="admDescargarPlantilla(window._csvTipoActivo,'xlsx')">⬇ Plantilla Excel</button>
          </div>

          <!-- Preview y botón confirmar (reutiliza los de ADM) -->
          <div id="csv-preview-wrap" style="margin-top:16px;">
            <div id="imp-preview-${tipoActivo}" style=""></div>
            <div id="imp-btn-${tipoActivo}" style="display:none;margin-top:16px;">
              <button onclick="admConfirmarImport('${tipoActivo}');cerrarImportadorCSV()"
                style="padding:12px 24px;background:linear-gradient(135deg,#0d5c2f,#157a40);color:white;border:none;border-radius:10px;font-family:'Sora',sans-serif;font-size:14px;font-weight:700;cursor:pointer;">
                ✅ Importar a SIEMBRA
              </button>
              <button onclick="admLimpiarImport('${tipoActivo}')"
                style="margin-left:10px;padding:12px 18px;background:white;border:1.5px solid #e2e8f0;color:#64748b;border-radius:10px;font-family:'Sora',sans-serif;font-size:13px;cursor:pointer;">
                ✕ Cancelar
              </button>
            </div>
          </div>
        </div>
      </div>`;

    document.body.appendChild(overlay);
    window._csvTipoActivo = tipoActivo;

    // Cerrar al hacer clic fuera
    overlay.addEventListener('click', e => { if (e.target === overlay) cerrarImportadorCSV(); });
  };

  window.cerrarImportadorCSV = function () {
    const el = document.getElementById('csv-modal-overlay');
    if (el) el.remove();
  };

  window.csvCambiarTipo = function (tipo) {
    window._csvTipoActivo = tipo;
    document.querySelectorAll('.csv-tab').forEach(t => t.classList.toggle('active', t.textContent.includes(tipo === 'alumnos' ? 'Alumnos' : 'Docentes')));
    const wrap = document.getElementById('csv-preview-wrap');
    if (wrap) wrap.innerHTML = `
      <div id="imp-preview-${tipo}"></div>
      <div id="imp-btn-${tipo}" style="display:none;margin-top:16px;">
        <button onclick="admConfirmarImport('${tipo}');cerrarImportadorCSV()"
          style="padding:12px 24px;background:linear-gradient(135deg,#0d5c2f,#157a40);color:white;border:none;border-radius:10px;font-family:'Sora',sans-serif;font-size:14px;font-weight:700;cursor:pointer;">
          ✅ Importar a SIEMBRA
        </button>
      </div>`;
  };

  window.csvHandleDrop = function (e) {
    e.preventDefault();
    document.getElementById('csv-dz')?.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (!file) return;
    _procesarArchivo(file);
  };

  window.csvFileSeleccionado = function (input) {
    const file = input.files[0];
    if (!file) return;
    _procesarArchivo(file);
  };

  function _procesarArchivo(file) {
    // Reutilizar la función del ADM — necesita un input simulado
    const fakeInput = { files: [file] };
    const tipo = window._csvTipoActivo || 'alumnos';
    if (typeof admLeerArchivo === 'function') {
      admLeerArchivo(fakeInput, tipo);
    } else {
      console.warn('[csv-import] admLeerArchivo no está disponible aún');
    }
  }
})();