import { expect, test, type Page, type Route, type TestInfo } from '@playwright/test';
import { runAxeWcagAA } from '@uniplus/shared-e2e';
import type { AxeResults } from 'axe-core';

type DsTheme = 'light' | 'dark' | 'contrast';

/** Abaixo desta largura o stepper lateral dá lugar à barra com diálogo. */
const LARGURA_STEPPER_LATERAL = 768;

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': 'authorization, accept',
};

/** Uma regra mínima do `rol_de_regras`, com o par código+base legal que o seletor exibe. */
function regra(codigo: string, tipo: string, baseLegal: string) {
  return {
    codigo,
    versao: '1.0',
    tipo,
    esquemaArgs: {},
    invariantes: {},
    baseLegal,
    hash: `hash-${codigo}`,
    modalidadesAdmitidas: null,
  };
}

const REGRAS_CALCULO = [
  regra('FORMULA-MEDIA-PONDERADA', 'regra_calculo', 'Resolução CEPS 12/2026'),
  regra('CLASSIFICACAO-IMPORTADA', 'regra_calculo', 'Portaria MEC 468/2023'),
];
const REGRAS_ARREDONDAMENTO = [
  regra('ARRED-TRUNCAR', 'regra_arredondamento', 'Edital padrão PSIQ'),
];
const REGRAS_ORDEM_ALOCACAO = [regra('ALOCACAO-PRIMEIRA-OPCAO-PRIORITARIA', 'regra_ordem_alocacao', 'UNI-REQ-0045 — processamento da 1ª opção antes da 2ª')];
const REGRAS_ELIMINACAO = [
  regra('ELIM-ZERO-EM-AREA', 'regra_eliminacao', 'Resolução 805/2020, art. 5º'),
  regra('ELIM-CORTE-EM-AREA', 'regra_eliminacao', 'Resolução 805/2024, art. 6º'),
];
const REGRAS_BONUS = [
  regra(
    'BONUS-MULTIPLICATIVO',
    'regra_bonus',
    'Bônus multiplicativo aplicado à nota final após os pesos das áreas do ENEM, sem teto por padrão',
  ),
];
const BASE_LEGAL_BONUS_REGIONAL_ID = 'ba5e0000-0000-7000-8000-000000000001';
const BASES_LEGAIS_BONUS_REGIONAL = [
  {
    id: BASE_LEGAL_BONUS_REGIONAL_ID,
    tipoInstrumento: 'PORTARIA',
    identificacao: 'Portaria Unifesspa nº 2514/2023',
    descricao: 'Institui inclusão regional.',
    municipios: [{ codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' }],
    criadoEm: '2026-01-01T00:00:00Z',
  },
];
const RESOLUCAO_PESO_AREA = 'Resolução nº 805/2024/Consepe';

/** A lista canônica que o cadastro de Peso por Área publica, na ordem das colunas. */
const AREAS_ENEM = [
  { codigo: 'REDACAO', rotulo: 'Redação' },
  { codigo: 'MATEMATICA', rotulo: 'Matemática e suas Tecnologias' },
];

/** Duas linhas do cadastro de Peso por Área — a resolução escolhida e o quadro que ela carrega. */
const PESOS_AREA_ENEM = [
  { codigo: 'TECNOLOGICA', rotulo: 'Tecnológica' },
  { codigo: 'SAUDE_E_BIOLOGICAS', rotulo: 'Saúde e Biológicas' },
].map((grupoCurso, indice) => ({
  id: `0196000${indice}-0000-7000-8000-00000000pa00`,
  resolucao: RESOLUCAO_PESO_AREA,
  grupoCurso,
  areas: [
    { codigo: 'REDACAO', rotulo: 'Redação', peso: 2, corte: 400 },
    { codigo: 'MATEMATICA', rotulo: 'Matemática e suas Tecnologias', peso: 1.5, corte: null },
  ],
  baseLegal: `${RESOLUCAO_PESO_AREA} – Anexo I`,
  criadoEm: '2026-09-01T00:00:00Z',
}));

const CRITERIOS_DESEMPATE = [
  regra('DESEMPATE-MAIOR-IDADE', 'criterio_desempate', 'Costume administrativo'),
  regra('DESEMPATE-IDOSO', 'criterio_desempate', 'Lei 10.741/2003, art. 27'),
  regra('DESEMPATE-PREDICADO-FATO', 'criterio_desempate', 'Definido por cada edital'),
  regra('DESEMPATE-MAIOR-NOTA-AREA-ENEM', 'criterio_desempate', 'Definido por cada edital'),
];

/**
 * Matriz do Uni+ DS para classificação, eliminação, bônus e desempate
 * (UNI-REQ-0482). As quatro telas são seletores dirigidos por catálogo,
 * editores dinâmicos por código de regra e listas ordenáveis — a mesma
 * superfície que `configuracao-por-fase.ds-matrix.spec.ts` cobre para o
 * cronograma, e o mesmo motivo de existir: seletor em laço, campo condicional
 * e lista reordenável escondem violação de rótulo e de contraste do template
 * estático.
 *
 * O CI do frontend sobe Keycloak, mas não a API: os catálogos de regra são
 * materializados por rota, o que mantém o cenário determinístico.
 */
test.describe('Classificação, bônus e desempate — matriz DS @ds', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await mockarCatalogos(page);
    await instalarPreferencia(page, temaDoProject(testInfo.project.name));
    await page.goto('/processo-seletivo/novo');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test.describe('Fórmula e precisão', () => {
    test('não viola WCAG 2.1 AA com fórmula local declarada', async ({ page }, testInfo) => {
      await irAoPasso(page, 'Fórmula e precisão', testInfo);
      await declararFormulaLocal(page);

      const resultado = await runAxeWcagAA(page);
      expect(identificadoresDe(resultado)).toEqual([]);
    });

    test('não viola WCAG 2.1 AA sob classificação importada (sem seção de precisão)', async ({
      page,
    }, testInfo) => {
      await irAoPasso(page, 'Fórmula e precisão', testInfo);
      await page
        .getByLabel('Regra de cálculo', { exact: true })
        .selectOption('CLASSIFICACAO-IMPORTADA|1.0');

      await expect(page.getByLabel('Regra de arredondamento', { exact: true })).toBeHidden();

      const resultado = await runAxeWcagAA(page);
      expect(identificadoresDe(resultado)).toEqual([]);
    });

    test('não viola WCAG 2.1 AA com a resolução de Peso por Área e o quadro à vista', async ({
      page,
    }, testInfo) => {
      await irAoPasso(page, 'Fórmula e precisão', testInfo);
      await declararFormulaLocal(page);
      await page.getByLabel('Classificação baseada em provas').check();
      await page
        .getByLabel('Resolução de Peso por Área', { exact: true })
        .selectOption(RESOLUCAO_PESO_AREA);

      await expect(
        page.getByRole('table', { name: /Prévia do quadro da resolução/ }),
      ).toBeVisible();
      await expect(
        page.getByRole('link', { name: /Abrir o cadastro de Peso por Área/ }),
      ).toBeVisible();

      const resultado = await runAxeWcagAA(page);
      expect(identificadoresDe(resultado)).toEqual([]);
    });

    test('bloqueia o avanço sem a resolução e aponta o campo', async ({ page }, testInfo) => {
      await irAoPasso(page, 'Fórmula e precisão', testInfo);
      await declararFormulaLocal(page);
      await page.getByLabel('Classificação baseada em provas').check();

      await page.getByRole('button', { name: 'Próximo' }).click();

      const seletor = page.getByLabel('Resolução de Peso por Área', { exact: true });
      await expect(seletor).toHaveAttribute('aria-invalid', 'true');
      await expect(page.locator('.step-error')).toContainText(
        'Selecione a resolução de Peso por Área usada na nota, no passo Fórmula.',
      );
    });

    test('nomeia cada campo pelo rótulo visível', async ({ page }, testInfo) => {
      await irAoPasso(page, 'Fórmula e precisão', testInfo);
      await declararFormulaLocal(page);

      await expect(page.getByLabel('Regra de cálculo', { exact: true })).toBeVisible();
      await expect(page.getByLabel('Regra de arredondamento', { exact: true })).toBeVisible();
      await expect(page.getByLabel('Casas decimais', { exact: true })).toBeVisible();
      await expect(page.getByLabel('Ordem de alocação', { exact: true })).toBeVisible();
      await expect(page.getByLabel('Número de opções de curso', { exact: true })).toBeVisible();
    });
  });

  test.describe('Eliminação', () => {
    /** ELIM-ZERO-EM-AREA não usa argumento — a única regra que dispensa etapa persistida. */
    test('não viola WCAG 2.1 AA com uma regra de eliminação sem argumento', async ({
      page,
    }, testInfo) => {
      await irAoPasso(page, 'Fórmula e precisão', testInfo);
      await declararFormulaLocal(page);
      await page.getByLabel('Classificação baseada em provas').check();

      await irAoPasso(page, 'Eliminação', testInfo);
      await page.getByRole('button', { name: '+ Acrescentar regra de eliminação' }).click();
      await page
        .getByLabel('Regra de eliminação', { exact: true })
        .selectOption('ELIM-ZERO-EM-AREA|1.0');

      const resultado = await runAxeWcagAA(page);
      expect(identificadoresDe(resultado)).toEqual([]);
    });

    test('corte por área: oferece as áreas do quadro, sugere o corte e não viola WCAG 2.1 AA', async ({
      page,
    }, testInfo) => {
      await irAoPasso(page, 'Fórmula e precisão', testInfo);
      await declararFormulaLocal(page);
      await page.getByLabel('Classificação baseada em provas').check();
      await page
        .getByLabel('Resolução de Peso por Área', { exact: true })
        .selectOption(RESOLUCAO_PESO_AREA);

      await irAoPasso(page, 'Eliminação', testInfo);
      await page.getByRole('button', { name: '+ Acrescentar regra de eliminação' }).click();
      await page
        .getByLabel('Regra de eliminação', { exact: true })
        .selectOption('ELIM-CORTE-EM-AREA|1.0');
      await page.getByLabel('Área do ENEM', { exact: true }).selectOption('REDACAO');

      const minimo = page.getByLabel('Nota mínima em Redação', { exact: true });
      await expect(minimo).toHaveValue('400');
      await expect(page.getByText(/dá o corte 400 para esta área/)).toBeVisible();

      const resultado = await runAxeWcagAA(page);
      expect(identificadoresDe(resultado)).toEqual([]);
    });

    test('avisa quando nenhuma etapa do cronograma compõe a nota', async ({ page }, testInfo) => {
      await irAoPasso(page, 'Fórmula e precisão', testInfo);
      await declararFormulaLocal(page);

      await irAoPasso(page, 'Eliminação', testInfo);

      await expect(page.getByRole('alert').filter({ hasText: 'Nenhuma etapa' })).toBeVisible();
    });
  });

  test.describe('Bônus', () => {
    test('não viola WCAG 2.1 AA com bônus declarado', async ({ page }, testInfo) => {
      await irAoPasso(page, 'Bônus', testInfo);
      await page
        .getByLabel('Aplicar bônus regional neste processo seletivo?', { exact: true })
        .check();
      await page
        .getByLabel('Regra do bônus', { exact: true })
        .selectOption('BONUS-MULTIPLICATIVO|1.0');
      await page.getByLabel('Fator', { exact: true }).fill('1.2');
      await page
        .getByLabel('Base Legal do bônus', { exact: true })
        .selectOption(BASE_LEGAL_BONUS_REGIONAL_ID);

      const resultado = await runAxeWcagAA(page);
      expect(identificadoresDe(resultado)).toEqual([]);
    });

    test('não viola WCAG 2.1 AA com a conferência acusando', async ({ page }, testInfo) => {
      await irAoPasso(page, 'Bônus', testInfo);
      await page
        .getByLabel('Aplicar bônus regional neste processo seletivo?', { exact: true })
        .check();
      await page.getByLabel('Fator', { exact: true }).fill('0');

      const resultado = await runAxeWcagAA(page);
      expect(identificadoresDe(resultado)).toEqual([]);
    });
  });

  test.describe('Desempate', () => {
    test('não viola WCAG 2.1 AA com três variantes de critério na lista', async ({
      page,
    }, testInfo) => {
      await irAoPasso(page, 'Desempate', testInfo);

      // "Regra do critério" se repete uma vez por linha da lista — o mesmo
      // rótulo em cada ocorrência é o comportamento correto de acessibilidade
      // para campos repetidos, e o `.nth()` aqui seleciona a N-ésima linha,
      // não desambigua conceitos diferentes que colidiram por acidente.
      const regraDoCriterio = page.getByLabel('Regra do critério', { exact: true });

      await page.getByRole('button', { name: '+ Acrescentar critério' }).click();
      await regraDoCriterio.nth(0).selectOption('DESEMPATE-MAIOR-IDADE|1.0');

      await page.getByRole('button', { name: '+ Acrescentar critério' }).click();
      await regraDoCriterio.nth(1).selectOption('DESEMPATE-IDOSO|1.0');
      await page.getByLabel('Idade mínima', { exact: true }).fill('60');

      await page.getByRole('button', { name: '+ Acrescentar critério' }).click();
      await regraDoCriterio.nth(2).selectOption('DESEMPATE-PREDICADO-FATO|1.0');
      // Fato, comparação e valor vêm do catálogo institucional: os três são vocabulário
      // fechado do servidor, e antes eram campos de texto que aceitavam "lte" para ser
      // recusado no 422.
      await page.getByLabel('Fato do candidato', { exact: true }).selectOption('RENDA_PER_CAPITA');
      await page.getByLabel('Comparação', { exact: true }).selectOption('MENOR_IGUAL');
      await page.getByLabel('Valor', { exact: true }).fill('1');

      const resultado = await runAxeWcagAA(page);
      expect(identificadoresDe(resultado)).toEqual([]);
    });

    test('reordena por teclado — mover para cima fica indisponível no topo', async ({
      page,
    }, testInfo) => {
      await irAoPasso(page, 'Desempate', testInfo);

      await page.getByRole('button', { name: '+ Acrescentar critério' }).click();
      // O rótulo diz QUAL critério move: numa lista de sete, sete botões "Mover para cima"
      // idênticos não dizem ao leitor de tela o que cada um opera.
      await expect(
        page.getByRole('button', { name: 'Mover o critério 1 para cima' }),
      ).toBeDisabled();
    });
  });

  test('não transborda horizontalmente na Eliminação', async ({ page }, testInfo) => {
    await irAoPasso(page, 'Eliminação', testInfo);

    const medida = await page.evaluate(() => {
      const documento = document.documentElement;
      const scroller = document.querySelector('.wiz-content');
      return {
        documento: documento.scrollWidth - documento.clientWidth,
        scroller: scroller instanceof HTMLElement ? scroller.scrollWidth - scroller.clientWidth : 0,
      };
    });

    expect(medida.documento).toBeLessThanOrEqual(1);
    expect(medida.scroller).toBeLessThanOrEqual(1);
  });
});

const PROCESSO_PUBLICADO_ID = '01960000-0000-7000-0000-000000000898';

/** A referência congelada de uma regra do catálogo, como o detalhe do processo a devolve. */
function referencia(codigo: string) {
  return { codigo, versao: '1.0', hash: `hash-${codigo}` };
}

/**
 * Um processo publicado com as quatro seções declaradas — o que a consulta precisa mostrar
 * marcado. `status: 'publicado'` é o que põe o editor em somente leitura.
 */
const DETALHE_PUBLICADO = {
  id: PROCESSO_PUBLICADO_ID,
  nome: 'Processo seletivo publicado',
  tipoProcesso: {
    origemId: '01960000-0000-7000-0000-000000000905',
    codigo: 'GRAD',
    nome: 'Graduação',
  },
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
  bonusRegional: {
    id: '01960000-0000-7000-0000-0000000008b1',
    regra: referencia('BONUS-MULTIPLICATIVO'),
    fator: 1.2,
    teto: null,
    baseLegalBonusRegionalId: BASE_LEGAL_BONUS_REGIONAL_ID,
    tipoInstrumento: 'PORTARIA',
    identificacao: 'Portaria Unifesspa nº 2514/2023',
    descricao: 'Institui inclusão regional.',
    municipios: [{ codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' }],
  },
  cascata: null,
  criteriosDesempate: [
    {
      id: '01960000-0000-7000-0000-0000000008d1',
      ordem: 1,
      regra: referencia('DESEMPATE-MAIOR-IDADE'),
      etapaRef: null,
      idadeMinima: null,
      fato: null,
      operador: null,
      valor: null,
      areas: null,
    },
  ],
  classificacao: {
    id: '01960000-0000-7000-0000-0000000008c1',
    regraCalculo: referencia('FORMULA-MEDIA-PONDERADA'),
    regraArredondamento: referencia('ARRED-TRUNCAR'),
    casasArredondamento: 2,
    regraOrdemAlocacao: referencia('ALOCACAO-PRIMEIRA-OPCAO-PRIORITARIA'),
    nOpcoesAlocacao: 1,
    regrasEliminacao: [
      {
        id: '01960000-0000-7000-0000-0000000008e1',
        regra: referencia('ELIM-ZERO-EM-AREA'),
        etapaRef: null,
        notaMinima: null,
        minimo: null,
        areaCodigo: null,
      },
    ],
    concorrenciaDuplaAplicavel: false,
    baseadoEmEnem: false,
    resolucaoPesoAreaEnem: null,
    quadroPesoAreaEnem: [],
  },
  cronogramaFases: [],
  documentosExigidos: [],
  raizesExigencia: [],
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

/** As regras que cada passo da consulta tem de mostrar marcadas. */
const REGRAS_MARCADAS: Record<string, Record<string, string>> = {
  'Fórmula e precisão': {
    'Regra de cálculo': 'FORMULA-MEDIA-PONDERADA|1.0',
    'Regra de arredondamento': 'ARRED-TRUNCAR|1.0',
    'Ordem de alocação': 'ALOCACAO-PRIMEIRA-OPCAO-PRIORITARIA|1.0',
  },
  Bônus: {
    'Regra do bônus': 'BONUS-MULTIPLICATIVO|1.0',
    'Base Legal do bônus': BASE_LEGAL_BONUS_REGIONAL_ID,
  },
  Desempate: { 'Regra do critério': 'DESEMPATE-MAIOR-IDADE|1.0' },
  'Eliminação': { 'Regra de eliminação': 'ELIM-ZERO-EM-AREA|1.0' },
};

/** As larguras de referência em que a consulta não pode ter rolagem horizontal. */
const LARGURAS_DE_REFERENCIA = [1440, 768, 375, 320] as const;

/**
 * Consulta de um processo publicado (web#898): a regra gravada aparece marcada mesmo com o
 * catálogo chegando depois do detalhe, e nenhum controle dos passos 6 a 9 aceita edição.
 */
test.describe('Classificação, bônus e desempate em consulta — matriz DS @ds', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await mockarCatalogos(page);
    await mockarProcessoPublicado(page);
    await instalarPreferencia(page, temaDoProject(testInfo.project.name));
    await page.goto(`/processo-seletivo/${PROCESSO_PUBLICADO_ID}`);
    // Enquanto o processo carrega, o stepper ignora o clique: a troca de passo espera a leitura.
    await expect(page.getByText('Carregando o processo seletivo…')).toBeHidden();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  for (const [passo, regras] of Object.entries(REGRAS_MARCADAS)) {
    test(`${passo}: mostra a regra gravada, não aceita edição e não transborda`, async ({
      page,
    }, testInfo) => {
      await irAoPasso(page, passo, testInfo);
      await expect(page.getByRole('heading', { level: 1 })).toContainText(passo);

      for (const [rotulo, valor] of Object.entries(regras)) {
        const seletor = page.getByLabel(rotulo, { exact: true }).first();
        await expect(seletor).toHaveValue(valor);
        await expect(seletor).toBeDisabled();
      }
      expect(await controlesEditaveisVisiveis(page)).toEqual([]);

      const resultado = await runAxeWcagAA(page);
      expect(identificadoresDe(resultado)).toEqual([]);

      const larguraDoProject = testInfo.project.use.viewport;
      for (const largura of LARGURAS_DE_REFERENCIA) {
        await page.setViewportSize({ width: largura, height: larguraDoProject?.height ?? 900 });
        expect(await transbordo(page), `transbordo em ${largura} px`).toEqual({
          documento: 0,
          conteudo: 0,
        });
      }
    });
  }
});

const PROCESSO_DESEMPATE_POR_AREA_ID = '01960000-0000-7000-0000-000000000900';

/**
 * O mesmo processo publicado, classificado pelo ENEM com o quadro de Peso por Área congelado e
 * um critério de desempate pela ordem das áreas: é o cartão que quebrava no celular.
 */
const DETALHE_DESEMPATE_POR_AREA = {
  ...DETALHE_PUBLICADO,
  id: PROCESSO_DESEMPATE_POR_AREA_ID,
  criteriosDesempate: [
    {
      ...DETALHE_PUBLICADO.criteriosDesempate[0],
      regra: referencia('DESEMPATE-MAIOR-NOTA-AREA-ENEM'),
      areas: AREAS_ENEM.map((area) => area.codigo),
    },
  ],
  classificacao: {
    ...DETALHE_PUBLICADO.classificacao,
    baseadoEmEnem: true,
    resolucaoPesoAreaEnem: RESOLUCAO_PESO_AREA,
    quadroPesoAreaEnem: PESOS_AREA_ENEM.map((linha) => ({
      grupoAreaEnem: linha.grupoCurso,
      baseLegal: linha.baseLegal,
      areas: linha.areas,
    })),
  },
};

/** A partir desta largura, o seletor mostra o código da regra inteiro. */
const LARGURA_CODIGO_INTEIRO = 768;

/** Com a lista até esta largura (40rem), o cartão do critério empilha número, campos e ações. */
const LARGURA_LISTA_EMPILHADA = 640;

/**
 * Cartão do critério de desempate por área em consulta (web#900): o nome da área não quebra
 * letra a letra, o seletor da regra tem a largura da lista de áreas, e no celular os campos
 * descem para a largura inteira do cartão.
 */
test.describe('Desempate por área em consulta — matriz DS @ds', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await mockarCatalogos(page);
    await mockarProcesso(page, PROCESSO_DESEMPATE_POR_AREA_ID, DETALHE_DESEMPATE_POR_AREA);
    await instalarPreferencia(page, temaDoProject(testInfo.project.name));
    await page.goto(`/processo-seletivo/${PROCESSO_DESEMPATE_POR_AREA_ID}`);
    await expect(page.getByText('Carregando o processo seletivo…')).toBeHidden();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('o cartão do critério cabe em cada largura sem quebrar as áreas', async ({
    page,
  }, testInfo) => {
    await irAoPasso(page, 'Desempate', testInfo);
    await expect(page.locator('.desempate-area__nome').first()).toBeVisible();

    const resultado = await runAxeWcagAA(page);
    expect(identificadoresDe(resultado)).toEqual([]);

    for (const largura of LARGURAS_DE_REFERENCIA) {
      await page.setViewportSize({ width: largura, height: alturaDoProject(testInfo) });
      await esperarLayoutEstavel(page);
      const cartao = await medidasDoCartao(page);
      const empilhado = cartao.larguraDaListaDeCriterios <= LARGURA_LISTA_EMPILHADA;

      expect(await transbordo(page), `transbordo em ${largura} px`).toEqual({
        documento: 0,
        conteudo: 0,
      });
      // Uma letra por linha: a palavra se partia em várias linhas do nome.
      expect(cartao.palavrasPartidas, `nome da área em ${largura} px`).toEqual([]);
      expect(cartao.larguraDoSeletor, `seletor e áreas em ${largura} px`).toBeGreaterThanOrEqual(
        cartao.larguraDaLista - 1,
      );
      // Um <select> não quebra linha: no celular o código não cabe e o seletor ocupa a largura
      // toda; a partir de 768 px o código tem de aparecer inteiro.
      expect(
        cartao.codigoCabeNoSeletor || largura < LARGURA_CODIGO_INTEIRO,
        `código da regra inteiro em ${largura} px`,
      ).toBe(true);
      expect(cartao.camposAbaixoDoNumero, `campos empilhados em ${largura} px`).toBe(empilhado);
      // Lado a lado, número, campos e ações começam no topo do cartão, não no meio dele.
      expect(
        empilhado || cartao.desalinhamentoNoTopo <= 1,
        `número, campos e ações no topo em ${largura} px (${cartao.desalinhamentoNoTopo} px)`,
      ).toBe(true);
    }
  });
});

/** Espera dois quadros de animação, para medir depois que a troca de largura se assentou. */
async function esperarLayoutEstavel(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolver) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolver())),
      ),
  );
}

/** A altura da viewport do project, mantida quando o teste troca só a largura. */
function alturaDoProject(testInfo: TestInfo): number {
  return testInfo.project.use.viewport?.height ?? 900;
}

/** As medidas do primeiro cartão de critério que os critérios de aceite comparam. */
async function medidasDoCartao(page: Page): Promise<{
  palavrasPartidas: string[];
  larguraDoSeletor: number;
  larguraDaLista: number;
  larguraDaListaDeCriterios: number;
  codigoCabeNoSeletor: boolean;
  camposAbaixoDoNumero: boolean;
  desalinhamentoNoTopo: number;
}> {
  return page.evaluate(() => {
    const cartao = document.querySelector('.desempate-item');
    const largura = (seletor: string) =>
      cartao?.querySelector(seletor)?.getBoundingClientRect().width ?? 0;
    const nomes = Array.from(cartao?.querySelectorAll('.desempate-area__nome') ?? []);
    // Uma palavra que ocupa mais de uma linha tem mais de um retângulo de linha.
    const palavrasPartidas = nomes.flatMap((nome) => {
      const texto = nome.firstChild;
      if (!(texto instanceof Text)) return [];
      return Array.from(texto.data.matchAll(/\S+/g)).flatMap((palavra) => {
        const trecho = document.createRange();
        trecho.setStart(texto, palavra.index);
        trecho.setEnd(texto, palavra.index + palavra[0].length);
        const linhas = new Set(Array.from(trecho.getClientRects(), (r) => Math.round(r.top)));
        return linhas.size > 1 ? [palavra[0]] : [];
      });
    });
    const numero = cartao?.querySelector('.desempate-num')?.getBoundingClientRect();
    // A maior distância entre os topos de número, campos e ações.
    const desalinhamento = (caixas: (DOMRect | undefined)[]) => {
      const topos = caixas.filter((caixa) => caixa !== undefined).map((caixa) => caixa.top);
      return topos.length === 0 ? Infinity : Math.max(...topos) - Math.min(...topos);
    };
    // O código da regra escolhida, medido na fonte do seletor, tem de caber no espaço de texto dele.
    const seletor = cartao?.querySelector('select');
    const escolhida = seletor?.selectedOptions[0]?.textContent?.split('—')[0]?.trim() ?? '';
    const contexto = document.createElement('canvas').getContext('2d');
    let codigoCabeNoSeletor = false;
    if (seletor && contexto) {
      const estilo = getComputedStyle(seletor);
      contexto.font = `${estilo.fontWeight} ${estilo.fontSize} ${estilo.fontFamily}`;
      const espacoDeTexto =
        seletor.clientWidth - parseFloat(estilo.paddingLeft) - parseFloat(estilo.paddingRight);
      codigoCabeNoSeletor = contexto.measureText(escolhida).width <= espacoDeTexto;
    }
    const campos = cartao?.querySelector('.desempate-item__campos')?.getBoundingClientRect();
    return {
      palavrasPartidas,
      larguraDoSeletor: largura('select'),
      larguraDaLista: largura('.desempate-areas'),
      larguraDaListaDeCriterios:
        document.querySelector('.desempate-list')?.getBoundingClientRect().width ?? 0,
      codigoCabeNoSeletor,
      desalinhamentoNoTopo: desalinhamento([
        numero,
        campos,
        cartao?.querySelector(':scope > .desempate-actions')?.getBoundingClientRect(),
      ]),
      camposAbaixoDoNumero: !!numero && !!campos && campos.top >= numero.bottom,
    };
  });
}

/** O processo publicado da consulta dos passos 6 a 9. */
async function mockarProcessoPublicado(page: Page): Promise<void> {
  await mockarProcesso(page, PROCESSO_PUBLICADO_ID, DETALHE_PUBLICADO);
}

/** O detalhe, os documentos e o checklist de um processo, todos sob o mesmo prefixo. */
async function mockarProcesso(page: Page, id: string, detalhe: unknown): Promise<void> {
  await page.route(
    new RegExp(`/api/selecao/processos-seletivos/${id}(/.*)?(\\?.*)?$`),
    async (route: Route) => {
      if (route.request().method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers: CORS_HEADERS });
        return;
      }

      const caminho = new URL(route.request().url()).pathname;
      const corpo = caminho.endsWith(id)
        ? detalhe
        : caminho.endsWith('/conformidade')
          ? { processoSeletivoId: id, itens: [] }
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

/** Controles de formulário do passo aberto que ainda aceitam interação. */
async function controlesEditaveisVisiveis(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    Array.from(
      document.querySelectorAll<HTMLInputElement>(
        '.wiz-content select, .wiz-content input, .wiz-content textarea, .wiz-content button',
      ),
    )
      .filter((controle) => controle.offsetParent !== null && !controle.disabled)
      .map((controle) => controle.id || controle.textContent?.trim() || controle.tagName),
  );
}

/** Quanto a página e o conteúdo do passo passam da largura visível. */
async function transbordo(page: Page): Promise<{ documento: number; conteudo: number }> {
  return page.evaluate(() => {
    const documento = document.documentElement;
    const conteudo = document.querySelector('.wiz-content');
    return {
      documento: Math.max(0, documento.scrollWidth - documento.clientWidth),
      conteudo:
        conteudo instanceof HTMLElement
          ? Math.max(0, conteudo.scrollWidth - conteudo.clientWidth)
          : 0,
    };
  });
}

/** Fórmula local completa — regra de cálculo, arredondamento, casas e ordem de alocação. */
async function declararFormulaLocal(page: Page): Promise<void> {
  await page
    .getByLabel('Regra de cálculo', { exact: true })
    .selectOption('FORMULA-MEDIA-PONDERADA|1.0');
  await page
    .getByLabel('Regra de arredondamento', { exact: true })
    .selectOption('ARRED-TRUNCAR|1.0');
  await page.getByLabel('Casas decimais', { exact: true }).fill('2');
  await page
    .getByLabel('Ordem de alocação', { exact: true })
    .selectOption('ALOCACAO-PRIMEIRA-OPCAO-PRIORITARIA|1.0');
  await page.getByLabel('Número de opções de curso', { exact: true }).selectOption('2');
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
 * O vocabulário fechado de fatos do candidato, como o catálogo institucional o publica. O
 * critério de desempate por predicado cita um destes — e só estes, porque o comando resolve o
 * vocabulário sem os fatos de domínio dinâmico.
 */
const FATOS_CANDIDATO = [
  {
    id: '01960000-0000-7000-0000-0000000000f1',
    codigo: 'RENDA_PER_CAPITA',
    nome: 'Renda familiar per capita',
    descricao: null,
    dominio: 'NUMERICO',
    origem: 'DERIVADO',
    cardinalidade: 'ESCALAR',
    valoresDominio: null,
    pontoResolucao: 'INSCRICAO',
    binding: 'ATRIBUTO_CANDIDATO:RENDA_PER_CAPITA',
    valoresDominioDeclarados: null,
  },
  {
    id: '01960000-0000-7000-0000-0000000000f2',
    codigo: 'COR_RACA',
    nome: 'Cor ou raça',
    descricao: null,
    dominio: 'CATEGORICO',
    origem: 'DECLARADO',
    cardinalidade: 'ESCALAR',
    valoresDominio: ['BRANCA', 'PRETA', 'PARDA', 'INDIGENA', 'AMARELA'],
    pontoResolucao: 'INSCRICAO',
    binding: 'CAMPO_INSCRICAO:COR_RACA',
    valoresDominioDeclarados: null,
  },
];

/** Os catálogos de regra que as quatro telas consultam, todos do mesmo `rol_de_regras`. */
async function mockarCatalogos(page: Page): Promise<void> {
  await page.route(/\/api\/selecao\/regras-catalogo(\?.*)?$/, async (route: Route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }

    const url = new URL(route.request().url());
    const tipo = url.searchParams.get('tipo');
    const porTipo: Record<string, readonly unknown[]> = {
      regra_calculo: REGRAS_CALCULO,
      regra_arredondamento: REGRAS_ARREDONDAMENTO,
      regra_ordem_alocacao: REGRAS_ORDEM_ALOCACAO,
      regra_eliminacao: REGRAS_ELIMINACAO,
      regra_bonus: REGRAS_BONUS,
      criterio_desempate: CRITERIOS_DESEMPATE,
    };

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: CORS_HEADERS,
      body: JSON.stringify(porTipo[tipo ?? ''] ?? []),
    });
  });

  // O vocabulário de fatos que o critério de desempate por predicado pode citar.
  await page.route(/\/api\/configuracao\/fatos-candidato(\?.*)?$/, async (route: Route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: CORS_HEADERS,
      body: JSON.stringify(FATOS_CANDIDATO),
    });
  });

  // A lista canônica das áreas, que ordena as colunas do quadro. Rota própria: a do cadastro,
  // abaixo, termina no recurso e não casa com `/areas`.
  await page.route(/\/api\/configuracao\/pesos-area-enem\/areas(\?.*)?$/, async (route: Route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: CORS_HEADERS,
      body: JSON.stringify(AREAS_ENEM),
    });
  });

  // O cadastro de Peso por Área, de onde o passo da fórmula tira a resolução e o quadro.
  await page.route(/\/api\/configuracao\/pesos-area-enem(\?.*)?$/, async (route: Route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: CORS_HEADERS,
      body: JSON.stringify(PESOS_AREA_ENEM),
    });
  });

  await page.route(
    /\/api\/configuracao\/base-legal-bonus-regional(\?.*)?$/,
    async (route: Route) => {
      if (route.request().method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers: CORS_HEADERS });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: CORS_HEADERS,
        body: JSON.stringify(BASES_LEGAIS_BONUS_REGIONAL),
      });
    },
  );
}
