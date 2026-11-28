import {
  ConsequenciaDoDescumprimentoCodigo,
  FonteValoresFatoCodigo,
  OrigemFatoCodigo,
  QuantidadeDeValoresCodigo,
  TipoDoDadoCodigo,
} from '@uniplus/shared-data/configuracao';

export const DECLARACAO_DE_INSCRICAO = { serveAFaseDeInscricao: true, obrigatorio: true };
export const DECLARACAO_FORA_DA_INSCRICAO = { serveAFaseDeInscricao: false, obrigatorio: false };

export const CONSEQUENCIAS_DO_DESCUMPRIMENTO = [
  {
    codigo: ConsequenciaDoDescumprimentoCodigo.ELIMINA_DO_PROCESSO,
    rotulo: 'Eliminação do processo',
  },
  {
    codigo: ConsequenciaDoDescumprimentoCodigo.RETIRA_A_MODALIDADE,
    rotulo: 'Retirada da modalidade',
  },
  {
    codigo: ConsequenciaDoDescumprimentoCodigo.RETIRA_O_ACRESCIMO,
    rotulo: 'Retirada do acréscimo',
  },
];

export const DADO_SIM_OU_NAO = { codigo: TipoDoDadoCodigo.SIM_OU_NAO, rotulo: 'Sim ou não' };
export const DADO_OPCAO = { codigo: TipoDoDadoCodigo.OPCAO, rotulo: 'Opção' };
export const ORIGEM_DECLARADA = { codigo: OrigemFatoCodigo.DECLARADO, rotulo: 'Declarado' };
export const VALOR_UNICO = { codigo: QuantidadeDeValoresCodigo.VALOR_UNICO, rotulo: 'Um valor' };
export const FONTE_MUNICIPIOS = { codigo: FonteValoresFatoCodigo.MUNICIPIOS, rotulo: 'Municípios' };

export const TIPOS_DE_DOCUMENTO = [
  { id: '1', codigo: 'LAUDO_MEDICO', nome: 'Laudo médico' },
  { id: '2', codigo: 'CERTIDAO_NASCIMENTO', nome: 'Certidão de nascimento' },
  { id: '3', codigo: 'ATESTADO', nome: 'Atestado' },
];

export const FASES = [
  { id: '1', codigo: 'INSCRICAO', nome: 'Inscrição', permiteComplementacao: true },
  { id: '2', codigo: 'HOMOLOGACAO_INSCRICOES', nome: 'Homologação', permiteComplementacao: false },
];
