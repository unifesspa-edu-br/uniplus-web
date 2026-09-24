import { HttpHeaders } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { apiOk, type ApiResult } from '@uniplus/shared-core/http';
import type { ProcessoSeletivoDto } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import { ProcessoSeletivoStore } from '../processo-seletivo.store';
import { CadastroInicialService } from './cadastro-inicial.service';
import { ReleituraDoSnapshot } from './releitura-do-snapshot.service';

/** Uma leitura do detalhe que o teste resolve quando quiser. */
function leituraPendente() {
  let responder!: (dto: ProcessoSeletivoDto) => void;
  const promessa = new Promise<ApiResult<ProcessoSeletivoDto>>((resolve) => {
    responder = (dto) => resolve(apiOk(dto, 200, new HttpHeaders()));
  });
  return { promessa, responder };
}

function detalheCom(resolucao: string): ProcessoSeletivoDto {
  return {
    id: 'processo-1',
    classificacao: { resolucaoPesoAreaEnem: resolucao, quadroPesoAreaEnem: [] },
  } as unknown as ProcessoSeletivoDto;
}

function montar(leituras: Promise<ApiResult<ProcessoSeletivoDto>>[]) {
  const fila = [...leituras];
  TestBed.configureTestingModule({
    providers: [
      ProcessoSeletivoStore,
      ReleituraDoSnapshot,
      { provide: CadastroInicialService, useValue: { obterDetalhe: () => fila.shift() } },
    ],
  });
  const store = TestBed.inject(ProcessoSeletivoStore);
  store.processoSeletivoId.set('processo-1');
  return { store, releitura: TestBed.inject(ReleituraDoSnapshot) };
}

describe('ReleituraDoSnapshot', () => {
  it('a resposta de uma leitura superada não sobrescreve a da mais nova', async () => {
    const antiga = leituraPendente();
    const nova = leituraPendente();
    const { store, releitura } = montar([antiga.promessa, nova.promessa]);

    const primeira = releitura.reler();
    const segunda = releitura.reler();
    nova.responder(detalheCom('Resolução nova'));
    await expect(segunda).resolves.toBe(true);
    antiga.responder(detalheCom('Resolução antiga'));
    await expect(primeira).resolves.toBe(false);

    expect(store.quadroPesoAreaEnemCongelado()?.resolucao).toBe('Resolução nova');
  });

  it('atualiza só a classificação: o detalhe de que outros passos derivam estado fica intacto', async () => {
    const leitura = leituraPendente();
    const { store, releitura } = montar([leitura.promessa]);
    const anterior = { id: 'processo-1', cascata: { id: 'c' } } as unknown as ProcessoSeletivoDto;
    store.remoteSnapshot.set(anterior);

    const relendo = releitura.reler();
    leitura.responder(detalheCom('Resolução nova'));
    await relendo;

    expect(store.remoteSnapshot()).toBe(anterior);
    expect(store.quadroPesoAreaEnemCongelado()?.resolucao).toBe('Resolução nova');
  });
});
