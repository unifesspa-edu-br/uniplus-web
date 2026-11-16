import type { Page, Request, Route } from '@playwright/test';
import type { TipoEtapaDto } from '@uniplus/shared-data/configuracao';
import { responder, responderPreflight, servirLeitura, type Resposta } from './escritas-retidas';
import { mockTiposDeConceito } from './tipos-conceito-api';

/** API mockada do cadastro de Tipo de etapa, compartilhada pelos specs de fluxo da tela. */

const ID_DO_TIPO_CRIADO = 'novo-tipo-etapa-id';

/** O tipo sem nada declarado além do que o contrato exige; o teste troca só o que mede. */
const TIPO_SEM_DECLARACOES: TipoEtapaDto = {
  id: '01960000-0000-7000-0000-0000000000e1',
  codigo: 'PROVA',
  nome: 'Prova',
  descricao: null,
  ativo: true,
  admitePontuacao: true,
  admiteEliminacao: true,
  notaDeOrigemNoEnem: false,
  exigeCorrecaoIndependente: false,
  conceitosAdmitidos: [],
  criadoEm: '2026-08-11T00:00:00Z',
};

export function tipoDeEtapa(parcial: Partial<TipoEtapaDto> = {}): TipoEtapaDto {
  return { ...TIPO_SEM_DECLARACOES, ...parcial };
}

/** O que a tela enviou: o corpo de cada criação e de cada atualização, e o id de cada remoção. */
export interface Capturado {
  readonly posts: unknown[];
  readonly puts: unknown[];
  readonly deletedIds: string[];
}

export function novoCapturado(): Capturado {
  return { posts: [], puts: [], deletedIds: [] };
}

function registrar(capturado: Capturado, requisicao: Request): void {
  const metodo = requisicao.method();
  if (metodo === 'POST') capturado.posts.push(requisicao.postDataJSON());
  if (metodo === 'PUT') capturado.puts.push(requisicao.postDataJSON());
  if (metodo === 'DELETE') capturado.deletedIds.push(requisicao.url().split('/').pop() ?? '');
}

function respostaDaEscrita(metodo: string, recusa: Resposta | undefined): Resposta {
  if (recusa) return recusa;
  return metodo === 'POST' ? { status: 201, corpo: ID_DO_TIPO_CRIADO } : { status: 204 };
}

function aoEscrever(capturado: Capturado, recusa: Resposta | undefined) {
  return async (route: Route): Promise<void> => {
    const requisicao = route.request();
    if (requisicao.method() === 'OPTIONS') return responderPreflight(route);
    registrar(capturado, requisicao);
    await responder(route, respostaDaEscrita(requisicao.method(), recusa));
  };
}

/** Serve a lista e o catálogo de conceitos, e captura as escritas; `recusa` responde a toda escrita. */
export async function mockApiDeTiposEtapa(
  page: Page,
  capturado: Capturado,
  lista: readonly TipoEtapaDto[],
  recusa?: Resposta,
): Promise<void> {
  await mockTiposDeConceito(page);
  await page.route(
    /\/api\/configuracao\/admin\/tipos-etapa(\/[^/?]+)?(\?.*)?$/,
    aoEscrever(capturado, recusa),
  );
  await servirLeitura(page, /\/api\/configuracao\/tipos-etapa(\?.*)?$/, lista);
}
