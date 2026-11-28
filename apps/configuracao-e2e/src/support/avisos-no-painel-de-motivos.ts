import { expect, type Locator, type Page, type TestInfo } from '@playwright/test';
import { mockPermissoesEfetivas } from '@uniplus/shared-e2e';
import {
  problema,
  responder,
  responderPreflight,
  servirLeitura,
  type Resposta,
} from './escritas-retidas';
import { TODAS_AS_PERMISSOES_DA_CONFIGURACAO } from './permissoes';
import { mockConfiguracaoRuntimeConfig } from './runtime-config';
import { mockarVocabularioDeTiposDeDecisao } from './api-do-vocabulario-de-tipos-de-decisao';
import { metadataTheme, type VisualTheme } from './visual-das-unidades';

/** Apoio do spec de geometria dos avisos que aparecem acima do formulário do painel de motivos. */

const PERMISSAO_DE_MANTER_MOTIVOS = 'selecao:motivos-de-decisao:manter';

/** A API não respondeu de forma conclusiva: a tela mostra o erro e o aviso de envio sem confirmação. */
export const ENVIO_SEM_CONFIRMACAO: Resposta = {
  status: 503,
  corpo: problema(503, 'uniplus.internal.unexpected', 'Erro interno'),
};

/** Recusa definitiva, sem bloqueio dos campos: a tela mostra só o aviso de erro. */
export const RECUSA_DO_SERVIDOR: Resposta = {
  status: 409,
  corpo: problema(409, 'uniplus.selecao.motivo_de_decisao.conflito', 'Conflito'),
};

export interface CaixaNaTela {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

export interface GeometriaDoPainel {
  /** O recuo do formulário: o padding que ele aplica aos campos. */
  readonly recuo: number;
  readonly tituloAoPrimeiroAviso: number;
  readonly entreOsAvisos: readonly number[];
  readonly ultimoAvisoAoPrimeiroConteudo: number;
  readonly recuoEsquerdoDosAvisos: readonly number[];
  readonly recuoDireitoDosAvisos: readonly number[];
  readonly recuoEsquerdoDoPrimeiroCampo: number;
  readonly rodape: { readonly recuoEsquerdo: number; readonly recuoDireito: number };
}

async function caixa(alvo: Locator): Promise<CaixaNaTela> {
  const box = await alvo.boundingBox();
  if (!box) throw new Error('Elemento sem geometria visível.');
  return { left: box.x, right: box.x + box.width, top: box.y, bottom: box.y + box.height };
}

export async function prepararTema(page: Page, testInfo: TestInfo): Promise<void> {
  await page.addInitScript((tema: VisualTheme) => {
    window.localStorage.setItem(
      'uniplus.a11y',
      JSON.stringify({
        theme: tema === 'contrast' ? 'auto' : tema,
        contrast: tema === 'contrast',
        fontMode: 'default',
      }),
    );
  }, metadataTheme(testInfo));
}

async function simularApiDeMotivos(page: Page, recusaDaEscrita: Resposta): Promise<void> {
  await mockPermissoesEfetivas(page, [
    ...TODAS_AS_PERMISSOES_DA_CONFIGURACAO,
    PERMISSAO_DE_MANTER_MOTIVOS,
  ]);
  await mockarVocabularioDeTiposDeDecisao(page);
  await servirLeitura(page, /\/api\/selecao\/motivos-de-decisao(\?.*)?$/, []);
  await page.route(/\/api\/selecao\/admin\/motivos-de-decisao(\/[^/?]+)?$/, (route) =>
    route.request().method() === 'OPTIONS'
      ? responderPreflight(route)
      : responder(route, recusaDaEscrita),
  );
}

/** Tema do projeto, configuração de runtime e a API de motivos que recusa a gravação como pedido. */
export async function prepararMotivosComEscritaRecusada(
  page: Page,
  testInfo: TestInfo,
  recusaDaEscrita: Resposta,
): Promise<void> {
  await mockConfiguracaoRuntimeConfig(page);
  await prepararTema(page, testInfo);
  await simularApiDeMotivos(page, recusaDaEscrita);
}

async function preencherOMotivo(painel: Locator): Promise<void> {
  await painel.getByRole('textbox', { name: /^Código/ }).fill('DOCUMENTO_ILEGIVEL');
  await painel.getByRole('combobox', { name: /^Sentido/ }).selectOption('FAVORAVEL');
  await painel
    .getByRole('textbox', { name: /^Descrição/ })
    .fill('O documento enviado não pôde ser lido.');
}

/** Abre o painel de cadastro e grava um motivo: a escrita recusada deixa os avisos visíveis. */
export async function abrirPainelAposARecusa(page: Page, avisos: number): Promise<Locator> {
  await page.goto('/motivos-de-decisao');
  await page.locator('#cfg-motivos-tipo').selectOption('GABARITO_DA_PROVA');
  await page.locator('#cfg-motivos-de-decisao-novo').click();
  const painel = page.getByRole('dialog', { name: 'Formulário de motivo de decisão' });
  await expect(painel.getByRole('heading', { name: 'Novo motivo de decisão' })).toBeVisible();
  await preencherOMotivo(painel);
  await painel.getByRole('button', { name: 'Criar motivo' }).click();
  await expect(painel.locator('.uni-drawer__body > ui-alert')).toHaveCount(avisos);
  return painel;
}

interface CaixasDoPainel {
  readonly painel: CaixaNaTela;
  readonly titulo: CaixaNaTela;
  readonly avisos: readonly CaixaNaTela[];
  readonly primeiroConteudo: CaixaNaTela;
  readonly primeiroCampo: CaixaNaTela;
  readonly rodape: CaixaNaTela;
}

async function caixasDoPainel(painel: Locator): Promise<CaixasDoPainel> {
  const avisos = await painel.locator('.uni-drawer__body > ui-alert').all();
  return {
    painel: await caixa(painel.locator('.uni-drawer__panel')),
    titulo: await caixa(painel.locator('.uni-drawer__header')),
    avisos: await Promise.all(avisos.map(caixa)),
    primeiroConteudo: await caixa(
      painel.locator('.form-drawer__campos .form-section__title').first(),
    ),
    primeiroCampo: await caixa(painel.locator('.form-drawer__campos .field').first()),
    rodape: await caixa(painel.locator('.form-drawer__footer')),
  };
}

const espacosEntre = (avisos: readonly CaixaNaTela[]): number[] =>
  avisos.slice(1).map((aviso, i) => aviso.top - avisos[i].bottom);

/** O recuo do formulário, lido do estilo dele: é a referência de todos os outros espaços. */
const recuoDoFormulario = (painel: Locator): Promise<number> =>
  painel
    .locator('.form-drawer__form')
    .evaluate((form) => Number.parseFloat(getComputedStyle(form).paddingLeft));

const recuosDoRodape = (c: CaixasDoPainel): GeometriaDoPainel['rodape'] => ({
  recuoEsquerdo: c.rodape.left - c.painel.left,
  recuoDireito: c.painel.right - c.rodape.right,
});

/** As distâncias, em pixels, entre o título, os avisos, as bordas do painel e o primeiro campo. */
export async function medirOPainel(painel: Locator): Promise<GeometriaDoPainel> {
  const c = await caixasDoPainel(painel);
  return {
    recuo: await recuoDoFormulario(painel),
    tituloAoPrimeiroAviso: c.avisos[0].top - c.titulo.bottom,
    entreOsAvisos: espacosEntre(c.avisos),
    ultimoAvisoAoPrimeiroConteudo: c.primeiroConteudo.top - c.avisos[c.avisos.length - 1].bottom,
    recuoEsquerdoDosAvisos: c.avisos.map((aviso) => aviso.left - c.painel.left),
    recuoDireitoDosAvisos: c.avisos.map((aviso) => c.painel.right - aviso.right),
    recuoEsquerdoDoPrimeiroCampo: c.primeiroCampo.left - c.painel.left,
    rodape: recuosDoRodape(c),
  };
}
