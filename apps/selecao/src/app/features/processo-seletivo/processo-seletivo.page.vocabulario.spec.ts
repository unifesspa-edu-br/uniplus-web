import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { TiposDeDecisaoApi } from '@uniplus/shared-data/configuracao';

import { ProcessoSeletivoPage } from './processo-seletivo.page';
import { configurarPagina } from './processo-seletivo.page.testing';
import { RESPOSTA_DO_VOCABULARIO } from './wizard/shared/decisoes-da-fase-ou-etapa/tipos-de-decisao-da-api.testing';
import { VocabulariosDaRegra } from './wizard/shared/deliberacao/vocabularios-da-regra.service';
import { COLEGIADA } from './wizard/shared/deliberacao/regra-de-deliberacao.testing';
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

  it('bloqueia com aviso visível somente quando há regra e uma lista falhou', () => {
    const vocabularios = TestBed.inject(VocabulariosDaRegra);
    (vocabularios.indisponivel as ReturnType<typeof signal<boolean>>).set(true);
    const fixture = abrirNoCronograma();
    const host = fixture.nativeElement as HTMLElement;
    const avancar = () => host.querySelector<HTMLButtonElement>('.wiz-footer .btn--primary');
    expect(avancar()?.disabled).toBe(false);
    const fase = {
      faseCanonicaId: 'fase',
      codigo: 'AVALIACAO',
      ordem: 1,
      inicio: '',
      fim: '',
      unidadeResponsavelId: null,
      produtos: [],
      noMesmoMomentoDaAnterior: false,
      emiteParecerIndividual: false,
      regraRecurso: null,
      tiposDeDecisao: [],
      congelados: null,
      bancasRequeridas: [
        {
          id: null,
          identificadorLocal: 'banca',
          tipoBancaId: 'tipo',
          copiaDoTipo: null,
          categoriasDocumentoIds: [],
          regraDeDeliberacao: COLEGIADA,
        },
      ],
    };
    fixture.componentInstance.store.patchObjectSection('cronograma', { fases: [fase] });
    fixture.detectChanges();
    expect(avancar()?.disabled).toBe(true);
    expect(avancar()?.parentElement?.textContent).toContain('As opções da regra de deliberação');
  });

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
