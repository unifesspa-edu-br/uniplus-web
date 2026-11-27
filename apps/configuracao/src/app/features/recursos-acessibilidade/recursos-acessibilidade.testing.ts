import { RecursoAcessibilidadeDto } from '@uniplus/shared-data/configuracao';
import {
  BASE_DA_API,
  CadastroEmTeste,
  PaginaDeCadastro,
  problema,
} from '../../shared/cadastro-em-teste/pagina-de-cadastro.testing';
import { RecursosAcessibilidadeListPage } from './recursos-acessibilidade-list.page';
import { RecursosAcessibilidadeStore } from './recursos-acessibilidade.store';
import { EdicaoDosRecursosAcessibilidade } from './edicao-dos-recursos-acessibilidade';
import { ValoresDoRecurso } from './recurso-acessibilidade-form';

export const LISTA = `${BASE_DA_API}/api/configuracao/recursos-acessibilidade`;
export const ESCRITA = `${BASE_DA_API}/api/configuracao/admin/recursos-acessibilidade`;
const ID_DO_FORMULARIO = 'cfg-recurso-acessibilidade-form';
export const FORMULARIO = `#${ID_DO_FORMULARIO}`;

export const ledor: RecursoAcessibilidadeDto = {
  id: '019f41cf-69fd-759a-ac6d-09acabc1b028',
  codigo: 'LEDOR',
  nome: 'Ledor',
  descricao: null,
  criadoEm: '2026-07-07T13:23:42.707136+00:00',
};
export const URL_LEDOR = `${ESCRITA}/${ledor.id}`;
export const TITULO = '#cfg-recursos-acessibilidade-list-title';

export const recusaDoCodigo = problema(422, 'uniplus.validacao', 'Dados inválidos', [
  {
    field: 'Codigo',
    code: 'uniplus.configuracao.recurso_acessibilidade.codigo_formato_invalido',
    message: 'Código recusado.',
  },
]);

export const codigoDuplicado = problema(
  409,
  'uniplus.configuracao.recurso_acessibilidade.codigo_ja_existe',
  'Já existe um recurso de acessibilidade ativo com este código',
);

export const nomeDuplicado = problema(
  409,
  'uniplus.configuracao.recurso_acessibilidade.nome_ja_existe',
  'Já existe um recurso de acessibilidade ativo com este nome',
);

export const processando = problema(
  409,
  'uniplus.idempotency.processing_conflict',
  'A requisição anterior ainda está em processamento',
);

export const falhaInterna = problema(500, 'uniplus.internal.unexpected', 'Erro interno');
export const criado = ['novo-id', { status: 201, statusText: 'Created' }] as const;
export const semConteudo = [null, { status: 204, statusText: 'No Content' }] as const;

export const RECURSOS: CadastroEmTeste<
  RecursosAcessibilidadeListPage,
  EdicaoDosRecursosAcessibilidade,
  RecursosAcessibilidadeStore,
  RecursoAcessibilidadeDto,
  ValoresDoRecurso
> = {
  pagina: RecursosAcessibilidadeListPage,
  edicao: EdicaoDosRecursosAcessibilidade,
  store: RecursosAcessibilidadeStore,
  lista: LISTA,
  formulario: ID_DO_FORMULARIO,
  objetoDaAcao: 'recurso',
  itemInicial: ledor,
  valoresValidos: { nome: 'Sala de apoio', codigo: 'SALA_DE_APOIO', descricao: '' },
};

export type PaginaDeRecursos = PaginaDeCadastro<
  RecursosAcessibilidadeListPage,
  EdicaoDosRecursosAcessibilidade,
  RecursosAcessibilidadeStore,
  RecursoAcessibilidadeDto,
  ValoresDoRecurso
>;
