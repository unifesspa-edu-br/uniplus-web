import { expect, test, type Page, type Route } from '@playwright/test';
import { responder } from '../support/responder';
import { mockPermissoesEfetivas } from '@uniplus/shared-e2e';
import { PERMISSOES_DO_LEANDRO } from '../support/permissoes';

test.beforeEach(async ({ page }) => {
  await mockPermissoesEfetivas(page, PERMISSOES_DO_LEANDRO);
});

/**
 * O que a reformulação do eixo fase → etapa habilita, exercitado de ponta a ponta na
 * tela: qualquer fase se subdivide em etapas, e cada etapa declara o que publica e que
 * recursos admite.
 *
 * O CI do frontend sobe Keycloak, mas não a API: os catálogos são materializados por
 * rota, e o `PUT /etapas` é interceptado para conferir o comando que a tela monta — que
 * é o contrato de verdade entre as duas pontas.
 */

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, PUT, POST, OPTIONS',
  'access-control-allow-headers': 'authorization, accept, content-type, idempotency-key, if-match',
};

const TIPOS_PROCESSO = [
  {
    id: '01960000-0000-7000-0000-000000000515',
    codigo: 'SISU',
    nome: 'SISU',
    descricao: null,
    ativo: true,
    criadoEm: '2026-08-11T00:00:00Z',
  },
] as const;

/** Habilitação: uma fase que o cadastro NÃO marca como agrupadora de etapas. */
const FASES_CANONICAS = [
  {
    id: '01960000-0000-7000-0000-0000000000d1',
    codigo: 'HABILITACAO',
    nome: 'Habilitação',
    descricao: null,
    donoTipico: 'CRCA',
    agrupaEtapas: false,
    permiteComplementacao: false,
    baseLegal: null,
    coletaInscricao: false,
    origemData: 'PROPRIA',
    criadoEm: '2026-08-30T12:00:00Z',
  },
] as const;

const TIPOS_ETAPA = [
  {
    id: '01960000-0000-7000-0000-0000000000e1',
    codigo: 'ANALISE_DOCUMENTAL',
    nome: 'Análise Documental',
    descricao: null,
    ativo: true,
    admitePontuacao: false,
    admiteEliminacao: true,
  },
  {
    id: '01960000-0000-7000-0000-0000000000e2',
    codigo: 'PROVA_OBJETIVA',
    nome: 'Prova Objetiva',
    descricao: null,
    ativo: true,
    admitePontuacao: true,
    admiteEliminacao: true,
  },
] as const;

const TIPOS_ATO = [
  {
    id: '01960000-0000-7000-0000-0000000000a1',
    codigo: 'RESULTADO_PRELIMINAR',
    nome: 'Resultado preliminar',
    congelaConfiguracao: false,
    unicoPorObjeto: false,
    efeitoIrreversivel: false,
    ehResultado: true,
    vigenciaInicio: '2020-01-01',
    vigenciaFim: null,
    baseLegal: null,
  },
  {
    id: '01960000-0000-7000-0000-0000000000a2',
    codigo: 'RESULTADO_FINAL',
    nome: 'Resultado final',
    congelaConfiguracao: false,
    unicoPorObjeto: false,
    efeitoIrreversivel: false,
    ehResultado: true,
    vigenciaInicio: '2020-01-01',
    vigenciaFim: null,
    baseLegal: null,
  },
] as const;

const TIPOS_BANCA = [
  {
    id: '01960000-0000-7000-0000-0000000000a9',
    codigo: 'ANALISE_DOCUMENTAL',
    nome: 'Banca de análise documental',
    faseTipica: 'HABILITACAO',
    descricao: null,
    criadoEm: '2026-08-30T12:00:00Z',
  },
] as const;

const CATEGORIAS_DOCUMENTO = [
  {
    id: '01960000-0000-7000-0000-0000000000c1',
    codigo: 'RENDA',
    nome: 'Comprovação de renda',
    descricao: null,
    ativo: true,
  },
] as const;

const TIPOS_DOCUMENTO = [
  {
    id: '01960000-0000-7000-0000-0000000000b1',
    codigo: 'CONTRACHEQUE',
    nome: 'Contracheque',
    descricao: null,
    categoria: 'RENDA',
    tipoEquivalente: null,
    ativo: true,
    formatosAceitos: null,
    criadoEm: '2026-08-30T12:00:00Z',
  },
] as const;

const REGRAS_RECURSO = [
  {
    codigo: 'RECURSO-PRAZO-ANCORADO-EM-ATO',
    versao: 'v1',
    tipo: 'regra_prazo_recurso',
    esquemaArgs: {},
    invariantes: {},
    baseLegal: 'Lei 9.784/1999, art. 59',
    hash: 'abc',
    modalidadesAdmitidas: null,
  },
] as const;

const REGRAS_CONSOLIDACAO = [
  {
    codigo: 'CONSOLIDACAO-AVALIACAO-UNICA',
    versao: 'v1',
    tipo: 'regra_consolidacao',
    esquemaArgs: {},
    invariantes: ['um só avaliador lança a nota de cada candidato na etapa'],
    baseLegal: 'Decisão institucional da Unifesspa',
    hash: 'u1',
    modalidadesAdmitidas: null,
  },
  {
    codigo: 'CONSOLIDACAO-CORRECAO-INDEPENDENTE',
    versao: 'v1',
    tipo: 'regra_consolidacao',
    esquemaArgs: {},
    invariantes: ['mais de um avaliador corrige cada candidato sem conhecer a nota do outro'],
    baseLegal: 'Decisão institucional da Unifesspa',
    hash: 'c1',
    modalidadesAdmitidas: null,
  },
] as const;

test.describe('Etapa da fase — o que ela publica e que recurso admite', () => {
  test.beforeEach(async ({ page }) => {
    await mockarCatalogos(page);
    await page.goto('/processo-seletivo/novo');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.getByRole('button', { name: 'Cronograma' }).first().click();
    await expect(page.getByLabel('Fase do catálogo')).toBeVisible();

    await page.getByLabel('Fase do catálogo').selectOption({ label: 'Habilitação' });
    await page.getByRole('button', { name: 'Acrescentar à linha do tempo' }).click();

    // A fase entra fechada — a linha do tempo mostra os cabeçalhos, e configurar é abrir.
    await page.locator('.fase-alternar').first().click();
  });

  /**
   * Antes do vínculo, só a fase que o cadastro marcava como agrupadora recebia etapa —
   * e a habilitação com oito etapas, que todas as planilhas do CEPS descrevem, não tinha
   * onde existir.
   */
  test('fase não agrupadora recebe etapa', async ({ page }) => {
    await acrescentarEtapa(page);

    await expect(page.getByLabel('Nome', { exact: true }).last()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'O que esta etapa publica' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Quem julga esta etapa' })).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Recursos que esta etapa admite' }),
    ).toBeVisible();
  });

  /**
   * Peso só aparece quando a etapa pode compor a nota final, e quem diz isso é o tipo, no
   * cadastro: uma análise documental confere conformidade e não atribui nota que entre na média.
   * Antes disso a tela pedia peso em toda etapa, inclusive nas que o cálculo ignora.
   */
  test('tipo que não compõe a nota final não oferece caráter que pontua, nem peso', async ({
    page,
  }) => {
    await acrescentarEtapa(page);
    const etapa = page.locator('.etapa-bloco--aberta').last();

    await etapa.getByLabel('Tipo').selectOption({ label: 'Análise Documental' });

    const carater = etapa.getByLabel('Caráter');
    await expect(carater.getByRole('option', { name: 'Eliminatória' })).toHaveCount(1);
    await expect(carater.getByRole('option', { name: 'Classificatória', exact: true })).toHaveCount(
      0,
    );
    await expect(
      carater.getByRole('option', { name: 'Classificatória e eliminatória' }),
    ).toHaveCount(0);

    await carater.selectOption({ label: 'Eliminatória' });
    await expect(etapa.getByLabel('Peso')).toHaveCount(0);
    await expect(etapa.getByLabel('Nota mínima')).toBeVisible();
  });

  /** Trocar para um tipo que pontua devolve as três escolhas, e o peso volta a fazer sentido. */
  test('tipo que compõe a nota final oferece os três caracteres', async ({ page }) => {
    await acrescentarEtapa(page);
    const etapa = page.locator('.etapa-bloco--aberta').last();

    await etapa.getByLabel('Tipo').selectOption({ label: 'Prova Objetiva' });

    const carater = etapa.getByLabel('Caráter');
    await expect(carater.getByRole('option'), 'as três escolhas mais "Selecione…"').toHaveCount(4);

    await carater.selectOption({ label: 'Classificatória' });
    await expect(etapa.getByLabel('Peso')).toBeVisible();
  });

  /**
   * A nota máxima é a escala da etapa com nota lançada: aparece junto do peso ou da nota
   * mínima, e some quando a etapa não tem nota (apto/inapto).
   */
  test('pede a nota máxima só da etapa que tem nota', async ({ page }) => {
    await acrescentarEtapa(page);
    const etapa = page.locator('.etapa-bloco--aberta').last();

    await etapa.getByLabel('Tipo').selectOption({ label: 'Prova Objetiva' });
    await expect(etapa.getByLabel('Nota máxima')).toHaveCount(0);

    await etapa.getByLabel('Caráter').selectOption({ label: 'Classificatória' });
    await expect(etapa.getByLabel('Nota máxima')).toBeVisible();

    await etapa.getByLabel('Nota máxima').fill('10');
    await etapa.getByLabel('Caráter').selectOption({ label: 'Eliminatória' });
    await expect(etapa.getByLabel('Nota máxima')).toHaveValue('10');
  });

  /**
   * A forma de avaliação diz como a nota é obtida: a humana pede a regra que consolida as
   * notas dos avaliadores, que o catálogo da API publica, e o passo do lançamento. A objetiva
   * não tem nenhum dos dois.
   */
  test('a avaliação humana pede a regra de consolidação e o passo', async ({ page }) => {
    await acrescentarEtapa(page);
    const etapa = page.locator('.etapa-bloco--aberta').last();

    await etapa.getByLabel('Tipo').selectOption({ label: 'Prova Objetiva' });
    await expect(etapa.getByRole('group', { name: 'Forma de avaliação' })).toHaveCount(0);

    await etapa.getByLabel('Caráter').selectOption({ label: 'Classificatória' });
    const forma = etapa.getByRole('group', { name: 'Forma de avaliação' });
    await expect(forma.getByRole('radio')).toHaveCount(2);
    await expect(etapa.getByRole('group', { name: 'Regra de consolidação das notas' })).toHaveCount(
      0,
    );
    await expect(etapa.getByLabel('Passo do lançamento')).toHaveCount(0);

    await forma.getByText('Humana — banca').click();
    const regra = etapa.getByRole('group', { name: 'Regra de consolidação das notas' });
    await expect(regra.getByRole('radio')).toHaveCount(2);
    await expect(regra).toContainText('mais de um avaliador corrige cada candidato');
    await regra.getByText(/CONSOLIDACAO-CORRECAO-INDEPENDENTE/).click();
    await etapa.getByLabel('Nota máxima').fill('10');
    await etapa.getByLabel('Passo do lançamento').fill('0,25');

    await expect(regra.getByRole('radio', { name: /CORRECAO-INDEPENDENTE/ })).toBeChecked();
    await expect(etapa.getByLabel('Passo do lançamento')).toHaveValue('0,25');

    await forma.getByText('Objetiva — gabarito ou leitora').click();
    await expect(etapa.getByRole('group', { name: 'Regra de consolidação das notas' })).toHaveCount(
      0,
    );
    await expect(etapa.getByLabel('Passo do lançamento')).toHaveCount(0);

    await forma.getByText('Humana — banca').click();
    await expect(etapa.getByLabel('Passo do lançamento')).toHaveValue('');
    await expect(
      etapa
        .getByRole('group', { name: 'Regra de consolidação das notas' })
        .getByRole('radio', { checked: true }),
    ).toHaveCount(0);
  });

  /**
   * Os itens dividem a nota da etapa em critérios; a soma é conferida contra a nota máxima. A
   * escala de atendimento só existe na avaliação humana e com itens, e com ela o passo do
   * lançamento deixa de existir — a banca escolhe o nível, não digita a nota.
   */
  test('a avaliação humana cadastra itens e a escala de atendimento', async ({ page }) => {
    await acrescentarEtapa(page);
    const etapa = page.locator('.etapa-bloco--aberta').last();

    await etapa.getByLabel('Tipo').selectOption({ label: 'Prova Objetiva' });
    await etapa.getByLabel('Caráter').selectOption({ label: 'Classificatória' });
    await etapa.getByLabel('Nota máxima').fill('10');

    const itens = etapa.getByRole('group', { name: 'Itens de avaliação', exact: true });
    await itens.getByRole('button', { name: 'Acrescentar item' }).click();
    const primeiro = itens.getByRole('group', { name: 'Item 1' });
    await expect(primeiro.getByLabel('Rótulo')).toBeFocused();
    await primeiro.getByLabel('Rótulo').fill('Clareza');
    await primeiro.getByLabel('Pontuação máxima').fill('4');

    await expect(itens.getByText('Soma dos itens: 4 de 10')).toBeVisible();
    await expect(itens.getByText(/precisa ser igual à nota máxima/)).toBeVisible();

    await itens.getByRole('button', { name: 'Acrescentar item' }).click();
    const segundo = itens.getByRole('group', { name: 'Item 2' });
    await segundo.getByLabel('Rótulo').fill('Método');
    await segundo.getByLabel('Pontuação máxima').fill('6');

    await expect(itens.getByText('Soma dos itens: 10 de 10')).toBeVisible();
    await expect(itens.getByText(/precisa ser igual à nota máxima/)).toHaveCount(0);
    await expect(itens.getByRole('button', { name: 'Remover o item Método' })).toBeVisible();

    await expect(etapa.getByRole('group', { name: 'Escala de atendimento' })).toHaveCount(0);

    await etapa
      .getByRole('group', { name: 'Forma de avaliação' })
      .getByText('Humana — banca')
      .click();
    await etapa.getByLabel('Passo do lançamento').fill('0,5');
    const escala = etapa.getByRole('group', { name: 'Escala de atendimento', exact: true });
    await escala.getByRole('button', { name: 'Usar a escala sugerida' }).click();

    await expect(escala.getByRole('group', { name: 'Nível 1' }).getByLabel('Rótulo')).toHaveValue(
      'Atendeu',
    );
    await expect(
      escala.getByRole('group', { name: 'Nível 2' }).getByLabel('Percentual da pontuação'),
    ).toHaveValue('50');
    await expect(
      escala.getByRole('group', { name: 'Nível 3' }).getByLabel('Percentual da pontuação'),
    ).toHaveValue('0');
    await expect(etapa.getByLabel('Passo do lançamento')).toHaveCount(0);

    await itens.getByRole('button', { name: 'Remover o item Método' }).click();
    await itens.getByRole('button', { name: 'Remover o item Clareza' }).click();
    await expect(etapa.getByRole('group', { name: 'Escala de atendimento' })).toHaveCount(0);
    await expect(etapa.getByLabel('Passo do lançamento')).toBeVisible();
  });

  /** Só ato que o catálogo marca como resultado recebe papel no ciclo recursal. */
  test('a etapa declara o que publica, com papel', async ({ page }) => {
    await acrescentarEtapa(page);

    await abrirBloco(page, 'O que esta etapa publica');
    const bloco = blocoDaEtapa(page, 'O que esta etapa publica');
    await bloco.getByRole('button', { name: 'Acrescentar publicação' }).click();
    await bloco.getByLabel('Ato').selectOption('RESULTADO_PRELIMINAR');
    await bloco.getByLabel('Papel').selectOption('PRELIMINAR');

    await expect(bloco.getByLabel('Ato')).toHaveValue('RESULTADO_PRELIMINAR');
    await expect(bloco.getByLabel('Papel')).toHaveValue('PRELIMINAR');
  });

  /**
   * O caso que uma regra por fase tornava inexprimível: a mesma etapa abre duas janelas,
   * com prazos e relógios distintos — uma contra o que ela publica, outra contra a
   * decisão individual que alcança cada candidato.
   */
  test('a etapa abre duas janelas recursais com prazos distintos', async ({ page }) => {
    await acrescentarEtapa(page);

    // Duas publicações preliminares: é contra cada uma que uma janela corre.
    await abrirBloco(page, 'O que esta etapa publica');
    const publica = blocoDaEtapa(page, 'O que esta etapa publica');
    await publica.getByRole('button', { name: 'Acrescentar publicação' }).click();
    await publica.getByLabel('Ato').nth(0).selectOption('RESULTADO_PRELIMINAR');
    await publica.getByLabel('Papel').nth(0).selectOption('PRELIMINAR');
    await publica.getByRole('button', { name: 'Acrescentar publicação' }).click();
    await publica.getByLabel('Ato').nth(1).selectOption('RESULTADO_FINAL');
    await publica.getByLabel('Papel').nth(1).selectOption('PRELIMINAR');

    await abrirBloco(page, 'Recursos que esta etapa admite');
    const recursos = blocoDaEtapa(page, 'Recursos que esta etapa admite');
    await recursos.getByRole('button', { name: 'Acrescentar recurso' }).click();
    await recursos.getByLabel('Prazo', { exact: true }).nth(0).fill('24');
    await recursos.getByLabel('Unidade', { exact: true }).nth(0).selectOption('horas');

    await recursos.getByRole('button', { name: 'Acrescentar recurso' }).click();
    await recursos.getByLabel('Contra qual publicação').nth(1).selectOption('RESULTADO_FINAL');
    await recursos.getByLabel('Prazo', { exact: true }).nth(1).fill('2');
    await recursos.getByLabel('Unidade', { exact: true }).nth(1).selectOption('diasUteis');

    await expect(recursos.getByLabel('Prazo', { exact: true }).nth(0)).toHaveValue('24');
    await expect(recursos.getByLabel('Unidade', { exact: true }).nth(0)).toHaveValue('horas');
    await expect(recursos.getByLabel('Contra qual publicação').nth(0)).toHaveValue(
      'RESULTADO_PRELIMINAR',
    );
    await expect(recursos.getByLabel('Prazo', { exact: true }).nth(1)).toHaveValue('2');
    await expect(recursos.getByLabel('Unidade', { exact: true }).nth(1)).toHaveValue('diasUteis');
    await expect(recursos.getByLabel('Contra qual publicação').nth(1)).toHaveValue(
      'RESULTADO_FINAL',
    );
  });

  /**
   * O efeito suspensivo da janela da etapa. O servidor guarda os quatro valores em colunas
   * próprias e os devolve na leitura, mas a tela não tinha onde declará-los e o comando saía
   * com os quatro em branco: bastava mexer numa data do cronograma para o que estivesse
   * gravado desaparecer. A fase sempre teve estes campos — a etapa recorre nas mesmas
   * condições. Os dois da 2ª instância só existem quando a janela admite instância superior.
   */
  test('a janela da etapa declara por quanto tempo suspende o efeito do ato', async ({ page }) => {
    await acrescentarEtapa(page);

    await abrirBloco(page, 'Recursos que esta etapa admite');
    const recursos = blocoDaEtapa(page, 'Recursos que esta etapa admite');
    await recursos.getByRole('button', { name: 'Acrescentar recurso' }).click();

    await recursos.getByLabel('Suspensividade da 1ª instância — prazo').fill('3');
    await recursos.getByLabel('Suspensividade da 1ª instância — unidade').selectOption('diasUteis');
    // A 2ª instância só tem suspensividade quando a janela admite instância superior.
    const prazoDaSegunda = recursos.getByLabel('Suspensividade da 2ª instância — prazo');
    await expect(prazoDaSegunda).toHaveCount(0);
    const instanciaSuperior = recursos.getByRole('group', {
      name: 'Admite recurso em instância superior?',
    });
    await instanciaSuperior.getByText('Sim', { exact: true }).click();
    await expect(instanciaSuperior.getByRole('radio', { name: 'Sim', exact: true })).toBeChecked();
    await prazoDaSegunda.fill('48');
    await recursos.getByLabel('Suspensividade da 2ª instância — unidade').selectOption('horas');

    await expect(recursos.getByLabel('Suspensividade da 1ª instância — prazo')).toHaveValue('3');
    await expect(recursos.getByLabel('Suspensividade da 1ª instância — unidade')).toHaveValue(
      'diasUteis',
    );
    await expect(recursos.getByLabel('Suspensividade da 2ª instância — prazo')).toHaveValue('48');
    await expect(recursos.getByLabel('Suspensividade da 2ª instância — unidade')).toHaveValue(
      'horas',
    );
  });

  /** Instância sem os dois campos é desativação declarada, e a tela nomeia isso. */
  test('a janela da etapa admite instância sem suspensividade', async ({ page }) => {
    await acrescentarEtapa(page);

    await abrirBloco(page, 'Recursos que esta etapa admite');
    const recursos = blocoDaEtapa(page, 'Recursos que esta etapa admite');
    await recursos.getByRole('button', { name: 'Acrescentar recurso' }).click();

    await expect(recursos.getByLabel('Suspensividade da 1ª instância — unidade')).toHaveValue('');
    await expect(
      recursos.getByLabel('Suspensividade da 1ª instância — unidade').getByRole('option', {
        name: 'Sem suspensividade',
      }),
    ).toHaveCount(1);
  });

  /**
   * A habilitação do certame regional tem oito etapas e cada uma pede o seu comprovante.
   * Sem dizer qual delas coleta, os oito documentos apareceriam nas oito.
   *
   * A etapa ainda não gravada aparece sem poder ser escolhida: a exigência a referencia
   * pelo identificador que o servidor atribui, e ele só existe depois da gravação. O
   * rótulo diz isso em vez de deixar a opção falhar em silêncio.
   */
  test('o documento aponta a etapa da fase que o coleta', async ({ page }) => {
    await acrescentarEtapa(page);
    await page.getByLabel('Nome', { exact: true }).last().fill('Envio dos comprovantes de renda');

    await escolherDocumento(page, 'Contracheque');
    await page.getByRole('button', { name: 'Acrescentar documento' }).click();

    const coletadoEm = page.getByLabel('Coletado em');
    await expect(coletadoEm).toHaveValue('');
    await expect(coletadoEm).toContainText('Envio dos comprovantes de renda');
    await expect(coletadoEm).toContainText('grave o passo para poder escolher');
  });

  /**
   * A escolha da banca precisa de um indicador desenhado. O controle nativo fica
   * escondido — é a caixa que mostra o estado —, e sem ela o operador clicava, o valor
   * mudava por baixo e a tela não respondia nada.
   */
  test('a banca traz a caixa que mostra a escolha', async ({ page }) => {
    await acrescentarEtapa(page);

    const bloco = blocoDaEtapa(page, 'Quem julga esta etapa');
    const banca = bloco.getByText('Banca de análise documental');
    await expect(banca).toBeVisible();

    await expect(bloco.locator('.checkbox__box')).toHaveCount(1);
    await expect(bloco.locator('.checkbox__box')).toBeVisible();

    await banca.click();

    await expect(bloco.locator('input[type="checkbox"]')).toBeChecked();
  });

  /** A fase que não se subdivide não tem onde coletar senão ela própria. */
  test('fase sem etapa não oferece onde coletar', async ({ page }) => {
    await escolherDocumento(page, 'Contracheque');
    await page.getByRole('button', { name: 'Acrescentar documento' }).click();

    // Escopado ao item: a conferência do passo também nomeia o documento, ao cobrar a norma.
    await expect(page.locator('.doc-item__name').filter({ hasText: 'Contracheque' })).toBeVisible();
    await expect(page.getByLabel('Coletado em')).toHaveCount(0);
  });

  /** A ciência não tem publicação a apontar: o campo do ato sai junto com ela. */
  test('recurso por ciência individual não pede publicação-âncora', async ({ page }) => {
    await acrescentarEtapa(page);
    await abrirBloco(page, 'Recursos que esta etapa admite');
    const recursos = blocoDaEtapa(page, 'Recursos que esta etapa admite');
    await recursos.getByRole('button', { name: 'Acrescentar recurso' }).click();

    await expect(recursos.getByLabel('Contra qual publicação')).toBeVisible();

    await recursos.getByLabel('O prazo corre de').selectOption('cienciaIndividual');

    await expect(recursos.getByLabel('Contra qual publicação')).toHaveCount(0);
  });
});

/**
 * Abre um dos blocos que a etapa traz recolhidos — as janelas recursais e as publicações
 * crescem com o que se declara nelas, e chegam contadas no cabeçalho.
 */
async function abrirBloco(page: Page, titulo: string): Promise<void> {
  await page.locator('.etapa-publica__cabecalho', { hasText: titulo }).first().click();
}

/**
 * Escolhe um documento no campo de busca: digitar filtra a lista, e a opção é escolhida com
 * o teclado — é o caminho de quem usa a tela, e o controle não é um `select` nativo.
 */
async function escolherDocumento(page: Page, nome: string): Promise<void> {
  await page.getByLabel('Documento a exigir').fill(nome);
  await page.getByRole('option', { name: nome, exact: true }).click();
}

/**
 * Acrescenta uma etapa à fase aberta e a expande — ela entra fechada, resumida numa linha,
 * porque aberta passa de mil pixels e oito delas enterravam o passo em rolagem.
 */
async function acrescentarEtapa(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Acrescentar etapa nesta fase' }).click();
  await page.locator('.etapa-resumo').last().click();
}

/**
 * O bloco da ETAPA, não o da fase: a configuração da fase vive na mesma tela e tem campos
 * de rótulo idêntico — `Ato`, `Papel` —, então o escopo é o que separa os dois.
 */
function blocoDaEtapa(page: Page, titulo: string) {
  return page.locator('.etapa-publica').filter({ hasText: titulo }).first();
}

async function mockarCatalogos(page: Page): Promise<void> {
  await responder(page, /\/api\/configuracao\/tipos-processo(\?.*)?$/, TIPOS_PROCESSO, CORS);
  await responder(page, /\/api\/configuracao\/fases-canonicas(\?.*)?$/, FASES_CANONICAS, CORS);
  await responder(page, /\/api\/configuracao\/precedencias-fase(\?.*)?$/, [], CORS);
  await responder(page, /\/api\/configuracao\/tipos-banca(\?.*)?$/, TIPOS_BANCA, CORS);
  await responder(
    page,
    /\/api\/configuracao\/categorias-documento(\?.*)?$/,
    CATEGORIAS_DOCUMENTO,
    CORS,
  );
  await responder(page, /\/api\/configuracao\/tipos-etapa(\?.*)?$/, TIPOS_ETAPA, CORS);
  await responder(page, /\/api\/configuracao\/tipos-documento(\?.*)?$/, TIPOS_DOCUMENTO, CORS);
  await responder(page, /\/api\/configuracao\/fatos-candidato(\?.*)?$/, [], CORS);
  await responder(page, /\/api\/publicacoes\/tipos-ato(\?.*)?$/, TIPOS_ATO, CORS);

  await page.route(/\/api\/selecao\/regras-catalogo(\?.*)?$/, async (route: Route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS });
      return;
    }

    const tipo = new URL(route.request().url()).searchParams.get('tipo');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: CORS,
      body: JSON.stringify(regrasDoTipo(tipo)),
    });
  });
}

function regrasDoTipo(tipo: string | null): readonly unknown[] {
  if (tipo === 'regra_prazo_recurso') return REGRAS_RECURSO;
  if (tipo === 'regra_consolidacao') return REGRAS_CONSOLIDACAO;
  return [];
}
