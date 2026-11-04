import { HttpHeaders } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { apiOk, type ApiResult } from '@uniplus/shared-core/http';
import type { ProcessoSeletivoDto } from '@uniplus/shared-data/selecao';
import { describe, expect, it, vi } from 'vitest';

import { ProcessoSeletivoStore } from '../processo-seletivo.store';
import { CadastroInicial } from './cadastro-inicial.service';
import { ReleituraDoSnapshot, relerProcessoAPedido } from './releitura-do-snapshot.service';

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
    classificacao: {
      resolucaoPesoAreaEnem: resolucao,
      quadroPesoAreaEnem: [
        { grupoAreaEnem: { codigo: 'G', rotulo: 'G' }, baseLegal: 'Anexo I', areas: [] },
      ],
    },
  } as unknown as ProcessoSeletivoDto;
}

function montar(leituras: Promise<ApiResult<ProcessoSeletivoDto>>[]) {
  const fila = [...leituras];
  TestBed.configureTestingModule({
    providers: [
      ProcessoSeletivoStore,
      ReleituraDoSnapshot,
      { provide: CadastroInicial, useValue: { obterDetalhe: () => fila.shift() } },
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

    expect(store.classificacao.copiaCongeladaEmVigor()?.resolucao).toBe('Resolução nova');
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
    expect(store.classificacao.copiaCongeladaEmVigor()?.resolucao).toBe('Resolução nova');
  });

  it('repõe os critérios de desempate que o processo tem, junto com a classificação', async () => {
    const leitura = leituraPendente();
    const { store, releitura } = montar([leitura.promessa]);
    store.classificacao.criteriosDesempateGravados.set(null);

    const relendo = releitura.reler();
    leitura.responder({
      ...detalheCom('Resolução nova'),
      criteriosDesempate: [
        {
          id: 'c1',
          ordem: 1,
          regra: { codigo: 'DESEMPATE-MAIOR-NOTA-AREA-ENEM', versao: '1' },
          etapaRef: null,
          idadeMinima: null,
          fato: null,
          operador: null,
          valor: null,
          areas: ['REDACAO'],
        },
      ],
    } as unknown as ProcessoSeletivoDto);
    await relendo;

    expect(
      store.classificacao.criteriosDesempateGravados()?.map((criterio) => criterio.areas),
    ).toEqual([['REDACAO']]);
  });

  it('confirma a cópia presumida com o que o servidor congelou', async () => {
    const leitura = leituraPendente();
    const { store, releitura } = montar([leitura.promessa]);
    store.classificacao.registrarGravadaComQuadro('Resolução nova', []);
    expect(store.classificacao.copiaCongeladaEmVigor()).toBeNull();

    const relendo = releitura.reler();
    leitura.responder(detalheCom('Resolução nova'));
    await relendo;

    expect(store.classificacao.motivoDaReleitura()).not.toBe('por-confirmar');
    expect(
      store.classificacao.copiaCongeladaEmVigor()?.grupos.map((grupo) => grupo.codigo),
    ).toEqual(['G']);
  });

  it('a falha da releitura deixa a cópia por confirmar, sem rebaixá-la a desconhecida', async () => {
    const { store, releitura } = montar([Promise.reject(new Error('rede'))]);
    store.classificacao.registrarGravadaComQuadro('Resolução nova', []);

    await releitura.reler();

    expect(store.classificacao.motivoDaReleitura()).toBe('por-confirmar');
    expect(store.classificacao.motivoDaReleitura()).not.toBe('desconhecida');
  });

  it('a falha da releitura pedida pelos critérios desconhecidos não rebaixa a classificação sabida', async () => {
    const leitura = leituraPendente();
    const { store, releitura } = montar([leitura.promessa, Promise.reject(new Error('rede'))]);
    const primeira = releitura.reler();
    leitura.responder(detalheCom('Resolução nova'));
    await primeira;
    store.classificacao.criteriosDesempateGravados.set(null);

    await releitura.reler();

    expect(store.classificacao.copiaCongeladaEmVigor()?.resolucao).toBe('Resolução nova');
    expect(store.classificacao.criteriosDesempateGravados()).toBeNull();
  });
});

describe('ReleituraDoSnapshot.gravando', () => {
  it('descarta a leitura em curso e, com a classificação desconhecida, relê depois de gravar', async () => {
    const antiga = leituraPendente();
    const nova = leituraPendente();
    const { store, releitura } = montar([antiga.promessa, nova.promessa]);
    const emCurso = releitura.reler();
    store.classificacao.marcarDesconhecida();

    const gravacao = releitura.gravando(async () => 'gravado');
    antiga.responder(detalheCom('Resolução antiga'));
    await expect(emCurso).resolves.toBe(false);
    nova.responder(detalheCom('Resolução nova'));

    await expect(gravacao).resolves.toBe('gravado');
    expect(store.classificacao.copiaCongeladaEmVigor()?.resolucao).toBe('Resolução nova');
  });

  it('com a cópia por confirmar, relê depois de gravar', async () => {
    const leitura = leituraPendente();
    const { store, releitura } = montar([leitura.promessa]);

    const gravacao = releitura.gravando(async () =>
      store.classificacao.registrarGravadaComQuadro('Resolução nova', []),
    );
    await new Promise((resolve) => setTimeout(resolve));
    leitura.responder(detalheCom('Resolução nova'));
    await gravacao;

    expect(store.classificacao.copiaCongeladaEmVigor()?.resolucao).toBe('Resolução nova');
  });

  it('com os critérios de desempate desconhecidos, relê depois de gravar', async () => {
    const { store, releitura } = montar([]);
    const reler = vi.spyOn(releitura, 'reler').mockResolvedValue(true);

    await releitura.gravando(async () => store.classificacao.criteriosDesempateGravados.set(null));

    expect(reler).toHaveBeenCalledTimes(1);
  });

  it('relê mesmo quando a gravação lança: a leitura descartada era a que resolveria', async () => {
    const { store, releitura } = montar([]);
    const reler = vi.spyOn(releitura, 'reler').mockResolvedValue(true);
    store.classificacao.marcarDesconhecida();

    await expect(
      releitura.gravando(async () => {
        throw new Error('falha fora do envelope');
      }),
    ).rejects.toThrow('falha fora do envelope');

    expect(reler).toHaveBeenCalledTimes(1);
  });

  it('com o que o servidor tem já sabido, não relê', async () => {
    const { releitura } = montar([]);
    const reler = vi.spyOn(releitura, 'reler');

    await releitura.gravando(async () => undefined);

    expect(reler).not.toHaveBeenCalled();
  });

  it('depois de uma troca de processo não relê: o processo novo traz a leitura dele', async () => {
    const { store, releitura } = montar([]);
    const reler = vi.spyOn(releitura, 'reler');

    await releitura.gravando(async () => {
      store.reset();
      store.classificacao.marcarDesconhecida();
    });

    expect(reler).not.toHaveBeenCalled();
  });

  it('na varredura da publicação não relê: ela relê uma vez no fim', async () => {
    const { store, releitura } = montar([]);
    const reler = vi.spyOn(releitura, 'reler');
    store.classificacao.marcarDesconhecida();
    store.travamentoDeOrquestracao.set(true);

    await releitura.gravando(async () => undefined);

    expect(reler).not.toHaveBeenCalled();
  });
});

describe('relerProcessoAPedido', () => {
  it('liga o sinal enquanto a releitura corre e não começa outra antes de ela acabar', async () => {
    let terminar!: (decidiu: boolean) => void;
    const reler = vi.fn(() => new Promise<boolean>((resolve) => (terminar = resolve)));
    const relendo = signal(false);

    const primeira = relerProcessoAPedido({ reler }, relendo);
    expect(relendo()).toBe(true);
    await expect(relerProcessoAPedido({ reler }, relendo)).resolves.toBe(false);

    terminar(true);
    await expect(primeira).resolves.toBe(true);
    expect(relendo()).toBe(false);
    expect(reler).toHaveBeenCalledTimes(1);
  });
});
