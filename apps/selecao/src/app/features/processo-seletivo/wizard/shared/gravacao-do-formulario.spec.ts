import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { FormulariosDoProcessoApi, SELECAO_BASE_PATH } from '@uniplus/shared-data/selecao';
import { REGRAS_INICIAIS, type ConteudoDoFormulario } from '@uniplus/shared-inscricao/formulario';
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
      paginas: [
        {
          codigo: 'S1',
          ordem: 1,
          tipo: 'SECAO',
          bloco: null,
          apresentacao: { titulo: 'S1', descricao: null, aviso: null },
        },
      ],
      itens: [
        {
          fatoCodigo: 'IDADE',
          ordem: 1,
          paginaCodigo: 'S1',
          apresentacao: { rotulo: 'Idade', tipoDeCampo: 'NUMERO', pedirConfirmacao: false },
          regras: {
            ...REGRAS_INICIAIS,
            restricoes: [{ tipo: 'FAIXA_NUMERICA', minimo: 'abc' }],
          },
        },
      ],
      termos: [],
      pressupostos: [],
      grupos: [],
    };

    const resultado = await gravarFormulario(
      { gravacao, api },
      { processoSeletivoId: 'p1', codigo: 'INSCRICAO' },
      null,
      { faseId: 'F1', obrigatorio: true, consequenciaDaFaltaDeEnvio: null, conteudo },
    );

    expect(resultado.ok).toBe(false);
    http.expectNone(() => true);
  });

  it('diz que o cabeçalho existe quando o servidor já o tem e a atualização dele é recusada', async () => {
    TestBed.configureTestingModule({
      providers: [
        GravacaoDoProcesso,
        { provide: SELECAO_BASE_PATH, useValue: '/api/selecao' },
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    const destino = {
      gravacao: TestBed.inject(GravacaoDoProcesso),
      api: TestBed.inject(FormulariosDoProcessoApi),
    };
    const conteudo: ConteudoDoFormulario = {
      titulo: 'Inscrição',
      paginas: [],
      itens: [],
      termos: [],
      pressupostos: [],
      grupos: [],
    };
    const gravado = { faseId: 'F1', obrigatorio: true, consequenciaDaFaltaDeEnvio: null, conteudo };

    const resultado = gravarFormulario(
      destino,
      { processoSeletivoId: 'p1', codigo: 'INSCRICAO' },
      gravado,
      { ...gravado, obrigatorio: false },
    );
    await new Promise((resolver) => setTimeout(resolver));
    TestBed.inject(HttpTestingController)
      .expectOne((r) => r.method === 'PUT')
      .flush(
        { type: 'about:blank', title: 'Recusado.', status: 422, traceId: '' },
        { status: 422, statusText: 'Unprocessable Entity' },
      );

    expect(await resultado).toMatchObject({ ok: false, cabecalhoAceito: true });
  });
});
