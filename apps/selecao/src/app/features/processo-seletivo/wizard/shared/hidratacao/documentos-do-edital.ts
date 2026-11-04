import type { DocumentoAPublicarDto } from '@uniplus/shared-data/selecao';
import { formatarDataBr, formatarTamanhoDeArquivo } from '@uniplus/shared-utils';

import type { UploadItem } from '../../processo-seletivo.models';

/**
 * Projeta o readback de um documento confirmado no shape que o passo 2 exibe, com o nome do
 * arquivo que o operador enviou.
 */
export function uploadItemDe(documento: DocumentoAPublicarDto): UploadItem {
  return {
    id: documento.id,
    name: documento.nomeArquivo,
    extension: 'pdf',
    progress: 100,
    fase: 'confirmado',
    documentoAPublicarId: documento.id,
    enviado: true,
  };
}

/** O edital é sempre um PDF; o tipo declarado no início do envio é o que a API confere depois. */
export const TIPO_DE_MIDIA_DO_EDITAL = 'application/pdf';

export interface ReadbackDocumentos {
  /** Documento confirmado único — vínculo restaurável sem decisão. */
  readonly vinculo: UploadItem | null;
  /** Confirmados que exigem escolha explícita do administrador. */
  readonly escolha: readonly DocumentoAPublicarDto[];
}

/**
 * Decide o que fazer com os documentos lidos do processo. Um confirmado restaura o vínculo; mais de
 * um vai ao administrador, porque eleger o mais recente trocaria o edital em silêncio. Pendentes não
 * contam, pois só o confirmado tem hash e selo de imutabilidade. Só PDF conta: o processo também
 * guarda DOCX e ODT como anexo, e a API recusa na publicação o edital que não é PDF.
 */
export function classificarDocumentos(
  documentos: readonly DocumentoAPublicarDto[],
): ReadbackDocumentos {
  const confirmados = documentos.filter(
    (documento) =>
      documento.confirmadoEm !== null && documento.tipoDeMidia === TIPO_DE_MIDIA_DO_EDITAL,
  );

  if (confirmados.length === 0) return { vinculo: null, escolha: [] };
  if (confirmados.length === 1) return { vinculo: uploadItemDe(confirmados[0]), escolha: [] };
  return { vinculo: null, escolha: confirmados };
}

/**
 * Como apresentar um documento confirmado na escolha do oficial. Não há rota de download
 * para inspecionar o conteúdo, então além do nome vão metadados estáveis: o instante da confirmação
 * com segundos (duas confirmações no mesmo minuto ficariam idênticas), o tamanho e o início do hash,
 * que é a identidade do arquivo.
 */
export function descreverDocumento(documento: DocumentoAPublicarDto): string {
  const instante =
    formatarDataBr(documento.confirmadoEm, 'datetimeSeconds') || 'instante indisponível';

  const hash =
    documento.hashSha256 === null
      ? 'hash indisponível'
      : `hash ${documento.hashSha256.slice(0, 12)}`;

  const nome = documento.nomeArquivo.trim() || 'nome indisponível';

  return `${nome} · ${instante} · ${formatarTamanhoDeArquivo(documento.tamanhoBytes)} · ${hash}`;
}
