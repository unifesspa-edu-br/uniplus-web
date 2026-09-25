import { expect, test, type Page, type Route, type TestInfo } from '@playwright/test';
import { runAxeWcagAA } from '@uniplus/shared-e2e';
import type { AxeResults } from 'axe-core';
import { blocosColados } from '../support/ritmo-vertical';
import { medirTransbordoHorizontal } from '../support/rolagem-do-editor';

type DsTheme = 'light' | 'dark' | 'contrast';

/** Abaixo desta largura o stepper lateral dá lugar à barra com diálogo. */
const LARGURA_STEPPER_LATERAL = 768;

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': 'authorization, accept',
};

const TIPOS_PROCESSO = [
  {
    id: '01960000-0000-7000-0000-000000000515',
    codigo: 'SISU',
    nome: 'SISU',
    descricao: 'Seleção unificada pelo ENEM.',
    ativo: true,
    criadoEm: '2026-08-11T00:00:00Z',
  },
] as const;

const FASES_CANONICAS = [
  {
    id: '01960000-0000-7000-0000-0000000000c1',
    codigo: 'COLETA_INSCRICAO',
    nome: 'Inscrição',
    descricao: null,
    donoTipico: 'CEPS',
    agrupaEtapas: false,
    permiteComplementacao: false,
    baseLegal: null,
    coletaInscricao: true,
    origemData: 'PROPRIA',
    criadoEm: '2026-08-30T12:00:00Z',
  },
] as const;

/**
 * Um documento de nome longo, com descrição: é o caso que espremia o título do card ao lado
 * da ação de remover numa tela estreita.
 */
const NOME_DOCUMENTO = 'Requerimento de inclusão do nome social no registro acadêmico';
const TIPOS_DOCUMENTO = [
  {
    id: '01960000-0000-7000-0000-0000000000f1',
    codigo: 'REQUERIMENTO_NOME_SOCIAL',
    nome: NOME_DOCUMENTO,
    descricao: 'Pedido de uso do nome social nos documentos emitidos pela universidade.',
    categoria: 'IDENTIFICACAO',
    formatosAceitos: 'pdf',
    tamanhoMaximoMb: 10,
    tipoEquivalente: null,
    criadoEm: '2026-08-30T12:00:00Z',
  },
] as const;

/** O catálogo não tem `nome` nem `descricao` — só `codigo` e `baseLegal` são legíveis. */
const REGRAS_CONTAGEM = [
  {
    codigo: 'CONTAGEM-PRAZO-EXCLUI-DIA-INICIAL',
    versao: 'v1',
    tipo: 'algoritmo_contagem_prazo',
    esquemaArgs: {},
    invariantes: ['o dia da âncora não conta'],
    baseLegal: 'Lei 9.784/1999, art. 66',
    hash: 'xyz',
    modalidadesAdmitidas: null,
  },
] as const;

/**
 * A opção traz só o que identifica a convenção. A base legal saiu do rótulo porque as três
 * convenções de contagem do catálogo têm a MESMA, e repeti-la em cada linha empurrava o
 * código para fora da largura do campo; ela aparece uma vez, abaixo, junto do que a
 * convenção escolhida faz.
 */
const ROTULO_CONVENCAO = 'CONTAGEM-PRAZO-EXCLUI-DIA-INICIAL (v1)';

/**
 * Matriz do Uni+ DS para o passo Cronograma, com foco no seletor da convenção
 * de contagem de prazo (#480): a única superfície nova do passo.
 *
 * O axe roda com a convenção ausente — o estado padrão de um rascunho — e com
 * ela declarada, porque CA-05 promete que nenhuma opção vem pré-selecionada e
 * isso não pode se confirmar só no estado cheio.
 *
 * O CI do frontend sobe Keycloak, mas não a API: os catálogos que a tela
 * consulta são materializados por rota, o que mantém o cenário determinístico.
 */
test.describe('Cronograma — matriz DS @ds', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await mockarCatalogos(page);
    await instalarPreferencia(page, temaDoProject(testInfo.project.name));
    await page.goto('/processo-seletivo/novo');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    await irAoPasso(page, 'Cronograma', testInfo);
    await expect(page.getByLabel('Fase do catálogo')).toBeVisible();
  });

  /**
   * A asserção é sobre a coleção inteira. `impact` é severidade do axe, não
   * nível de conformidade: filtrar por ele deixaria passar violação de WCAG
   * 2.1 AA classificada como moderada, num teste que promete o contrário.
   */
  test('não viola WCAG 2.1 AA sem convenção de contagem declarada', async ({ page }) => {
    await acrescentarFase(page);

    const resultado = await runAxeWcagAA(page);

    expect(identificadoresDe(resultado)).toEqual([]);
  });

  test('não viola WCAG 2.1 AA com a convenção de contagem declarada', async ({ page }) => {
    await acrescentarFase(page);
    await declararConvencaoDeContagem(page);

    const resultado = await runAxeWcagAA(page);

    expect(identificadoresDe(resultado)).toEqual([]);
  });

  /** CA-05: ausência é estado válido enquanto rascunho — nenhum default. */
  test('não pré-seleciona nenhuma convenção de contagem', async ({ page }) => {
    await acrescentarFase(page);

    await expect(page.getByLabel('Convenção de contagem')).toHaveValue('');
  });

  /**
   * Nome acessível do seletor pelo rótulo visível (SC 2.5.3), e o texto que o
   * catálogo entrega — código e base legal, nunca um rótulo inventado.
   */
  test('nomeia o seletor pelo rótulo visível e identifica a convenção pelo código', async ({
    page,
  }) => {
    await acrescentarFase(page);

    await expect(page.getByLabel('Convenção de contagem')).toBeVisible();
    await expect(page.locator('#cr-algoritmo-contagem')).toContainText(ROTULO_CONVENCAO);
  });

  /**
   * O que separa uma convenção da outra são os invariantes que o catálogo publica, e é
   * depois da escolha que eles importam — descrevem a convenção escolhida, não as
   * disponíveis.
   */
  test('descreve a convenção escolhida com o que o catálogo publica', async ({ page }) => {
    await acrescentarFase(page);
    await declararConvencaoDeContagem(page);

    await expect(page.getByText('O que esta convenção faz')).toBeVisible();
    await expect(page.getByText('o dia da âncora não conta')).toBeVisible();
  });

  test('não transborda horizontalmente', async ({ page }) => {
    await acrescentarFase(page);

    const transbordo = await medirTransbordoHorizontal(page);
    expect(transbordo.documento).toBeLessThanOrEqual(1);
    expect(transbordo.areaDeTrabalho).toBeLessThanOrEqual(1);
  });

  /**
   * Título de seção, alerta e dica têm margem do ritmo vertical do passo: nenhum encosta
   * no bloco vizinho. A fase aberta é o trecho que mais empilha esses três.
   */
  test('separa título, alerta e dica do bloco vizinho', async ({ page }) => {
    await acrescentarFase(page);
    await page.getByRole('button', { name: '1. Inscrição' }).click();
    await expect(page.getByRole('heading', { name: 'Etapas desta fase' })).toBeVisible();

    expect(await blocosColados(page)).toEqual([]);
  });

  /**
   * O card do documento exigido numa tela estreita: o nome não pode ficar embaixo da ação
   * de remover, nada passa da borda do card, e o aviso de norma ausente só aparece sem norma.
   */
  test('mostra o documento exigido inteiro no card', async ({ page }, testInfo) => {
    await acrescentarFase(page);
    await page.getByRole('button', { name: '1. Inscrição' }).click();
    await exigirDocumento(page);

    const card = page.locator('.doc-item--exigido').first();
    await expect(card.getByText(NOME_DOCUMENTO)).toBeVisible();

    const medida = await card.evaluate((elemento) => {
      const caixa = (seletor: string) => elemento.querySelector(seletor)?.getBoundingClientRect();
      const nome = caixa('.doc-item__name');
      const linha = caixa('.doc-item__row');
      const remover = caixa('.doc-item__row > .btn');
      const limite = elemento.getBoundingClientRect().right;
      const transbordam = Array.from(elemento.querySelectorAll<HTMLElement>('*'))
        .filter((filho) => filho.offsetParent !== null)
        .filter((filho) => filho.getBoundingClientRect().right > limite + 1)
        .map((filho) => filho.className || filho.tagName);
      const sobrepoe =
        nome !== undefined &&
        remover !== undefined &&
        nome.left < remover.right &&
        remover.left < nome.right &&
        nome.top < remover.bottom &&
        remover.top < nome.bottom;
      return {
        sobrepoe,
        transbordam,
        larguraDoNome: nome?.width ?? 0,
        larguraDaLinha: linha?.width ?? 0,
      };
    });

    expect(medida.sobrepoe, 'o nome não fica sob a ação de remover').toBe(false);
    expect(medida.transbordam, 'nada passa da borda do card').toEqual([]);
    expect(medida.larguraDoNome, 'o nome não é espremido ao lado da ação').toBeGreaterThanOrEqual(
      medida.larguraDaLinha / 2,
    );

    const acrescentar = await page
      .getByRole('button', { name: 'Acrescentar documento' })
      .evaluate((botao) => {
        const secao = botao.closest('.escolher-e-acrescentar') as HTMLElement;
        return botao.getBoundingClientRect().right - secao.getBoundingClientRect().right;
      });
    expect(acrescentar, '"Acrescentar documento" não passa da borda').toBeLessThanOrEqual(1);
    const transbordo = await medirTransbordoHorizontal(page);
    expect(transbordo.documento).toBeLessThanOrEqual(1);
    expect(transbordo.areaDeTrabalho).toBeLessThanOrEqual(1);

    const tamanhos = await card.evaluate((elemento) => {
      const tamanho = (seletor: string) =>
        parseFloat(getComputedStyle(elemento.querySelector(seletor) as Element).fontSize);
      return { nome: tamanho('.doc-item__name'), rotulo: tamanho('.label') };
    });
    expect(tamanhos.nome, 'o nome do documento encabeça os rótulos dos campos').toBeGreaterThan(
      tamanhos.rotulo,
    );

    /*
     * Em 1440 px a grade dos eixos tem três colunas estreitas, e a observação divide a linha
     * com o alcance e a identificação da norma: um rótulo que quebra em duas linhas desce o
     * input em relação aos vizinhos. O viewport desktop da matriz (1366 px) tem duas colunas
     * largas, onde o rótulo cabe em qualquer caso.
     */
    if (testInfo.project.metadata['viewport'] === 'desktop') {
      const original = page.viewportSize();
      await page.setViewportSize({ width: 1440, height: 900 });
      const alinhamento = await card.evaluate((elemento) => {
        const topoDoInput = (campo: Element) =>
          campo.querySelector('input, select, textarea')?.getBoundingClientRect().top ?? null;
        const campo = elemento
          .querySelector('[id^="fase-doc-obs-legal-"]')
          ?.closest('.form-field') as Element;
        const linha = campo.getBoundingClientRect().top;
        const referencia = topoDoInput(campo) ?? 0;
        const vizinhos = Array.from(elemento.querySelectorAll('.doc-item__eixos > .form-field'))
          .filter((outro) => outro !== campo)
          .filter((outro) => Math.abs(outro.getBoundingClientRect().top - linha) <= 1)
          .map(topoDoInput)
          .filter((topo): topo is number => topo !== null);
        return { vizinhos: vizinhos.length, diferencas: vizinhos.map((topo) => topo - referencia) };
      });
      if (original) await page.setViewportSize(original);

      expect(alinhamento.vizinhos, 'a observação divide a linha com outros campos').toBeGreaterThan(
        0,
      );
      for (const diferenca of alinhamento.diferencas) {
        expect(
          Math.abs(diferenca),
          'o input da observação alinha com os vizinhos',
        ).toBeLessThanOrEqual(1);
      }
    }

    // O aviso segue a regra da publicação: alguma norma declarada E resolvida.
    const aviso = card.getByText('Sem uma norma declarada e identificada como "Resolvida"');
    const normas = card.getByLabel('Norma que exige o documento');
    const identificacoes = card.getByLabel('Identificação da norma');
    await expect(aviso).toBeVisible();
    await normas.first().fill('Lei 12.711/2012, art. 3º');
    await expect(aviso).toHaveCount(0);

    await identificacoes.first().selectOption({ label: 'Pendente' });
    await expect(aviso, 'a norma pendente não sustenta a exigência').toBeVisible();
    expect(await blocosColados(page)).toEqual([]);

    await card.getByRole('button', { name: 'Acrescentar outra norma' }).click();
    await identificacoes.first().selectOption({ label: 'Resolvida' });
    await expect(normas).toHaveCount(2);
    await expect(aviso, 'a outra norma, resolvida, já sustenta a exigência').toHaveCount(0);

    expect(identificadoresDe(await runAxeWcagAA(page))).toEqual([]);
  });
});

/** Acrescenta a única fase do catálogo à linha do tempo. */
async function acrescentarFase(page: Page): Promise<void> {
  await page.getByLabel('Fase do catálogo').selectOption({ label: 'Inscrição' });
  await page.getByRole('button', { name: 'Acrescentar à linha do tempo' }).click();
}

/** Escolhe no seletor da fase aberta o único documento do catálogo e o exige. */
async function exigirDocumento(page: Page): Promise<void> {
  const campo = page.getByLabel('Documento a exigir');
  await campo.fill('nome social');
  await page.getByRole('option', { name: NOME_DOCUMENTO }).click();
  await page.getByRole('button', { name: 'Acrescentar documento' }).click();
}

/** Declara a única convenção de contagem que o catálogo do cenário oferece. */
async function declararConvencaoDeContagem(page: Page): Promise<void> {
  await page.getByLabel('Convenção de contagem').selectOption({ label: ROTULO_CONVENCAO });
}

/**
 * Abaixo de 768 px o stepper lateral dá lugar à barra de etapas com diálogo, e
 * o caminho até um passo muda com ele.
 */
async function irAoPasso(page: Page, rotulo: string, testInfo: TestInfo): Promise<void> {
  const largura = testInfo.project.use.viewport?.width;
  if (largura === undefined) {
    throw new Error(`Project ${testInfo.project.name} não declara viewport.`);
  }

  if (largura >= LARGURA_STEPPER_LATERAL) {
    await page.getByRole('button', { name: rotulo }).click();
    return;
  }

  await page.getByRole('button', { name: 'Abrir lista de etapas' }).click();
  const dialogo = page.getByRole('dialog', { name: 'Etapas do cadastro' });
  await expect(dialogo).toBeVisible();
  await dialogo.getByRole('button', { name: rotulo }).click();
  await expect(dialogo).toBeHidden();
}

/** Falhar por id diz qual regra caiu; a coleção crua não. */
function identificadoresDe(resultado: AxeResults): string[] {
  return resultado.violations.map((violacao) => violacao.id);
}

async function instalarPreferencia(page: Page, theme: DsTheme): Promise<void> {
  await page.addInitScript((dsTheme) => {
    window.localStorage.setItem(
      'uniplus.a11y',
      JSON.stringify({
        theme: dsTheme === 'contrast' ? 'auto' : dsTheme,
        contrast: dsTheme === 'contrast',
        fontMode: 'default',
      }),
    );
  }, theme);
}

function temaDoProject(projectName: string): DsTheme {
  const parte = projectName.split('-').at(-1);
  return parte === 'dark' || parte === 'contrast' ? parte : 'light';
}

/**
 * Os catálogos que a linha do tempo e o seletor de convenção consultam. Vazio
 * onde a tela não precisa da lista, com conteúdo onde ela é o que se exercita.
 *
 * `regras-catalogo` é filtrado por `tipo`: só `algoritmo_contagem_prazo`
 * devolve conteúdo — é a única dimensão que este passo exercita aqui, e
 * devolver a mesma lista para qualquer tipo mascararia um filtro quebrado.
 */
async function mockarCatalogos(page: Page): Promise<void> {
  await responderCatalogo(page, /\/api\/configuracao\/tipos-processo(\?.*)?$/, TIPOS_PROCESSO);
  await responderCatalogo(page, /\/api\/configuracao\/fases-canonicas(\?.*)?$/, FASES_CANONICAS);
  await responderCatalogo(page, /\/api\/configuracao\/precedencias-fase(\?.*)?$/, []);
  await responderCatalogo(page, /\/api\/configuracao\/tipos-banca(\?.*)?$/, []);
  await responderCatalogo(page, /\/api\/configuracao\/categorias-documento(\?.*)?$/, []);
  await responderCatalogo(page, /\/api\/configuracao\/tipos-documento(\?.*)?$/, TIPOS_DOCUMENTO);
  await responderCatalogo(page, /\/api\/configuracao\/tipos-etapa(\?.*)?$/, []);
  await responderCatalogo(page, /\/api\/publicacoes\/tipos-ato(\?.*)?$/, []);
  await mockarRegrasCatalogo(page);
}

async function mockarRegrasCatalogo(page: Page): Promise<void> {
  await page.route(/\/api\/selecao\/regras-catalogo(\?.*)?$/, async (route: Route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }

    const tipo = new URL(request.url()).searchParams.get('tipo');
    const itens = tipo === 'algoritmo_contagem_prazo' ? REGRAS_CONTAGEM : [];

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: CORS_HEADERS,
      body: JSON.stringify(itens),
    });
  });
}

async function responderCatalogo(
  page: Page,
  rota: RegExp,
  itens: readonly unknown[],
): Promise<void> {
  await page.route(rota, async (route: Route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: CORS_HEADERS,
      body: JSON.stringify(itens),
    });
  });
}
