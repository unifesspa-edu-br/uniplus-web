export {
  FormularioDoCandidatoComponent,
  type PendenciaDaSecao,
} from '../../src/lib/components/formulario-do-candidato/formulario-do-candidato';
export type {
  CampoRenderizavel,
  DependenciasDaAvaliacao,
  ErroDoServidor,
  FormularioDoCandidato,
  GrupoRenderizavel,
  PressupostoDoFormulario,
  PassoPrefixado,
  RespostaFixa,
  SecaoRenderizavel,
  TermoRenderizavel,
  ValorSelecionavel,
} from '../../src/lib/components/formulario-do-candidato/formulario-do-candidato.model';
export {
  CONCORRE,
  FALTA_RESPONDER,
  NAO_CONCORRE,
  nomesPelaOrdem,
  type AvaliacaoNaTela,
  type ModalidadesAvaliadas,
} from '../../src/lib/components/formulario-do-candidato/modalidades-avaliadas';
export {
  AGUARDE_A_VERIFICACAO,
  type DocumentosAvaliados,
} from '../../src/lib/components/formulario-do-candidato/documentos-avaliados';
export {
  derivadosDoSistema,
  type DerivadoDoSistema,
} from '../../src/lib/components/formulario-do-candidato/derivados-do-sistema';
export {
  casoDaSimulacao,
  lerArquivoDoFormulario,
  type ArquivoDoFormulario,
} from '../../src/lib/components/formulario-do-candidato/arquivo-do-formulario';
export {
  SimulacaoDeFormularioComponent,
  type ConferenciaComOServidor,
  type SimulacaoParaConferir,
} from '../../src/lib/components/formulario-do-candidato/simulacao-de-formulario';
export { PressupostosDaSimulacaoComponent } from '../../src/lib/components/formulario-do-candidato/pressupostos-da-simulacao';
export {
  type CampoExibido,
  respostaExibida,
} from '../../src/lib/components/formulario-do-candidato/resposta-exibida';
export {
  separarMunicipiosGravados,
  type MunicipiosGravados,
  type MunicipiosSeparados,
} from '../../src/lib/components/formulario-do-candidato/valor-de-municipio-gravado';
export { baixarJson } from '../../src/lib/components/formulario-do-candidato/baixar-json';
export {
  divergenciasEntre,
  type Divergencia,
} from '../../src/lib/components/formulario-do-candidato/divergencias';
export {
  interpretarFormulario,
  type InterpretacaoDoFormulario,
} from '../../src/lib/components/formulario-do-candidato/interpretador/interpretador';
export type { RegrasInvalidas } from '../../src/lib/components/formulario-do-candidato/interpretador/definicao-do-formulario';
export type {
  AvaliacaoDoFormulario,
  CampoAvaliado,
  EnvioDasRespostas,
  RegrasDoFormulario,
  SimulacaoDoFormulario,
  ValorJson,
} from '../../src/lib/components/formulario-do-candidato/interpretador/regras-do-formulario';
export { titulosDasOcorrencias } from '../../src/lib/components/formulario-do-candidato/interpretador/ocorrencia-do-candidato';
export {
  detalheDoArquivoEnviado,
  regrasDoArquivo,
  rotuloDoFormato,
  tipoDeMidiaDoArquivo,
  type AlvoDoEnvio,
  type DadosDoArquivoEnviado,
  type ArquivoEnviado,
  type DesfechoDaRemocao,
  type DesfechoDoDownload,
  type DesfechoDoEnvio,
  type EnvioDeDocumentos,
  type SituacaoDaExigencia,
  type SituacaoDoArquivo,
} from '../../src/lib/components/formulario-do-candidato/envio-de-documentos';
