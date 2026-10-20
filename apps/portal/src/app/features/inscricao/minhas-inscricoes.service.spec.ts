import { HttpClient, type HttpContext, HttpHeaders, provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { apiFailure, apiOk } from '@uniplus/shared-core/http';
import { IDEMPOTENCY_KEY_TOKEN } from '@uniplus/shared-core/idempotency';
import { GeoApi } from '@uniplus/shared-data/geo';
import { InscricoesApi, SELECAO_BASE_PATH } from '@uniplus/shared-data/selecao';

import { MinhasInscricoesService } from './minhas-inscricoes.service';

describe('MinhasInscricoesService.nomesDosMunicipios', () => {
  it('lê cada código uma vez e deixa de fora o que o Geo não devolve', async () => {
    const lidos: string[] = [];
    const geo = {
      obterCidade: (codigo: string) => {
        lidos.push(codigo);
        return of(
          codigo === '5002704'
            ? apiOk({ codigoIbge: codigo, nome: 'Campo Grande', uf: 'MS' }, 200, new HttpHeaders())
            : apiFailure(
                {
                  type: 'about:blank',
                  title: 'Não encontrada',
                  status: 404,
                  code: 'cidade_nao_encontrada',
                  traceId: '',
                },
                404,
                new HttpHeaders(),
              ),
        );
      },
    };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        { provide: GeoApi, useValue: geo },
        { provide: SELECAO_BASE_PATH, useValue: 'http://localhost:5000' },
      ],
    });

    const nomes = await firstValueFrom(
      TestBed.inject(MinhasInscricoesService).nomesDosMunicipios(['5002704', '9999999']),
    );

    expect(lidos).toEqual(['5002704', '9999999']);
    expect([...nomes]).toEqual([['5002704', 'Campo Grande — MS']]);
  });
});

describe('MinhasInscricoesService.certame', () => {
  const falha = (status: number) =>
    apiFailure(
      { type: 'about:blank', title: 'Falha', status, code: 'falha', traceId: '' },
      status,
      new HttpHeaders(),
    );

  function certameCom(resposta: ReturnType<typeof falha>) {
    TestBed.configureTestingModule({
      providers: [
        { provide: HttpClient, useValue: { get: () => of(resposta) } },
        { provide: GeoApi, useValue: {} },
        { provide: SELECAO_BASE_PATH, useValue: 'http://localhost:5000' },
      ],
    });
    return firstValueFrom(TestBed.inject(MinhasInscricoesService).certame('processo-1'));
  }

  it('o certame não publicado (404) vem como nulo', async () => {
    const certame = await certameCom(falha(404));

    expect(certame.ok && certame.data).toBeNull();
  });

  it('a falha transitória segue como falha, não como certame não publicado', async () => {
    const certame = await certameCom(falha(503));

    expect(certame.ok).toBe(false);
    expect(certame.status).toBe(503);
  });
});

describe('MinhasInscricoesService.cancelar e descartar', () => {
  const semCabecalhos = new HttpHeaders();
  const falha = (status: number, code: string) =>
    apiFailure(
      { type: 'about:blank', title: 'Falha', status, code, traceId: '' },
      status,
      semCabecalhos,
    );
  const inscricao = apiOk({ eTag: '"i1:3"' }, 200, semCabecalhos);

  function servico(api: Record<string, unknown>) {
    TestBed.configureTestingModule({
      providers: [
        { provide: InscricoesApi, useValue: api },
        { provide: GeoApi, useValue: {} },
        { provide: HttpClient, useValue: {} },
        { provide: SELECAO_BASE_PATH, useValue: 'http://localhost:5000' },
      ],
    });
    return TestBed.inject(MinhasInscricoesService);
  }

  const chaveDe = (contexto: HttpContext): string => contexto.get(IDEMPOTENCY_KEY_TOKEN);

  it('age com o ETag que a inscrição tem agora, e sem ele não age', async () => {
    const descartar = vi.fn(() => of(apiOk<void>(undefined, 204, semCabecalhos)));
    const obter = vi
      .fn()
      .mockReturnValueOnce(of(inscricao))
      .mockReturnValueOnce(of(falha(404, 'nao_encontrada')));
    const service = servico({ obter, descartar });

    await firstValueFrom(service.descartar('p1'));
    const semInscricao = await firstValueFrom(service.descartar('p1'));

    expect(descartar).toHaveBeenCalledExactlyOnceWith('p1', '"i1:3"');
    expect(semInscricao.ok).toBe(false);
  });

  it('repete a Idempotency-Key quando nada foi gravado e troca por uma nova depois de uma recusa', async () => {
    const cancelar = vi
      .fn()
      .mockReturnValueOnce(of(falha(503, 'indisponivel')))
      .mockReturnValueOnce(of(falha(422, 'recusado')))
      .mockReturnValue(of(apiOk<void>(undefined, 204, semCabecalhos)));
    const service = servico({ obter: () => of(inscricao), cancelar });

    for (let i = 0; i < 3; i++) await firstValueFrom(service.cancelar('p1', 'Mudei de curso'));
    const [, , , primeira] = cancelar.mock.calls[0];
    const [, , , segunda] = cancelar.mock.calls[1];
    const [, , , terceira] = cancelar.mock.calls[2];

    expect(chaveDe(segunda)).toBe(chaveDe(primeira));
    expect(chaveDe(terceira)).not.toBe(chaveDe(segunda));
  });
});
