import { TestBed } from '@angular/core/testing';
import { SituacaoDoProcessoSeletivoCodigo } from '@uniplus/shared-data/selecao';
import { afterEach, describe, expect, it } from 'vitest';

import { umaFaseDoCronograma } from '../../../shared/fase-do-cronograma.testing';
import { FasesNoServidor } from '../../cronograma/servicos/fases-no-servidor.service';
import { FASE_ID, montarOStoreDosMotivos, type Montagem } from './motivos-da-fase.testing';

let montagem: Montagem;

afterEach(() => montagem.controller.verify());

describe('MotivosDaFaseStore: quando a escolha é liberada', () => {
  it('deixa a seção bloqueada enquanto a fase não foi gravada no cronograma', () => {
    montagem = montarOStoreDosMotivos({ faseGravada: false });

    expect(montagem.store.faseGravada()).toBe(false);
    expect(montagem.store.modo()).toBe('bloqueado');
  });

  it('libera a escolha da fase acrescentada e gravada na sessão, sem recarregar o processo', () => {
    montagem = montarOStoreDosMotivos({ faseGravada: false });
    expect(montagem.store.modo()).toBe('bloqueado');

    TestBed.inject(FasesNoServidor).registrarGravadas([
      umaFaseDoCronograma({ faseCanonicaId: FASE_ID }),
    ]);

    expect(montagem.store.faseGravada()).toBe(true);
    expect(montagem.store.modo()).toBe('edicao');
  });

  it('libera a escolha quando a fase está gravada, o processo é rascunho e a pessoa pode configurar', () => {
    montagem = montarOStoreDosMotivos();

    expect(montagem.store.faseGravada()).toBe(true);
    expect(montagem.store.modo()).toBe('edicao');
  });

  it('bloqueia sem a permissão efetiva de configurar o processo', () => {
    montagem = montarOStoreDosMotivos({ permissoes: [] });

    expect(montagem.store.modo()).toBe('bloqueado');
  });

  it('só consulta depois da publicação', () => {
    montagem = montarOStoreDosMotivos({ situacao: SituacaoDoProcessoSeletivoCodigo.PUBLICADO });

    expect(montagem.store.modo()).toBe('consulta');
  });

  it('bloqueia enquanto outra gravação do processo está em curso', () => {
    montagem = montarOStoreDosMotivos();

    montagem.processo.salvando.set(true);

    expect(montagem.store.modo()).toBe('bloqueado');
  });
});
