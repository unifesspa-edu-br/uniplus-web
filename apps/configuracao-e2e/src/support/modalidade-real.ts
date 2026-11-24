import { expect, type Locator, type Page } from '@playwright/test';
import type {
  ComposicaoVagasCodigo,
  NaturezaLegalCodigo,
  RegraRemanejamentoCodigo,
} from '@uniplus/shared-data/configuracao';
import { acharNaListagem, chamarApi } from '@uniplus/shared-e2e';
import { PERSONA_DA_CONFIGURACAO, type OpcaoDoVocabulario } from './vocabularios-reais';

/**
 * A modalidade de concorrência pela tela e pela API real. A cota reservada, que só admite a regra
 * de remanejamento que segue a cascata, grava a regra sem destino, par nem fallback.
 */
export const NATUREZA: `${NaturezaLegalCodigo}` = 'COTA_RESERVADA';
export const COMPOSICAO: `${ComposicaoVagasCodigo}` = 'DENTRO_DA_RESERVA_LEGAL';
export const REGRA: `${RegraRemanejamentoCodigo}` = 'SEGUE_ORDEM_DE_REMANEJAMENTO';

interface Descrito {
  readonly codigo: string;
  readonly rotulo: string;
}

export interface ModalidadeGravada {
  readonly id: string;
  readonly codigo: string;
  readonly naturezaLegal: Descrito;
  readonly composicaoVagas: Descrito;
  readonly remanejamento: {
    readonly regra: Descrito;
    readonly destino: string | null;
    readonly par: string | null;
    readonly fallback: string | null;
  } | null;
}

/** As escolhas da pessoa, cada uma uma opção do vocabulário que a API devolveu. */
export interface EscolhasDaModalidade {
  readonly natureza: OpcaoDoVocabulario;
  readonly composicao: OpcaoDoVocabulario;
  readonly regra: OpcaoDoVocabulario;
}

export const campo = (escopo: Pick<Page, 'getByRole'>, nome: RegExp): Locator =>
  escopo.getByRole('combobox', { name: nome });

export const camposDaModalidade = (pagina: Page) => ({
  natureza: campo(pagina, /^Natureza legal/),
  composicao: campo(pagina, /^Composição de vagas/),
  regra: campo(pagina, /^Regra de remanejamento/),
  par: campo(pagina, /^Par/),
  fallback: campo(pagina, /^Fallback/),
});

/** Escolhe a opção pelo texto que a pessoa lê, o rótulo da API; o que se grava é o código dela. */
const escolherPeloRotulo = (select: Locator, opcao: OpcaoDoVocabulario): Promise<unknown> =>
  select.selectOption({ label: opcao.rotulo });

async function escolherOsEnums(pagina: Page, escolhas: EscolhasDaModalidade): Promise<void> {
  const campos = camposDaModalidade(pagina);
  await escolherPeloRotulo(campos.natureza, escolhas.natureza);
  await escolherPeloRotulo(campos.composicao, escolhas.composicao);
  await escolherPeloRotulo(campos.regra, escolhas.regra);
}

/** Preenche o formulário de criação e salva. */
export async function criarModalidadePelaTela(
  pagina: Page,
  codigo: string,
  escolhas: EscolhasDaModalidade,
): Promise<void> {
  await pagina.getByRole('textbox', { name: /^Código/ }).fill(codigo);
  await escolherOsEnums(pagina, escolhas);
  await pagina.getByRole('button', { name: 'Criar modalidade' }).click();
  await expect(pagina).toHaveURL(/\/modalidades$/);
}

export function modalidadeNaApi(codigo: string): Promise<ModalidadeGravada | undefined> {
  return acharNaListagem<ModalidadeGravada>(
    PERSONA_DA_CONFIGURACAO,
    '/api/configuracao/modalidades?limit=100',
    (m) => m.codigo === codigo,
  );
}

/** Remove a modalidade criada pela spec; sem ela na base, não há o que remover. */
export async function removerModalidade(codigo: string): Promise<void> {
  const gravada = await modalidadeNaApi(codigo);
  if (gravada === undefined) return;
  const resposta = await chamarApi(
    PERSONA_DA_CONFIGURACAO,
    'DELETE',
    `/api/configuracao/admin/modalidades/${gravada.id}`,
  );
  expect(resposta.status, `Remoção da modalidade ${codigo}`).toBeLessThan(300);
}
