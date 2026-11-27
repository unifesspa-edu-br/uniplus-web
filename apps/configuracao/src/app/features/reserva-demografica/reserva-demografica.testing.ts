import { ReferenciaReservaDemograficaDto } from '@uniplus/shared-data/configuracao';
import {
  BASE_DA_API,
  CadastroEmTeste,
  PaginaDeCadastro,
  problema,
} from '../../shared/cadastro-em-teste/pagina-de-cadastro.testing';
import { ReservaDemograficaListPage } from './reserva-demografica-list.page';
import { ReservaDemograficaStore } from './reserva-demografica.store';
import { EdicaoDasReservasDemograficas } from './edicao-das-reservas-demograficas';
import { ValoresDaReserva } from './reserva-demografica-form';

export const LISTA = `${BASE_DA_API}/api/configuracao/referencias-reserva-demografica`;
export const ESCRITA = `${BASE_DA_API}/api/configuracao/admin/referencias-reserva-demografica`;
const ID_DO_FORMULARIO = 'cfg-reserva-form';
export const FORMULARIO = `#${ID_DO_FORMULARIO}`;
export const CODIGO_DUPLICADO =
  'uniplus.configuracao.referencia_reserva_demografica.censo_ja_existe';

export const referencia: ReferenciaReservaDemograficaDto = {
  id: '01960000-0000-7000-0000-0000000000e1',
  censoReferencia: '2022',
  ppiPercentual: 78.5,
  quilombolaPercentual: 1.2,
  pcdPercentual: 8.4,
  baseLegal: 'Lei 12.711/2012, art. 10, III',
  criadoEm: '2026-06-10T12:00:00Z',
};
export const URL_DA_REFERENCIA = `${ESCRITA}/${referencia.id}`;

export const VALORES_VALIDOS = {
  censoReferencia: '2010',
  ppiPercentual: 70,
  quilombolaPercentual: 1,
  pcdPercentual: 8,
  baseLegal: 'Lei 12.711/2012, art. 10, III',
};

export const recusaDoPercentual = problema(422, 'uniplus.validacao', 'Dados inválidos', [
  {
    field: 'PpiPercentual',
    code: 'uniplus.configuracao.referencia_reserva_demografica.percentual_fora_de_faixa',
    message: 'Percentual recusado.',
  },
]);

export const duplicado = problema(
  409,
  CODIGO_DUPLICADO,
  'Já existe uma referência ativa para este Censo',
);

export const processando = problema(
  409,
  'uniplus.idempotency.processing_conflict',
  'A requisição anterior ainda está em processamento',
);

export const naoEncontrada = problema(
  404,
  'uniplus.configuracao.referencia_reserva_demografica.nao_encontrada',
  'Referência de reserva demográfica não encontrada',
);

export const falhaInterna = problema(500, 'uniplus.internal.unexpected', 'Erro interno');

export const RESERVA: CadastroEmTeste<
  ReservaDemograficaListPage,
  EdicaoDasReservasDemograficas,
  ReservaDemograficaStore,
  ReferenciaReservaDemograficaDto,
  ValoresDaReserva
> = {
  pagina: ReservaDemograficaListPage,
  edicao: EdicaoDasReservasDemograficas,
  store: ReservaDemograficaStore,
  lista: LISTA,
  formulario: ID_DO_FORMULARIO,
  objetoDaAcao: 'reserva',
  itemInicial: referencia,
  valoresValidos: VALORES_VALIDOS,
  textoDaConfirmacaoDeRemocao: 'Censo 2022',
};

export type PaginaDeReservaDemografica = PaginaDeCadastro<
  ReservaDemograficaListPage,
  EdicaoDasReservasDemograficas,
  ReservaDemograficaStore,
  ReferenciaReservaDemograficaDto,
  ValoresDaReserva
>;
