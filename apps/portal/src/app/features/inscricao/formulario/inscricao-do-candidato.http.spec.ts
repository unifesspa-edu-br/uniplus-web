import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { type InscricaoRequest, SELECAO_BASE_PATH } from '@uniplus/shared-data/selecao';

import { InscricaoDoCandidatoHttp } from './inscricao-do-candidato.http';

const BASE = 'http://localhost:5000';
const PROCESSO = '0199e000-0000-7000-8000-0000000000d1';
const SUBMISSAO = `${BASE}/api/selecao/processos-seletivos/${PROCESSO}/inscricao/submissao`;
const REQUEST: InscricaoRequest = { ofertaCursoId: null, respostas: {}, grupos: null, aceites: [] };

describe('InscricaoDoCandidatoHttp', () => {
  let servico: InscricaoDoCandidatoHttp;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: SELECAO_BASE_PATH, useValue: BASE },
        InscricaoDoCandidatoHttp,
      ],
    });
    servico = TestBed.inject(InscricaoDoCandidatoHttp);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  /** Envia, responde com o status pedido e devolve a Idempotency-Key que o envio usou. */
  const enviarERecebe = async (status: number): Promise<string> => {
    const resultado = firstValueFrom(servico.submeter(PROCESSO, REQUEST, '"i:1"'));
    const req = controller.expectOne(SUBMISSAO);
    const chave = req.request.headers.get('Idempotency-Key') ?? '';
    if (status === 0) {
      req.error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });
    } else if (status >= 400) {
      req.flush(
        { type: 'about:blank', title: 'Recusa', status, code: 'uniplus.teste', traceId: 't' },
        { status, statusText: 'Recusa' },
      );
    } else {
      req.flush({ numeroInscricao: '00000001' });
    }
    await resultado;
    return chave;
  };

  it('repete a chave enquanto o envio fica sem resposta ou falha no servidor, e troca depois do sucesso', async () => {
    const semResposta = await enviarERecebe(0);
    const comFalhaDoServidor = await enviarERecebe(503);
    const comSucesso = await enviarERecebe(200);
    const proxima = await enviarERecebe(200);

    expect(comFalhaDoServidor).toBe(semResposta);
    expect(comSucesso).toBe(semResposta);
    expect(proxima).not.toBe(comSucesso);
  });

  it('as ofertas saem do certame publicado, com o nome congelado e o rótulo dos turnos', async () => {
    const resultado = firstValueFrom(servico.obterOfertas(PROCESSO));
    controller
      .expectOne((req) => req.url.startsWith(`${BASE}/api/selecao/certames/`))
      .flush({
        ofertas: [
          {
            ofertaCursoOrigemId: 'oferta-1',
            cursoNome: 'Medicina',
            cursoGrau: 'Bacharelado',
            unidadeOfertanteNome: 'Campus Marabá',
            turnos: ['MATUTINO', 'VESPERTINO'],
          },
        ],
      });

    const ofertas = await resultado;

    expect(ofertas.ok && ofertas.data).toEqual([
      { id: 'oferta-1', nome: 'Medicina (Bacharelado) — Campus Marabá — Matutino e Vespertino' },
    ]);
  });

  it('troca a chave depois de uma recusa, para o envio corrigido não colidir com o recusado', async () => {
    const recusada = await enviarERecebe(422);
    const corrigida = await enviarERecebe(200);

    expect(corrigida).not.toBe(recusada);
  });
});
