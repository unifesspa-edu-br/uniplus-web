import { HttpHeaders } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { apiFailure, apiOk, ProblemI18nService } from '@uniplus/shared-core/http';
import type { ProcessoSeletivoDto } from '@uniplus/shared-data/selecao';
import { ProcessosSeletivosApi } from '@uniplus/shared-data/selecao';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { detalhe } from '../../../processo-seletivo.retomada.testing';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { rascunhoInicial } from '../../rascunho-inicial';
import { CadastroInicial } from '../cadastro-inicial.service';
import { GravacaoDosCamposPressupostos } from '../campos-pressupostos.service';
import { exigencia, rascunho } from './exigencias.testing';
import { GravacaoDasExigenciasDocumentais } from './gravacao-das-exigencias-documentais.service';

const headers = new HttpHeaders();
const problema = { type: '', title: '', status: 500, code: '', traceId: '' };
const obter = vi.fn();
const garantirCampos = vi.fn();
const definirDocumentosExigidos = vi.fn();
const aguardando = signal(false);
const documentos = rascunho(exigencia({ faseCodigo: 'HABILITACAO' }));
const FASE_ID = '01960000-0000-7000-0000-0000000000f2';

function processoComFormularioNaFase(formularios: readonly string[]): ProcessoSeletivoDto {
  return detalhe({
    cronogramaFases: [{ id: FASE_ID, codigo: 'HABILITACAO' }],
    formularios: formularios.map((codigo) => ({ codigo, faseId: FASE_ID })),
  } as unknown as Partial<ProcessoSeletivoDto>);
}

beforeEach(() => {
  aguardando.set(false);
  obter.mockReset();
  garantirCampos.mockReset();
  definirDocumentosExigidos.mockReset();
  TestBed.configureTestingModule({
    providers: [
      GravacaoDasExigenciasDocumentais,
      {
        provide: ProcessoSeletivoStore,
        useValue: {
          geracao: () => 1,
          draft: () => ({ ...rascunhoInicial(), documentos }),
          modalidadesDoProcesso: () => [],
          documentosExigidosAguardandoFormulario: aguardando,
        },
      },
      { provide: ProcessosSeletivosApi, useValue: { obter } },
      { provide: CadastroInicial, useValue: { definirDocumentosExigidos } },
      {
        provide: GravacaoDosCamposPressupostos,
        useValue: { garantirCampos, coletaTudo: () => false },
      },
      { provide: ProblemI18nService, useValue: { resolve: () => ({ title: 'Falha' }) } },
    ],
  });
});

describe('gravação das exigências documentais', () => {
  it('orienta nova tentativa quando a releitura das fases falha', async () => {
    obter.mockReturnValue(of(apiFailure(problema, 500, headers)));
    const resultado = await TestBed.inject(GravacaoDasExigenciasDocumentais).gravar(
      'processo',
      'Gravado.',
    );
    expect(resultado.valid).toBe(false);
    expect(resultado.messages?.[0]).toContain('Não foi possível reler as fases');
    expect(garantirCampos).not.toHaveBeenCalled();
  });

  it('pede fase de inscrição quando um dado necessário não é coletado', async () => {
    obter.mockReturnValue(of(apiOk(detalhe(), 200, headers)));
    garantirCampos.mockResolvedValue({ tipo: 'semFaseDeInscricao' });
    const resultado = await TestBed.inject(GravacaoDasExigenciasDocumentais).gravar(
      'processo',
      'Gravado.',
    );
    expect(resultado.valid).toBe(false);
    expect(resultado.messages?.[0]).toContain('Acrescente a fase de inscrição');
    expect(definirDocumentosExigidos).not.toHaveBeenCalled();
  });

  describe('formulário que o documento exige', () => {
    const gravar = () =>
      TestBed.inject(GravacaoDasExigenciasDocumentais).gravar('processo', 'Gravado.');

    beforeEach(() => {
      garantirCampos.mockResolvedValue({ tipo: 'ok' });
      definirDocumentosExigidos.mockResolvedValue({ ok: true });
    });

    it('não envia os documentos quando a fase não tem formulário no servidor, e deixa o aviso ligado', async () => {
      obter.mockReturnValue(of(apiOk(processoComFormularioNaFase([]), 200, headers)));
      const resultado = await gravar();
      expect(resultado.valid).toBe(true);
      expect(definirDocumentosExigidos).not.toHaveBeenCalled();
      expect(aguardando()).toBe(true);
    });

    it('envia o conjunto quando a fase já tem formulário no servidor, e desliga o aviso', async () => {
      aguardando.set(true);
      obter.mockReturnValue(of(apiOk(processoComFormularioNaFase(['HABILITACAO']), 200, headers)));
      const resultado = await gravar();
      expect(resultado.valid).toBe(true);
      expect(definirDocumentosExigidos).toHaveBeenCalledTimes(1);
      expect(aguardando()).toBe(false);
    });

    it('não envia os documentos quando falta o formulário de inscrição que receberia o campo', async () => {
      obter.mockReturnValue(of(apiOk(processoComFormularioNaFase(['HABILITACAO']), 200, headers)));
      garantirCampos.mockResolvedValue({ tipo: 'semFormularioDeInscricao' });
      const resultado = await gravar();
      expect(resultado.valid).toBe(true);
      expect(definirDocumentosExigidos).not.toHaveBeenCalled();
      expect(aguardando()).toBe(true);
    });

    it('diz o que o passo de quem chama já gravou quando o servidor recusa o conjunto', async () => {
      obter.mockReturnValue(of(apiOk(processoComFormularioNaFase(['HABILITACAO']), 200, headers)));
      definirDocumentosExigidos.mockResolvedValue({ ok: false, problem: { code: '', errors: [] } });
      const resultado = await gravar();
      expect(resultado.valid).toBe(false);
      expect(resultado.messages?.[0]).toMatch(/^Gravado\. /);
      expect(aguardando()).toBe(false);
    });
  });
});
