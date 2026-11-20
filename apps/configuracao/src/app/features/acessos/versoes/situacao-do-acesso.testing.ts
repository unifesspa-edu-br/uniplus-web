import {
  SituacaoDoAcessoDoPerfilCodigo,
  type SituacaoDoAcessoDoPerfilDto,
} from '@uniplus/shared-data/autorizacao';

/** O que a API devolve como situação do acesso, com os rótulos dela. */
export const ACESSO_SUSPENSO: SituacaoDoAcessoDoPerfilDto = {
  codigo: SituacaoDoAcessoDoPerfilCodigo.suspenso,
  rotulo: 'Suspenso',
};
export const ACESSO_EM_VIGOR: SituacaoDoAcessoDoPerfilDto = {
  codigo: SituacaoDoAcessoDoPerfilCodigo.em_vigor,
  rotulo: 'Em vigor',
};
export const ACESSO_SEM_VERSAO_EM_VIGOR: SituacaoDoAcessoDoPerfilDto = {
  codigo: SituacaoDoAcessoDoPerfilCodigo.sem_versao_em_vigor,
  rotulo: 'Sem versão em vigor',
};
