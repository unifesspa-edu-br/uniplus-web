import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CODIGO_ESPERA_ESGOTADA } from '@uniplus/shared-core/idempotency';
import { type InscricaoRequest, SELECAO_BASE_PATH } from '@uniplus/shared-data/selecao';

import { InscricaoDoCandidatoHttp } from './inscricao-do-candidato.http';

const BASE = 'http://localhost:5000';
const PROCESSO = '0199e000-0000-7000-8000-0000000000d1';
const OUTRO_PROCESSO = '0199e000-0000-7000-8000-0000000000d2';
const submissaoDe = (processo: string): string =>
  `${BASE}/api/selecao/processos-seletivos/${processo}/inscricao/submissao`;
const REQUEST: InscricaoRequest = { ofertaCursoId: null, respostas: {}, grupos: null, aceites: [] };
const OUTRO_REQUEST: InscricaoRequest = { ...REQUEST, respostas: { NOME: 'Fernanda Laura' } };
const CONFLITO_DE_PROCESSAMENTO = 'uniplus.idempotency.processing_conflict';
const CORPO_DIFERENTE = 'uniplus.idempotency.body_mismatch';

type Desfecho =
  | { readonly status: number; readonly code: string }
  | 'sucesso'
  | 'sem_resposta'
  | 'resposta_ilegivel';

describe('InscricaoDoCandidatoHttp: Idempotency-Key do envio', () => {
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

  /** Envia, responde com o desfecho e devolve a Idempotency-Key que a requisição levou. */
  const enviar = async (
    desfecho: Desfecho,
    request = REQUEST,
    processo = PROCESSO,
  ): Promise<string> => {
    const resultado = firstValueFrom(servico.submeter(processo, structuredClone(request), '"i:1"'));
    const req = controller.expectOne(submissaoDe(processo));
    const chave = req.request.headers.get('Idempotency-Key') ?? '';
    expect(chave).not.toBe('');
    if (desfecho === 'sem_resposta') {
      req.error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });
    } else if (desfecho === 'resposta_ilegivel') {
      req.error(new ProgressEvent('error'), { status: 200, statusText: 'OK' });
    } else if (desfecho === 'sucesso') {
      req.flush({ numeroInscricao: '00000001' });
    } else {
      const { status, code } = desfecho;
      const problema = { type: 'about:blank', title: 'Recusa', status, code, traceId: 't' };
      req.flush(problema, {
        status,
        statusText: 'Recusa',
        headers: { 'Content-Type': 'application/problem+json' },
      });
    }
    await resultado;
    return chave;
  };

  it('mantém a chave quando a API responde que o envio anterior ainda está em processamento', async () => {
    const primeira = await enviar({ status: 409, code: CONFLITO_DE_PROCESSAMENTO });
    const repeticao = await enviar('sucesso');

    expect(repeticao).toBe(primeira);
  });

  it('troca a chave quando a espera pela vez do processo se esgotou, porque a API guardou a recusa', async () => {
    const primeira = await enviar({ status: 503, code: CODIGO_ESPERA_ESGOTADA });
    const repeticao = await enviar('sucesso');

    expect(repeticao).not.toBe(primeira);
  });

  it('troca a chave depois de recusa 4xx, para o mesmo corpo não voltar com a resposta guardada', async () => {
    const primeira = await enviar({ status: 422, code: 'uniplus.teste.recusa' });
    const repeticao = await enviar('sucesso');

    expect(repeticao).not.toBe(primeira);
  });

  it('troca a chave depois de body_mismatch, que é recusa definitiva', async () => {
    const primeira = await enviar({ status: 422, code: CORPO_DIFERENTE });
    const repeticao = await enviar('sucesso');

    expect(repeticao).not.toBe(primeira);
  });

  it('mantém a chave quando a resposta 2xx não pode ser lida, porque o envio foi concluído', async () => {
    const primeira = await enviar('resposta_ilegivel');
    const repeticao = await enviar('sucesso');

    expect(repeticao).toBe(primeira);
  });

  it('mantém a chave depois de falha 5xx, porque o envio pode ter sido gravado', async () => {
    const primeira = await enviar({ status: 500, code: 'uniplus.teste.falha' });
    const repeticao = await enviar('sucesso');

    expect(repeticao).toBe(primeira);
  });

  it('mantém a chave quando a resposta não chega, porque o envio pode ter sido gravado', async () => {
    const primeira = await enviar('sem_resposta');
    const repeticao = await enviar('sucesso');

    expect(repeticao).toBe(primeira);
  });

  it('gera outra chave para o envio seguinte a um sucesso', async () => {
    const concluido = await enviar('sucesso');
    const seguinte = await enviar('sucesso');

    expect(seguinte).not.toBe(concluido);
  });

  it('troca a chave quando o corpo muda, mesmo sem a falha ter dado resposta definitiva', async () => {
    const original = await enviar({ status: 500, code: 'uniplus.teste.falha' });
    const corrigido = await enviar({ status: 500, code: 'uniplus.teste.falha' }, OUTRO_REQUEST);

    expect(corrigido).not.toBe(original);
  });

  it('mantém a chave do corpo corrigido ao repeti-lo igual, e troca ao voltar ao corpo original', async () => {
    await enviar({ status: 500, code: 'uniplus.teste.falha' });
    const corrigido = await enviar({ status: 500, code: 'uniplus.teste.falha' }, OUTRO_REQUEST);
    const repeticao = await enviar({ status: 500, code: 'uniplus.teste.falha' }, OUTRO_REQUEST);
    const originalDeNovo = await enviar('sucesso', REQUEST);

    expect(repeticao).toBe(corrigido);
    expect(originalDeNovo).not.toBe(corrigido);
  });

  it('troca a chave ao enviar o mesmo corpo para outro processo, e a mantém para o mesmo processo', async () => {
    const falhou = { status: 500, code: 'uniplus.teste.falha' };
    const original = await enviar(falhou);
    const mesmoProcesso = await enviar(falhou);
    const outroProcesso = await enviar(falhou, REQUEST, OUTRO_PROCESSO);

    expect(mesmoProcesso).toBe(original);
    expect(outroProcesso).not.toBe(original);
  });
});
