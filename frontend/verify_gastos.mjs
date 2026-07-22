import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const networkLogs = [];
page.on('response', async (res) => {
  if (res.url().includes('gastos') || res.url().includes('supabase')) {
    let body = '';
    try { body = await res.text(); } catch {}
    networkLogs.push({ url: res.url().slice(0, 120), status: res.status(), body: body.slice(0, 300) });
  }
});
page.on('console', msg => {
  if (msg.type() === 'error') console.log('CONSOLE ERROR:', msg.text());
});

await page.goto('http://localhost:3002/erp.mamkam/', { waitUntil: 'networkidle' });

// Paso 1: RUT + click Verificar
await page.fill('input', '16421090-1');
await page.click('button:has-text("Verificar")');
await page.waitForTimeout(1500);
await page.screenshot({ path: 'C:/Users/Nico/AppData/Local/Temp/02_after_verificar.png' });

// Paso 2: contraseña
const passInput = await page.$('input[type="password"]');
if (passInput) {
  await passInput.fill('1234');
  const loginBtn = await page.$('button[type="submit"], button:has-text("Ingresar"), button:has-text("Continuar"), button:has-text("Acceder")');
  if (loginBtn) await loginBtn.click();
  else await page.keyboard.press('Enter');
  await page.waitForTimeout(2000);
}
await page.screenshot({ path: 'C:/Users/Nico/AppData/Local/Temp/03_after_login.png' });

// Paso 3: seleccionar empresa
const empresaBtn = await page.$('button:has-text("MAMKAM"), button:has-text("MKM")');
if (empresaBtn) {
  const texto = await empresaBtn.textContent();
  console.log('Seleccionando empresa:', texto?.trim());
  await empresaBtn.click();
  await page.waitForTimeout(2500);
}
await page.screenshot({ path: 'C:/Users/Nico/AppData/Local/Temp/04_after_empresa.png' });

// Paso 4: navegar a Finanzas
const finanzasLink = await page.$('a:has-text("Finanzas"), [href*="finanzas"]');
if (finanzasLink) {
  await finanzasLink.click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'C:/Users/Nico/AppData/Local/Temp/05_finanzas.png' });
} else {
  const allText = await page.$$eval('a, nav button, aside button', els => els.map(e => e.textContent?.trim()).filter(Boolean));
  console.log('Elementos nav:', allText);
  await page.screenshot({ path: 'C:/Users/Nico/AppData/Local/Temp/05_no_finanzas.png' });
}

// Paso 5: click tab Gastos
const gastosTab = await page.$('button:has-text("Gastos")');
if (gastosTab) {
  await gastosTab.click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'C:/Users/Nico/AppData/Local/Temp/06_tab_gastos.png' });

  const rows = await page.$$('tbody tr');
  console.log('Filas en tabla gastos:', rows.length);
  const textos = await page.$$eval('tbody tr td', tds => tds.map(td => td.textContent?.trim()).filter(Boolean));
  console.log('Contenido:', textos.slice(0, 40));
} else {
  console.log('Tab Gastos no encontrado');
  await page.screenshot({ path: 'C:/Users/Nico/AppData/Local/Temp/06_no_tab.png' });
}

const gastosReqs = networkLogs.filter(l => l.url.includes('gastos'));
console.log('\nRequests a gastos:', gastosReqs.length);
gastosReqs.forEach(r => console.log(' -', r.status, r.url, '\n  body:', r.body.slice(0, 200)));

await browser.close();
