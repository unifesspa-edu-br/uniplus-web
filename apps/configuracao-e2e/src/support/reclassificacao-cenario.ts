import type { Page } from '@playwright/test';
import { mockPermissoesEfetivas } from '@uniplus/shared-e2e';
import { UNIDADE_CEPS, mockRota, mockUnidades, type Resposta } from './api-de-perfis-filas';
import { mockConfiguracaoRuntimeConfig } from './runtime-config';

export const ID = '01960000-0000-7000-0000-0000000000e1';
export const PERFIL_ID = '01960000-0000-7000-0000-0000000000a1';
export const VERSAO_2 = '01960000-0000-7000-0000-0000000000b2';
export const FILA = /\/api\/autorizacao\/reclassificacoes(\?.*)?$/;
export const DETALHE = new RegExp(`/api/autorizacao/reclassificacoes/${ID}$`);
export const DECISAO = new RegExp(`/api/autorizacao/reclassificacoes/${ID}/decisoes$`);
export const DOCUMENTO = new RegExp(
  `/api/autorizacao/perfis/${PERFIL_ID}/versoes/${VERSAO_2}/documento$`,
);
export const URL_DO_DOCUMENTO = 'http://localhost:9000/uniplus-teste/portaria.pdf';

export const ITEM_DA_FILA = {
  id: ID,
  perfilId: PERFIL_ID,
  perfilNome: 'Operador de inscrições',
  codigo: 'selecao:processos:aprovar',
  mudanca: {
    classificacaoAnterior: 'interno',
    classificacaoNova: 'pessoal',
    deUnidadeAnterior: false,
    deUnidadeNovo: true,
  },
  instante: '2026-11-09T15:00:00Z',
  concessoesAguardando: 3,
};

export const concessao = (id: string, nome: string, extra: Record<string, unknown> = {}) => ({
  concessaoId: id,
  beneficiarioNome: nome,
  escopoTipo: 'UNIDADE',
  unidadeId: UNIDADE_CEPS,
  versao: 2,
  etapasExigidas: ['GESTAO_DE_ACESSOS'],
  etapasDecididas: [],
  ehDoLeitor: false,
  ...extra,
});

export const RECLASSIFICACAO = {
  ...ITEM_DA_FILA,
  vigente: true,
  versoes: [
    {
      id: VERSAO_2,
      numero: 2,
      situacao: 'VIGENTE',
      permissoes: [
        { codigo: 'selecao:processos:aprovar', classificacao: 'pessoal', deUnidade: true },
      ],
      linkDoDocumento: 'documento',
    },
  ],
  concessoes: [
    concessao('c1', 'Betina Teste'),
    concessao('c2', 'Diogo Teste', { ehDoLeitor: true }),
    concessao('c3', 'Paulo Teste', { unidadeId: null }),
  ],
};

export const DECISAO_OK = {
  loteId: 'lote-1',
  decididas: ['c1'],
  liberadas: ['c1'],
  paraOutraPessoa: [],
  puladasPorEscopo: [],
};

interface Cenario {
  readonly detalhe?: Resposta | readonly Resposta[];
  readonly decisao?: readonly Resposta[];
}

export async function preparar(page: Page, permissoes: readonly string[], cenario: Cenario = {}) {
  await mockConfiguracaoRuntimeConfig(page);
  await mockPermissoesEfetivas(page, permissoes);
  await mockUnidades(page);
  const detalhes = [cenario.detalhe ?? { status: 200, corpo: RECLASSIFICACAO }].flat();
  const leituras = await respostasEmSequencia(page, DETALHE, detalhes);
  const decisoes = cenario.decisao ?? [{ status: 200, corpo: DECISAO_OK }];
  const envios = await respostasEmSequencia(page, DECISAO, decisoes);
  return { leituras, envios };
}

function respostasEmSequencia(page: Page, rota: RegExp, respostas: readonly Resposta[]) {
  return mockRota(page, rota, (_c, n) => respostas[Math.min(n, respostas.length) - 1] as Resposta);
}
