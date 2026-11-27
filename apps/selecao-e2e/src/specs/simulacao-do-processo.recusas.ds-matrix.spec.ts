import { expect, test } from '@playwright/test';
import { mockPermissoesEfetivas, runAxeWcagAA } from '@uniplus/shared-e2e';
import { PERMISSOES_DO_LEANDRO } from '../support/permissoes';
import { instalarPreferencia, temaDoProject } from '../support/tema';

const ID = '01960000-0000-7000-0000-000000000515';

const FORMULARIO = {
  codigo: 'HABILITACAO',
  obrigatorio: true,
  faseId: null,
  dependenciasDaAvaliacao: null,
  dependenciasDoFator: null,
  formulario: {
    titulo: null,
    paginas: [
      {
        codigo: 'DOCUMENTOS',
        codigoNasRegras: null,
        ordem: 0,
        tipo: 'BLOCO',
        bloco: 'COMPROVACAO_DOCUMENTAL',
        apresentacao: { titulo: 'Documentos', descricao: null, aviso: null },
      },
    ],
    termos: [],
    coleta: { itens: [], grupos: [] },
    regras: { paginas: [], termos: [], derivacoes: [], agregados: [] },
    pressupostos: { fatos: [], dataReferenciaFatos: null, fusoDoEnvio: null },
  },
  comprovacaoDocumental: [],
};

const RECUSAS = [
  {
    code: 'uniplus.teste.primeira',
    message: 'A primeira regra foi recusada.',
    field: 'paginas[0]',
  },
  {
    code: 'uniplus.teste.segunda',
    message: 'A segunda regra foi recusada, e a mensagem é longa para conferir a quebra de linha.',
    field: 'regras.derivacoes[3].condicao.valores[12].identificador_muito_comprido_sem_espaco',
  },
  { code: 'uniplus.teste.terceira', message: 'Recusa sem campo.' },
];

/**
 * Quando o servidor recusa as regras na conferência da simulação do processo, a lista mostra todas as
 * recusas, cada uma com o campo a que se refere, e o foco vai ao título. A lista é conferida nos temas
 * e larguras da matriz, com o axe e sem transbordo horizontal. As respostas da API são simuladas.
 */
test.describe('Simulação do processo — recusas da conferência @ds', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await mockPermissoesEfetivas(page, PERMISSOES_DO_LEANDRO);
    await instalarPreferencia(page, temaDoProject(testInfo.project.name));
    await page.route(
      new RegExp(
        `/api/selecao/admin/processos-seletivos/${ID}/formularios/HABILITACAO/apresentacao$`,
      ),
      (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(FORMULARIO),
        }),
    );
    await page.route('**/api/configuracao/admin/avaliacoes-de-formulario', (route) =>
      route.fulfill({
        status: 422,
        contentType: 'application/problem+json',
        body: JSON.stringify({
          title: 'Regras recusadas',
          status: 422,
          code: 'uniplus.configuracao.regras_recusadas',
          errors: RECUSAS,
        }),
      }),
    );
    await page.goto(`/processo-seletivo/${ID}/simulacao/HABILITACAO`);
    await page.getByRole('button', { name: 'Conferir com o servidor' }).click();
  });

  test('lista as três recusas, mostra o campo só onde há e leva o foco ao título', async ({
    page,
  }) => {
    const titulo = page.getByRole('heading', {
      name: /O servidor não conferiu a simulação: 3 recusas/,
    });
    await expect(titulo).toBeFocused();
    await expect(page.locator('.recusas-da-conferencia__lista li')).toHaveCount(3);
    await expect(page.locator('.recusas-da-conferencia__onde')).toHaveCount(2);
  });

  test('não há violação de WCAG 2.1 AA com a lista de recusas', async ({ page }) => {
    await expect(page.locator('.recusas-da-conferencia__lista')).toBeVisible();
    const { violations } = await runAxeWcagAA(page);
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });

  test('não transborda horizontalmente com as recusas', async ({ page }) => {
    await expect(page.locator('.recusas-da-conferencia__lista')).toBeVisible();
    const largura = await page.evaluate(() => ({
      pagina: document.documentElement.scrollWidth,
      janela: document.documentElement.clientWidth,
    }));
    expect(largura.pagina).toBeLessThanOrEqual(largura.janela);
  });
});
