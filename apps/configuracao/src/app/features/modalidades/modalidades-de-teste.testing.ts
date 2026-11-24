import { ModalidadeDto } from '@uniplus/shared-data/configuracao';
import { MODALIDADE } from './modalidades-tabela.testing';

export const BASE = 'http://localhost:5000';
export const URL = `${BASE}/api/configuracao/modalidades`;
export const URL_ADMIN = `${BASE}/api/configuracao/admin/modalidades`;
export const URL_CATALOGO = `${BASE}/api/configuracao/fatos-candidato`;

const MODALIDADE_AMPLA: ModalidadeDto = {
  ...MODALIDADE,
  id: 'id-modalidade',
  codigo: 'AC',
  legalFixa: true,
  descricao: 'Ampla concorrência',
};

export function modalidade(over: Partial<ModalidadeDto>): ModalidadeDto {
  return { ...MODALIDADE_AMPLA, id: over.id ?? crypto.randomUUID(), ...over };
}

export const AC = modalidade({ id: 'id-ac', codigo: 'AC' });
