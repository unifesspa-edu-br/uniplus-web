import { TestBed } from '@angular/core/testing';
import { type ProblemDetails, ProblemI18nService } from '@uniplus/shared-core/http';

import {
  FALHAS_DA_PUBLICACAO,
  MENSAGEM_DA_FALHA_DA_PUBLICACAO,
  provideMensagensDoCandidato,
} from './mensagens-do-candidato';

const problema = (code: string): ProblemDetails => ({
  type: `https://exemplo/${code}`,
  title: 'A versão do envelope congelado não está no registro de codecs',
  detail: 'A versão 0.0.23 do envelope congelado não está no registro de codecs.',
  status: 422,
  code,
  traceId: '',
});

describe('provideMensagensDoCandidato', () => {
  let problemas: ProblemI18nService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideMensagensDoCandidato()] });
    problemas = TestBed.inject(ProblemI18nService);
  });

  it('troca o texto técnico de cada falha de leitura da publicação pela mensagem ao candidato', () => {
    for (const codigo of FALHAS_DA_PUBLICACAO) {
      expect(problemas.resolve(problema(codigo))).toEqual({
        title: MENSAGEM_DA_FALHA_DA_PUBLICACAO,
        detail: MENSAGEM_DA_FALHA_DA_PUBLICACAO,
        action: undefined,
      });
    }
  });

  it('mantém o texto da API nas demais recusas', () => {
    const recusa = problema('uniplus.selecao.inscricao.periodo_encerrado');
    expect(problemas.resolve(recusa)).toEqual({ title: recusa.title, detail: recusa.detail });
  });
});
