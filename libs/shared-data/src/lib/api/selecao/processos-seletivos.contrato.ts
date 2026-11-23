import {
  FundamentoIsencaoCodigo,
  FinalidadeDoDocumentoCodigo,
  ImpedimentoDoProdutoCodigo,
  SituacaoDoProdutoPrevistoCodigo,
} from './schema';
import type { components } from './schema';

export type CriarProcessoSeletivoCommand = components['schemas']['CriarProcessoSeletivoCommand'];
export type ProcessoSeletivoDto = components['schemas']['ProcessoSeletivoDto'];
export type FormularioApresentadoDoProcessoDto =
  components['schemas']['FormularioApresentadoDoProcessoDto'];
export type ProcessoSeletivoResumoDto = components['schemas']['ProcessoSeletivoResumoDto'];
export type TipoProcessoSnapshotDto = components['schemas']['TipoProcessoSnapshotDto'];
export type IniciarEnvioDoDocumentoAPublicarRequest =
  components['schemas']['IniciarEnvioDoDocumentoAPublicarRequest'];
export type IniciarEnvioDoDocumentoAPublicarDto =
  components['schemas']['IniciarEnvioDoDocumentoAPublicarDto'];
export type DocumentoAPublicarDto = components['schemas']['DocumentoAPublicarDto'];
export type AcessoDocumentoAPublicarDto = components['schemas']['AcessoDocumentoAPublicarDto'];
export type AnexoDoEditalRequest = components['schemas']['AnexoDoEditalRequest'];
export type AtoDoProcessoDto = components['schemas']['AtoDoProcessoDto'];
export type DocumentoDoAtoDto = components['schemas']['DocumentoDoAtoDto'];
export type PublicarAtoAvulsoDoProcessoRequest =
  components['schemas']['PublicarAtoAvulsoDoProcessoRequest'];
export type AnexoDoAtoRequest = components['schemas']['AnexoDoAtoRequest'];
export type AtoPublicadoDto = components['schemas']['AtoPublicadoDto'];
export type ProdutosPrevistosDoProcessoDto =
  components['schemas']['ProdutosPrevistosDoProcessoDto'];
export type FaseComProdutosPrevistosDto = components['schemas']['FaseComProdutosPrevistosDto'];
export type EtapaComProdutosPrevistosDto = components['schemas']['EtapaComProdutosPrevistosDto'];
export type ProdutoPrevistoDto = components['schemas']['ProdutoPrevistoDto'];
export type PublicarProdutoDoEditalRequest =
  components['schemas']['PublicarProdutoDoEditalRequest'];
export type ConfiguracaoDivulgacaoDto = components['schemas']['ConfiguracaoDivulgacaoDto'];
export type CampoDivulgacaoDto = components['schemas']['CampoDivulgacaoDto'];

/** Para que serve o documento enviado: o edital oficial, um anexo dele ou um documento de ato. */
export { FinalidadeDoDocumentoCodigo };

/** O que o cronograma do edital declara publicar: a situação de cada item e o que o impede de sair. */
export { ImpedimentoDoProdutoCodigo, SituacaoDoProdutoPrevistoCodigo };
export type IniciarEnvioDoModeloDeDocumentoRequest =
  components['schemas']['IniciarEnvioDoModeloDeDocumentoRequest'];
export type IniciarEnvioDoModeloDeDocumentoDto =
  components['schemas']['IniciarEnvioDoModeloDeDocumentoDto'];
export type ModeloDeDocumentoDto = components['schemas']['ModeloDeDocumentoDto'];
export type AcessoModeloDeDocumentoDto = components['schemas']['AcessoModeloDeDocumentoDto'];
export type ModeloDaExigenciaDto = components['schemas']['ModeloDaExigenciaDto'];
export type ConfiguracaoTaxaInscricaoDto = components['schemas']['ConfiguracaoTaxaInscricaoDto'];
export type DefinirTaxaInscricaoRequest = components['schemas']['DefinirTaxaInscricaoRequest'];
export type DefinirProvaPresencialRequest = components['schemas']['DefinirProvaPresencialRequest'];
export type MunicipioDeProvaInformado = components['schemas']['MunicipioDeProvaInformado'];
export type ProvaPresencialDto = components['schemas']['ProvaPresencialDto'];
export type MunicipioDeProvaDto = components['schemas']['MunicipioDeProvaDto'];
export type FundamentoIsencaoDto = components['schemas']['FundamentoIsencaoDto'];

/** Vocabulário fechado dos fundamentos que a configuração pode referenciar. */
export { FundamentoIsencaoCodigo as FundamentoIsencao };
export type { FundamentoIsencaoCodigo };
export type ConfiguracaoDistribuicaoVagasInput =
  components['schemas']['ConfiguracaoDistribuicaoVagasInput'];
export type ConfiguracaoDistribuicaoVagasDto =
  components['schemas']['ConfiguracaoDistribuicaoVagasDto'];
export type EtapaProcessoInput = components['schemas']['EtapaProcessoInput'];
export type EtapaProcessoDto = components['schemas']['EtapaProcessoDto'];
export type FaseCronogramaInput = components['schemas']['FaseCronogramaInput'];
export type RegraDeDeliberacaoDto = components['schemas']['RegraDeDeliberacaoDto'];
export type RegraDeDeliberacaoInput = components['schemas']['RegraDeDeliberacaoInput'];
export type RegraDeHomologacaoDto = components['schemas']['RegraDeHomologacaoDto'];
export type RegraDeHomologacaoInput = components['schemas']['RegraDeHomologacaoInput'];
export type AlternativaDeCondicoesDto = components['schemas']['AlternativaDeCondicoesDto'];
export type AlternativaDeCondicoesInput = components['schemas']['AlternativaDeCondicoesInput'];
export type CondicaoDeHomologacaoDto = components['schemas']['CondicaoDeHomologacaoDto'];
export type CondicaoDeHomologacaoInput = components['schemas']['CondicaoDeHomologacaoInput'];
export type RegraDeComprovacaoInformada = components['schemas']['RegraDeComprovacaoInformada'];
export type ItemDocumentoExigidoInput = components['schemas']['ItemDocumentoExigidoInput'];
export type DocumentoExigidoDto = components['schemas']['DocumentoExigidoDto'];
export type RegraDeComprovacaoDto = components['schemas']['RegraDeComprovacaoDto'];
export type FatoColetadoDto = components['schemas']['FatoColetadoDto'];
export type FatoColetadoInput = components['schemas']['FatoColetadoInput'];
export type ConfiguracaoDerivacaoDto = components['schemas']['ConfiguracaoDerivacaoDto'];
export type ConfiguracaoDerivacaoInput = components['schemas']['ConfiguracaoDerivacaoInput'];
export type ReferenciaTemporalFatosDto = components['schemas']['ReferenciaTemporalFatosDto'];
export type DefinirReferenciaTemporalFatosRequest =
  components['schemas']['DefinirReferenciaTemporalFatosRequest'];
export type FormularioDto = components['schemas']['FormularioDto'];
export type DefinirFormularioRequest = components['schemas']['DefinirFormularioRequest'];
export type DefinirItensDoFormularioRequest =
  components['schemas']['DefinirItensDoFormularioRequest'];
export type DefinirTermosDoFormularioRequest =
  components['schemas']['DefinirTermosDoFormularioRequest'];
export type AplicacaoDeModeloInput = components['schemas']['AplicacaoDeModeloInput'];
export type AplicacaoDeModeloDto = components['schemas']['AplicacaoDeModeloDto'];
export type ParteDescartadaDto = components['schemas']['ParteDescartadaDto'];
export type DefinirIdentificadorLegivelRequest =
  components['schemas']['DefinirIdentificadorLegivelRequest'];
export type BaseLegalDto = components['schemas']['BaseLegalDto'];
export type FaseCronogramaDto = components['schemas']['FaseCronogramaDto'];
export type RegraRecursoFaseInput = components['schemas']['RegraRecursoFaseInput'];
export type DefinirAlgoritmoContagemPrazoRequest =
  components['schemas']['DefinirAlgoritmoContagemPrazoRequest'];
export type DefinirAtendimentoEspecializadoRequest =
  components['schemas']['DefinirAtendimentoEspecializadoRequest'];
export type DefinirCascataRemanejamentoRequest =
  components['schemas']['DefinirCascataRemanejamentoRequest'];
export type DestinoRemanejamentoInput = components['schemas']['DestinoRemanejamentoInput'];
export type ConformidadeProcessoSeletivoDto =
  components['schemas']['ConformidadeProcessoSeletivoDto'];
export type ItemConformidadeDto = components['schemas']['ItemConformidadeDto'];
export type AvisoConformidadeDto = components['schemas']['AvisoConformidadeDto'];
export type ConformidadeLegalProcessoSeletivoDto =
  components['schemas']['ConformidadeLegalProcessoSeletivoDto'];
export type RegraAvaliadaDto = components['schemas']['RegraAvaliadaDto'];
export type PublicarProcessoSeletivoRequest =
  components['schemas']['PublicarProcessoSeletivoRequest'];
export type DadosDoAtoRequest = components['schemas']['DadosDoAtoRequest'];
export type ReferenciaRegraDto = components['schemas']['ReferenciaRegraDto'];
export type ConfiguracaoClassificacaoDto = components['schemas']['ConfiguracaoClassificacaoDto'];
export type DefinirOpcoesDeCursoRequest = components['schemas']['DefinirOpcoesDeCursoRequest'];
export type DefinirClassificacaoRequest = components['schemas']['DefinirClassificacaoRequest'];
export type RegraEliminacaoDto = components['schemas']['RegraEliminacaoDto'];
export type RegraEliminacaoInput = components['schemas']['RegraEliminacaoInput'];
export type ConfiguracaoDoFadaDto = components['schemas']['ConfiguracaoDoFadaDto'];
export type MunicipioDoFadaDto = components['schemas']['MunicipioDoFadaDto'];
export type DefinirFadaRequest = components['schemas']['DefinirFadaRequest'];
export type DefinirOpcoesDeclaradasRequest =
  components['schemas']['DefinirOpcoesDeclaradasRequest'];
export type CriterioDesempateDto = components['schemas']['CriterioDesempateDto'];
export type CriterioDesempateInput = components['schemas']['CriterioDesempateInput'];
export type SnapshotVigenteDto = components['schemas']['SnapshotVigenteDto'];
