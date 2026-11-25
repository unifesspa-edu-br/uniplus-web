export {
  FormularioDoCandidatoComponent,
  type PendenciaDaSecao,
} from './formulario-do-candidato';
export type {
  CampoApresentado,
  DependenciasDaAvaliacao,
  ErroDoServidor,
  FormularioDoCandidato,
  FormularioNoProcesso,
  GrupoApresentado,
  PressupostoDoFormulario,
  PassoPrefixado,
  RespostaFixa,
  PaginaApresentada,
  TermoApresentado,
  ValorSelecionavel,
} from './formulario-do-candidato.model';
export {
  CONCORRE,
  FALTA_RESPONDER,
  NAO_CONCORRE,
  nomesPelaOrdem,
  type AvaliacaoNaTela,
  type ModalidadesAvaliadas,
} from './modalidades-avaliadas';
export {
  AGUARDE_A_VERIFICACAO,
  type DocumentosAvaliados,
} from './documentos-avaliados';
export {
  derivadosDoSistema,
  type DerivadoDoSistema,
} from './derivados-do-sistema';
export {
  casoDaSimulacao,
  lerArquivoDoFormulario,
  type ArquivoDoFormulario,
} from './arquivo-do-formulario';
export {
  SimulacaoDeFormularioComponent,
  type ConferenciaComOServidor,
  type SimulacaoParaConferir,
} from './simulacao-de-formulario';
export { PressupostosDaSimulacaoComponent } from './pressupostos-da-simulacao';
export {
  separarMunicipiosGravados,
  type MunicipiosGravados,
  type MunicipiosSeparados,
} from './valor-de-municipio-gravado';
export { baixarJson } from './baixar-json';
export {
  divergenciasEntre,
  type Divergencia,
} from './divergencias';
export {
  interpretarFormulario,
  type InterpretacaoDoFormulario,
} from './interpretador/interpretador';
export type { RegrasInvalidas } from './interpretador/definicao-do-formulario';
export type {
  AvaliacaoDoFormulario,
  CampoAvaliado,
  EnvioDasRespostas,
  RegrasDoFormulario,
  SimulacaoDoFormulario,
  ValorJson,
} from './interpretador/regras-do-formulario';
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
} from './envio-de-documentos';
export { comparaComLista, ehNegacao } from './interpretador/predicado';
