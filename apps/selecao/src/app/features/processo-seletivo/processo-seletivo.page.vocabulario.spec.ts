import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { TiposDeDecisaoApi } from '@uniplus/shared-data/configuracao';

import { ProcessoSeletivoPage } from './processo-seletivo.page';
import { configurarPagina } from './processo-seletivo.page.testing';
import { RESPOSTA_DO_VOCABULARIO } from './wizard/shared/decisoes-da-fase-ou-etapa/tipos-de-decisao-da-api.testing';
import { ROTULOS_DOS_PASSOS } from './wizard/processo-seletivo.data';

describe('ProcessoSeletivoPage: vocabulário de tipos de decisão', () => {
  const listar = vi.fn(() => RESPOSTA_DO_VOCABULARIO);

  beforeEach(async () => {
    listar.mockClear();
    await configurarPagina();
    TestBed.overrideProvider(TiposDeDecisaoApi, { useValue: { listar } });
  });

  function abrirNoCronograma() {
    const fixture = TestBed.createComponent(ProcessoSeletivoPage);
    fixture.detectChanges();
    fixture.componentInstance.store.goTo(ROTULOS_DOS_PASSOS.indexOf('Cronograma'));
    fixture.detectChanges();
    return fixture;
  }

  it('pede os tipos de decisão uma vez por visita ao processo', () => {
    abrirNoCronograma();

    expect(listar).toHaveBeenCalledTimes(1);
  });

  it('não guarda cópia ao sair: abrir outro processo pede de novo', () => {
    abrirNoCronograma().destroy();
    abrirNoCronograma();

    expect(listar).toHaveBeenCalledTimes(2);
  });
});
