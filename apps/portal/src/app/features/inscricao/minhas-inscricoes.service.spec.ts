import { HttpClient, HttpHeaders, provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { apiFailure, apiOk } from '@uniplus/shared-core/http';
import { GeoApi } from '@uniplus/shared-data/geo';
import { SELECAO_BASE_PATH } from '@uniplus/shared-data/selecao';

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
