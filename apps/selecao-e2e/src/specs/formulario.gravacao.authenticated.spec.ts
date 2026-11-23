import { expect, test, type Page } from '@playwright/test';
import { PROCESSO_PUBLICADO_DA_MEDICINA } from '../fixtures/consulta-da-medicina';
import {
  mockarFormularioDoProcesso,
  type CorpoDosItens,
} from '../support/api-do-formulario-do-processo';

/**
 * A gravação do passo Formulários com o contrato de campos agrupados: o que o operador lê e não
 * edita não é regravado, o que edita segue com a apresentação e as regras em sub-objetos, e a
 * recusa do servidor aponta o campo pelo caminho aninhado.
 *
 * O CI do frontend sobe Keycloak, mas não a API: o processo e os catálogos são servidos por rota,
 * e o `PUT /formularios/INSCRICAO/itens` é capturado para conferir o comando que a tela monta.
 */
const CAMPO_DA_PCD = /Você é pessoa com deficiência/;
const ROTULO_NOVO = 'Você tem deficiência?';
const RECUSA_DO_ROTULO = 'O rótulo passou do tamanho permitido.';

async function abrirOFormulario(page: Page): Promise<void> {
  await page.goto(`/processo-seletivo/${PROCESSO_PUBLICADO_DA_MEDICINA.id}`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Etapas do cadastro' })
    .getByRole('button', { name: 'Formulários' })
    .click();
  await expect(page.getByRole('heading', { level: 1, name: /Formulários/ })).toBeVisible();
  await expect(page.getByRole('article', { name: CAMPO_DA_PCD })).toBeVisible();
}

async function gravarEAvancar(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Gravar e avançar/ }).click();
}

async function editarORotuloDaPcd(page: Page): Promise<void> {
  const campo = page.getByRole('article', { name: CAMPO_DA_PCD });
  await campo.getByLabel('Rótulo').fill(ROTULO_NOVO);
}

function caminhoDoRotuloDaPcd(): string {
  const posicaoDaPcd = PROCESSO_PUBLICADO_DA_MEDICINA.formularios[0].coleta.itens.findIndex(
    (item) => item.fatoCodigo === 'PCD',
  );
  return `itens[${posicaoDaPcd}].apresentacao.rotulo`;
}

function conferirSoOCampoDaPcdComApresentacaoAgrupada(enviado: CorpoDosItens): void {
  const comRotuloNovo = enviado.itens.filter((item) => item.apresentacao?.rotulo === ROTULO_NOVO);
  expect(comRotuloNovo.map((item) => item.fatoCodigo)).toEqual(['PCD']);
  expect(comRotuloNovo[0]).toMatchObject({
    ordem: expect.any(Number),
    regras: expect.any(Object),
  });
  expect(comRotuloNovo[0]).not.toHaveProperty('rotulo');
  expect(comRotuloNovo[0]).not.toHaveProperty('obrigatorio');
  expect(comRotuloNovo[0]).not.toHaveProperty('visivel');
}

async function conferirRecusaNoCampoDaPcdSemAvancar(page: Page): Promise<void> {
  await expect(
    page.getByRole('article', { name: /Você tem deficiência/ }).getByText(RECUSA_DO_ROTULO),
  ).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: /Formulários/ })).toBeVisible();
}

test.describe('Formulários — gravação dos campos na forma do contrato', () => {
  test('o conteúdo lido e não editado não é regravado ao avançar', async ({ page }) => {
    const gravacoes = await mockarFormularioDoProcesso(page);
    await abrirOFormulario(page);

    await gravarEAvancar(page);

    await expect(
      page.getByRole('heading', { level: 1, name: /Revisão e publicação/ }),
    ).toBeVisible();
    expect(gravacoes.corpos).toEqual([]);
  });

  test('o rótulo editado segue só no campo alterado, com a apresentação agrupada', async ({
    page,
  }) => {
    const gravacoes = await mockarFormularioDoProcesso(page);
    await abrirOFormulario(page);
    await editarORotuloDaPcd(page);

    await gravarEAvancar(page);

    await expect.poll(() => gravacoes.corpos.length).toBe(1);
    conferirSoOCampoDaPcdComApresentacaoAgrupada(gravacoes.corpos[0]);
  });

  test('a recusa do rótulo aninhado aparece no campo e o passo não avança', async ({ page }) => {
    const gravacoes = await mockarFormularioDoProcesso(page);
    gravacoes.recusa = { field: caminhoDoRotuloDaPcd(), message: RECUSA_DO_ROTULO };
    await abrirOFormulario(page);
    await editarORotuloDaPcd(page);

    await gravarEAvancar(page);

    await conferirRecusaNoCampoDaPcdSemAvancar(page);
  });
});
