import {
  RESOLUCAO,
  ROTA_CLASSIFICACAO,
  controller,
  prepararClassificacaoLocal,
  store,
} from '../eliminacao/eliminacao.testing';

export interface ErroDeCampoDaRecusa {
  readonly field: string;
  readonly code: string;
  readonly message: string;
}

export interface RecusaDaGravacao {
  readonly title: string;
  readonly code: string;
  readonly errors?: readonly ErroDeCampoDaRecusa[];
}

/** Base local válida, baseada no ENEM e com a resolução de Peso por Área escolhida. */
export function prepararClassificacaoLocalComResolucao(): void {
  prepararClassificacaoLocal();
  store.patchObjectSection('classificacao', {
    baseadoEmEnem: true,
    resolucaoPesoAreaEnem: RESOLUCAO,
  });
}

/** O servidor recusa a gravação da classificação com a resposta de erro 422 do contrato. */
export function recusarGravacao(recusa: RecusaDaGravacao): void {
  controller.expectOne(ROTA_CLASSIFICACAO).flush(
    { type: 'about:blank', status: 422, traceId: 'trace-1', ...recusa },
    {
      status: 422,
      statusText: 'Unprocessable Entity',
      headers: { 'content-type': 'application/problem+json' },
    },
  );
}

/** A requisição à rota cai sem resposta, como numa falha de rede. */
export function falharPorRede(rota: string): void {
  controller
    .expectOne(rota)
    .error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });
}

/** Resposta de sucesso sem corpo da gravação da classificação. */
export function aceitarGravacao(): void {
  controller.expectOne(ROTA_CLASSIFICACAO).flush(null, { status: 204, statusText: 'No Content' });
}
