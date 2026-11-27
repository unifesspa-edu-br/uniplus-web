import { CondicaoAtendimentoDto } from '@uniplus/shared-data/configuracao';
import {
  BASE_DA_API,
  CadastroEmTeste,
  PaginaDeCadastro,
  problema,
} from '../../shared/cadastro-em-teste/pagina-de-cadastro.testing';
import { CondicoesAtendimentoPage } from './condicoes-atendimento.page';
import { CondicoesAtendimentoStore } from './condicoes-atendimento.store';
import { EdicaoDasCondicoesAtendimento } from './edicao-das-condicoes-atendimento';
import { ValoresDaCondicao } from './condicao-atendimento-form';

export const LISTA = `${BASE_DA_API}/api/configuracao/condicoes-atendimento`;
export const ESCRITA = `${BASE_DA_API}/api/configuracao/admin/condicoes-atendimento`;
const ID_DO_FORMULARIO = 'cfg-condicao-atendimento-form';
export const FORMULARIO = `#${ID_DO_FORMULARIO}`;

export const ledor: CondicaoAtendimentoDto = {
  id: '019f41cf-69fd-759a-ac6d-09acabc1b028',
  codigo: 'LEDOR',
  nome: 'Ledor',
  descricao: null,
  criadoEm: '2026-07-07T13:23:42.707136+00:00',
};
export const pcd: CondicaoAtendimentoDto = { ...ledor, id: 'pcd-1', codigo: 'PCD', nome: 'Pcd' };
export const URL_LEDOR = `${ESCRITA}/${ledor.id}`;
export const URL_PCD = `${ESCRITA}/${pcd.id}`;

export const recusaDoCodigo = problema(422, 'uniplus.validacao', 'Dados inválidos', [
  {
    field: 'Codigo',
    code: 'uniplus.configuracao.condicao_atendimento.x',
    message: 'Código recusado.',
  },
]);

export const duplicado = problema(
  409,
  'uniplus.configuracao.condicao_atendimento.codigo_ja_existe',
  'Já existe uma condição de atendimento ativa com este código',
);

export const processando = problema(
  409,
  'uniplus.idempotency.processing_conflict',
  'A requisição anterior ainda está em processamento',
);

export const falhaInterna = problema(500, 'uniplus.internal.unexpected', 'Erro interno');

export const CONDICOES: CadastroEmTeste<
  CondicoesAtendimentoPage,
  EdicaoDasCondicoesAtendimento,
  CondicoesAtendimentoStore,
  CondicaoAtendimentoDto,
  ValoresDaCondicao
> = {
  pagina: CondicoesAtendimentoPage,
  edicao: EdicaoDasCondicoesAtendimento,
  store: CondicoesAtendimentoStore,
  lista: LISTA,
  formulario: ID_DO_FORMULARIO,
  objetoDaAcao: 'condição',
  itemInicial: ledor,
  valoresValidos: { codigo: 'DISLEXIA', nome: 'Dislexia', descricao: '' },
};

export type PaginaDeCondicoes = PaginaDeCadastro<
  CondicoesAtendimentoPage,
  EdicaoDasCondicoesAtendimento,
  CondicoesAtendimentoStore,
  CondicaoAtendimentoDto,
  ValoresDaCondicao
>;
