import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { FormulariosDoProcessoApi, SELECAO_BASE_PATH } from '@uniplus/shared-data/selecao';
import type { ConteudoDoFormulario } from '@uniplus/shared-ui/components';
import { afterEach, describe, expect, it } from 'vitest';

import { gravarFormulario } from './gravacao-do-formulario';
import { GravacaoDoProcesso } from './gravacao/gravacao-do-processo';

describe('gravarFormulario', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('não envia nenhum passo quando um limite digitado não é número', async () => {
    TestBed.configureTestingModule({
      providers: [
        GravacaoDoProcesso,
        { provide: SELECAO_BASE_PATH, useValue: '/api/selecao' },
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    const gravacao = TestBed.inject(GravacaoDoProcesso);
    const api = TestBed.inject(FormulariosDoProcessoApi);
    const http = TestBed.inject(HttpTestingController);
    const conteudo: ConteudoDoFormulario = {
      titulo: 'Inscrição',
      etapas: [
        {
          codigo: 'S1',
          ordem: 1,
          tipo: 'SECAO',
          bloco: null,
          titulo: 'S1',
          descricao: null,
          aviso: null,
        },
      ],
      itens: [
        {
          fatoCodigo: 'IDADE',
          ordem: 1,
          rotulo: 'Idade',
          tipoRenderizacao: 'NUMERO',
          obrigatoriedade: 'SEMPRE',
          precondicao: null,
          etapaCodigo: 'S1',
          pedirConfirmacao: false,
          restricoes: [{ tipo: 'FAIXA_NUMERICA', minimo: 'abc' }],
        },
      ],
      termos: [],
      pressupostos: [],
      grupos: [],
    };

    const resultado = await gravarFormulario(
      gravacao,
      api,
      { processoSeletivoId: 'p1', finalidade: 'INSCRICAO' },
      null,
      { faseId: 'F1', conteudo },
    );

    expect(resultado.ok).toBe(false);
    http.expectNone(() => true);
  });
});
