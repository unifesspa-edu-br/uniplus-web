import { HttpHeaders } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { apiFailure, apiOk, ProblemI18nService } from '@uniplus/shared-core/http';
import { ProcessosSeletivosApi } from '@uniplus/shared-data/selecao';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { detalhe } from '../../../../processo-seletivo.retomada.testing';
import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { rascunhoInicial } from '../../../rascunho-inicial';
import { CadastroInicial } from '../../../shared/cadastro-inicial.service';
import { GravacaoDosCamposPressupostos } from '../../../shared/campos-pressupostos.service';
import { GravacaoDasExigenciasDocumentais } from './gravacao-das-exigencias-documentais.service';

const headers = new HttpHeaders();
const problema = { type: '', title: '', status: 500, code: '', traceId: '' };
const obter = vi.fn();
const garantirCampos = vi.fn();
const definirDocumentosExigidos = vi.fn();

beforeEach(() => {
  obter.mockReset();
  garantirCampos.mockReset();
  definirDocumentosExigidos.mockReset();
  TestBed.configureTestingModule({
    providers: [
      GravacaoDasExigenciasDocumentais,
      {
        provide: ProcessoSeletivoStore,
        useValue: { geracao: () => 1, draft: rascunhoInicial, modalidadesDoProcesso: () => [] },
      },
      { provide: ProcessosSeletivosApi, useValue: { obter } },
      { provide: CadastroInicial, useValue: { definirDocumentosExigidos } },
      {
        provide: GravacaoDosCamposPressupostos,
        useValue: { garantirCampos, coletaTudo: () => false },
      },
      { provide: ProblemI18nService, useValue: {} },
    ],
  });
});

describe('gravação das exigências documentais', () => {
  it('orienta nova tentativa quando a releitura das fases falha', async () => {
    obter.mockReturnValue(of(apiFailure(problema, 500, headers)));
    const resultado = await TestBed.inject(GravacaoDasExigenciasDocumentais).gravar('processo');
    expect(resultado.valid).toBe(false);
    expect(resultado.messages?.[0]).toContain('não foi possível reler as fases');
    expect(garantirCampos).not.toHaveBeenCalled();
  });

  it('pede fase de inscrição quando um dado necessário não é coletado', async () => {
    obter.mockReturnValue(of(apiOk(detalhe(), 200, headers)));
    garantirCampos.mockResolvedValue({ tipo: 'semFaseDeInscricao' });
    const resultado = await TestBed.inject(GravacaoDasExigenciasDocumentais).gravar('processo');
    expect(resultado.valid).toBe(false);
    expect(resultado.messages?.[0]).toContain('Acrescente a fase de inscrição');
    expect(definirDocumentosExigidos).not.toHaveBeenCalled();
  });
});
