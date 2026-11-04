import { By } from '@angular/platform-browser';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { HttpTestingController } from '@angular/common/http/testing';
import type { DebugElement } from '@angular/core';

import type { FaseDoCronograma } from '../../../processo-seletivo.models';
import type { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { fase, montarFase } from '../fase.testing';
import { PublicacoesDaFaseComponent } from './publicacoes-da-fase.component';

describe('PublicacoesDaFaseComponent', () => {
  let store: ProcessoSeletivoStore;
  let controller: HttpTestingController;
  let detectar: () => void;
  let raiz: DebugElement;
  let comCronograma: (...fases: readonly FaseDoCronograma[]) => void;

  const publicacoes = () =>
    raiz.query(By.directive(PublicacoesDaFaseComponent))
      .componentInstance as PublicacoesDaFaseComponent;

  beforeEach(async () => {
    ({ store, controller, detectar, raiz, comCronograma } = await montarFase());
  });

  afterEach(() => controller.verify());

  it('leva ao rascunho a publicação declarada na tela', () => {
    comCronograma(fase({}));

    publicacoes().acrescentarProduto();
    publicacoes().escolherAto(0, 'RESULTADO_FINAL');
    publicacoes().escolherPapel(0, 'DEFINITIVO');
    detectar();

    expect(store.draft().cronograma.fases[0].produtos).toEqual([
      { atoCodigo: 'RESULTADO_FINAL', papel: 'DEFINITIVO' },
    ]);
  });

  /**
   * Só ato que o catálogo marca como resultado recebe papel: trocar para um que
   * não é deixaria declarada uma combinação que o servidor recusa.
   */
  it('descarta o papel ao trocar para publicação que não é resultado', () => {
    comCronograma(fase({ produtos: [{ atoCodigo: 'RESULTADO_FINAL', papel: 'DEFINITIVO' }] }));

    publicacoes().escolherAto(0, 'COMUNICADO');
    detectar();

    expect(store.draft().cronograma.fases[0].produtos).toEqual([
      { atoCodigo: 'COMUNICADO', papel: null },
    ]);
  });
});
