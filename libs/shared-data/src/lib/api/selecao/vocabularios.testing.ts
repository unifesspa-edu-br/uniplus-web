import {
  FinalidadeDoDocumentoCodigo,
  SentidoDoMotivoCodigo,
  StatusArquivoEnviadoCodigo,
  StatusProcessoCodigo,
  TipoRegraCodigo,
} from './schema';

export const situacaoDoProcesso = {
  codigo: StatusProcessoCodigo.rascunho,
  rotulo: 'Em preparação',
};
export const arquivoConfirmado = {
  codigo: StatusArquivoEnviadoCodigo.Confirmado,
  rotulo: 'Confirmado',
};
export const arquivoPendente = { codigo: StatusArquivoEnviadoCodigo.Pendente, rotulo: 'Pendente' };
export const sentidoDesfavoravel = {
  codigo: SentidoDoMotivoCodigo.DESFAVORAVEL,
  rotulo: 'Desfavorável',
};
export const tipoDeRegra = {
  codigo: TipoRegraCodigo.regra_distribuicao_vagas,
  rotulo: 'Distribuição de vagas',
};
export const finalidadeDoDocumento = {
  codigo: FinalidadeDoDocumentoCodigo.documentoDoEdital,
  rotulo: 'Documento do edital',
};
