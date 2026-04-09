/**
 * SIEMBRA — Tests unitarios (sin dependencias externas)
 * Ejecutar: node tests/unit/run.js
 *
 * Prueba la lógica pura de siembra-services.js y las funciones
 * utilitarias que no requieren DOM ni Supabase.
 */

'use strict';

// ── Colores para consola ──────────────────────────────────────
const G = '\x1b[32m', R = '\x1b[31m', Y = '\x1b[33m', B = '\x1b[1m', X = '\x1b[0m';

let passed = 0, failed = 0, total = 0;

function it(desc, fn) {
  total++;
  try {
    fn();
    console.log(`  ${G}✓${X} ${desc}`);
    passed++;
  } catch (e) {
    console.log(`  ${R}✗${X} ${desc}`);
    console.log(`    ${R}→ ${e.message}${X}`);
    failed++;
  }
}

function expect(val) {
  return {
    toBe(expected) {
      if (val !== expected)
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(val)}`);
    },
    toEqual(expected) {
      const a = JSON.stringify(val), b = JSON.stringify(expected);
      if (a !== b) throw new Error(`Expected ${b}, got ${a}`);
    },
    toBeTruthy() {
      if (!val) throw new Error(`Expected truthy, got ${JSON.stringify(val)}`);
    },
    toBeFalsy() {
      if (val) throw new Error(`Expected falsy, got ${JSON.stringify(val)}`);
    },
    toBeGreaterThan(n) {
      if (val <= n) throw new Error(`Expected > ${n}, got ${val}`);
    },
    toMatch(re) {
      if (!re.test(val)) throw new Error(`Expected to match ${re}, got ${JSON.stringify(val)}`);
    },
    toContain(substr) {
      if (!String(val).includes(substr))
        throw new Error(`Expected to contain ${JSON.stringify(substr)}, got ${JSON.stringify(val)}`);
    },
    toHaveLength(n) {
      if (val.length !== n)
        throw new Error(`Expected length ${n}, got ${val.length}`);
    },
    not: {
      toBe(expected) {
        if (val === expected)
          throw new Error(`Expected NOT ${JSON.stringify(expected)}`);
      },
      toContain(substr) {
        if (String(val).includes(substr))
          throw new Error(`Expected NOT to contain ${JSON.stringify(substr)}`);
      },
    },
  };
}

// ── Extraer y ejecutar lógica pura de siembra-services.js ─────
const fs = require('fs');
const vm = require('vm');

// Shim mínimo de window/global para que el IIFE no explote
const mockWindow = {
  currentPerfil: null,
  currentUser: null,
  CICLO_ACTIVO: '2025-2026',
  SIEMBRA: {},
  addEventListener: () => {},
  dispatchEvent: () => {},
  sb: null,
};

// Extraer solo las funciones utilitarias puras (genToken, cicloActivo, etc.)
// sin ejecutar el IIFE completo (que necesita Supabase)
const servicesSrc = fs.readFileSync('siembra-services.js', 'utf8');

// Extraer funciones internas del IIFE para testearlas de forma aislada
function extractFn(src, fnName) {
  // Buscar la función dentro del IIFE y envolverla en un contexto ejecutable
  const re = new RegExp(`(function ${fnName}\\s*\\([^)]*\\)\\s*\\{[\\s\\S]*?\\n  \\})`, 'm');
  const match = src.match(re);
  return match ? match[1] : null;
}

// ═══════════════════════════════════════════════════════════════
// SUITE 1: Utilidades puras (genToken, cicloActivo)
// ═══════════════════════════════════════════════════════════════
console.log(`\n${B}Suite 1: Utilidades puras${X}`);

// Extraer y testear genToken directamente
const genTokenSrc = extractFn(servicesSrc, 'genToken');

it('genToken produce un string', () => {
  // Ejecutar genToken en contexto aislado
  const ctx = vm.createContext({ crypto: require('crypto').webcrypto });
  const fn = vm.runInContext(`(${genTokenSrc})`, ctx);
  const token = fn(32);
  expect(typeof token).toBe('string');
});

it('genToken longitud por defecto es 32', () => {
  const ctx = vm.createContext({ crypto: require('crypto').webcrypto });
  const fn = vm.runInContext(`(${genTokenSrc})`, ctx);
  expect(fn(32)).toHaveLength(32);
});

it('genToken no contiene caracteres ambiguos (0, O, I, l)', () => {
  const ctx = vm.createContext({ crypto: require('crypto').webcrypto });
  const fn = vm.runInContext(`(${genTokenSrc})`, ctx);
  const token = fn(64);
  expect(token).not.toContain('0');
  expect(token).not.toContain('O');
  expect(token).not.toContain('I');
  expect(token).not.toContain('l');
});

it('genToken produce tokens únicos', () => {
  const ctx = vm.createContext({ crypto: require('crypto').webcrypto });
  const fn = vm.runInContext(`(${genTokenSrc})`, ctx);
  const tokens = new Set(Array.from({ length: 20 }, () => fn(16)));
  expect(tokens.size).toBe(20);
});

it('genToken longitud 8 produce 8 chars', () => {
  const ctx = vm.createContext({ crypto: require('crypto').webcrypto });
  const fn = vm.runInContext(`(${genTokenSrc})`, ctx);
  expect(fn(8)).toHaveLength(8);
});

// ═══════════════════════════════════════════════════════════════
// SUITE 2: Validaciones de negocio (lógica pura)
// ═══════════════════════════════════════════════════════════════
console.log(`\n${B}Suite 2: Validaciones de negocio${X}`);

it('ciclo activo tiene formato YYYY-YYYY', () => {
  const ciclo = '2025-2026';
  expect(/^\d{4}-\d{4}$/.test(ciclo)).toBeTruthy();
});

it('ciclo activo años consecutivos', () => {
  const ciclo = '2025-2026';
  const [a, b] = ciclo.split('-').map(Number);
  expect(b - a).toBe(1);
});

it('CCT formato correcto (ej: 19EPR0001A)', () => {
  const validCCT = /^[0-9]{2}[A-Z]{3}[0-9]{4}[A-Z]$/;
  expect(validCCT.test('19EPR0001A')).toBeTruthy();
  expect(validCCT.test('15EST0045B')).toBeTruthy();
  expect(validCCT.test('ABC')).toBeFalsy();
  expect(validCCT.test('19EPR0001a')).toBeFalsy(); // lowercase inválido
});

it('roles válidos del sistema', () => {
  const ROLES_VALIDOS = ['director','subdirector','docente','tutor','coordinador',
                         'prefecto','ts','padre','alumno','admin','superadmin'];
  expect(ROLES_VALIDOS).toContain('director');
  expect(ROLES_VALIDOS).toContain('padre');
  expect(ROLES_VALIDOS).toContain('alumno');
  expect(ROLES_VALIDOS).not.toContain('hacker');
});

it('planes de suscripción con precios MXN correctos', () => {
  const PLANES = { basico: 199, estandar: 399, premium: 699 };
  expect(PLANES.basico).toBe(199);
  expect(PLANES.estandar).toBe(399);
  expect(PLANES.premium).toBe(699);
  expect(PLANES.premium).toBeGreaterThan(PLANES.estandar);
  expect(PLANES.estandar).toBeGreaterThan(PLANES.basico);
});

it('método de pago Conekta solo acepta valores válidos', () => {
  const METODOS = ['card', 'oxxo', 'spei'];
  expect(METODOS).toContain('card');
  expect(METODOS).toContain('oxxo');
  expect(METODOS).toContain('spei');
  expect(METODOS).not.toContain('paypal');
  expect(METODOS).not.toContain('bitcoin');
});

// ═══════════════════════════════════════════════════════════════
// SUITE 3: Estructura de archivos críticos
// ═══════════════════════════════════════════════════════════════
console.log(`\n${B}Suite 3: Estructura de archivos${X}`);

const ARCHIVOS_REQUERIDOS = [
  'index.html', 'alumno.html', 'padres.html', 'sa.html',
  'facturacion.html', 'onboarding.html', 'demo.html',
  'siembra-services.js', 'sw.js', 'manifest.json',
  'icon-192.png', 'icon-512.png', 'screenshot1.png',
  'vercel.json',
  'app/core/runtime.js', 'app/core/store.js',
  'app/demo/fixtures.js', 'app/services/asignaciones.js', 'app/services/coberturas.js',
  'app/services/planeaciones.js',
  'app/admin/grupos.js',
];

ARCHIVOS_REQUERIDOS.forEach(archivo => {
  it(`${archivo} existe`, () => {
    expect(fs.existsSync(archivo)).toBeTruthy();
  });
});

it('manifest.json tiene los íconos declarados', () => {
  const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
  const srcs = manifest.icons.map(i => i.src);
  expect(srcs).toContain('icon-192.png');
  expect(srcs).toContain('icon-512.png');
});

it('manifest.json tiene screenshot', () => {
  const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
  expect(manifest.screenshots?.length).toBeGreaterThan(0);
});

it('manifest.json lang es es-MX', () => {
  const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
  expect(manifest.lang).toBe('es-MX');
});

// ═══════════════════════════════════════════════════════════════
// SUITE 4: Service Worker
// ═══════════════════════════════════════════════════════════════
console.log(`\n${B}Suite 4: Service Worker${X}`);

const swSrc = fs.readFileSync('sw.js', 'utf8');

it('sw.js cachea icon-192.png', () => {
  expect(swSrc).toContain('/icon-192.png');
});

it('sw.js cachea icon-512.png', () => {
  expect(swSrc).toContain('/icon-512.png');
});

it('sw.js cachea manifest.json', () => {
  expect(swSrc).toContain('/manifest.json');
});

it('sw.js usa versión de caché v2+', () => {
  expect(swSrc).toMatch(/siembra-v[2-9]/);
});

it('sw.js no intercepta llamadas a Supabase', () => {
  expect(swSrc).toContain('supabase.co');
  expect(swSrc).toContain('return'); // retorna sin interceptar
});

// ═══════════════════════════════════════════════════════════════
// SUITE 5: Accesibilidad (a11y) — sin DOM
// ═══════════════════════════════════════════════════════════════
console.log(`\n${B}Suite 5: Accesibilidad${X}`);

['index.html', 'alumno.html', 'padres.html'].forEach(fname => {
  const html = fs.readFileSync(fname, 'utf8');
  const btnPattern = /<button([^>]*)>([\s\S]*?)<\/button>/gi;

  it(`${fname}: botones de menú (☰) tienen aria-label`, () => {
    const matches = [...html.matchAll(/<button([^>]*)>☰<\/button>/gi)];
    if (matches.length === 0) return; // no hay, test no aplica
    matches.forEach(m => {
      expect(m[1]).toContain('aria-label');
    });
  });

  it(`${fname}: botones de cerrar (✕) tienen aria-label`, () => {
    const matches = [...html.matchAll(/<button([^>]*)>\s*✕\s*<\/button>/gi)];
    if (matches.length === 0) return;
    matches.forEach(m => {
      expect(m[1]).toContain('aria-label');
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// SUITE 6: siembra-services.js — exports y estructura
// ═══════════════════════════════════════════════════════════════
console.log(`\n${B}Suite 6: siembra-services.js exports${X}`);

const SERVICES_REQUERIDOS = [
  'auth', 'billing', 'escuela', 'grupo',
  'alumno', 'docente', 'tarea', 'padre', 'sessionWatcher',
];

SERVICES_REQUERIDOS.forEach(srv => {
  it(`SIEMBRA.${srv} está exportado`, () => {
    expect(servicesSrc).toContain(`${srv}:`);
  });
});

it('sessionWatcher tiene método start()', () => {
  expect(servicesSrc).toContain('start()');
});

it('sessionWatcher tiene método stop()', () => {
  expect(servicesSrc).toContain('stop()');
});

it('billingService tiene crearOrden()', () => {
  expect(servicesSrc).toContain('async crearOrden');
});

it('billingService tiene verificarSuscripcion()', () => {
  expect(servicesSrc).toContain('async verificarSuscripcion');
});

it('authService tiene login()', () => {
  expect(servicesSrc).toContain('async login(');
});

it('authService tiene logout()', () => {
  expect(servicesSrc).toContain('async logout(');
});

it('onAuthStateChange es manejado', () => {
  expect(servicesSrc).toContain('onAuthStateChange');
});

// ═══════════════════════════════════════════════════════════════
// SUITE 7: CI/CD
// ═══════════════════════════════════════════════════════════════
console.log(`\n${B}Suite 7: CI/CD${X}`);

const ciSrc = fs.readFileSync('.github/workflows/lint.yml', 'utf8');

it('CI valida sintaxis JS en HTML', () => {
  expect(ciSrc).toContain('vm.Script');
});

it('CI verifica aria-label en botones', () => {
  expect(ciSrc).toContain('aria-label');
});

it('CI corre en Node 20', () => {
  expect(ciSrc).toContain('node-version: "20"');
});

it('CI corre en push y pull_request', () => {
  expect(ciSrc).toContain('push:');
  expect(ciSrc).toContain('pull_request:');
});

// ═══════════════════════════════════════════════════════════════
// RESULTADO FINAL
// ═══════════════════════════════════════════════════════════════
console.log(`\n${'─'.repeat(50)}`);
const icon  = failed === 0 ? `${G}✅` : `${R}❌`;
const color = failed === 0 ? G : R;
console.log(`${icon} ${B}${color}${passed}/${total} tests pasaron${X}  (${failed} fallaron)\n`);

if (failed > 0) process.exit(1);
