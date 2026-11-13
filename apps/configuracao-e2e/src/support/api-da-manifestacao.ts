import type { Page } from '@playwright/test';
import { PENDENCIAS, SOLICITADA } from './dados-de-tipos-e-fatos';
import { mockRota, type Chamada, type Resposta } from './api-de-perfis-filas';
import { json } from './listas-de-tipos-e-fatos';

const RAIZ = '\\/api\\/configuracao\\/admin\\/protecao-do-catalogo';
const ITEM = PENDENCIAS[0];

/** Uma manifestação vigente desfavorável do Encarregado de dados, no ciclo 1. */
export const MANIFESTACAO_DESFAVORAVEL = {
  id: '01960000-0000-7000-0000-0000000000f1',
  ciclo: 1,
  parecer: 'INADEQUADA',
  texto: 'O laudo revela condição de saúde: a classificação deve ser sensível.',
  autorNome: 'Isabella Priscila Figueiredo',
  instante: '2026-11-02T14:00:00Z',
  substituiId: null,
  situacao: 'VIGENTE',
};

const LAUDO = {
  ...ITEM,
  descricao: 'Laudo que complementa o pedido de atendimento especializado.',
  fato: null,
  tipoDocumento: { categoria: 'SAUDE', formatosAceitos: 'pdf', tamanhoMaximoMb: 10 },
  atos: [],
};

/** O detalhe do laudo, que aguarda a decisão, com as manifestações vigentes dadas. */
export function detalheDoLaudo(vigentes: readonly object[]) {
  const desfavoravel = vigentes.length > 0;
  const aprovacao = {
    ...SOLICITADA,
    manifestadaEm: desfavoravel ? MANIFESTACAO_DESFAVORAVEL.instante : null,
    manifestacaoDesfavoravel: desfavoravel,
  };
  return { ...LAUDO, aprovacao, manifestacoesVigentes: vigentes };
}

/** As leituras: categorias, fila, detalhe e histórico das manifestações. */
async function mockLeituras(page: Page, vigentes: readonly object[]): Promise<void> {
  await page.route(/\/api\/configuracao\/categorias-documento(\?.*)?$/, (r) => json(r, []));
  await page.route(new RegExp(`${RAIZ}\\/tipos-documento\\/[^/?]+\\/manifestacoes$`), (r) =>
    json(r, vigentes),
  );
  await page.route(new RegExp(`${RAIZ}\\/tipos-documento\\/[^/?]+$`), (r) =>
    json(r, detalheDoLaudo(vigentes)),
  );
  await page.route(new RegExp(`${RAIZ}\\?situacao=SOLICITADA$`), (r) =>
    json(r, [{ ...ITEM, aprovacao: SOLICITADA }]),
  );
}

/** A fila, o detalhe, o histórico e as escritas da proteção; devolve as escritas recebidas. */
export async function mockManifestacoes(
  page: Page,
  vigentes: readonly object[],
  escrita: Resposta = { status: 204 },
): Promise<Chamada[]> {
  await mockLeituras(page, vigentes);
  return mockRota(page, new RegExp(`${RAIZ}(\\/manifestacoes)?$`), () => escrita);
}
