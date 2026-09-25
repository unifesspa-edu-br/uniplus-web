import { expect, test, type Page, type Route, type TestInfo } from '@playwright/test';
import { runAxeWcagAA } from '@uniplus/shared-e2e';
import type { AxeResults } from 'axe-core';
import { elementosForaDoCartao } from '../support/limites-do-cartao';
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
   * O rótulo da ação é longo para a tela estreita: ele quebra em vez de passar da borda do
   * cartão, que o `.page` corta sem rolagem. Lado a lado com o campo, os dois têm a mesma
   * altura e a mesma base.
   */
  test('mantém a ação de acrescentar fase dentro do cartão, na base do campo', async ({ page }) => {
    const medida = await medirAcaoDeAcrescentarFase(page);

    expect(medida.direitaDaAcao).toBeLessThanOrEqual(medida.direitaDoCartao + 1);
    expect(Math.abs(medida.alturaDaAcao - medida.alturaDoCampo)).toBeLessThanOrEqual(1);
    expect(
      !medida.ladoALado || medida.desalinhamentoDaBase <= 1,
      `base da ação e do campo (${medida.desalinhamentoDaBase} px)`,
    ).toBe(true);
  });

  /** A fase aberta é o trecho com mais ações, e as de rótulo longo passavam da borda. */
  test('mantém as ações da fase aberta dentro do cartão', async ({ page }) => {
    await acrescentarFase(page);
    await page.getByRole('button', { name: '1. Inscrição' }).click();
    await expect(page.getByRole('heading', { name: 'Etapas desta fase' })).toBeVisible();

    expect(await elementosForaDoCartao(page)).toEqual([]);
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

  /**
   * Os campos do documento abrem e recolhem pelo nome dele, que diz o estado; recolhidos, o
   * resumo continua dizendo o que decide a exigência.
   */
  test('abre e recolhe os campos do documento pelo nome', async ({ page }) => {
    await acrescentarFase(page);
    await page.getByRole('button', { name: '1. Inscrição' }).click();
    await exigirDocumento(page);

    const alternar = page.getByRole('button', { name: NOME_DOCUMENTO, exact: true });
    await expect(alternar).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByLabel('Entrega')).toBeVisible();

    await alternar.click();
    await expect(alternar).toHaveAttribute('aria-expanded', 'false');
    await expect(alternar).toBeFocused();
    await expect(page.getByLabel('Entrega')).toHaveCount(0);
    await expect(
      page.getByRole('row', { name: new RegExp(NOME_DOCUMENTO) }).getByText('Obrigatória'),
    ).toBeVisible();

    const transbordo = await medirTransbordoHorizontal(page);
    expect(transbordo.documento).toBeLessThanOrEqual(1);
    expect(transbordo.areaDeTrabalho).toBeLessThanOrEqual(1);
    expect(identificadoresDe(await runAxeWcagAA(page))).toEqual([]);
  });

  /**
   * Com o filtro "todo candidato" ativo, passar o documento aberto para "de quem satisfaz" o
   * tira do público filtrado; ele continua na tela, com o campo em foco.
   */
  test('mantém o documento em edição e o foco quando ele sai do público filtrado', async ({
    page,
  }) => {
    await acrescentarFase(page);
    await page.getByRole('button', { name: '1. Inscrição' }).click();
    await exigirDocumento(page);
    await page.getByLabel('Conferir os documentos de').selectOption({
      label: 'Exigidos de todo candidato',
    });

    const exigidoDe = page.getByLabel('Exigido de', { exact: true });
    await exigidoDe.focus();
    await exigidoDe.selectOption({ label: 'Só de quem satisfaz as condições declaradas' });

    await expect(exigidoDe).toBeFocused();
    await expect(page.getByRole('button', { name: NOME_DOCUMENTO, exact: true })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(identificadoresDe(await runAxeWcagAA(page))).toEqual([]);

    // Recolhido, o documento sai da lista: o foco vai ao seletor do público, visível, e a
    // contagem ligada a ele diz o que saiu.
    await page.getByRole('button', { name: NOME_DOCUMENTO, exact: true }).click();
    const filtro = page.getByLabel('Conferir os documentos de');
    await expect(filtro).toBeFocused();
    await expect(filtro).toBeInViewport();
    const aviso = `${NOME_DOCUMENTO} saiu da lista, porque não é mais do público filtrado.`;
    await expect(filtro).toHaveAccessibleDescription(new RegExp(aviso));
    await expect(page.locator('.doc-conferencia__filtro [role="status"]')).toContainText(aviso);
    await expect(page.locator('.doc-conferencia__linha')).toHaveCount(0);
  });
});

/**
 * Documentos publicados: o processo da consulta, com uma fase e dois documentos — um cobrado de
 * todo candidato e outro só de quem concorre por LB_PPI. `status: 'publicado'` põe o editor em
 * somente leitura.
 */
const PROCESSO_PUBLICADO_ID = '01960000-0000-7000-0000-000000000a01';
const FASE_PUBLICADA_ID = '01960000-0000-7000-0000-000000000a02';
const NORMA_DO_EDITAL = {
  referencia: 'Edital nº 1/2027, Anexo III',
  abrangencia: 'INTERNA_EDITAL',
  status: 'RESOLVIDO',
  observacao: null,
};

function folha(id: string, documento: Record<string, unknown>) {
  return {
    id,
    tipo: 'FOLHA',
    quantidadeMinima: null,
    consequencia: null,
    basesLegais: [],
    filhos: [],
    chaveDistincao: null,
    dataReferencia: null,
    ocorrenciasEsperadas: null,
    repetePorEntidade: null,
    documento: {
      id: `${id}-doc`,
      exigidoNaFaseId: FASE_PUBLICADA_ID,
      tipoDocumentoCategoria: 'IDENTIFICACAO',
      condicoes: [],
      basesLegais: [{ id: `${id}-norma`, ...NORMA_DO_EDITAL }],
      idadeMaximaEmissao: null,
      formatosPermitidos: ['pdf'],
      tamanhoMaximoBytes: 10485760,
      exigidoNaEtapaId: null,
      ...documento,
    },
  };
}

const DETALHE_PUBLICADO = {
  id: PROCESSO_PUBLICADO_ID,
  nome: 'Processo seletivo publicado',
  tipoProcesso: { origemId: TIPOS_PROCESSO[0].id, codigo: 'SISU', nome: 'SISU' },
  status: 'publicado',
  origemCandidatos: 'inscricaoPropria',
  unidadeAdministradora: {
    origemId: '01960000-0000-7000-0000-000000000906',
    sigla: 'CEPS',
    slug: 'ceps',
    nome: 'CEPS',
    tipo: 'PROREITORIA',
    cidadeCodigoIbge: '1504208',
    cidadeNome: 'Marabá',
    cidadeUf: 'PA',
  },
  localidade: { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' },
  etapas: [],
  ofertaAtendimento: null,
  distribuicaoVagas: [],
  bonusRegional: null,
  cascata: null,
  criteriosDesempate: [],
  classificacao: null,
  cronogramaFases: [
    {
      id: FASE_PUBLICADA_ID,
      ordem: 1,
      faseCanonicaOrigemId: FASES_CANONICAS[0].id,
      codigo: FASES_CANONICAS[0].codigo,
      donoInstitucional: 'CEPS',
      origemData: 'PROPRIA',
      agrupaEtapas: false,
      permiteComplementacao: false,
      produzResultado: false,
      coletaInscricao: true,
      coletaSolicitacaoIsencao: false,
      inicio: '2027-01-01T00:00:00Z',
      fim: '2027-01-31T23:59:59Z',
      produtos: [],
      faseConcluinteCodigo: null,
      emiteParecerIndividual: false,
      bancasRequeridas: [],
      regraRecurso: null,
    },
  ],
  documentosExigidos: [],
  raizesExigencia: [
    folha('01960000-0000-7000-0000-000000000a11', {
      tipoDocumentoOrigemId: TIPOS_DOCUMENTO[0].id,
      tipoDocumentoCodigo: TIPOS_DOCUMENTO[0].codigo,
      tipoDocumentoNome: NOME_DOCUMENTO,
      aplicabilidade: 'GERAL',
      obrigatorio: true,
      consequenciaIndeferimento: 'ELIMINA',
    }),
    folha('01960000-0000-7000-0000-000000000a12', {
      tipoDocumentoOrigemId: '01960000-0000-7000-0000-0000000000f9',
      tipoDocumentoCodigo: 'AUTODECLARACAO_PPI',
      tipoDocumentoNome: 'Autodeclaração étnico-racial',
      aplicabilidade: 'CONDICIONAL',
      obrigatorio: false,
      consequenciaIndeferimento: 'RECLASSIFICA_AC',
      condicoes: [
        {
          id: '01960000-0000-7000-0000-000000000a13',
          clausula: 1,
          fato: 'MODALIDADE',
          operador: 'EM',
          valor: '["LB_PPI"]',
        },
      ],
    }),
  ],
  referenciaTemporalFatos: null,
  fatosColetados: [],
  regrasDerivacao: [],
  formularioTitulo: null,
  formularioTermoAceiteTexto: null,
  configuracaoDivulgacao: null,
  configuracaoTaxaInscricao: null,
  algoritmoContagemPrazo: null,
  criadoEm: '2026-09-01T00:00:00Z',
};

/**
 * Conferência dos documentos de uma fase publicada (web#902): o resumo mostra todas as regras
 * com os campos recolhidos — cada documento com a quem se aplica, a entrega, a consequência e a
 * coleta, a norma comum uma vez —, o nome abre os campos desabilitados, e a lista é filtrável
 * por público.
 */
test.describe('Documentos da fase em consulta — matriz DS @ds', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await mockarCatalogos(page);
    await mockarProcessoPublicado(page);
    await instalarPreferencia(page, temaDoProject(testInfo.project.name));
    await page.goto(`/processo-seletivo/${PROCESSO_PUBLICADO_ID}`);
    await expect(page.getByText('Carregando o processo seletivo…')).toBeHidden();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    await irAoPasso(page, 'Cronograma', testInfo);
    await page.getByRole('button', { name: /Inscrição \d+ documentos/ }).click();
    await expect(
      page.getByRole('heading', { name: 'Documentos exigidos nesta fase' }),
    ).toBeVisible();
  });

  test('mostra o que decide cada exigência com os campos recolhidos', async ({ page }) => {
    const tabela = page.getByRole('table', { name: 'Documentos exigidos nesta fase' });
    const autodeclaracao = tabela.getByRole('row', { name: /Autodeclaração étnico-racial/ });

    await expect(tabela.getByRole('row', { name: new RegExp(NOME_DOCUMENTO) })).toContainText(
      'Todo candidato',
    );
    await expect(autodeclaracao).toContainText('Modalidades LB_PPI');
    await expect(autodeclaracao).toContainText('Facultativa');
    await expect(autodeclaracao).toContainText('Reclassifica para ampla concorrência');
    await expect(autodeclaracao).toContainText('Na fase inteira');
    await expect(page.getByText('Norma de todos os documentos:')).toBeVisible();
    await expect(tabela.locator('button[aria-expanded="true"]')).toHaveCount(0);
    await expect(tabela.locator('.doc-conferencia__campos')).toHaveCount(0);

    const transbordo = await medirTransbordoHorizontal(page);
    expect(transbordo.documento).toBeLessThanOrEqual(1);
    expect(transbordo.areaDeTrabalho).toBeLessThanOrEqual(1);
    expect(await blocosColados(page)).toEqual([]);
    expect(identificadoresDe(await runAxeWcagAA(page))).toEqual([]);
  });

  /**
   * O detalhe continua ao alcance em consulta: o nome abre os campos pelo teclado, e eles vêm
   * desabilitados — o processo publicado só muda por retificação.
   */
  test('abre pelo teclado os campos do documento, desabilitados', async ({ page }) => {
    const alternar = page.getByRole('button', {
      name: 'Autodeclaração étnico-racial',
      exact: true,
    });
    await expect(alternar).toHaveAttribute('aria-expanded', 'false');

    await alternar.focus();
    await page.keyboard.press('Enter');

    await expect(alternar).toHaveAttribute('aria-expanded', 'true');
    const campos = page.locator(`[id="${await alternar.getAttribute('aria-controls')}"]`);
    await expect(campos.getByLabel('Entrega')).toBeDisabled();
    await expect(campos.getByLabel('Se não for entregue')).toBeDisabled();

    const transbordo = await medirTransbordoHorizontal(page);
    expect(transbordo.documento).toBeLessThanOrEqual(1);
    expect(transbordo.areaDeTrabalho).toBeLessThanOrEqual(1);
    expect(identificadoresDe(await runAxeWcagAA(page))).toEqual([]);
  });

  /**
   * Nenhuma célula do resumo, nem cabeçalho, passa da própria caixa ou da borda da linha: a
   * tabela tem largura fixa, e o que não coubesse sairia por cima da coluna vizinha.
   */
  test('mostra o resumo inteiro em qualquer largura', async ({ page }) => {
    const problemas = await page
      .locator('.doc-conferencia tr:not(.doc-conferencia__campos)')
      .evaluateAll((linhas) =>
        linhas.flatMap((linha) => {
          const limite = linha.getBoundingClientRect();
          return Array.from(linha.querySelectorAll<HTMLElement>('th, td'))
            .filter((celula) => celula.offsetParent !== null)
            .filter(
              (celula) =>
                celula.scrollWidth > celula.clientWidth + 1 ||
                celula.getBoundingClientRect().right > limite.right + 1,
            )
            .map((celula) => celula.dataset['label'] ?? celula.textContent?.trim() ?? '');
        }),
      );

    expect(problemas).toEqual([]);
  });

  test('filtra o que cada público entrega e diz quantos sobraram', async ({ page }) => {
    await page.getByLabel('Conferir os documentos de').selectOption({
      label: 'Exigidos de todo candidato',
    });

    await expect(page.locator('.doc-conferencia__linha')).toHaveCount(1);
    await expect(page.getByText('1 de 2 documentos.')).toBeVisible();
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

/** Ação de acrescentar fase, o campo ao lado dela e a borda do conteúdo do cartão. */
async function medirAcaoDeAcrescentarFase(page: Page): Promise<{
  direitaDaAcao: number;
  direitaDoCartao: number;
  alturaDaAcao: number;
  alturaDoCampo: number;
  ladoALado: boolean;
  desalinhamentoDaBase: number;
}> {
  return page.getByRole('button', { name: 'Acrescentar à linha do tempo' }).evaluate((acao) => {
    const cartao = acao.closest('.step-card');
    const campo = document.getElementById('cr-nova-fase');
    if (!cartao || !campo) {
      throw new Error('Cartão ou campo de acrescentar fase ausente.');
    }
    const caixaDaAcao = acao.getBoundingClientRect();
    const caixaDoCampo = campo.getBoundingClientRect();
    return {
      direitaDaAcao: caixaDaAcao.right,
      direitaDoCartao:
        cartao.getBoundingClientRect().right - parseFloat(getComputedStyle(cartao).paddingRight),
      alturaDaAcao: caixaDaAcao.height,
      alturaDoCampo: caixaDoCampo.height,
      ladoALado: caixaDaAcao.top < caixaDoCampo.bottom,
      desalinhamentoDaBase: Math.abs(caixaDaAcao.bottom - caixaDoCampo.bottom),
    };
  });
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

/** O detalhe e o que mora sob o prefixo do processo publicado da consulta. */
async function mockarProcessoPublicado(page: Page): Promise<void> {
  await page.route(
    new RegExp(`/api/selecao/processos-seletivos/${PROCESSO_PUBLICADO_ID}(/.*)?(\\?.*)?$`),
    async (route: Route) => {
      if (route.request().method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers: CORS_HEADERS });
        return;
      }

      const caminho = new URL(route.request().url()).pathname;
      const corpo = caminho.endsWith(PROCESSO_PUBLICADO_ID)
        ? DETALHE_PUBLICADO
        : caminho.endsWith('/conformidade')
          ? { processoSeletivoId: PROCESSO_PUBLICADO_ID, itens: [] }
          : [];

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: CORS_HEADERS,
        body: JSON.stringify(corpo),
      });
    },
  );
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
