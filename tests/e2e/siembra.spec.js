// tests/e2e/siembra.spec.js
// Playwright E2E — flujos críticos de SIEMBRA

const { test, expect } = require('@playwright/test');

// ── Helper: filtro de errores externos ────────────────────────
function esErrorExterno(msg) {
  return (
    msg.includes('fetch') ||
    msg.includes('supabase') ||
    msg.includes('Failed to load resource') ||
    msg.includes('ERR_') ||
    msg.includes('net::') ||
    msg.includes('cdn.') ||
    msg.includes('unpkg.') ||
    msg.includes('googleapis') ||
    msg.includes('<') // "Unexpected token '<'" = recurso 404 retorna HTML
  );
}

async function seleccionarEscuelaSiAplica(page) {
  const select = page.locator('#hub-escuela-sel');
  const exists = await select.count();
  if (!exists) return;

  const optionCount = await page.locator('#hub-escuela-sel option').count();
  if (optionCount > 1) {
    const value = await page.locator('#hub-escuela-sel option').nth(1).getAttribute('value');
    if (value) {
      await select.selectOption(value);
      await page.waitForFunction(() => {
        const wrap = document.getElementById('hub-roles-wrap');
        if (!wrap) return true;
        const style = window.getComputedStyle(wrap);
        return style.display !== 'none' && style.visibility !== 'hidden';
      });
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// SUITE 1: Carga inicial y pantalla de login
// ═══════════════════════════════════════════════════════════════
test.describe('Pantalla de login', () => {

  test('index.html carga sin errores JS críticos', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => {
      if (!esErrorExterno(e.message)) errors.push(e.message);
    });

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    expect(errors).toHaveLength(0);
  });

  test('muestra pantalla de login por defecto', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.waitForSelector('#hub-login', { state: 'visible', timeout: 3000 })
      .catch(() => {});

    await expect(page.locator('h1, .brand-text h1, .login-logo').first()).toBeVisible({ timeout: 5000 });
  });

  test('el formulario incluye campo de email y contraseña', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(600);

    await expect(page.locator('#hub-email')).toHaveCount(1);
    await expect(page.locator('#hub-pass')).toHaveCount(1);
  });

  test('muestra acceso por login y registro por invitación', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(600);

    await expect(page.locator('#panel-login')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#panel-registro')).toHaveCount(1);
  });

  test('incluye los roles base del login', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(600);

    const chips = page.locator('.role-chip[id^="rc-"]');
    const count = await chips.count();
    expect(count).toBeGreaterThan(0);
    await expect(page.locator('#rc-docente')).toHaveCount(1);
    await expect(page.locator('#rc-director')).toHaveCount(1);
    await expect(page.locator('#rc-admin')).toHaveCount(1);
  });

  test('botón de login está deshabilitado sin seleccionar rol', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(600);

    const loginBtn = page.locator('#hub-login-btn');
    await expect(loginBtn).toBeDisabled({ timeout: 5000 });
  });

  test('al seleccionar rol se activa el botón de login', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(600);

    await seleccionarEscuelaSiAplica(page);
    await expect(page.locator('#hub-roles-wrap')).toBeVisible();
    await page.evaluate(() => window.hubSelectRole('docente'));
    await page.waitForTimeout(300);

    const loginBtn = page.locator('#hub-login-btn');
    await expect(loginBtn).not.toBeDisabled({ timeout: 3000 });
  });

  test('al seleccionar rol se marca el chip activo y actualiza el hint', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(600);

    await seleccionarEscuelaSiAplica(page);
    await expect(page.locator('#hub-roles-wrap')).toBeVisible();
    await page.evaluate(() => window.hubSelectRole('director'));
    await page.waitForTimeout(300);

    await expect(page.locator('#rc-director')).toHaveClass(/active/);
    await expect(page.locator('#hub-hint')).toContainText('Director');
  });

  test('botón "Explorar en modo demo" está oculto en producción', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(600);

    await expect(page.locator('#hub-demo-wrap')).toBeHidden({ timeout: 5000 });
  });

  test('demo.html muestra la portada de accesos demo', async ({ page }) => {
    await page.goto('/demo.html?mode=demo');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(600);

    await expect(page.locator('text=SIEMBRA Demo')).toBeVisible();
    await expect(page.locator('a[href="index.html?mode=demo"]')).toBeVisible();
    await expect(page.locator('a[href="alumno.html?mode=demo"]')).toBeVisible();
    await expect(page.locator('a[href="padres.html?mode=demo"]')).toBeVisible();
  });

});

// ═══════════════════════════════════════════════════════════════
// SUITE 2: PWA y manifest
// ═══════════════════════════════════════════════════════════════
test.describe('PWA', () => {

  test('manifest.json es accesible', async ({ page }) => {
    const res = await page.goto('/manifest.json');
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.name).toContain('SIEMBRA');
  });

  test('manifest.json tiene los dos íconos', async ({ page }) => {
    const res = await page.goto('/manifest.json');
    const json = await res.json();
    const srcs = json.icons.map(i => i.src);
    expect(srcs).toContain('icon-192.png');
    expect(srcs).toContain('icon-512.png');
  });

  test('icon-192.png es accesible y es imagen PNG', async ({ page }) => {
    const res = await page.goto('/icon-192.png');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('image/png');
  });

  test('icon-512.png es accesible y es imagen PNG', async ({ page }) => {
    const res = await page.goto('/icon-512.png');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('image/png');
  });

  test('sw.js es accesible', async ({ page }) => {
    const res = await page.goto('/sw.js');
    expect(res.status()).toBe(200);
  });

  test('meta theme-color está configurado', async ({ page }) => {
    await page.goto('/');
    const themeColor = await page.locator('meta[name="theme-color"]').getAttribute('content');
    expect(themeColor).toBeTruthy();
  });

  test('meta viewport está configurado', async ({ page }) => {
    await page.goto('/');
    const vp = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(vp).toContain('width=device-width');
  });

  test('link rel=manifest está en index.html', async ({ page }) => {
    await page.goto('/');
    const manifest = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(manifest).toContain('manifest.json');
  });

});

// ═══════════════════════════════════════════════════════════════
// SUITE 3: Portal de padres
// ═══════════════════════════════════════════════════════════════
test.describe('Portal padres', () => {

  test('padres.html carga sin errores JS críticos', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => {
      if (!esErrorExterno(e.message)) errors.push(e.message);
    });
    await page.goto('/padres.html');
    await page.waitForLoadState('domcontentloaded');
    expect(errors).toHaveLength(0);
  });

  test('muestra login screen (no vinculación directa)', async ({ page }) => {
    await page.goto('/padres.html');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // Buscar cualquier contenedor de login con varios selectores posibles
    const loginSelectors = [
      '#login-screen',
      '.login-screen',
      '#padres-login',
      'form.login-form',
      'input[type="email"]',
      'input[type="password"]',
    ];

    let loginFound = false;
    for (const sel of loginSelectors) {
      const visible = await page.locator(sel).first().isVisible().catch(() => false);
      if (visible) { loginFound = true; break; }
    }

    const vincVisible = await page.locator('#vinc-nombre').isVisible().catch(() => false);

    if (vincVisible) {
      // Si vinculación es visible, el header de la app debe estarlo también (sesión activa)
      const headerVisible = await page.locator('.app-header, header').first().isVisible().catch(() => false);
      expect(headerVisible).toBeTruthy();
    } else {
      // Sin sesión → login visible
      expect(loginFound).toBeTruthy();
    }
  });

  test('link "Regístrate aquí" abre modal de registro', async ({ page }) => {
    await page.goto('/padres.html');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(800);

    const loginVisible = await page.locator('#login-screen').isVisible().catch(() => false);
    if (!loginVisible) return test.skip();

    await page.locator('#login-screen .login-switch a').click();
    await page.waitForTimeout(300);

    await expect(page.locator('#modal-register')).toHaveClass(/open/, { timeout: 2000 });
  });

  test('modal de registro tiene todos los campos', async ({ page }) => {
    await page.goto('/padres.html');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(800);

    const loginVisible = await page.locator('#login-screen').isVisible().catch(() => false);
    if (!loginVisible) return;

    await page.locator('#login-screen .login-switch a').click();
    await page.waitForTimeout(300);

    await expect(page.locator('#reg-nombre')).toBeVisible({ timeout: 2000 });
    await expect(page.locator('#reg-email')).toBeVisible();
    await expect(page.locator('#reg-pass')).toBeVisible();
    await expect(page.locator('#reg-codigo')).toBeVisible();
  });

});

// ═══════════════════════════════════════════════════════════════
// SUITE 4: Portal del alumno
// ═══════════════════════════════════════════════════════════════
test.describe('Portal alumno', () => {

  test('alumno.html carga sin errores JS críticos', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => {
      if (!esErrorExterno(e.message)) errors.push(e.message);
    });
    await page.goto('/alumno.html');
    await page.waitForLoadState('domcontentloaded');
    expect(errors).toHaveLength(0);
  });

  test('alumno.html tiene meta viewport móvil', async ({ page }) => {
    await page.goto('/alumno.html');
    const vp = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(vp).toContain('width=device-width');
  });

  test('alumno.html link manifest correcto', async ({ page }) => {
    await page.goto('/alumno.html');
    const manifest = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(manifest).toContain('manifest-alumno.json');
  });

});

// ═══════════════════════════════════════════════════════════════
// SUITE 5: Accesibilidad básica en navegador
// ═══════════════════════════════════════════════════════════════
test.describe('Accesibilidad', () => {

  test('index.html: botones de menú tienen aria-label', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const menuBtns = page.locator('button:has-text("☰")');
    const count = await menuBtns.count();
    if (count === 0) return;

    for (let i = 0; i < count; i++) {
      const label = await menuBtns.nth(i).getAttribute('aria-label');
      expect(label).toBeTruthy();
    }
  });

  test('index.html: inputs tienen labels asociados', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(600);

    const loginPanel = page.locator('#panel-login');
    await expect(loginPanel.locator('label:has-text("Correo")')).toHaveCount(1);
    await expect(loginPanel.locator('label:has-text("Contraseña")')).toHaveCount(1);
  });

  test('padres.html: botón de cerrar sesión tiene aria-label', async ({ page }) => {
    await page.goto('/padres.html');
    await page.waitForLoadState('domcontentloaded');

    const logoutBtn = page.locator('button[aria-label="Cerrar sesión"]');
    const count = await logoutBtn.count();
    expect(count).toBeGreaterThan(0);
  });

});

// ═══════════════════════════════════════════════════════════════
// SUITE 6: Archivos estáticos críticos
// ═══════════════════════════════════════════════════════════════
test.describe('Archivos estáticos', () => {

  const ARCHIVOS = [
    '/',
    '/alumno.html',
    '/padres.html',
    '/sa.html',
    '/siembra-services.js',
    '/sw.js',
    '/manifest.json',
    '/icon-192.png',
    '/icon-512.png',
    '/screenshot1.png',
  ];

  ARCHIVOS.forEach(ruta => {
    test(`${ruta} responde 200`, async ({ page }) => {
      const res = await page.goto(ruta);
      expect(res.status()).toBe(200);
    });
  });

});
