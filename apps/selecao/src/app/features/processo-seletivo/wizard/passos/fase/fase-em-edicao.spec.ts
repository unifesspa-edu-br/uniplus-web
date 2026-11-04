import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { HttpTestingController } from '@angular/common/http/testing';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { FaseEmEdicao } from './fase-em-edicao';
import { montarFase } from './fase.testing';

describe('FaseEmEdicao', () => {
  let controller: HttpTestingController;
  let detectar: () => void;
  let emEdicao: FaseEmEdicao;

  beforeEach(async () => {
    const montada = await montarFase();
    ({ controller, detectar } = montada);
    emEdicao = montada.raiz.injector.get(FaseEmEdicao);
  });

  afterEach(() => controller.verify());

  it('esquece a recusa do processo anterior quando outro processo entra em cena', () => {
    emEdicao.recusaPorCampo.set(new Map([['produtos', 'Escolha o tipo de ato.']]));
    emEdicao.recusasGerais.set(['O servidor recusou a gravação.']);

    TestBed.inject(ProcessoSeletivoStore).reset();
    detectar();

    expect(emEdicao.recusaPorCampo().size).toBe(0);
    expect(emEdicao.recusasGerais()).toEqual([]);
  });
});
