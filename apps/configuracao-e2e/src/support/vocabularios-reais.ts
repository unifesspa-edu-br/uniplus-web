import { expect, type Browser, type Locator, type Page } from '@playwright/test';
import type { VocabulariosDeConfiguracao } from '@uniplus/shared-data/configuracao';
import { OPERADOR_DO_ROTEIRO, chamarApi, entrarComoPersona } from '@uniplus/shared-e2e';

/**
 * Apoio das specs contra a API real que conferem o rótulo dos enums de configuração: lê o
 * vocabulário pela API, com o mesmo token da persona que opera a tela, e compara com o que o campo
 * da tela oferece. O rótulo nunca é escrito na spec: o que vale é o que a API devolve.
 */
export const APP = process.env['BASE_URL'] ?? 'http://localhost:4203';

/** Persona fictícia com a manutenção de todos os cadastros de configuração que as telas abrem. */
export const PERSONA_DA_CONFIGURACAO = OPERADOR_DO_ROTEIRO;

export type NomeDoVocabulario = keyof VocabulariosDeConfiguracao;

export interface OpcaoDoVocabulario {
  readonly codigo: string;
  readonly rotulo: string;
}

/** Uma opção como a tela a oferece: o valor que será enviado e o texto que a pessoa lê. */
export interface OpcaoDaTela {
  readonly valor: string;
  readonly texto: string;
  readonly desabilitada: boolean;
}

export type LeitorDeOpcoes = (campo: Locator) => Promise<readonly OpcaoDaTela[]>;

export async function lerVocabulario(nome: NomeDoVocabulario): Promise<OpcaoDoVocabulario[]> {
  const resposta = await chamarApi<OpcaoDoVocabulario[]>(
    PERSONA_DA_CONFIGURACAO,
    'GET',
    `/api/configuracao/vocabularios/${nome}`,
  );
  expect(resposta.status, `Leitura do vocabulário ${nome}`).toBe(200);
  expect(resposta.corpo.length, `O vocabulário ${nome} veio vazio`).toBeGreaterThan(0);
  return resposta.corpo;
}

/** O select como a pessoa o vê: cada opção com o valor, o texto e se está desabilitada. */
export const opcoesDoSelect: LeitorDeOpcoes = (campo) =>
  campo.locator('option').evaluateAll((opcoes) =>
    (opcoes as HTMLOptionElement[]).map((opcao) => ({
      valor: opcao.value,
      texto: (opcao.textContent ?? '').trim(),
      desabilitada: opcao.disabled,
    })),
  );

/** O grupo de caixas de marcação: o valor de cada caixa e o texto do rótulo dela. */
export const opcoesDasCaixas: LeitorDeOpcoes = (grupo) =>
  grupo.locator('input[type="checkbox"]').evaluateAll((caixas) =>
    (caixas as HTMLInputElement[]).map((caixa) => ({
      valor: caixa.value,
      texto: (caixa.closest('label')?.textContent ?? '').trim(),
      desabilitada: caixa.disabled,
    })),
  );

/** Tira só a opção de orientação ("Selecione…", "Não se aplica"), que não é código do vocabulário. */
function semOrientacao(
  opcoes: readonly OpcaoDaTela[],
  vocabulario: readonly OpcaoDoVocabulario[],
): OpcaoDaTela[] {
  const codigos = new Set(vocabulario.map((opcao) => opcao.codigo));
  return opcoes.filter((o) => codigos.has(o.valor) || (o.valor !== '' && !o.desabilitada));
}

export async function lerOpcoesDoVocabulario(
  campo: Locator,
  vocabulario: readonly OpcaoDoVocabulario[],
  ler: LeitorDeOpcoes = opcoesDoSelect,
): Promise<{ valor: string; texto: string }[]> {
  return semOrientacao(await ler(campo), vocabulario).map(({ valor, texto }) => ({ valor, texto }));
}

/** Entra como a persona, abre a rota, roda o passo e fecha a sessão, que só serve a esta conferência. */
export async function comPagina(
  browser: Browser,
  rota: string,
  passo: (pagina: Page) => Promise<void>,
): Promise<void> {
  const pagina = await entrarComoPersona(browser, APP, PERSONA_DA_CONFIGURACAO, rota);
  try {
    await passo(pagina);
  } finally {
    await pagina.context().close();
  }
}
