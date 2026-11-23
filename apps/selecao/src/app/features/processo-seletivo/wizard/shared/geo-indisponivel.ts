import type { ProblemDetails } from '@uniplus/shared-core/http';

export const CODIGO_GEO_INDISPONIVEL = 'uniplus.selecao.conferencia_endereco_geo.geo_indisponivel';

export const MENSAGEM_GEO_INDISPONIVEL =
  'O serviço de localidades não respondeu ao conferir os municípios de prova. Nada foi publicado e a declaração continua como está; tente publicar de novo mais tarde.';

export function ehGeoIndisponivel(problema: ProblemDetails): boolean {
  return problema.status === 503 && problema.code === CODIGO_GEO_INDISPONIVEL;
}
