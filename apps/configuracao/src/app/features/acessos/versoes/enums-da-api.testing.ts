import {
  ClassificacaoDeProtecaoCodigo,
  EtapaDaVersaoCodigo,
  ResultadoDaDecisaoCodigo,
  SituacaoDaVersaoCodigo,
  SituacaoDoAnexoCodigo,
  TipoDeGovernancaCodigo,
} from '@uniplus/shared-data/autorizacao';
import type { CodigoComRotulo } from '@uniplus/shared-ui/components';

export const ROTULO_DA_ETAPA: Readonly<Record<EtapaDaVersaoCodigo, string>> = {
  [EtapaDaVersaoCodigo.GESTAO_DE_ACESSOS]: 'Gestão de acessos',
  [EtapaDaVersaoCodigo.PROTECAO_DE_DADOS]: 'Proteção de dados',
};

const ANEXO: Readonly<Record<SituacaoDoAnexoCodigo, string>> = {
  [SituacaoDoAnexoCodigo.AGUARDANDO_ENVIO]: 'Aguardando envio',
  [SituacaoDoAnexoCodigo.EM_VERIFICACAO]: 'Em verificação',
  [SituacaoDoAnexoCodigo.VERIFICADO]: 'Verificado',
  [SituacaoDoAnexoCodigo.RECUSADO]: 'Recusado',
};

const RESULTADO: Readonly<Record<ResultadoDaDecisaoCodigo, string>> = {
  [ResultadoDaDecisaoCodigo.APROVADO]: 'Aprovado',
  [ResultadoDaDecisaoCodigo.RECUSADO]: 'Recusado',
  [ResultadoDaDecisaoCodigo.PERFIL_ALTERADO]: 'Perfil alterado',
  [ResultadoDaDecisaoCodigo.PRAZO_VENCIDO]: 'Prazo vencido',
  [ResultadoDaDecisaoCodigo.TERMO_EXIGIDO]: 'Termo exigido',
};

const VERSAO: Readonly<Record<SituacaoDaVersaoCodigo, string>> = {
  [SituacaoDaVersaoCodigo.PENDENTE]: 'Pendente',
  [SituacaoDaVersaoCodigo.VIGENTE]: 'Vigente',
  [SituacaoDaVersaoCodigo.ENCERRADA]: 'Encerrada',
  [SituacaoDaVersaoCodigo.CANCELADA]: 'Cancelada',
  [SituacaoDaVersaoCodigo.RECUSADA]: 'Recusada',
  [SituacaoDaVersaoCodigo.EXPIRADA]: 'Expirada',
};

const GOVERNANCA: Readonly<Record<TipoDeGovernancaCodigo, string>> = {
  [TipoDeGovernancaCodigo.GESTOR_DE_ACESSOS]: 'Gestor de acessos',
  [TipoDeGovernancaCodigo.REPRESENTANTE_DO_CONTROLADOR]: 'Representante do controlador',
  [TipoDeGovernancaCodigo.GESTOR_DE_PROTECAO_DE_DADOS]: 'Gestor de proteção de dados',
};

const SENSIBILIDADE: Readonly<Record<ClassificacaoDeProtecaoCodigo, string>> = {
  [ClassificacaoDeProtecaoCodigo.PUBLICO]: 'Público',
  [ClassificacaoDeProtecaoCodigo.INTERNO]: 'Interno',
  [ClassificacaoDeProtecaoCodigo.PESSOAL]: 'Pessoal',
  [ClassificacaoDeProtecaoCodigo.IDENTIFICADOR]: 'Identificador',
  [ClassificacaoDeProtecaoCodigo.SENSIVEL]: 'Sensível',
};

type Par<C extends string> = CodigoComRotulo<C>;

/** Os valores de enum que a API devolve, com os rótulos pt-BR dela, para montar respostas de teste. */
export const etapaDaVersao = (codigo: EtapaDaVersaoCodigo): Par<EtapaDaVersaoCodigo> => ({
  codigo,
  rotulo: ROTULO_DA_ETAPA[codigo],
});
export const situacaoDoAnexo = (codigo: SituacaoDoAnexoCodigo): Par<SituacaoDoAnexoCodigo> => ({
  codigo,
  rotulo: ANEXO[codigo],
});
export const resultadoDaDecisao = (
  codigo: ResultadoDaDecisaoCodigo,
): Par<ResultadoDaDecisaoCodigo> => ({ codigo, rotulo: RESULTADO[codigo] });
export const situacaoDaVersao = (codigo: SituacaoDaVersaoCodigo): Par<SituacaoDaVersaoCodigo> => ({
  codigo,
  rotulo: VERSAO[codigo],
});
export const tipoDeGovernanca = (codigo: TipoDeGovernancaCodigo): Par<TipoDeGovernancaCodigo> => ({
  codigo,
  rotulo: GOVERNANCA[codigo],
});
export const sensibilidade = (
  codigo: ClassificacaoDeProtecaoCodigo,
): Par<ClassificacaoDeProtecaoCodigo> => ({ codigo, rotulo: SENSIBILIDADE[codigo] });

export const ETAPA_GESTAO = etapaDaVersao(EtapaDaVersaoCodigo.GESTAO_DE_ACESSOS);
export const ETAPA_PROTECAO = etapaDaVersao(EtapaDaVersaoCodigo.PROTECAO_DE_DADOS);
