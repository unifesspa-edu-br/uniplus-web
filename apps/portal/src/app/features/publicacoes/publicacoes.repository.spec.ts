import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { describe, expect, it } from 'vitest';

import { MOCK_PUBLICACOES } from './publicacoes.mock';
import { PublicacoesRepository } from './publicacoes.repository';

describe('PublicacoesRepository', () => {
  it('devolve só os processos ainda não finalizados', async () => {
    TestBed.configureTestingModule({});
    const repositorio = TestBed.inject(PublicacoesRepository);

    const publicacoes = await firstValueFrom(repositorio.listarNaoFinalizadas());

    expect(publicacoes.length).toBeGreaterThan(0);
    expect(publicacoes.every((publicacao) => publicacao.situacao !== 'encerrado')).toBe(true);
    expect(publicacoes.length).toBeLessThan(MOCK_PUBLICACOES.length);
  });

  it('simula latência de rede — não emite no mesmo tick da inscrição', () => {
    TestBed.configureTestingModule({});
    const repositorio = TestBed.inject(PublicacoesRepository);

    let emitiu = false;
    repositorio.listarNaoFinalizadas().subscribe(() => {
      emitiu = true;
    });

    expect(emitiu).toBe(false);
  });

  it('buscarPorId encontra até processos já finalizados — a listagem os esconde, o detalhe não', async () => {
    TestBed.configureTestingModule({});
    const repositorio = TestBed.inject(PublicacoesRepository);
    const finalizada = MOCK_PUBLICACOES.find((publicacao) => publicacao.situacao === 'encerrado');
    if (!finalizada) {
      throw new Error(
        'Mock precisa de ao menos um processo encerrado para este teste fazer sentido.',
      );
    }

    const publicacao = await firstValueFrom(repositorio.buscarPorId(finalizada.id));

    expect(publicacao?.id).toBe(finalizada.id);
  });

  it('buscarPorId devolve undefined para um id que não existe', async () => {
    TestBed.configureTestingModule({});
    const repositorio = TestBed.inject(PublicacoesRepository);

    const publicacao = await firstValueFrom(repositorio.buscarPorId('id-que-nao-existe'));

    expect(publicacao).toBeUndefined();
  });
});
