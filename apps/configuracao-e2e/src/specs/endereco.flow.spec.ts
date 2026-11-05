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
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      headers: CORS_HEADERS,
      body: '"new-id"',
    });
  });
}

async function abrirCadastroCampus(page: Page): Promise<void> {
  await page.goto('/campi');
  await page.getByRole('button', { name: 'Novo campus' }).first().click();
  await expect(page.locator('#cfg-campus-form')).toBeVisible();
}

/** Com o CEP resolvido, a UF e a cidade vêm do CEP, em campos só de leitura. */
async function conferirCidadeDoCep(page: Page): Promise<void> {
  const form = page.locator('#cfg-campus-form');
  const uf = form.getByRole('textbox', { name: 'UF', exact: true });
  const cidade = form.getByRole('textbox', { name: 'Cidade', exact: true });
  await expect(uf).toHaveValue('PA');
  await expect(uf).toHaveAttribute('readonly', '');
  await expect(cidade).toHaveValue('Marabá');
  await expect(cidade).toHaveAttribute('readonly', '');
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
    await conferirCidadeDoCep(page);
  });

  test('"Trocar CEP" por teclado leva o foco ao campo do CEP e a pendência fica anunciada', async ({
    page,
  }) => {
    await mockApi(page, {});
    await abrirCadastroCampus(page);
    const cep = page.locator('#campus-endereco-cep');

    await cep.fill('68507590');
    // Sair do campo com o CEP completo já inicia a busca: a pessoa de teclado digita e dá Tab. O
    // botão mantém o foco enquanto a busca corre e, ao resolver, muda de papel para "Trocar CEP".
    await page.keyboard.press('Tab');
    const trocar = page.getByRole('button', { name: 'Trocar CEP' });
    await expect(trocar).toBeFocused();

    await page.keyboard.press('Enter');
    await expect(cep).toBeFocused();
    await expect(cep).not.toHaveAttribute('readonly', '');

    await cep.fill('68507591');
    await expect(cep).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#campus-endereco-cep-pendente')).toHaveText(/Valide o CEP/);
    await expect(cep).toHaveAttribute('aria-describedby', /campus-endereco-cep-pendente/);
  });

  for (const tecla of ['Enter', 'Space']) {
    test(`"Buscar CEP" ativado com ${tecla} inicia a busca, e repetir durante a espera não a repete`, async ({
      page,
    }) => {
      await mockApi(page, {});
      let buscas = 0;
      let liberar!: () => void;
      const resposta = new Promise<void>((resolve) => (liberar = resolve));
      await page.route(/\/api\/cep\/68507590$/, async (route) => {
        if (route.request().method() === 'GET') {
          buscas++;
          await resposta;
        }
        await jsonRoute(route, CEP_LOGRADOURO);
      });
      await abrirCadastroCampus(page);
      const buscar = page.getByRole('button', { name: 'Buscar CEP' });

      await buscar.focus();
      await page.locator('#campus-endereco-cep').evaluate((campo: HTMLInputElement) => {
        campo.value = '68507590';
        campo.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await page.keyboard.press(tecla);
      await expect(page.locator('#campus-endereco-cep-status')).toHaveText(/Buscando CEP/);
      await page.keyboard.press(tecla);
      await page.keyboard.press(tecla);
      await expect.poll(() => buscas).toBe(1);

      liberar();
      await expect(page.getByRole('button', { name: 'Trocar CEP' })).toBeFocused();
      await expect(page.locator('#campus-endereco-cep-status')).toHaveText(/CEP encontrado/);
      expect(buscas).toBe(1);
    });
  }

  test('CA-02: fluxo sem CEP escolhe a UF e busca a cidade no campo de município', async ({
    page,
  }) => {
    await mockApi(page, {});
    await abrirCadastroCampus(page);

    await page.getByRole('button', { name: 'preencher sem CEP' }).click();
    const form = page.locator('#cfg-campus-form');
    const cidade = form.getByRole('combobox', { name: /^Cidade\b/ });
    // A cidade só se busca depois da UF, que limita a busca.
    await expect(cidade).toBeDisabled();
    await form.getByRole('combobox', { name: /^UF\b/ }).selectOption('PA');
    await expect(cidade).toBeEnabled();

    await cidade.fill('Mara');
    await page.getByRole('option', { name: 'Marabá (PA)' }).click();

    await expect(cidade).toHaveValue('Marabá (PA)');
    await expect(form.getByRole('button', { name: 'Limpar cidade' })).toBeVisible();
  });

  test('envio em curso com a lista de cidades aberta: a cidade escolhida não muda', async ({
    page,
  }) => {
    const capturado: { post?: unknown } = {};
    await mockApi(page, capturado);
    let liberar: () => void = () => undefined;
    const retida = new Promise<void>((resolve) => (liberar = resolve));
    await page.route(/\/api\/configuracao\/admin\/campi$/, async (route) => {
      if (route.request().method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers: CORS_HEADERS });
        return;
      }
      capturado.post = route.request().postDataJSON();
      await retida;
      await route.fulfill({
        status: 422,
        contentType: 'application/json',
        headers: CORS_HEADERS,
        body: '{}',
      });
    });
    await abrirCadastroCampus(page);
    const form = page.locator('#cfg-campus-form');
    await form.locator('[formControlName="sigla"]').fill('MARABA');
    await form.locator('[formControlName="nome"]').fill('Campus de Marabá');
    await page.getByRole('button', { name: 'preencher sem CEP' }).click();
    await form.getByRole('combobox', { name: /^UF\b/ }).selectOption('PA');
    const cidade = form.getByRole('combobox', { name: /^Cidade\b/ });
    await cidade.fill('Mara');
    await page.getByRole('option', { name: 'Marabá (PA)' }).click();
    await expect(cidade).toHaveValue('Marabá (PA)');

    // A lista fica aberta com uma busca em curso, sem opção destacada, quando o Enter envia.
    await cidade.fill('Para');
    const outra = page.getByRole('option', { name: 'Parauapebas (PA)' });
    await expect(outra).toBeVisible();
    await cidade.press('Enter');
    await expect.poll(() => capturado.post).toBeDefined();

    // O Enter fecha a lista e devolve o texto do valor escolhido antes de enviar.
    await expect(cidade).toBeDisabled();
    await expect(cidade).toHaveAttribute('aria-expanded', 'false');
    await expect(cidade).toHaveValue('Marabá (PA)');
    liberar();

    // Com a recusa, o formulário volta a ser editável sem a lista reaberta nem texto divergente.
    await expect(cidade).toBeEnabled();
    await expect(cidade).toHaveAttribute('aria-expanded', 'false');
    await expect(outra).toBeHidden();
    await expect(cidade).toHaveValue('Marabá (PA)');
    expect(capturado.post).toMatchObject({ cidadeCodigoIbge: '1504208' });
  });

  test('CA-06: CEP inexistente exibe erro inline e oculta os campos de endereço', async ({
    page,
  }) => {
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
    await conferirCidadeDoCep(page);

    await page.getByRole('button', { name: 'Criar campus' }).click();

    await expect
      .poll(() => capturado.post)
      .toMatchObject({
        sigla: 'MARABA',
        nome: 'Campus de Marabá',
        cidadeCodigoIbge: '1504208',
        cidadeUf: 'PA',
        endereco: { cep: '68507590', nivelResolucao: 'logradouro' },
      });
  });
});
