import { expect, test } from '@playwright/test';
import { runAxeWcagAA } from '@uniplus/shared-e2e';
import { PROCESSO_ID, FASE_DE_COLETA } from '../fixtures/processo-da-revisao';
import { mockarProcesso, prepararARevisao } from '../support/api-da-revisao';
import { identificadoresDe, medirTransbordo } from '../support/medicoes-do-passo';
import { irAoPasso } from '../support/navega-passo';

/**
 * Matriz do Uni+ DS para o passo Revisão e Publicação (`#486`). O preflight —
 * checklist estrutural, conformidade legal, documento confirmado e tipo de
 * ato — só existe com um processo já criado, então a suíte entra pela rota de
 * retomada (`/processo-seletivo/{id}`) em vez de `/novo`, com o detalhe,
 * os documentos e os dois checklists mockados por rota.
 */
test.describe('Revisão e publicação — conformidade, matriz DS @ds', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await prepararARevisao(page, testInfo.project.name);
  });

  test('não viola WCAG 2.1 AA com checklist estrutural e legal conformes', async ({
    page,
  }, testInfo) => {
    await mockarProcesso(page, { cronogramaFases: [FASE_DE_COLETA] });
    await page.goto(`/processo-seletivo/${PROCESSO_ID}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await irAoPasso(page, 'Revisão e publicação', testInfo);

    await expect(page.getByRole('heading', { name: 'Checklist estrutural' })).toBeVisible();
    await expect(page.getByText('Nenhuma pendência estrutural.')).toBeVisible();
    await expect(page.getByText('Nenhuma obrigatoriedade legal reprovada.')).toBeVisible();
    // Com fase de coleta, o período não é pedido nesta tela.
    await expect(page.getByLabel('Início do período de inscrição', { exact: true })).toBeHidden();

    const resultado = await runAxeWcagAA(page);
    expect(identificadoresDe(resultado)).toEqual([]);
  });

  test('não viola WCAG 2.1 AA sem fase de coleta — período de inscrição pedido nesta tela', async ({
    page,
  }, testInfo) => {
    await mockarProcesso(page, { cronogramaFases: [] });
    await page.goto(`/processo-seletivo/${PROCESSO_ID}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await irAoPasso(page, 'Revisão e publicação', testInfo);

    await expect(page.getByLabel('Início do período de inscrição', { exact: true })).toBeVisible();
    await page
      .getByLabel('Início do período de inscrição', { exact: true })
      .fill('2027-05-01T08:00');
    await page.getByLabel('Fim do período de inscrição', { exact: true }).fill('2027-05-10T18:00');
    await page.getByLabel('Número do ato (opcional)', { exact: true }).fill('001/2027');
    await page.getByLabel('Tipo de ato', { exact: true }).selectOption('PORTARIA');
    await page.getByLabel('Órgão', { exact: true }).fill('Reitoria');
    await page.getByLabel('Série', { exact: true }).fill('1');
    await page.getByLabel('Ano', { exact: true }).fill('2027');
    await page.getByLabel('Data do ato', { exact: true }).fill('2027-01-15');
    await page.getByLabel('Assinante', { exact: true }).fill('Reitor');

    const resultado = await runAxeWcagAA(page);
    expect(identificadoresDe(resultado)).toEqual([]);
  });

  test('não viola WCAG 2.1 AA com pendências no checklist estrutural e legal', async ({
    page,
  }, testInfo) => {
    await mockarProcesso(page, {
      cronogramaFases: [FASE_DE_COLETA],
      conformidadeItens: [
        {
          codigo: 'taxa_inscricao_nao_declarada',
          dimensao: 'taxa_inscricao',
          mensagem: 'Declare se o processo cobra taxa de inscrição.',
          ok: false,
        },
        {
          codigo: 'classificacao_ausente',
          dimensao: 'classificacao',
          mensagem: 'Declare a classificação do processo.',
          ok: false,
        },
      ],
      conformidadeLegalRegras: [
        {
          regraId: '01960000-0000-7000-0000-000000000907',
          regraCodigo: 'OBRIG-COTAS-LEI-12711',
          categoria: 'OBRIGATORIA',
          tipoProcessoCodigoAvaliado: 'GRAD',
          predicado: 'SEMPRE',
          aprovada: false,
          motivo: 'O processo não declarou distribuição de vagas por cotas.',
          baseLegal: 'Lei 12.711/2012',
          atoNormativoUrl: null,
          portariaInterna: null,
          descricaoHumana: 'Reserva de vagas da Lei de Cotas',
          vigenciaInicio: '2012-08-30',
          vigenciaFim: null,
        },
      ],
    });
    await page.goto(`/processo-seletivo/${PROCESSO_ID}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await irAoPasso(page, 'Revisão e publicação', testInfo);

    // Grupo pendente abre sozinho — o item fica visível sem clique algum.
    // Ancorado em `.revisao-list` (não `page` inteira): todos os passos do
    // wizard ficam montados (`[hidden]`), e o passo Pagamento tem um
    // subtítulo estático com a MESMA frase que este item de pendência —
    // coincidência de domínio (o texto do checklist espelha o da tela),
    // não colisão de teste. `getByText` alcança elemento oculto por padrão,
    // então sem ancorar o teste bateria em dois elementos.
    await expect(
      page.locator('.revisao-list').getByText('Declare se o processo cobra taxa de inscrição.'),
    ).toBeVisible();
    await expect(page.getByText('Reserva de vagas da Lei de Cotas')).toBeVisible();
    // O botão nomeia o PASSO, não a dimensão: com a decisão por item, dois itens da mesma
    // dimensão podem levar a passos diferentes, e "Taxa inscricao" era a grafia mecânica do
    // código da dimensão, não o nome que o operador vê no stepper.
    await expect(page.getByRole('button', { name: /Ir para Taxa de inscrição/ })).toBeVisible();

    const resultado = await runAxeWcagAA(page);
    expect(identificadoresDe(resultado)).toEqual([]);
  });

  test('não viola WCAG 2.1 AA com aviso de conformidade e checklist conforme', async ({
    page,
  }, testInfo) => {
    await mockarProcesso(page, {
      cronogramaFases: [FASE_DE_COLETA],
      conformidadeAvisos: [
        {
          codigo: 'cronograma_tipo_definitivo_em_mais_de_um_lugar',
          dimensao: 'cronograma',
          mensagem:
            'O mesmo tipo de ato definitivo foi declarado em mais de uma fase. Confirme que o edital quer isso.',
        },
      ],
    });
    await page.goto(`/processo-seletivo/${PROCESSO_ID}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await irAoPasso(page, 'Revisão e publicação', testInfo);

    await expect(page.getByRole('heading', { name: 'Avisos para conferir' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Ir para Cronograma/ })).toBeVisible();

    const resultado = await runAxeWcagAA(page);
    expect(identificadoresDe(resultado)).toEqual([]);
  });

  test('a frase de publicação simulada não existe mais', async ({ page }, testInfo) => {
    await mockarProcesso(page, { cronogramaFases: [FASE_DE_COLETA] });
    await page.goto(`/processo-seletivo/${PROCESSO_ID}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await irAoPasso(page, 'Revisão e publicação', testInfo);

    await expect(
      page.getByText(
        'A publicação será habilitada quando a integração com a API estiver disponível.',
      ),
    ).toHaveCount(0);
  });

  test('não transborda horizontalmente', async ({ page }, testInfo) => {
    await mockarProcesso(page, { cronogramaFases: [FASE_DE_COLETA] });
    await page.goto(`/processo-seletivo/${PROCESSO_ID}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await irAoPasso(page, 'Revisão e publicação', testInfo);

    const medida = await medirTransbordo(page);

    expect(medida.documento).toBeLessThanOrEqual(1);
    expect(medida.scroller).toBeLessThanOrEqual(1);
  });
});
