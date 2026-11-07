import { TestBed } from '@angular/core/testing';
import { HttpHeaders } from '@angular/common/http';
import { apiOk } from '@uniplus/shared-core/http';
import { FatosCandidatoApi } from '@uniplus/shared-data/configuracao';
import { Subject } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';

import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { FatosDoDesempate } from './fatos-do-desempate.service';

describe('FatosDoDesempate', () => {
  let resposta: Subject<unknown>;
  
  beforeEach(() => {
    resposta = new Subject<unknown>();
    TestBed.configureTestingModule({
      providers: [
        ProcessoSeletivoStore,
        FatosDoDesempate,
        {
          provide: FatosCandidatoApi,
          useValue: { listar: () => resposta },
        },
      ],
    });
  });

  it('sobe a espera antes da resposta e a derruba junto da falha', () => {
    const fatos = TestBed.inject(FatosDoDesempate);

    fatos.carregar();
    expect(fatos.pendente()).toBe(true);
    expect(fatos.falha()).toBeNull();

    resposta.next({ ok: false, problem: { status: 500 } });
    expect(fatos.pendente()).toBe(false);
    expect(fatos.falha()).not.toBeNull();
    expect(fatos.lido()).toBe(false);
  });

  it('apaga a falha ao tentar de novo e marca o catálogo como lido quando chega', () => {
    const fatos = TestBed.inject(FatosDoDesempate);
    fatos.carregar();
    resposta.next({ ok: false, problem: { status: 500 } });

    fatos.carregar();
    expect(fatos.falha()).toBeNull();
    expect(fatos.pendente()).toBe(true);

    resposta.next(apiOk([], 200, new HttpHeaders()));
    expect(fatos.pendente()).toBe(false);
    expect(fatos.lido()).toBe(true);
  });
});
