import { TipoDeficienciaDto } from '@uniplus/shared-data/configuracao';
import {
  BASE_DA_API,
  CadastroEmTeste,
  PaginaDeCadastro,
  problema,
} from '../../shared/cadastro-em-teste/pagina-de-cadastro.testing';
import { TiposDeficienciaListPage } from './tipos-deficiencia-list.page';
import { TiposDeficienciaStore } from './tipos-deficiencia.store';
import { EdicaoDosTiposDeficiencia } from './edicao-dos-tipos-deficiencia';
import { ValoresDoTipoDeficiencia } from './tipo-deficiencia-form';

export const LISTA = `${BASE_DA_API}/api/configuracao/tipos-deficiencia`;
export const ESCRITA = `${BASE_DA_API}/api/configuracao/admin/tipos-deficiencia`;
const ID_DO_FORMULARIO = 'cfg-tipo-deficiencia-form';
export const FORMULARIO = `#${ID_DO_FORMULARIO}`;

export const visual: TipoDeficienciaDto = {
  id: '019f41cf-69fd-759a-ac6d-09acabc1b028',
  codigo: 'VISUAL',
  nome: 'Visual',
  descricao: 'Baixa visão',
  permanente: null,
  criadoEm: '2026-07-07T13:23:42.707136+00:00',
};
export const URL_VISUAL = `${ESCRITA}/${visual.id}`;
export const TITULO = '#cfg-tipos-deficiencia-list-title';

export const recusaDoCodigo = problema(422, 'uniplus.validacao', 'Dados inválidos', [
  {
    field: 'Codigo',
    code: 'uniplus.configuracao.tipo_deficiencia.codigo_formato_invalido',
    message: 'Código recusado.',
  },
]);

export const codigoDuplicado = problema(
  409,
  'uniplus.configuracao.tipo_deficiencia.codigo_ja_existe',
  'Já existe um tipo de deficiência ativo com este código',
);

export const nomeDuplicado = problema(
  409,
  'uniplus.configuracao.tipo_deficiencia.nome_ja_existe',
  'Já existe um tipo de deficiência ativo com este nome',
);

export const processando = problema(
  409,
  'uniplus.idempotency.processing_conflict',
  'A requisição anterior ainda está em processamento',
);

export const falhaInterna = problema(500, 'uniplus.internal.unexpected', 'Erro interno');
export const criado = ['novo-id', { status: 201, statusText: 'Created' }] as const;
export const semConteudo = [null, { status: 204, statusText: 'No Content' }] as const;

export const TIPOS: CadastroEmTeste<
  TiposDeficienciaListPage,
  EdicaoDosTiposDeficiencia,
  TiposDeficienciaStore,
  TipoDeficienciaDto,
  ValoresDoTipoDeficiencia
> = {
  pagina: TiposDeficienciaListPage,
  edicao: EdicaoDosTiposDeficiencia,
  store: TiposDeficienciaStore,
  lista: LISTA,
  formulario: ID_DO_FORMULARIO,
  objetoDaAcao: 'tipo',
  itemInicial: visual,
  valoresValidos: { nome: 'Auditiva', codigo: 'AUDITIVA', descricao: 'Perda auditiva' },
};

export type PaginaDeTiposDeficiencia = PaginaDeCadastro<
  TiposDeficienciaListPage,
  EdicaoDosTiposDeficiencia,
  TiposDeficienciaStore,
  TipoDeficienciaDto,
  ValoresDoTipoDeficiencia
>;
