import { HttpContext, HttpHeaders } from '@angular/common/http';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import {
  ChaveDeSubstituicao,
  apiFailure,
  apiOk,
  type ProblemDetails,
} from '@uniplus/shared-core/http';
import { conflitoRetentavel, enviarComRetentativa } from './envio-com-retentativa';

const problema = (status: number, code: string, retryable?: boolean): ProblemDetails => ({
  type: 'x',
  title: 't',
  status,
  code,
  traceId: '',
  ...(retryable === undefined ? {} : { retryable }),
});

const CONFLITO = problema(409, 'uniplus.concorrencia.conflito', true);
const SEM_CABECALHOS = new HttpHeaders();
const recusa = (p: ProblemDetails) => apiFailure(p, p.status, SEM_CABECALHOS);

describe('enviarComRetentativa', () => {
  it('só o 409 marcado retentável se repete', () => {
    expect(conflitoRetentavel(CONFLITO)).toBe(true);
    expect(conflitoRetentavel(problema(409, 'uniplus.autorizacao.providencia.ja_respondida'))).toBe(
      false,
    );
    expect(conflitoRetentavel(problema(422, 'x', true))).toBe(false);
    expect(
      conflitoRetentavel(problema(409, 'uniplus.autorizacao.providencia.ja_atendida', true)),
    ).toBe(false);
  });

  it('repete uma vez, com a mesma chave, o conflito retentável', async () => {
    const contextos: HttpContext[] = [];
    const enviar = vi.fn((contexto: HttpContext) => {
      contextos.push(contexto);
      return of(contextos.length === 1 ? recusa(CONFLITO) : apiOk({ ok: 1 }, 200, SEM_CABECALHOS));
    });

    const resultado = await enviarComRetentativa(new ChaveDeSubstituicao(), { a: 1 }, enviar);

    expect(resultado.ok).toBe(true);
    expect(enviar).toHaveBeenCalledTimes(2);
    expect(contextos[1]).toBe(contextos[0]);
  });

  it('não repete de novo quando a repetição também é recusada', async () => {
    const enviar = vi.fn(() => of(recusa(CONFLITO)));

    const resultado = await enviarComRetentativa(new ChaveDeSubstituicao(), { a: 1 }, enviar);

    expect(resultado.ok).toBe(false);
    expect(enviar).toHaveBeenCalledTimes(2);
  });

  it('não repete o 409 que não é retentável', async () => {
    const enviar = vi.fn(() =>
      of(recusa(problema(409, 'uniplus.autorizacao.providencia.ja_atendida'))),
    );

    await enviarComRetentativa(new ChaveDeSubstituicao(), { a: 1 }, enviar);

    expect(enviar).toHaveBeenCalledTimes(1);
  });
});
