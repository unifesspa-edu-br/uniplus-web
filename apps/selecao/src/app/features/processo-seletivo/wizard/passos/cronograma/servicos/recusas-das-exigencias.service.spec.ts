import { HttpHeaders } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { apiOk, ProblemI18nService } from '@uniplus/shared-core/http';
import { ProcessosSeletivosApi } from '@uniplus/shared-data/selecao';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { detalhe } from '../../../../processo-seletivo.retomada.testing';
import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { rascunhoInicial } from '../../../rascunho-inicial';
import { CadastroInicial } from '../../../shared/cadastro-inicial.service';
import { GravacaoDosCamposPressupostos } from '../../../shared/campos-pressupostos.service';
import { exigencia, rascunho } from '../../../shared/exigencias/exigencias.testing';
import { GravacaoDasExigenciasDocumentais } from '../../../shared/exigencias/gravacao-das-exigencias-documentais.service';

const documentos = rascunho(
  exigencia({ faseIdLido: 'fase' }),
  exigencia({ faseIdLido: 'fase', tipoDocumentoId: 'outro' }),
);
const definirDocumentosExigidos = vi.fn();
const codigo = 'uniplus.selecao.regra_de_comprovacao.forma_invalida';

beforeEach(() => {
  definirDocumentosExigidos.mockReset();
  const processo = detalhe();
  TestBed.configureTestingModule({
    providers: [
      GravacaoDasExigenciasDocumentais,
      {
        provide: ProcessoSeletivoStore,
        useValue: {
          geracao: () => 1,
          draft: () => ({ ...rascunhoInicial(), documentos }),
          modalidadesDoProcesso: () => [],
        },
      },
      {
        provide: ProcessosSeletivosApi,
        useValue: { obter: () => of(apiOk(processo, 200, new HttpHeaders())) },
      },
      { provide: CadastroInicial, useValue: { definirDocumentosExigidos } },
      {
        provide: GravacaoDosCamposPressupostos,
        useValue: { garantirCampos: () => Promise.resolve({ tipo: 'ok' }) },
      },
      { provide: ProblemI18nService, useValue: { resolve: () => ({ title: 'Falha' }) } },
    ],
  });
});

describe('recusas da gravação das exigências', () => {
  it('mantém geral a recusa sem caminho', async () => {
    definirDocumentosExigidos.mockResolvedValue({
      ok: false,
      problem: { code: codigo, errors: [{ code: codigo, message: 'Recusa' }] },
    });
    const resultado = await TestBed.inject(GravacaoDasExigenciasDocumentais).gravar(
      'processo',
      'Gravado.',
    );
    expect(resultado.recusas?.[0].identificadorDaRegra).toBeNull();
    expect(resultado.messages?.[0]).toContain('forma da regra');
  });
  it('identifica recusas em duas regras enviadas', async () => {
    const errors = [0, 1].map((indice) => ({
      code: codigo,
      message: 'Recusa',
      field: `regrasDeComprovacao[${indice}].documento.requisitos.formatosPermitidos`,
    }));
    definirDocumentosExigidos.mockResolvedValue({ ok: false, problem: { code: codigo, errors } });
    const resultado = await TestBed.inject(GravacaoDasExigenciasDocumentais).gravar(
      'processo',
      'Gravado.',
    );
    expect(resultado.recusas?.map((recusa) => recusa.identificadorDaRegra)).toEqual(
      documentos.regrasDeComprovacao.map((regra) => regra.identificadorNoRascunho),
    );
    expect(resultado.recusas?.[0].campo).toBe('documento.requisitos.formatosPermitidos');
    expect(resultado.recusas?.[0].mensagem).toContain('forma da regra');
  });
});
