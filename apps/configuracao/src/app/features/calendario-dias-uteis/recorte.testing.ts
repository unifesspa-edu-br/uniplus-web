import { ABRANGENCIAS } from './abrangencias.testing';
import { DIA_ESTADUAL, DIA_MUNICIPAL, PARAUAPEBAS } from './calendario-dias-uteis.testing';

/** Dias de outras localidades e abrangências, para o recorte da grade ter o que esconder. */
export const DIA_EM_PARAUAPEBAS = {
  ...DIA_MUNICIPAL,
  id: '019f41cf-69fd-759a-ac6d-09acabc1b103',
  municipioIbge: PARAUAPEBAS.codigoIbge,
  municipioNome: PARAUAPEBAS.nome,
  data: '2026-10-10',
  descricao: 'Aniversário de Parauapebas',
};

export const DIA_EM_TOCANTINS = {
  ...DIA_ESTADUAL,
  id: '019f41cf-69fd-759a-ac6d-09acabc1b104',
  uf: 'TO',
  data: '2026-10-05',
  descricao: 'Criação do Estado do Tocantins',
};

export const DIA_INSTITUCIONAL = {
  ...DIA_ESTADUAL,
  id: '019f41cf-69fd-759a-ac6d-09acabc1b105',
  abrangencia: ABRANGENCIAS.INSTITUCIONAL,
  uf: null,
  data: '2026-10-28',
  descricao: 'Dia do Servidor Público',
};
