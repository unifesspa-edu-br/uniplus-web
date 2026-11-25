import { HttpClient } from '@angular/common/http';
import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { expect, it, vi } from 'vitest';
import {
  encerrarConferenciaDoContrato,
  provedoresDeHttpComConferencia,
} from './interceptador-de-conferencia.testing';
import { ligarRelogioControlado } from './relogio-controlado.testing';

it('encaminha imediatamente e reprova a divergência com relógio controlado', async () => {
  ligarRelogioControlado();
  try {
    TestBed.configureTestingModule({ providers: [provedoresDeHttpComConferencia()] });
    TestBed.inject(HttpClient).get('/api/organizacao/rota-inexistente').subscribe();
    TestBed.inject(HttpTestingController).expectOne('/api/organizacao/rota-inexistente').flush({});
    await expect(encerrarConferenciaDoContrato()).rejects.toThrow('operação não encontrada');
  } finally {
    vi.useRealTimers();
  }
});

function criarCorpoDaUnidade() {
  return {
    nome: 'antes',
    alias: null,
    slug: null,
    sigla: null,
    codigo: null,
    unidadeSuperiorId: null,
    tipo: null,
    unidadeAcademica: true as boolean | string,
    vigenciaInicio: '2025-01-01',
    vigenciaFim: null,
  };
}

it('confere cópia do pedido antes de sua mutação', async () => {
  TestBed.configureTestingModule({ providers: [provedoresDeHttpComConferencia()] });
  const corpo = criarCorpoDaUnidade();
  TestBed.inject(HttpClient)
    .post('/api/organizacao/admin/unidades', corpo, {
      headers: { 'Idempotency-Key': 'chave', 'Content-Type': 'application/json' },
    })
    .subscribe();
  corpo.unidadeAcademica = 'inválido';
  TestBed.inject(HttpTestingController)
    .expectOne('/api/organizacao/admin/unidades')
    .flush('123e4567-e89b-12d3-a456-426614174000', {
      status: 201,
      statusText: 'Created',
      headers: { 'Content-Type': 'application/json' },
    });
  await expect(encerrarConferenciaDoContrato()).resolves.toBeUndefined();
});

it('confere cópia da resposta de sucesso antes de sua mutação', async () => {
  TestBed.configureTestingModule({ providers: [provedoresDeHttpComConferencia()] });
  TestBed.inject(HttpClient).get('/api/organizacao/unidades').subscribe();
  const resposta: unknown[] = [];
  TestBed.inject(HttpTestingController)
    .expectOne('/api/organizacao/unidades')
    .flush(resposta, {
      headers: { 'Content-Type': 'application/vnd.uniplus.unidade.v1+json' },
    });
  resposta.push('inválido');
  await expect(encerrarConferenciaDoContrato()).resolves.toBeUndefined();
});

it('confere cópia da resposta de erro', async () => {
  TestBed.configureTestingModule({ providers: [provedoresDeHttpComConferencia()] });
  TestBed.inject(HttpClient)
    .get('/api/organizacao/unidades')
    .subscribe({ error: () => undefined });
  const resposta: { status: number | string } = { status: 400 };
  TestBed.inject(HttpTestingController)
    .expectOne('/api/organizacao/unidades')
    .flush(resposta, {
      status: 400,
      statusText: 'Bad Request',
      headers: { 'Content-Type': 'application/problem+json' },
    });
  resposta.status = 'inválido';
  await expect(encerrarConferenciaDoContrato()).resolves.toBeUndefined();
});
