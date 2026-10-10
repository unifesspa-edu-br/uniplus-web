import { HttpHeaders } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { apiFailure, apiOk } from '@uniplus/shared-core/http';
import {
  type ComprovanteInscricaoDto,
  InscricoesApi,
  SELECAO_BASE_PATH,
} from '@uniplus/shared-data/selecao';
import { provideHttpClient } from '@angular/common/http';

import { MinhasInscricoesService } from './minhas-inscricoes.service';

const PROCESSO = '0199e000-0000-7000-8000-0000000000d1';

function comprovante(numeroInscricao: string): ComprovanteInscricaoDto {
  return { numeroInscricao } as ComprovanteInscricaoDto;
}

describe('MinhasInscricoesService', () => {
  let emitidos: number;
  const pedidos: number[] = [];

  beforeEach(() => {
    pedidos.length = 0;
    const api = {
      obterComprovante: (_: string, numero: number) => {
        pedidos.push(numero);
        return of(
          numero <= emitidos
            ? apiOk(comprovante(`submissao-${numero}`), 200, new HttpHeaders())
            : apiFailure(
                {
                  type: 'about:blank',
                  title: 'Não encontrado',
                  status: 404,
                  code: 'uniplus.selecao.inscricao.comprovante_nao_encontrado',
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
        { provide: InscricoesApi, useValue: api },
        { provide: SELECAO_BASE_PATH, useValue: 'http://localhost:5000' },
      ],
    });
  });

  it('o comprovante mais recente é o da última submissão, depois de uma correção (CA-02)', async () => {
    emitidos = 2;

    const resultado = await firstValueFrom(
      TestBed.inject(MinhasInscricoesService).comprovanteMaisRecente(PROCESSO),
    );

    expect(resultado.ok && resultado.data.numero).toBe(2);
    expect(resultado.ok && resultado.data.comprovante.numeroInscricao).toBe('submissao-2');
    expect(pedidos).toEqual([1, 2, 3]);
  });

  it('sem nenhuma submissão, devolve a recusa do servidor', async () => {
    emitidos = 0;

    const resultado = await firstValueFrom(
      TestBed.inject(MinhasInscricoesService).comprovanteMaisRecente(PROCESSO),
    );

    expect(resultado.ok).toBe(false);
    expect(resultado.status).toBe(404);
  });
});
