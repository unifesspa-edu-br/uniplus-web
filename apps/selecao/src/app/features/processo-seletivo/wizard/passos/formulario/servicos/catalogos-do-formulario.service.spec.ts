import { TestBed } from '@angular/core/testing';
import { HttpHeaders } from '@angular/common/http';
import { ProblemI18nService, apiOk } from '@uniplus/shared-core/http';
import {
  FatosCandidatoApi,
  TermosConsentimentoApi,
  VocabulariosDeConfiguracaoApi,
} from '@uniplus/shared-data/configuracao';
import { TIPOS_DE_CAMPO_SIMULADOS, rotuloSimuladoDoTipoDeCampo } from '@uniplus/shared-testing';
import { Subject } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';

import { CatalogosDoFormulario } from './catalogos-do-formulario.service';

describe('CatalogosDoFormulario', () => {
  let termos: Subject<unknown>;
  let tiposDeCampo: Subject<unknown>;
  let servico: CatalogosDoFormulario;

  beforeEach(() => {
    termos = new Subject<unknown>();
    tiposDeCampo = new Subject<unknown>();
    TestBed.configureTestingModule({
      providers: [
        CatalogosDoFormulario,
        { provide: ProblemI18nService, useValue: { resolve: () => ({ title: 'Erro' }) } },
        { provide: FatosCandidatoApi, useValue: { listar: () => new Subject() } },
        { provide: TermosConsentimentoApi, useValue: { listarComVersoes: () => termos } },
        { provide: VocabulariosDeConfiguracaoApi, useValue: { listar: () => tiposDeCampo } },
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

  it('guarda as duas identidades das versões e as invalida ao recarregar', () => {
    servico.carregarTermos();
    termos.next({
      ok: true,
      data: [
        {
          id: 't1',
          codigo: 'TERMO',
          nome: 'Termo',
          versoes: [{ id: 'v1', numero: 2, promovidaEm: '2026-01-01T00:00:00Z' }],
        },
      ],
    });
    expect(servico.referenciasDosTermos()).toEqual([
      { termoId: 't1', termoCodigo: 'TERMO', versaoId: 'v1', versaoNumero: 2 },
    ]);
    expect(servico.termosDisponiveis()[0].versoes[0].versaoId).toBe('v1');
    servico.carregarTermos();
    expect(servico.referenciasDosTermos()).toBeNull();
  });

  it('lê os tipos de campo da API e dá a cada código o rótulo recebido', () => {
    servico.tiposDeCampo.carregar();

    tiposDeCampo.next(apiOk(TIPOS_DE_CAMPO_SIMULADOS, 200, new HttpHeaders()));

    expect(servico.tiposDeCampo.itens()).toEqual(TIPOS_DE_CAMPO_SIMULADOS);
    expect(servico.tiposDeCampo.rotulo()('DATA')).toBe(rotuloSimuladoDoTipoDeCampo('DATA'));
    expect(servico.tiposDeCampo.erro()).toBeNull();
  });

  it('deixa a lista vazia e avisa sem expor a resposta quando a leitura dos tipos de campo falha', () => {
    servico.tiposDeCampo.carregar();

    tiposDeCampo.next({ ok: false, problem: { detail: 'corpo da resposta' } });

    expect(servico.tiposDeCampo.itens()).toEqual([]);
    expect(servico.tiposDeCampo.erro()).toBe('Não foi possível carregar os tipos de campo.');
  });
});
