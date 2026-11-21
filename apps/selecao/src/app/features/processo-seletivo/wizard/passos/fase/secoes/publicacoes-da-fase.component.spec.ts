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
  let nativo: HTMLElement;
  let raiz: DebugElement;
  let comCronograma: (...fases: readonly FaseDoCronograma[]) => void;

  const publicacoes = () =>
    raiz.query(By.directive(PublicacoesDaFaseComponent))
      .componentInstance as PublicacoesDaFaseComponent;

  beforeEach(async () => {
    ({ store, controller, detectar, nativo, raiz, comCronograma } = await montarFase());
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

  describe('orientação de publicar também o definitivo', () => {
    const ORIENTACAO =
      'Para cada publicação com o papel "Resultado preliminar", a fase precisa ter também a mesma publicação com o papel "Resultado definitivo".';
    const orientacao = () => nativo.querySelector('#fase-AVALIACAO-produtos-definitivo');
    const controle = (sufixo: string) =>
      nativo.querySelector(`#fase-AVALIACAO-${sufixo}-0`) as HTMLSelectElement;
    const descritoPor = (sufixo: string) =>
      (controle(sufixo).getAttribute('aria-describedby') ?? '').split(' ');

    it('aparece na fase que publica resultado preliminar', () => {
      comCronograma(
        fase({ produtos: [{ atoCodigo: 'RESULTADO_PRELIMINAR', papel: 'PRELIMINAR' }] }),
      );

      expect(orientacao()?.textContent?.replace(/\s+/g, ' ').trim()).toBe(ORIENTACAO);
    });

    it.each([
      ['sem publicação', []],
      ['só com definitivo', [{ atoCodigo: 'RESULTADO_FINAL', papel: 'DEFINITIVO' }]],
      ['só com ato que não é resultado', [{ atoCodigo: 'COMUNICADO', papel: null }]],
    ])('não aparece na fase %s', (_caso, produtos) => {
      comCronograma(fase({ produtos }));

      expect(orientacao()).toBeNull();
    });

    it('descreve o seletor do ato e o do papel de cada publicação', () => {
      comCronograma(
        fase({ produtos: [{ atoCodigo: 'RESULTADO_PRELIMINAR', papel: 'PRELIMINAR' }] }),
      );

      expect(descritoPor('produto-ato')).toEqual([
        'fase-AVALIACAO-produtos-ajuda',
        'fase-AVALIACAO-produtos-definitivo',
      ]);
      expect(descritoPor('produto-papel')).toEqual(descritoPor('produto-ato'));
    });

    it('acompanha a troca do papel da publicação', () => {
      comCronograma(
        fase({ produtos: [{ atoCodigo: 'RESULTADO_PRELIMINAR', papel: 'PRELIMINAR' }] }),
      );

      publicacoes().escolherPapel(0, '');
      detectar();
      expect(orientacao()).toBeNull();
      expect(descritoPor('produto-papel')).toEqual(['fase-AVALIACAO-produtos-ajuda']);

      publicacoes().escolherPapel(0, 'PRELIMINAR');
      detectar();
      expect(orientacao()).not.toBeNull();
    });
  });
});
