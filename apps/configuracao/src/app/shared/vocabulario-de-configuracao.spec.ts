import { Injector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { VocabulariosDeConfiguracaoApi } from '@uniplus/shared-data/configuracao';
import { Subject, of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { carregarVocabulario } from './vocabulario-de-configuracao';

const OPCAO = { codigo: 'MUNICIPAL', rotulo: 'Município de teste' };

function carregarCom(listar: ReturnType<typeof vi.fn>) {
  TestBed.configureTestingModule({
    providers: [{ provide: VocabulariosDeConfiguracaoApi, useValue: { listar } }],
  });
  return runInInjectionContext(TestBed.inject(Injector), () =>
    carregarVocabulario('abrangencias-dia-nao-util'),
  );
}

describe('carregarVocabulario', () => {
  it('guarda as opções recebidas, com código e rótulo', () => {
    const vocabulario = carregarCom(vi.fn(() => of({ ok: true, data: [OPCAO] })));
    expect(vocabulario.opcoes()).toEqual([OPCAO]);
    expect(vocabulario.falhou()).toBe(false);
  });

  it('marca a falha quando a leitura dá erro e se recupera ao recarregar', () => {
    const listar = vi
      .fn()
      .mockReturnValueOnce(throwError(() => new Error('indisponível')))
      .mockReturnValueOnce(of({ ok: true, data: [OPCAO] }));
    const vocabulario = carregarCom(listar);
    expect(vocabulario.falhou()).toBe(true);
    expect(vocabulario.opcoes()).toEqual([]);

    vocabulario.recarregar();

    expect(vocabulario.falhou()).toBe(false);
    expect(vocabulario.opcoes()).toEqual([OPCAO]);
  });

  it('acompanha a nova leitura e evita pedidos simultâneos', () => {
    const resposta = new Subject<{ ok: true; data: (typeof OPCAO)[] }>();
    const listar = vi
      .fn()
      .mockReturnValueOnce(throwError(() => new Error()))
      .mockReturnValue(resposta);
    const vocabulario = carregarCom(listar);
    vocabulario.recarregar();
    vocabulario.recarregar();
    expect(vocabulario.carregando()).toBe(true);
    expect(listar).toHaveBeenCalledTimes(2);
    resposta.next({ ok: true, data: [OPCAO] });
    resposta.complete();
    expect(vocabulario.carregando()).toBe(false);
    expect(vocabulario.opcoes()).toEqual([OPCAO]);
  });
});
