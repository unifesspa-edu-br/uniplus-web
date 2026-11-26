import { expect, test, type Page } from '@playwright/test';
import {
  verificarEnvioPendente,
  verificarRecusaDoNome,
  verificarRemocaoPendente,
  verificarOfertasBloqueadas,
  verificarFalhaRemocao,
  verificarAnuncioDeRemocao,
  verificarRecargaDasOfertas,
  abrirFormularioNovo,
  iniciarCriacaoDeCurso,
  verificarEnvioComErroInterno,
} from '../support/passos-das-escritas-de-curso';
import {
  mockApi,
  mockFalhaNaPrimeiraConsultaDeOfertas,
} from '../support/mock-das-escritas-de-curso';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

/**
 * Escritas de Curso num navegador real: com o envio em curso o formulário é só leitura e não
 * fecha; com a remoção em curso o diálogo segue aberto; e o foco vai ao campo recusado, volta ao
 * acionador ou, sem a linha, ao título da lista. API mockada por `page.route`; autenticação real
 * pelo projeto `fluxo-chromium`.
 */

const BLOQUEIO = 'Não é possível remover um curso referenciado por uma oferta de curso ativa';
const RECUSA_DO_NOME = {
  type: 'about:blank',
  title: 'Dados inválidos',
  status: 422,
  code: 'uniplus.validacao',
  traceId: 'e2e',
  errors: [
    {
      field: 'Nome',
      code: 'uniplus.configuracao.curso.nome_tamanho',
      message: 'Nome fora do padrão.',
    },
  ],
};
const RECUSA_POR_OFERTA = {
  type: 'about:blank',
  title: BLOQUEIO,
  status: 409,
  code: 'uniplus.configuracao.curso.remocao_bloqueada_por_oferta_curso',
};
const ERRO_INTERNO = {
  type: 'about:blank',
  title: 'Erro interno',
  status: 500,
  code: 'uniplus.internal.unexpected',
};

async function preencher(page: Page): Promise<void> {
  await page.locator('input[formcontrolname="codigo"]').fill('DIR');
  await page.locator('input[formcontrolname="nome"]').fill('Direito');
  await page.locator('input[formcontrolname="grau"]').fill('Bacharelado');
  await page.locator('input[formcontrolname="nivelEnsino"]').fill('Graduação');
}

const tituloDaLista = (page: Page) => page.getByRole('heading', { name: 'Cursos', level: 2 });
const formulario = (page: Page) => page.getByRole('dialog', { name: 'Formulário de curso' });
const confirmacao = (page: Page) => page.getByRole('dialog', { name: 'Remover curso' });
const editar = (page: Page) => page.getByRole('button', { name: 'Editar curso ENG_CIV' });
const remover = (page: Page) => page.getByRole('button', { name: 'Remover curso ENG_CIV' });

test.describe('Curso — escritas', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  test('envio pendente deixa o formulário só leitura, sem reenvio, e a recusa leva o foco ao campo', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(page, {
      status: 422,
      corpo: RECUSA_DO_NOME,
    });
    await iniciarCriacaoDeCurso(page, false);
    await verificarEnvioPendente(page, envios);

    liberar();
    await verificarRecusaDoNome(page);
  });

  test('Enter num campo leva o foco ao botão de salvar e, na falha 500, o envio segue disponível', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(page, { status: 500, corpo: ERRO_INTERNO });
    await abrirFormularioNovo(page);
    const nome = page.locator('input[formcontrolname="nome"]');
    await nome.focus();
    await page.keyboard.press('Enter');
    await expect(nome).toBeDisabled();
    await expect(formulario(page).getByRole('button', { name: 'Salvando...' })).toBeFocused();
    liberar();
    await verificarEnvioComErroInterno(page, envios);
  });

  test('envio barrado localmente leva o foco ao primeiro campo inválido', async ({ page }) => {
    const { envios } = await mockApi(page, { status: 201, corpo: 'novo-id' });
    await page.goto('/cursos');
    await page.locator('#cfg-cursos-novo').click();
    const drawer = formulario(page);
    await preencher(page);
    const nome = page.locator('input[formcontrolname="nome"]');
    await nome.fill('');
    await drawer.getByRole('button', { name: 'Criar curso' }).focus();
    await page.keyboard.press('Enter');

    await expect(nome).toBeFocused();
    await expect(nome).toHaveAttribute('aria-invalid', 'true');
    expect(envios).toEqual([]);
  });

  test('cadastro concluído devolve o foco ao botão que abriu o drawer, mesmo com a recarga atrasada', async ({
    page,
  }) => {
    const { liberar } = await mockApi(page, { status: 201, corpo: 'novo-id' });
    await iniciarCriacaoDeCurso(page, true);

    liberar();
    await expect(formulario(page)).toBeHidden();
    await expect(page.locator('#cfg-cursos-novo')).toBeFocused();
  });

  test('edição concluída devolve o foco ao botão de editar da linha', async ({ page }) => {
    const { liberar, envios } = await mockApi(page, { status: 204 });
    await page.goto('/cursos');
    await editar(page).click();
    const drawer = formulario(page);
    await drawer.getByRole('button', { name: 'Salvar curso' }).click();
    liberar();

    await expect(drawer).toBeHidden();
    await expect(editar(page)).toBeFocused();
    expect(envios).toEqual(['PUT']);
  });

  test('cancelar a edição devolve o foco ao botão que abriu o drawer', async ({ page }) => {
    const { envios } = await mockApi(page, { status: 204 });
    await page.goto('/cursos');
    await editar(page).click();
    const drawer = formulario(page);
    await drawer.getByRole('button', { name: 'Cancelar' }).click();

    await expect(drawer).toBeHidden();
    await expect(editar(page)).toBeFocused();
    expect(envios).toEqual([]);
  });

  test('edição concluída, com falha na recarga, leva o foco ao título da lista', async ({
    page,
  }) => {
    const { liberar } = await mockApi(page, { status: 204 }, 'com-falha');
    await page.goto('/cursos');
    await editar(page).click();
    const drawer = formulario(page);
    await drawer.getByRole('button', { name: 'Salvar curso' }).click();
    liberar();

    await expect(drawer).toBeHidden();
    await expect(tituloDaLista(page)).toBeFocused();
    await expect(page.getByRole('button', { name: 'Tentar novamente' })).toBeVisible();
  });

  test('remoção pendente mantém o diálogo, anuncia o andamento e não reenvia', async ({ page }) => {
    const { liberar, envios } = await mockApi(page, { status: 204 });
    await page.goto('/cursos');
    await remover(page).click();
    const dialogo = confirmacao(page);
    const confirmar = dialogo.getByRole('button', { name: 'Remover', exact: true });
    await confirmar.click();

    await verificarRemocaoPendente(page, envios);

    liberar();
    await expect(dialogo).toBeHidden();
  });

  test('remoção concluída, com a linha ausente da recarga, leva o foco ao título e anuncia o desfecho', async ({
    page,
  }) => {
    const { liberar } = await mockApi(page, { status: 204 }, 'sem-o-curso');
    await page.goto('/cursos');
    await remover(page).click();
    const dialogo = confirmacao(page);
    await dialogo.getByRole('button', { name: 'Remover', exact: true }).click();
    liberar();

    await expect(dialogo).toBeHidden();
    await expect(tituloDaLista(page)).toBeFocused();
    await verificarAnuncioDeRemocao(page);
  });

  test('remoção recusada por falha interna mantém o diálogo aberto e o foco dentro dele', async ({
    page,
  }) => {
    const { liberar } = await mockApi(page, { status: 500, corpo: ERRO_INTERNO });
    await page.goto('/cursos');
    await remover(page).click();
    const dialogo = confirmacao(page);
    await dialogo.getByRole('button', { name: 'Remover', exact: true }).click();
    liberar();

    await verificarFalhaRemocao(page);
  });

  test('remoção bloqueada por oferta viva abre as ofertas com o motivo e devolve o foco à lixeira', async ({
    page,
  }) => {
    const { liberar } = await mockApi(page, {
      status: 409,
      corpo: RECUSA_POR_OFERTA,
    });
    await page.goto('/cursos');
    await remover(page).click();
    const dialogo = confirmacao(page);
    await dialogo.getByRole('button', { name: 'Remover', exact: true }).click();
    liberar();

    await verificarOfertasBloqueadas(page);
  });

  test('"Tentar novamente" fica focado e indisponível durante a carga e leva o foco ao título', async ({
    page,
  }) => {
    await mockApi(page, { status: 204 }, 'com-o-curso', 'falha');
    await page.goto('/cursos');
    const tentar = page.getByRole('button', { name: 'Tentar novamente' });
    await tentar.click();

    await expect(tentar).toBeFocused();
    await expect(tentar).toHaveAttribute('aria-disabled', 'true');
    await expect(editar(page)).toBeVisible();
    await expect(tituloDaLista(page)).toBeFocused();
  });

  test('"Tentar novamente" das ofertas fica indisponível durante a carga e leva o foco ao Fechar', async ({
    page,
  }) => {
    await mockApi(page, { status: 204 });
    await mockFalhaNaPrimeiraConsultaDeOfertas(page);
    await page.goto('/cursos');
    await page.getByRole('button', { name: 'Ofertas de ENG_CIV', exact: true }).click();
    const ofertas = page.getByRole('dialog', { name: /Ofertas/ });
    const tentar = ofertas.getByRole('button', { name: 'Tentar novamente' });
    await tentar.click();

    await verificarRecargaDasOfertas(page);
  });

  test('a busca é limitada a 200 caracteres, o que a API aceita', async ({ page }) => {
    await mockApi(page, { status: 204 });
    await page.goto('/cursos');
    await expect(page.getByRole('searchbox', { name: 'Buscar curso' })).toHaveAttribute(
      'maxlength',
      '200',
    );
  });
});
