import { TestBed } from '@angular/core/testing';
import { ProblemI18nService } from '@uniplus/shared-core/http';
import { FatosCandidatoApi, TermosConsentimentoApi } from '@uniplus/shared-data/configuracao';
import { Subject } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';

import { CatalogosDoFormulario } from './catalogos-do-formulario.service';

describe('CatalogosDoFormulario', () => {
  let termos: Subject<unknown>;
  let servico: CatalogosDoFormulario;

  beforeEach(() => {
    termos = new Subject<unknown>();
    TestBed.configureTestingModule({
      providers: [
        CatalogosDoFormulario,
        { provide: ProblemI18nService, useValue: { resolve: () => ({ title: 'Erro' }) } },
        { provide: FatosCandidatoApi, useValue: { listar: () => new Subject() } },
        { provide: TermosConsentimentoApi, useValue: { listarComVersoes: () => termos } },
      ],
    });
    servico = TestBed.inject(CatalogosDoFormulario);
  });

  it('sobe a espera dos termos antes da resposta e a derruba junto da falha', () => {
    servico.carregarTermos();
    expect(servico.termosCarregando()).toBe(true);
    expect(servico.termosErro()).toBeNull();

    termos.next({ ok: false });

    expect(servico.termosCarregando()).toBe(false);
    expect(servico.termosErro()).toContain('termos de consentimento');
  });

  it('apaga a falha dos termos ao tentar de novo', () => {
    servico.carregarTermos();
    termos.next({ ok: false });

    servico.carregarTermos();

    expect(servico.termosErro()).toBeNull();
    expect(servico.termosCarregando()).toBe(true);
  });
});
