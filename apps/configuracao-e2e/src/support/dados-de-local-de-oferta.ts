import type { JsonDaApi } from '@uniplus/shared-e2e';
import type { LocalOfertaDto } from '@uniplus/shared-data/configuracao';

/** O local de oferta que os specs de fluxo da tela de Locais de oferta compartilham. */
export const LOCAL_POLO_EAD: JsonDaApi<LocalOfertaDto> = {
  id: '01960000-0000-7000-0000-0000000000d1',
  tipo: { codigo: 'POLO_DE_EDUCACAO_A_DISTANCIA', rotulo: 'Polo EAD' },
  codigoEmec: '999',
  campusResponsavelId: null,
  cidade: { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' },
  endereco: null,
  criadoEm: '2026-06-10T12:00:00Z',
};

/** O mesmo local depois de a recarga trazer o tipo alterado. */
export const LOCAL_COM_TIPO_ALTERADO: JsonDaApi<LocalOfertaDto> = {
  ...LOCAL_POLO_EAD,
  tipo: { codigo: 'CAMPUS_FORA_DE_SEDE', rotulo: 'Campus fora de sede' },
};
