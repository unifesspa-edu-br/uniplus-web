import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { runAxeWcagAA } from '@uniplus/shared-e2e';
import { PROCESSO_PUBLICADO_DA_MEDICINA } from '../fixtures/consulta-da-medicina';
import { ApiDaProvaPresencial, MARABA, PALMAS } from '../support/api-da-prova-presencial';
import { irAoPasso } from '../support/navega-passo';
import { medirTransbordoHorizontal } from '../support/rolagem-do-editor';
import { instalarPreferencia, temaDoProject } from '../support/tema';

test.describe('Prova presencial — matriz DS @ds', () => {
  test('mostra a pendência enquanto não declarada', async ({ page }, info) => {
    await abrir(page, info, new ApiDaProvaPresencial());
    await expect(
      page.getByText(
        'A prova presencial ainda não foi declarada. O processo não pode ser publicado sem essa declaração.',
      ),
    ).toBeVisible();
  });

  test('grava a ausência de prova sem municípios', async ({ page }, info) => {
    const api = new ApiDaProvaPresencial();
    await abrir(page, info, api);
    await escolher(page, 'Sem prova presencial');
    await gravar(page);
    await expect.poll(() => api.puts).toEqual([{ temProvaPresencial: false, municipios: [] }]);
    await esperarAvanco(page);
    await irAoPasso(page, 'Prova presencial', info);
    await expect(page.getByRole('radio', { name: /Sem prova presencial/ })).toBeChecked();
  });

  test('grava municípios de UFs distintas e relê seus nomes', async ({ page }, info) => {
    const api = new ApiDaProvaPresencial();
    await abrir(page, info, api);
    await escolher(page, 'Com prova presencial');
    await adicionar(page, MARABA.nome, 'Marabá (PA)');
    await adicionar(page, PALMAS.nome, 'Palmas (TO)');
    await gravar(page);
    await conferirMunicipiosGravados(api);
    await esperarAvanco(page);
    expect(api.releituras).toBeGreaterThan(0);
    await irAoPasso(page, 'Prova presencial', info);
    await expect(lista(page)).toContainText('Marabá (PA)');
    await expect(lista(page)).toContainText('Palmas (TO)');
  });

  test('avisa e confirma a remoção de município já gravado', async ({ page }, info) => {
    const api = new ApiDaProvaPresencial();
    api.declaracao = { temProvaPresencial: true, municipios: [MARABA] };
    await abrir(page, info, api);
    await escolher(page, 'Sem prova presencial');
    await expect(
      page.getByText(/O município de prova \(Marabá \(PA\)\) será removido/),
    ).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Municípios de prova' })).toHaveCount(0);
    await gravar(page);
    await confirmarRemocao(page, api);
    await expect.poll(() => api.puts).toEqual([{ temProvaPresencial: false, municipios: [] }]);
  });

  for (const codigo of [
    'MunicipiosSemProvaPresencial',
    'MunicipiosAcimaDoLimite',
    'MunicipioRepetido',
  ]) {
    test(`mostra a recusa ${codigo} junto ao campo`, async ({ page }, info) => {
      const api = new ApiDaProvaPresencial();
      recusar(api, codigo);
      await abrir(page, info, api);
      await escolher(page, 'Com prova presencial');
      await adicionar(page, MARABA.nome, 'Marabá (PA)');
      await gravar(page);
      await conferirRecusa(page, codigo);
    });
  }

  test('preserva município escolhido quando a busca falha', async ({ page }, info) => {
    const api = new ApiDaProvaPresencial();
    await abrir(page, info, api);
    await escolher(page, 'Com prova presencial');
    await adicionar(page, MARABA.nome, 'Marabá (PA)');
    api.geoIndisponivel = true;
    await page.getByRole('combobox', { name: 'Municípios de prova' }).fill('Palmas');
    await expect(
      page.getByText('Não foi possível buscar os municípios', { exact: false }).first(),
    ).toBeVisible();
    await expect(lista(page)).toContainText('Marabá (PA)');
  });

  test('sem permissão de configurar a tela nega o acesso', async ({ page }, info) => {
    await new ApiDaProvaPresencial().instalar(page, ['selecao:processos:publicar']);
    await instalarPreferencia(page, temaDoProject(info.project.name));
    await page.goto(`/processo-seletivo/${PROCESSO_PUBLICADO_DA_MEDICINA.id}`);
    await expect(page.getByRole('heading', { level: 1, name: 'Acesso negado' })).toBeVisible();
    await expect(page.getByRole('radio', { name: /prova presencial/ })).toHaveCount(0);
  });

  test('opera por teclado e atende WCAG 2.1 AA sem transbordo', async ({ page }, info) => {
    await abrir(page, info, new ApiDaProvaPresencial());
    await tabAte(page, 'radio', /Sem prova presencial/);
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('radio', { name: /Com prova presencial/ })).toBeChecked();
    await adicionarPorTeclado(page);
    expect((await runAxeWcagAA(page)).violations.map((violacao) => violacao.id)).toEqual([]);
    await conferirTransbordo(page);
    await tabAte(page, 'button', 'Remover Marabá (PA)');
    await page.keyboard.press('Enter');
    await expect(lista(page)).not.toContainText('Marabá (PA)');
  });

  test('não transborda com zoom de 200%', async ({ page }, info) => {
    await abrir(page, info, new ApiDaProvaPresencial());
    await escolher(page, 'Com prova presencial');
    await adicionar(page, MARABA.nome, 'Marabá (PA)');
    await page.setViewportSize({ width: 640, height: 450 });
    await page.evaluate(() => {
      document.documentElement.style.zoom = '2';
    });
    await conferirTransbordo(page);
  });
});

async function abrir(
  page: Page,
  info: TestInfo,
  api: ApiDaProvaPresencial,
  permissoes?: readonly string[],
): Promise<void> {
  await api.instalar(page, permissoes);
  await instalarPreferencia(page, temaDoProject(info.project.name));
  await page.goto(`/processo-seletivo/${PROCESSO_PUBLICADO_DA_MEDICINA.id}`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 20_000 });
  await irAoPasso(page, 'Prova presencial', info);
  await expect(page.getByRole('heading', { level: 1, name: /Prova presencial/ })).toBeVisible();
}

async function escolher(page: Page, nome: string): Promise<void> {
  await page.getByRole('radio', { name: new RegExp(nome) }).check({ force: true });
}

async function adicionar(page: Page, termo: string, nome: string): Promise<void> {
  await page.getByRole('combobox', { name: 'Municípios de prova' }).fill(termo);
  await page.getByRole('option', { name: nome }).click();
  await expect(lista(page)).toContainText(nome);
}

async function adicionarPorTeclado(page: Page): Promise<void> {
  await tabAte(page, 'combobox', 'Municípios de prova');
  await page.keyboard.type('Marabá');
  await expect(page.getByRole('option', { name: 'Marabá (PA)' })).toBeVisible();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(lista(page)).toContainText('Marabá (PA)');
}

async function tabAte(
  page: Page,
  role: 'radio' | 'combobox' | 'button',
  name: string | RegExp,
): Promise<void> {
  const alvo = page.getByRole(role, { name });
  for (
    let tentativa = 0;
    tentativa < 60 && !(await alvo.evaluate((elemento) => elemento === document.activeElement));
    tentativa++
  ) {
    await page.keyboard.press('Tab');
  }
  await expect(alvo).toBeFocused();
}

function lista(page: Page) {
  return page.getByRole('list', { name: 'Municípios de prova' });
}

async function gravar(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Gravar e avançar' }).click();
}

async function esperarAvanco(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { level: 1, name: /Formulários/ })).toBeVisible();
}

async function confirmarRemocao(page: Page, api: ApiDaProvaPresencial): Promise<void> {
  const dialogo = page.getByRole('dialog', { name: 'Município de prova será removido' });
  await expect(dialogo).toContainText('Marabá (PA)');
  expect(api.puts).toEqual([]);
  await dialogo.getByRole('button', { name: 'Confirmar e gravar' }).click();
}

async function conferirMunicipiosGravados(api: ApiDaProvaPresencial): Promise<void> {
  await expect
    .poll(() => api.puts)
    .toEqual([
      {
        temProvaPresencial: true,
        municipios: [
          { codigoIbge: MARABA.codigoIbge, uf: MARABA.uf },
          { codigoIbge: PALMAS.codigoIbge, uf: PALMAS.uf },
        ],
      },
    ]);
}

function recusar(api: ApiDaProvaPresencial, codigo: string): void {
  const field =
    codigo === 'MunicipioRepetido'
      ? '/provaPresencial/municipios/0/codigoIbge'
      : '/provaPresencial/municipios';
  api.recusas = [
    { field, code: `ProvaPresencial.${codigo}`, message: 'Confira os municípios de prova.' },
  ];
}

async function conferirRecusa(page: Page, codigo: string): Promise<void> {
  const campo =
    codigo === 'MunicipioRepetido'
      ? lista(page).getByRole('listitem')
      : page.locator('sel-municipios-de-prova');
  await expect(campo).toContainText(`ProvaPresencial.${codigo}`);
  await expect(campo.getByRole('link', { name: /Entenda a recusa/ })).toHaveAttribute(
    'href',
    `https://exemplo.org/erros/ProvaPresencial.${codigo}`,
  );
}

async function conferirTransbordo(page: Page): Promise<void> {
  const medida = await medirTransbordoHorizontal(page);
  expect(medida.documento).toBeLessThanOrEqual(1);
  expect(medida.areaDeTrabalho).toBeLessThanOrEqual(1);
}
