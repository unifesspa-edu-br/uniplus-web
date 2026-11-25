import {
  DocumentoDaConfiguracaoBancasRegraDeDeliberacaoCriterio as CriterioDaDeliberacao,
  DocumentoDaConfiguracaoBancasRegraDeDeliberacaoDesempate as DesempateDaDeliberacao,
  DocumentoDaConfiguracaoBancasRegraDeDeliberacaoEncerramento as EncerramentoDaDeliberacao,
  DocumentoDaConfiguracaoBancasRegraDeDeliberacaoModo as ModoDaDeliberacao,
  DocumentoDaConfiguracaoBancasRegraDeDeliberacaoSemUnanimidade as SemUnanimidadeNaDeliberacao,
  DocumentoDaConfiguracaoColetaReferenciaTemporalDosDadosTipo as TipoDaReferenciaTemporal,
  DocumentoDaConfiguracaoFormularioFinalidade as FinalidadeDoFormulario,
  DocumentoDaConfiguracaoComunsAlvoDoProcedimentoDeRecursoAreaDoEnem as AreaDoEnemDoProcedimento,
  DocumentoDaConfiguracaoComunsPublicacaoPrevistaPapel as PapelDaPublicacaoPrevista,
  DocumentoDaConfiguracaoComunsPropriedadesDoRecursoPrazoUnidade as UnidadeDoPrazoDoRecurso,
  DocumentoDaConfiguracaoComunsPropriedadesDoRecursoPrazoSegundaInstanciaUnidade as UnidadeDoPrazoDaSegundaInstancia,
  DocumentoDaConfiguracaoComunsPropriedadesDoRecursoEfeitoSuspensivo as EfeitoSuspensivoDoDocumento,
  DocumentoDaConfiguracaoComunsPropriedadesDoRecursoGuardaDaVaga as GuardaDaVagaDoDocumento,
  DocumentoDaConfiguracaoComunsTipoDeDecisao as TipoDeDecisaoDoDocumento,
  DocumentoDaConfiguracaoDistribuicaoDeVagasAjusteDoQuadro$tipo as TipoDeAjusteDoQuadro,
  DocumentoDaConfiguracaoEtapasCarater as CaraterDaEtapa,
  DocumentoDaConfiguracaoEtapasFormaDeAvaliacao as FormaDeAvaliacaoDaEtapa,
  DocumentoDaConfiguracaoEtapasRecursoDaEtapaEventoInicialDoPrazo as EventoInicialDoPrazoDoRecursoDaEtapa,
  DocumentoDaConfiguracaoExigenciasPrazoDeEmissaoUnidade as UnidadeDoPrazoDeEmissao,
  DocumentoDaConfiguracaoCondicoesBaseLegalAbrangencia as AbrangenciaDaBaseLegal,
  DocumentoDaConfiguracaoCondicoesCondicaoOperador as OperadorDaCondicao,
  DocumentoDaConfiguracaoCondicoesBaseLegalSituacao as SituacaoDaBaseLegal,
  DocumentoDaConfiguracaoRegrasDeComprovacaoForma as FormaDeComprovacaoDaConfiguracao,
  DocumentoDaConfiguracaoIdentificacaoOrigemCandidatos,
  DocumentoDaConfiguracaoMotivoSentido as SentidoDoMotivo,
  DocumentoDaConfiguracaoOpcoesDeCursoNumero,
  DocumentoDaConfiguracaoTaxaDeInscricaoFundamentos,
} from './schema';
import type { components } from './schema';

type Esquemas = components['schemas'];

export type DocumentoDaConfiguracao = Esquemas['DocumentoDaConfiguracao'];
export type RascunhoSubstituidoResponse = Esquemas['RascunhoSubstituidoResponse'];
export type DocumentoDaConfiguracaoIdentificacao = Esquemas['DocumentoDaConfiguracaoIdentificacao'];
export type DocumentoDaConfiguracaoDistribuicaoDeVagas =
  Esquemas['DocumentoDaConfiguracaoDistribuicaoDeVagas'];
export type DocumentoDaConfiguracaoOrdemDeRemanejamento =
  Esquemas['DocumentoDaConfiguracaoOrdemDeRemanejamento'];
export type DocumentoDaConfiguracaoFada = Esquemas['DocumentoDaConfiguracaoFada'];
export type DocumentoDaConfiguracaoAtendimento = Esquemas['DocumentoDaConfiguracaoAtendimento'];
export type DocumentoDaConfiguracaoClassificacao = Esquemas['DocumentoDaConfiguracaoClassificacao'];
export type DocumentoDaConfiguracaoReferenciaDeRegra =
  Esquemas['DocumentoDaConfiguracaoComunsReferenciaDeRegra'];

export type DocumentoDaConfiguracaoCronogramaFase =
  Esquemas['DocumentoDaConfiguracaoCronogramaFase'];
export type DocumentoDaConfiguracaoEtapa = Esquemas['DocumentoDaConfiguracaoEtapas'];
export type DocumentoDaConfiguracaoItemDeAvaliacao =
  Esquemas['DocumentoDaConfiguracaoEtapasItemDeAvaliacao'];
export type DocumentoDaConfiguracaoNivelDeAtendimento =
  Esquemas['DocumentoDaConfiguracaoEtapasNivelDeAtendimento'];
export type DocumentoDaConfiguracaoPropriedadesDoRecurso =
  Esquemas['DocumentoDaConfiguracaoComunsPropriedadesDoRecurso'];
export type DocumentoDaConfiguracaoRecursoDaEtapa =
  Esquemas['DocumentoDaConfiguracaoEtapasRecursoDaEtapa'];
export type DocumentoDaConfiguracaoFormulario = Esquemas['DocumentoDaConfiguracaoFormulario'];
export type DocumentoDaConfiguracaoColeta = Esquemas['DocumentoDaConfiguracaoColeta'];
export type DocumentoDaConfiguracaoCalculoDoDado = NonNullable<
  DocumentoDaConfiguracaoColeta['calculosDosDados']
>[number];
export type DocumentoDaConfiguracaoExigencia =
  Esquemas['DocumentoDaConfiguracaoExigenciasExigencia'];
export type DocumentoDaConfiguracaoRegraDeComprovacao =
  Esquemas['DocumentoDaConfiguracaoRegrasDeComprovacao'];
export type DocumentoDaConfiguracaoBaseLegal =
  Esquemas['DocumentoDaConfiguracaoCondicoesBaseLegal'];
export type DocumentoDaConfiguracaoCondicoesAlternativas =
  Esquemas['DocumentoDaConfiguracaoCondicoesCondicoesAlternativas'];
export type DocumentoDaConfiguracaoBanca = Esquemas['DocumentoDaConfiguracaoBancas'];
export type DocumentoDaConfiguracaoRegraDeDeliberacao =
  Esquemas['DocumentoDaConfiguracaoBancasRegraDeDeliberacao'];
export type DocumentoDaConfiguracaoPublicacaoPrevista =
  Esquemas['DocumentoDaConfiguracaoComunsPublicacaoPrevista'];
export type DocumentoDaConfiguracaoMotivo = Esquemas['DocumentoDaConfiguracaoMotivo'];
export type DocumentoDaConfiguracaoProcedimentoDeRecurso =
  Esquemas['DocumentoDaConfiguracaoComunsProcedimentoDeRecurso'];

export {
  AbrangenciaDaBaseLegal,
  TipoDaReferenciaTemporal,
  FinalidadeDoFormulario,
  OperadorDaCondicao,
  CriterioDaDeliberacao,
  DesempateDaDeliberacao,
  EncerramentoDaDeliberacao,
  ModoDaDeliberacao,
  SemUnanimidadeNaDeliberacao,
  SituacaoDaBaseLegal,
  FormaDeComprovacaoDaConfiguracao,
  UnidadeDoPrazoDeEmissao,
  EventoInicialDoPrazoDoRecursoDaEtapa,
  AreaDoEnemDoProcedimento,
  CaraterDaEtapa,
  FormaDeAvaliacaoDaEtapa,
  PapelDaPublicacaoPrevista,
  SentidoDoMotivo,
  TipoDeDecisaoDoDocumento,
  UnidadeDoPrazoDoRecurso,
  UnidadeDoPrazoDaSegundaInstancia,
  EfeitoSuspensivoDoDocumento,
  GuardaDaVagaDoDocumento,
  TipoDeAjusteDoQuadro,
  DocumentoDaConfiguracaoIdentificacaoOrigemCandidatos,
  DocumentoDaConfiguracaoOpcoesDeCursoNumero,
  DocumentoDaConfiguracaoTaxaDeInscricaoFundamentos,
};
