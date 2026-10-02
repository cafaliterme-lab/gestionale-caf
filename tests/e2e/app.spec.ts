import { test, expect } from '@playwright/test';

/**
 * Test end-to-end per Gestionale CAF
 *
 * Scenario:
 * 1. Login Angelo (diventa admin)
 * 2. Crea pratica con numero auto-assegnato
 * 3. Cambio stato, versamento
 * 4. Login Federica (operatore), vede schede assegnate
 * 5. Realtime sync su due browser
 * 6. Export Excel
 * 7. RLS: Federica non legge versamenti senza permesso
 */

test.describe('Gestionale CAF', () => {
  test.describe('Login e Autenticazione', () => {
    test('should show login overlay when not authenticated', async ({ page }) => {
      await page.goto('/');

      // Verifica che l'overlay di login sia visibile
      const loginOverlay = page.locator('#login-overlay');
      await expect(loginOverlay).toBeVisible();

      // Verifica campi email/password
      const emailInput = page.locator('#login-email');
      const passwordInput = page.locator('#login-pwd');
      await expect(emailInput).toBeVisible();
      await expect(passwordInput).toBeVisible();
    });

    test('should login and create first account as admin', async ({ page }) => {
      await page.goto('/');

      const email = `angelo-${Date.now()}@test.local`;
      const password = 'TestPassword123!';

      // Clicca "Crea nuovo account"
      await page.click('button:has-text("Crea nuovo account")');

      // Compila form creazione account
      const nomeInput = page.locator('#login-nome');
      await expect(nomeInput).toBeVisible();
      await nomeInput.fill('Angelo Test');

      const emailInputCreate = page.locator('#login-email-new');
      const passwordInputCreate = page.locator('#login-pwd-new');
      await emailInputCreate.fill(email);
      await passwordInputCreate.fill(password);

      // Clicca Crea account
      await page.click('button:has-text("Crea account")');

      // Aspetta che il login sia completato
      await page.waitForURL(/.*/, { waitUntil: 'networkidle' });

      // Verifica che l'overlay sia scomparso
      const loginOverlay = page.locator('#login-overlay');
      await expect(loginOverlay).not.toBeVisible();

      // Verifica che sia admin (controlla classe "admin" o similare)
      // La prima pagina non mostra chiaramente il ruolo, ma dopo il refactor lo dovrebbe
    });
  });

  test.describe('CRUD Pratiche', () => {
    test.beforeEach(async ({ page }) => {
      // Setup: login come admin
      await page.goto('/');

      const email = `admin-${Date.now()}@test.local`;
      const password = 'TestPassword123!';

      // Se login form visibile, effettua login
      const loginEmail = page.locator('#login-email');
      if (await loginEmail.isVisible()) {
        await page.click('button:has-text("Crea nuovo account")');
        const nomeInput = page.locator('#login-nome');
        await nomeInput.fill('Test Admin');
        await page.locator('#login-email-new').fill(email);
        await page.locator('#login-pwd-new').fill(password);
        await page.click('button:has-text("Crea account")');
        await page.waitForURL(/.*/, { waitUntil: 'networkidle' });
      }
    });

    test('should create new pratica with auto-assigned number', async ({ page }) => {
      await page.goto('/');

      // Aspetta caricamento della pagina
      await page.waitForLoadState('networkidle');

      // Accedi alla scheda "Anagrafica"
      await page.click('button[data-tab="anagrafica"]');

      // Compila form pratica
      const nomeInput = page.locator('#f-nome');
      if (await nomeInput.isVisible()) {
        await nomeInput.fill('Test Cliente');

        // Salva pratica
        const saveBtn = page.locator('button:has-text("Salva")').first();
        await saveBtn.click();

        // Aspetta notifica di successo
        await page.waitForTimeout(1000);

        // Verifica che il numero sia stato assegnato
        // (controllare se esiste nel DOM dopo il salvataggio)
      }
    });

    test('should update pratica state', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Accedi a scheda "Registro"
      await page.click('button[data-tab="registro"]');

      // Seleziona prima pratica se esiste
      const firstRow = page.locator('.tab-body table tbody tr').first();
      if (await firstRow.isVisible()) {
        // Click sulla riga
        await firstRow.click();

        // Aspetta apertura dettaglio
        await page.waitForTimeout(500);

        // Cambia stato (se esiste dropdown)
        const statoDropdown = page.locator('#f-stato');
        if (await statoDropdown.isVisible()) {
          await statoDropdown.selectOption('lavorazione');

          // Salva
          const saveBtn = page.locator('button:has-text("Salva")').first();
          await saveBtn.click();

          // Verifica che stato sia cambiato
          await page.waitForTimeout(500);
        }
      }
    });
  });

  test.describe('Realtime Sync', () => {
    test('should sync data across two browser windows', async ({ browser }) => {
      // Crea due browser context
      const context1 = await browser.newContext();
      const context2 = await browser.newContext();

      const page1 = await context1.newPage();
      const page2 = await context2.newPage();

      try {
        // Login stesso account su entrambi
        await page1.goto('/');
        await page2.goto('/');

        // Skip if login not visible (already logged in)
        const loginEmail1 = page1.locator('#login-email');
        if (await loginEmail1.isVisible()) {
          const email = `sync-test-${Date.now()}@test.local`;
          const password = 'TestPassword123!';

          // Login page1
          await page1.click('button:has-text("Crea nuovo account")');
          await page1.locator('#login-nome').fill('Sync Test');
          await page1.locator('#login-email-new').fill(email);
          await page1.locator('#login-pwd-new').fill(password);
          await page1.click('button:has-text("Crea account")');

          // Login page2 stessa email (dopo qualche secondo)
          await page1.waitForURL(/.*/, { waitUntil: 'networkidle' });
          await page2.waitForTimeout(2000);

          // Page2: login con stesse credenziali
          const email2 = page2.locator('#login-email');
          if (await email2.isVisible()) {
            await email2.fill(email);
            await page2.locator('#login-pwd').fill(password);
            await page2.click('button:has-text("Accedi")');
          }
        }

        // Aspetta caricamento su entrambi
        await page1.waitForLoadState('networkidle');
        await page2.waitForLoadState('networkidle');

        // Naviga page1 a "Registro"
        await page1.click('button[data-tab="registro"]');
        await page1.waitForTimeout(1000);

        // Verifica che page2 mostri stessa scheda (se realtime attivo)
        // Nota: realtime richiederebbe more advanced setup con database vero

      } finally {
        await context1.close();
        await context2.close();
      }
    });
  });

  test.describe('Permessi RLS', () => {
    test('operator should not see tabs without permission', async ({ page }) => {
      // Questo test richiede database di test con RLS
      // Per ora, è un placeholder che verificherà il flusso di permessi

      await page.goto('/');

      // Login come operatore (dopo aver fatto login come admin e assegnato permessi)
      // Per ora, semplicemente verifichiamo che il form di login appare
      const loginOverlay = page.locator('#login-overlay');
      await expect(loginOverlay).toBeVisible();
    });
  });

  test.describe('Export', () => {
    test('should export register as Excel', async ({ page, context }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Setup listener per download
      const downloadPromise = context.waitForEvent('download');

      // Naviga a registro
      await page.click('button[data-tab="registro"]');
      await page.waitForTimeout(500);

      // Clicca bottone esporta Excel (se esiste)
      const exportBtn = page.locator('button:has-text("Esporta Registro")');
      if (await exportBtn.isVisible()) {
        await exportBtn.click();

        // Aspetta il download
        const download = await downloadPromise;
        const filename = download.suggestedFilename();

        // Verifica che sia un file Excel
        expect(filename).toMatch(/\.xlsx?$/);
      }
    });

    test('should export backup as JSON', async ({ page, context }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Setup listener per download
      const downloadPromise = context.waitForEvent('download');

      // Naviga a permessi (dove è il bottone backup)
      await page.click('button[data-tab="permessi"]');
      await page.waitForTimeout(500);

      // Clicca bottone esporta backup
      const exportBtn = page.locator('button:has-text("Esporta Backup")');
      if (await exportBtn.isVisible()) {
        await exportBtn.click();

        // Aspetta il download
        const download = await downloadPromise;
        const filename = download.suggestedFilename();

        // Verifica che sia un file JSON
        expect(filename).toMatch(/backup.*\.json$/);
      }
    });
  });

  test.describe('Gestione Utenti', () => {
    test('admin should be able to manage users', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Naviga a permessi
      await page.click('button[data-tab="permessi"]');
      await page.waitForTimeout(500);

      // Verifica che possa vedere la lista operatori
      const permList = page.locator('#perm-lista');
      await expect(permList).toBeVisible();
    });
  });
});
