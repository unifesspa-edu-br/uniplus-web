import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { CODIGO_GEO_INDISPONIVEL, MENSAGEM_GEO_INDISPONIVEL } from '../../shared/geo-indisponivel';
import { RecusasDaPublicacao } from '../../shared/recusas/recusas-da-publicacao.service';
import { usarRevisao } from './revisao-publicacao.testing';
import {
  CenarioDaRevisao,
  PROCESSO_DTO_MINIMO,
  ROTA_CONFORMIDADE,
  ROTA_DETALHE,
  ROTA_PUBLICACAO,
  ROTA_SNAPSHOT,
  SNAPSHOT_DTO,
  criarProcesso,
  flushMicrotasks,
  flushProntidaoVerde,
  prepararCamposLocais,
} from './revisao.testing';

const RECUSA_DE_GEO_INDISPONIVEL = {
  type: `https://erros.exemplo/${CODIGO_GEO_INDISPONIVEL}`,
  title: 'Geo indisponível',
  status: 503,
  code: CODIGO_GEO_INDISPONIVEL,
  traceId: 't',
  errors: [{ field: '/municipios', code: 'regra', message: 'Recusa indevida' }],
};

const RESPOSTA_503 = {
  status: 503,
  statusText: 'Service Unavailable',
  headers: { 'Content-Type': 'application/problem+json' },
};

describe('RevisaoPassoComponent — indisponibilidade do Geo na publicação', () => {
  let cenario: CenarioDaRevisao;
  usarRevisao((montado) => (cenario = montado));

  async function prepararRevisao(): Promise<void> {
    prepararCamposLocais(cenario);
    await criarProcesso(cenario);
    await flushProntidaoVerde(cenario);
  }

  async function falharPorGeoIndisponivel() {
    const resultado = cenario.componente.persistir();
    const requisicao = cenario.controller.expectOne(ROTA_PUBLICACAO);
    const chave = requisicao.request.headers.get('Idempotency-Key');
    requisicao.flush(RECUSA_DE_GEO_INDISPONIVEL, RESPOSTA_503);
    return { resultado: await resultado, chave };
  }

  async function repetirPublicacaoComSucesso(chave: string | null): Promise<unknown> {
    const repetida = cenario.componente.persistir();
    const repeticao = cenario.controller.expectOne(ROTA_PUBLICACAO);
    expect(chave).toBeTruthy();
    expect(repeticao.request.headers.get('Idempotency-Key')).toBe(chave);
    repeticao.flush(null, { status: 204, statusText: 'No Content' });
    await flushMicrotasks();
    cenario.controller.expectOne(ROTA_DETALHE).flush(PROCESSO_DTO_MINIMO);
    cenario.controller.expectOne(ROTA_SNAPSHOT).flush(SNAPSHOT_DTO);
    return repetida;
  }

  it('informa a falha sem travar nem registrar recusa', async () => {
    await prepararRevisao();
    const { resultado } = await falharPorGeoIndisponivel();

    expect(resultado).toEqual({ valid: false, messages: [MENSAGEM_GEO_INDISPONIVEL] });
    expect(cenario.store.publicacaoNaoConfirmada()).toBe(false);
    expect(cenario.store.edicaoPermitida()).toBe(true);
    expect(TestBed.inject(RecusasDaPublicacao).recusas()).toEqual([]);
    expect(TestBed.inject(RecusasDaPublicacao).resposta()).toBeNull();
    cenario.controller.expectNone(ROTA_CONFORMIDADE);
  });

  it('publica ao repetir com a mesma chave depois da falha do Geo', async () => {
    await prepararRevisao();
    const { chave } = await falharPorGeoIndisponivel();

    expect(await repetirPublicacaoComSucesso(chave)).toEqual({ valid: true });
  });

  it('mantém a publicação travada quando o 503 tem outro código', async () => {
    await prepararRevisao();
    const gravacao = cenario.componente.persistir();
    cenario.controller
      .expectOne(ROTA_PUBLICACAO)
      .flush(
        { type: 'about:blank', title: 'Falha', status: 503, code: 'outro', traceId: 't' },
        { status: 503, statusText: 'Service Unavailable' },
      );
    expect((await gravacao).valid).toBe(false);
    expect(cenario.store.publicacaoNaoConfirmada()).toBe(true);
    expect(cenario.store.edicaoPermitida()).toBe(false);
  });
});
