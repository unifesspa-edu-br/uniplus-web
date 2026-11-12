import { expect, test, type Page } from '@playwright/test';
import {
  REPRESENTANTE_DO_CONTROLADOR,
  SEGUNDO_GESTOR_DE_ACESSOS,
  chamarApi,
  entrarComoPersona,
  garantirConcessao,
  prepararAcessosDaSimulacao,
} from '@uniplus/shared-e2e';

/**
 * Revisão periódica contra a API real, com os três papéis de governança (ADR-0162): o
 * Representante do controlador decide os itens comuns, a gestão de acessos decide os de quem é
 * Representante, o Encarregado de dados só consulta, e ninguém decide o próprio item. A spec não
 * decide nenhum item: confere só o que cada pessoa pode fazer, e pode rodar de novo na mesma base.
 */
const APP = process.env['BASE_URL'] ?? 'http://localhost:4203';
const ENCARREGADO_DE_DADOS = 'isabella.figueiredo';
const PERFIL_DO_ENCARREGADO = '019a0000-0000-7000-8000-000000000003';
const ITEM_COMUM = 'Diogo';
const ITEM_DE_REPRESENTANTE = 'Caroline';
const ITEM_PROPRIO_DA_REPRESENTANTE = 'Betina';

interface RevisaoListada {
  readonly id: string;
}

/** A revisão em andamento ou, sem nenhuma, uma aberta agora pelo Representante. */
async function revisaoEmAndamento(): Promise<string> {
  const lista = await chamarApi<RevisaoListada[]>(
    REPRESENTANTE_DO_CONTROLADOR,
    'GET',
    '/api/autorizacao/revisoes?situacao=em_andamento&limit=10',
  );
  expect(lista.status, JSON.stringify(lista.corpo)).toBe(200);
  const aberta = lista.corpo[0];
  if (aberta !== undefined) return aberta.id;
  const nova = await chamarApi<RevisaoListada>(
    REPRESENTANTE_DO_CONTROLADOR,
    'POST',
    '/api/autorizacao/revisoes',
  );
  expect(nova.status, JSON.stringify(nova.corpo)).toBe(201);
  return nova.corpo.id;
}

/** As ações do item pendente do beneficiário cujo nome contém o texto. */
function acoesDe(pagina: Page, beneficiario: string) {
  return pagina
    .locator('cfg-itens-do-beneficiario', {
      has: pagina.getByRole('heading', { name: new RegExp(beneficiario) }),
    })
    .locator('tr[data-item-id]', { hasText: 'Aguarda decisão' })
    .getByRole('button');
}

test.describe('Revisão periódica de acessos', () => {
  let detalhe: string;

  test.beforeAll(async () => {
    test.setTimeout(900_000);
    await prepararAcessosDaSimulacao();
    await garantirConcessao(ENCARREGADO_DE_DADOS, PERFIL_DO_ENCARREGADO, '');
    detalhe = `/acessos/revisoes/${await revisaoEmAndamento()}`;
  });

  test('o Representante do controlador decide o item comum, e não o de outro Representante nem o próprio', async ({
    browser,
  }) => {
    const pagina = await entrarComoPersona(browser, APP, REPRESENTANTE_DO_CONTROLADOR, detalhe);

    await expect(acoesDe(pagina, ITEM_COMUM).first()).toHaveText('Confirmar');
    await expect(acoesDe(pagina, ITEM_DE_REPRESENTANTE)).toHaveCount(0);
    await expect(acoesDe(pagina, ITEM_PROPRIO_DA_REPRESENTANTE)).toHaveCount(0);
  });

  test('a gestão de acessos decide o item de quem é Representante, e não o comum', async ({
    browser,
  }) => {
    const pagina = await entrarComoPersona(browser, APP, SEGUNDO_GESTOR_DE_ACESSOS, detalhe);

    await expect(acoesDe(pagina, ITEM_DE_REPRESENTANTE)).toHaveText(['Confirmar', 'Revogar']);
    await expect(acoesDe(pagina, ITEM_COMUM)).toHaveCount(0);
  });

  test('o Encarregado de dados vê a lista e os itens sem nenhuma ação', async ({ browser }) => {
    const pagina = await entrarComoPersona(browser, APP, ENCARREGADO_DE_DADOS, '/acessos/revisoes');

    await expect(
      pagina.getByRole('heading', { level: 1, name: 'Revisões de acesso' }),
    ).toBeVisible();
    await expect(pagina.getByRole('button', { name: 'Abrir revisão' })).toHaveCount(0);
    await pagina.goto(detalhe);
    await expect(pagina.locator('tr[data-item-id]').first()).toBeVisible();
    await expect(
      pagina.getByRole('main').getByRole('button', { name: /^(Confirmar|Revogar)/ }),
    ).toHaveCount(0);
  });
});
