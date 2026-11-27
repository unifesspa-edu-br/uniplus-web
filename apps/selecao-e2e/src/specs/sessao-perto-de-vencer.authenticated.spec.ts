import { expect, test, type Page } from '@playwright/test';
import { mockPermissoesEfetivas } from '@uniplus/shared-e2e';
import { PERMISSOES_DO_LEANDRO } from '../support/permissoes';

/**
 * Com a aba parada, a sessão acaba por inatividade. Faltando dois minutos, a pessoa é avisada em
 * quanto tempo isso acontece e pode pedir mais tempo; nenhuma credencial fica guardada no
 * navegador. O relógio da página é adiantado, sem esperar o tempo real.
 */

const ROTA = '/processo-seletivo/novo';
const UM_MINUTO = '01:00';
const MINUTOS_ATE_O_FIM_DA_INATIVIDADE = 29;

/** Adianta o relógio de minuto em minuto até o aviso abrir, para não passar do fim da sessão. */
async function avancarAteOAviso(page: Page): Promise<void> {
  const aviso = page.getByRole('dialog', { name: 'Sua sessão está perto de acabar' });
  for (let minuto = 0; minuto < MINUTOS_ATE_O_FIM_DA_INATIVIDADE; minuto += 1) {
    if (await aviso.isVisible()) return;
    await page.clock.runFor(UM_MINUTO);
  }
}

async function credenciaisNoArmazenamento(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [localStorage, sessionStorage].flatMap((armazenamento) =>
      Object.entries(armazenamento)
        .filter(([chave, valor]) => /token/i.test(chave) || valor.includes('eyJ'))
        .map(([chave]) => chave),
    ),
  );
}

test.describe('Sessão perto de vencer', () => {
  test.beforeEach(async ({ page }) => {
    // Com a API real no ar, as demais chamadas da tela seriam recusadas e levariam a "Acesso negado".
    // A rota registrada por último vale primeiro: a das permissões vem depois, para prevalecer.
    await page.route('**/api/**', (rota) => rota.abort());
    await mockPermissoesEfetivas(page, PERMISSOES_DO_LEANDRO);
    await page.clock.install();
    const acessoRecebido = page.waitForResponse('**/protocol/openid-connect/token');
    await page.goto(ROTA);
    await acessoRecebido;
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('avisa em quanto tempo a sessão acaba e continuar mantém o acesso, sem novo aviso', async ({
    page,
  }) => {
    await avancarAteOAviso(page);

    const aviso = page.getByRole('dialog', { name: 'Sua sessão está perto de acabar' });
    await expect(aviso).toBeVisible();
    await expect(aviso.getByRole('status')).toContainText('A sessão acaba em');
    await expect(aviso.getByRole('button', { name: 'Continuar' })).toBeFocused();
    expect(await credenciaisNoArmazenamento(page)).toEqual([]);

    await aviso.getByRole('button', { name: 'Continuar' }).click();

    await expect(aviso).toBeHidden();
    await page.clock.runFor('05:00');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(new URL(page.url()).pathname).toBe(ROTA);
  });

  test('"Agora não" fecha o aviso e devolve o foco à tela', async ({ page }) => {
    const origem = page.locator('a[href]:visible').first();
    await origem.focus();
    await avancarAteOAviso(page);
    const aviso = page.getByRole('dialog', { name: 'Sua sessão está perto de acabar' });

    await aviso.getByRole('button', { name: 'Agora não' }).click();

    await expect(aviso).toBeHidden();
    await expect(origem).toBeFocused();
  });
});
