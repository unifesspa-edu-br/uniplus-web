import { PROCESSO_ID } from './processo-da-revisao';

/** O host do storage que a URL pré-assinada aponta; fictício, nenhuma requisição sai da máquina. */
export const ARMAZENAMENTO = 'https://armazenamento.uniplus.test';

const PRAZO_DA_URL_ASSINADA = '2099-01-01T00:00:00Z';

/** O documento a publicar que a iniciação cria, na ordem em que os anexos são escolhidos. */
export function idDoDocumentoEnviado(posicao: number): string {
  return `01960000-0000-7000-0000-0000000009${(0x20 + posicao).toString(16)}`;
}

export function urlDoArmazenamento(documentoAPublicarId: string): string {
  return `${ARMAZENAMENTO}/anexos/${documentoAPublicarId}`;
}

/** O que a API devolve na iniciação: o documento pendente e a URL de PUT, com o content type que ela exige. */
export function iniciacaoDoEnvio(documentoAPublicarId: string, tipoDeMidia: string) {
  return {
    documentoAPublicarId,
    urlUpload: urlDoArmazenamento(documentoAPublicarId),
    contentTypeExigido: tipoDeMidia,
    expiraEm: PRAZO_DA_URL_ASSINADA,
  };
}

const DOCUMENTO_SELADO = {
  finalidade: 'anexoDoEdital',
  status: 'Confirmado',
  criadoEm: '2027-01-01T00:00:00Z',
  expiraEm: PRAZO_DA_URL_ASSINADA,
  tamanhoBytes: 2048,
  hashSha256: 'f'.repeat(64),
  confirmadoEm: '2027-01-01T00:10:00Z',
};

/** O que a API devolve na confirmação: o documento selado como imutável. */
export function documentoConfirmadoDoEnvio(
  documentoAPublicarId: string,
  nomeArquivo: string,
  tipoDeMidia: string,
) {
  return {
    ...DOCUMENTO_SELADO,
    id: documentoAPublicarId,
    processoSeletivoId: PROCESSO_ID,
    nomeArquivo,
    tipoDeMidia,
  };
}
