import { ModalidadeDto } from '@uniplus/shared-data/configuracao';

export const BASE = 'http://localhost:5000';
export const URL = `${BASE}/api/configuracao/modalidades`;
export const URL_ADMIN = `${BASE}/api/configuracao/admin/modalidades`;
export const URL_CATALOGO = `${BASE}/api/configuracao/fatos-candidato`;

const MODALIDADE_AMPLA: ModalidadeDto = {
  id: 'id-modalidade',
  codigo: 'AC',
  legalFixa: true,
  descricao: 'Ampla concorrência',
  naturezaLegal: 'AMPLA',
  composicaoVagas: 'RESTANTE_DAS_VAGAS_OFERTADAS',
  composicaoOrigem: null,
  regraRemanejamento: null,
  remanejamentoDestino: null,
  remanejamentoPar: null,
  remanejamentoFallback: null,
  regraDeAplicabilidade: [],
  acaoQuandoIndeferido: null,
  baseLegal: null,
  criadoEm: '2026-07-03T12:00:00Z',
};

export function modalidade(over: Partial<ModalidadeDto>): ModalidadeDto {
  return { ...MODALIDADE_AMPLA, id: over.id ?? crypto.randomUUID(), ...over };
}

export const AC = modalidade({ id: 'id-ac', codigo: 'AC' });
