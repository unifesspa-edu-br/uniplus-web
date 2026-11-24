import {
  SituacaoDoAcessoDoPerfilCodigo,
  type SituacaoDoAcessoDoPerfilDto,
} from '@uniplus/shared-data/autorizacao';

/** O que a API devolve como situação do acesso, com os rótulos dela. */
export const ACESSO_SUSPENSO: SituacaoDoAcessoDoPerfilDto = {
  codigo: SituacaoDoAcessoDoPerfilCodigo.SUSPENSO,
  rotulo: 'Suspenso',
};
export const ACESSO_EM_VIGOR: SituacaoDoAcessoDoPerfilDto = {
  codigo: SituacaoDoAcessoDoPerfilCodigo.EM_VIGOR,
  rotulo: 'Em vigor',
};
export const ACESSO_SEM_VERSAO_EM_VIGOR: SituacaoDoAcessoDoPerfilDto = {
  codigo: SituacaoDoAcessoDoPerfilCodigo.SEM_VERSAO_EM_VIGOR,
  rotulo: 'Sem versão em vigor',
};
