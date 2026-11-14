import {
  ATO_DO_PROCESSO,
  DOCUMENTO_DO_EDITAL,
  ID_DO_PROCESSO_COMPLETO,
  SNAPSHOT_VIGENTE,
} from '../fixtures/processo-publicado-completo';

const CONFORMIDADE_LEGAL = {
  processoSeletivoId: ID_DO_PROCESSO_COMPLETO,
  dataReferencia: '2027-01-01',
  regras: [],
  avisos: [],
};

const CONFORMIDADE_ESTRUTURAL = {
  processoSeletivoId: ID_DO_PROCESSO_COMPLETO,
  itens: [],
  avisos: [],
};

const LEITURAS_DO_PROCESSO_COMPLETO: readonly (readonly [string, unknown])[] = [
  ['/documentos-a-publicar', [DOCUMENTO_DO_EDITAL]],
  ['/atos', [ATO_DO_PROCESSO]],
  ['/snapshot-vigente', SNAPSHOT_VIGENTE],
  ['/conformidade-legal', CONFORMIDADE_LEGAL],
  ['/conformidade', CONFORMIDADE_ESTRUTURAL],
];

/**
 * O que o servidor devolve nas leituras do processo completo que não dependem do cenário: o edital,
 * os atos, a versão vigente e os dois checklists. `undefined` quando o caminho é outro.
 */
export function leituraDoProcessoCompleto(caminho: string): unknown {
  return LEITURAS_DO_PROCESSO_COMPLETO.find(([sufixo]) => caminho.endsWith(sufixo))?.[1];
}
