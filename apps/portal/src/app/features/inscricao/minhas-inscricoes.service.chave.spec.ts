import { type HttpContext, HttpHeaders } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { type Observable, firstValueFrom, of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { type ApiResult, apiFailure, apiOk } from '@uniplus/shared-core/http';
import { CODIGO_ESPERA_ESGOTADA, IDEMPOTENCY_KEY_TOKEN } from '@uniplus/shared-core/idempotency';
import { InscricoesApi } from '@uniplus/shared-data/selecao';

import { MinhasInscricoesService } from './minhas-inscricoes.service';

const CONFLITO_DE_PROCESSAMENTO = 'uniplus.idempotency.processing_conflict';
const REDE_INDISPONIVEL = 'uniplus.client.network_error';
const MOTIVO = 'Mudei de curso';

describe('MinhasInscricoesService.cancelar: Idempotency-Key do cancelamento', () => {
  const semCabecalhos = new HttpHeaders();
  const falha = (status: number, code: string) =>
    apiFailure(
      { type: 'about:blank', title: 'Falha', status, code, traceId: '' },
      status,
      semCabecalhos,
    );
  const sucesso = apiOk<void>(undefined, 204, semCabecalhos);
  const inscricao = apiOk({ eTag: '"i1:3"' }, 200, semCabecalhos);

  /** Cria o serviço com `cancelar` respondendo, em ordem, os desfechos dados, e o último repetido. */
  function preparar(
    desfechos: readonly ApiResult<void>[],
    leituras: readonly Observable<ApiResult<unknown>>[] = [],
  ) {
    const cancelar = vi.fn().mockReturnValue(of(sucesso));
    desfechos.forEach((desfecho) => cancelar.mockReturnValueOnce(of(desfecho)));
    const obter = vi.fn().mockReturnValue(of(inscricao));
    leituras.forEach((leitura) => obter.mockReturnValueOnce(leitura));
    TestBed.configureTestingModule({
      providers: [{ provide: InscricoesApi, useValue: { obter, cancelar } }],
    });
    return { service: TestBed.inject(MinhasInscricoesService), cancelar };
  }

  const chaveDe = (cancelar: ReturnType<typeof vi.fn>, chamada: number): string | null => {
    const contexto: HttpContext = cancelar.mock.calls[chamada][3];
    const chave = contexto.get(IDEMPOTENCY_KEY_TOKEN);
    expect(chave).toBeTruthy();
    return chave;
  };

  const executar = (service: MinhasInscricoesService, motivo: string | null = MOTIVO) =>
    firstValueFrom(service.cancelar('p1', motivo));

  it('mantém a chave quando a API responde que o cancelamento anterior ainda está em processamento', async () => {
    const { service, cancelar } = preparar([falha(409, CONFLITO_DE_PROCESSAMENTO)]);

    await executar(service);
    await executar(service);

    expect(chaveDe(cancelar, 1)).toBe(chaveDe(cancelar, 0));
  });

  it('troca a chave quando a espera pela vez do processo se esgotou, porque a API guardou a recusa', async () => {
    const { service, cancelar } = preparar([falha(503, CODIGO_ESPERA_ESGOTADA)]);

    await executar(service);
    await executar(service);

    expect(chaveDe(cancelar, 1)).not.toBe(chaveDe(cancelar, 0));
  });

  it('troca a chave ao repetir o mesmo motivo depois de uma recusa 4xx', async () => {
    const { service, cancelar } = preparar([falha(422, 'uniplus.teste.recusa')]);

    await executar(service);
    await executar(service);

    expect(chaveDe(cancelar, 1)).not.toBe(chaveDe(cancelar, 0));
  });

  it('mantém a chave depois de falha 5xx, porque o cancelamento pode ter sido gravado', async () => {
    const { service, cancelar } = preparar([falha(500, 'uniplus.teste.falha')]);

    await executar(service);
    await executar(service);

    expect(chaveDe(cancelar, 1)).toBe(chaveDe(cancelar, 0));
  });

  it('mantém a chave quando a resposta não chega, porque o cancelamento pode ter sido gravado', async () => {
    const { service, cancelar } = preparar([falha(0, REDE_INDISPONIVEL)]);

    await executar(service);
    await executar(service);

    expect(chaveDe(cancelar, 1)).toBe(chaveDe(cancelar, 0));
  });

  it('gera outra chave para o cancelamento seguinte a um sucesso', async () => {
    const { service, cancelar } = preparar([sucesso]);

    await executar(service);
    await executar(service);

    expect(chaveDe(cancelar, 1)).not.toBe(chaveDe(cancelar, 0));
  });

  it('troca a chave quando o motivo muda, mesmo sem a falha ter dado resposta definitiva', async () => {
    const { service, cancelar } = preparar([falha(500, 'uniplus.teste.falha')]);

    await executar(service, MOTIVO);
    await executar(service, 'Passei em outro processo');

    expect(chaveDe(cancelar, 1)).not.toBe(chaveDe(cancelar, 0));
  });

  it('trata a ausência de motivo como um motivo: mantém a chave ao repeti-la e troca ao informar um', async () => {
    const retida = falha(500, 'uniplus.teste.falha');
    const { service, cancelar } = preparar([retida, retida]);

    await executar(service, null);
    await executar(service, null);
    await executar(service, MOTIVO);

    expect(chaveDe(cancelar, 1)).toBe(chaveDe(cancelar, 0));
    expect(chaveDe(cancelar, 2)).not.toBe(chaveDe(cancelar, 1));
  });

  it('troca a chave quando o processo muda, com o mesmo motivo', async () => {
    const { service, cancelar } = preparar([falha(500, 'uniplus.teste.falha')]);

    await firstValueFrom(service.cancelar('p1', MOTIVO));
    await firstValueFrom(service.cancelar('p2', MOTIVO));

    expect(chaveDe(cancelar, 1)).not.toBe(chaveDe(cancelar, 0));
  });

  describe('quando a leitura do ETag falha no meio da repetição', () => {
    const quandoLeituraFalha = async (status: number, code: string) => {
      const leituras = [of(inscricao), of(falha(status, code)), of(inscricao)];
      const { service, cancelar } = preparar([falha(500, 'uniplus.teste.falha')], leituras);
      await executar(service);
      const falhaDaLeitura = await executar(service);
      await executar(service);
      return { cancelar, falhaDaLeitura };
    };

    it('não cancela e devolve a falha da leitura', async () => {
      const { cancelar, falhaDaLeitura } = await quandoLeituraFalha(404, 'uniplus.teste.ausente');

      expect(falhaDaLeitura.ok).toBe(false);
      expect(cancelar).toHaveBeenCalledTimes(2);
    });

    it('descarta a chave retida quando a leitura foi recusada com 4xx', async () => {
      const { cancelar } = await quandoLeituraFalha(404, 'uniplus.teste.ausente');

      expect(chaveDe(cancelar, 1)).not.toBe(chaveDe(cancelar, 0));
    });

    it('mantém a chave retida quando a leitura falhou com 5xx', async () => {
      const { cancelar } = await quandoLeituraFalha(503, 'uniplus.teste.falha');

      expect(chaveDe(cancelar, 1)).toBe(chaveDe(cancelar, 0));
    });
  });
});
