import type { TipoBancaDto } from '@uniplus/shared-data/configuracao';
import type { JsonDaApi } from '@uniplus/shared-e2e';

export const ID_DO_TIPO_DE_BANCA = '01960000-0000-7000-0000-0000000000b2';

/** O tipo de banca de entrevista como a API o devolve. */
export const TIPO_DE_BANCA_ENTREVISTA: JsonDaApi<TipoBancaDto> = {
  id: ID_DO_TIPO_DE_BANCA,
  codigo: { codigo: 'BANCA_ENTREVISTA', rotulo: 'Banca de entrevista' },
  nome: 'Banca de Entrevista',
  faseTipica: 'Avaliação',
  descricao: null,
  papel: { codigo: 'AVALIA_O_MERITO', rotulo: 'Avalia o mérito' },
  exigeDuasOuMaisBancas: false,
  encerraRecursoNaPrimeiraInstancia: false,
  tiposDeDecisaoJulgados: [],
  criadoEm: '2026-06-10T12:00:00Z',
};
