import { expect, test, type Page, type Route } from '@playwright/test';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

/**
 * E2E funcional dos fluxos do componente de endereço estruturado (story #412,
 * CA-07): autofill por CEP, fallback manual e fluxo "sem CEP". Segue a convenção
 * de E2E do repo — runtime-config e API mockados por `page.route` (determinismo
 * em CI); a autenticação real (Keycloak) vem do projeto `fluxo-chromium` via
 * `auth-setup` + `storageState`. Exercitado na tela de Campus por ser a mais
 * simples (cidade obrigatória, sem dependências de reitoria).
 */

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, accept, idempotency-key',
};

const CEP_LOGRADOURO = {
  cep: '68507590',
  tipo: 'Rua',
  logradouro: 'Folha 31, Quadra 7',
  complemento: null,
  bairro: 'Nova Marabá',
  distrito: null,
  cidade: 'Marabá',
  codigoIbge: '1504208',
  uf: 'PA',
  latitude: '-5.368',
  longitude: '-49.118',
  nivelResolucao: 'logradouro',
  origem: 'geo-api',
};

const CIDADES = [
  { id: 'c1', codigoIbge: '1504208', nome: 'Marabá', uf: 'PA', ddd: '94' },
  { id: 'c2', codigoIbge: '1505304', nome: 'Parauapebas', uf: 'PA', ddd: '94' },
];

async function jsonRoute(route: Route, body: unknown, status = 200): Promise<void> {
  // O app chama o apiUrl cross-origin com Authorization → o browser dispara um
  // preflight OPTIONS antes do GET. Responde 204 ao preflight para o GET real
  // (e sua resposta mockada) chegar até o app. #412
  if (route.request().method() === 'OPTIONS') {
    await route.fulfill({ status: 204, headers: CORS_HEADERS });
    return;
  }
  await route.fulfill({
    status,
    contentType: 'application/json',
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  });
}

async function mockApi(page: Page, capturado: { post?: unknown }): Promise<void> {
  await page.route(/\/api\/configuracao\/campi(\?.*)?$/, (route) => jsonRoute(route, []));
  // Playwright casa rotas na ordem inversa de registro: a regra genérica de CEP
  // (404) vem primeiro; a específica do CEP resolvido é registrada depois para
  // ter prioridade sobre a genérica.
  await page.route(/\/api\/cep\/\d+$/, (route) => jsonRoute(route, null, 404));
  await page.route(/\/api\/cep\/68507590$/, (route) => jsonRoute(route, CEP_LOGRADOURO));
  await page.route(/\/api\/cidades(\?.*)?$/, (route) => jsonRoute(route, CIDADES));
  await page.route(/\/api\/configuracao\/admin\/campi$/, async (route) => {
    capturado.post = route.request().postDataJSON();
    await route.fulfill({ status: 201, contentType: 'application/json', headers: CORS_HEADERS, body: '"new-id"' });
  });
}

async function abrirCadastroCampus(page: Page): Promise<void> {
  await page.goto('/campi');
  await page.getByRole('button', { name: 'Novo campus' }).first().click();
  await expect(page.locator('#cfg-campus-form')).toBeVisible();
}

test.describe('Endereço estruturado — fluxos do formulário (#412)', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  test('CA-01: autofill por CEP preenche e ancora os campos resolvidos', async ({ page }) => {
    await mockApi(page, {});
    await abrirCadastroCampus(page);

    await page.locator('#campus-endereco-cep').fill('68507590');
    await page.getByRole('button', { name: 'Buscar CEP' }).click();

    await expect(page.locator('#campus-endereco-logradouro')).toHaveValue('Rua Folha 31, Quadra 7');
    await expect(page.locator('#campus-endereco-logradouro')).toHaveAttribute('readonly', '');
    await expect(page.locator('#campus-endereco-numero')).not.toHaveAttribute('readonly', '');
    await expect(page.getByText('Marabá — PA')).toBeVisible();
  });

  test('CA-02: fluxo sem CEP seleciona a cidade pelo seletor', async ({ page }) => {
    await mockApi(page, {});
    await abrirCadastroCampus(page);

    await page.getByRole('button', { name: 'preencher sem CEP' }).click();
    await page.getByLabel('Cidade').last().selectOption('1504208');

    await expect(page.getByText('Cidade selecionada: Marabá — PA')).toBeVisible();
  });

  test('CA-06: CEP inexistente exibe erro inline e oculta os campos de endereço', async ({ page }) => {
    await mockApi(page, {});
    await abrirCadastroCampus(page);

    await page.locator('#campus-endereco-cep').fill('00000000');
    await page.getByRole('button', { name: 'Buscar CEP' }).click();

    await expect(page.locator('#campus-endereco-cep-error')).toContainText('CEP não encontrado');
    // Sem CEP resolvido, os campos de endereço não são exibidos (não persistiriam).
    await expect(page.locator('#campus-endereco-logradouro')).toHaveCount(0);
  });

  test('CA-04: cria campus enviando cidade + endereço aninhado', async ({ page }) => {
    const capturado: { post?: unknown } = {};
    await mockApi(page, capturado);
    await abrirCadastroCampus(page);

    await page.locator('[formControlName="sigla"]').fill('MARABA');
    await page.locator('[formControlName="nome"]').fill('Campus de Marabá');
    await page.locator('#campus-endereco-cep').fill('68507590');
    await page.getByRole('button', { name: 'Buscar CEP' }).click();
    await expect(page.getByText('Marabá — PA')).toBeVisible();

    await page.getByRole('button', { name: 'Criar campus' }).click();

    await expect.poll(() => capturado.post).toMatchObject({
      sigla: 'MARABA',
      nome: 'Campus de Marabá',
      cidadeCodigoIbge: '1504208',
      cidadeUf: 'PA',
      endereco: { cep: '68507590', nivelResolucao: 'logradouro' },
    });
  });
});
