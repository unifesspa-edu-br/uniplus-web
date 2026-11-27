import { conteudoInicial } from '@uniplus/shared-inscricao/formulario';

import { exigenciasVazias } from '../../shared/exigencias/exigencias-documentais';
import type { EntradaDasAbas, FaseDoCronograma } from './abas-do-formulario';
import { formularioDoRascunho, inscricaoGravada } from './formulario-de-inscricao.testing';

export const fase = (codigo: string, marcas: Partial<FaseDoCronograma> = {}): FaseDoCronograma => ({
  codigo,
  nome: `Fase ${codigo}`,
  coletaInscricao: false,
  coletaSolicitacaoIsencao: false,
  ...marcas,
});
export const FASES = [fase('INSCRICAO', { coletaInscricao: true }), fase('AVALIACAO')];

export const textosVazios = (): EntradaDasAbas['textos'] => ({
  recusasDaGravacao: new Map(),
  recusasDaRemocao: new Map(),
  recusasDaAplicacao: new Map(),
  resumosDaAplicacao: new Map(),
  modelos: [],
  modeloEscolhido: new Map(),
});

/** A entrada das abas: os formularios dados, cada um na fase em que está. */
export const entradaDasAbas = (
  formularios: EntradaDasAbas['formularios'],
  extra: Partial<EntradaDasAbas> = {},
): EntradaDasAbas => ({
  formularios,
  fases: new Map(
    formularios.map((item) => [item.codigo, { opcoes: FASES, escolhida: item.faseCodigo }]),
  ),
  fasesDoCronograma: FASES,
  documentos: exigenciasVazias(),
  vocabulario: { fatoPorCodigo: new Map(), consequencias: [], nomeDoTipo: (id) => id },
  fatosDaInscricao: ['PCD'],
  textos: textosVazios(),
  ...extra,
});

export const inscricao = () => formularioDoRascunho(inscricaoGravada(), { gravado: true });
export const laudo = (extra: Parameters<typeof formularioDoRascunho>[1] = {}) =>
  formularioDoRascunho(conteudoInicial(), {
    codigo: 'LAUDO',
    faseCodigo: 'AVALIACAO',
    ...extra,
  });
