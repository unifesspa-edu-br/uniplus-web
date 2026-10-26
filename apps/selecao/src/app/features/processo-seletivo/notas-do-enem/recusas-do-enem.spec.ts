import { CLIENT_PROBLEM_CODES, type ProblemDetails } from '@uniplus/shared-core/http';
import { describe, expect, it } from 'vitest';

import { explicarRecusa } from './recusas-do-enem';

const NS = 'uniplus.selecao.notas_do_enem.';

function problema(
  status: number,
  code: string,
  extras: Partial<ProblemDetails> = {},
): ProblemDetails {
  return {
    type: 'about:blank',
    title: 'Título do servidor',
    status,
    code,
    traceId: 'trace-1',
    ...extras,
  };
}

describe('explicarRecusa na importação', () => {
  it('arquivo fora do leiaute diz que nada foi gravado e manda conferir o leiaute', () => {
    const recusa = explicarRecusa(
      problema(422, `${NS}arquivo_fora_do_leiaute`, { detail: 'Linha 3, coluna 21.' }),
      'importacao',
    );

    expect(recusa.titulo).toContain('nenhuma nota foi gravada');
    expect(recusa.orientacao).toContain('Confira se o leiaute selecionado');
    expect(recusa.detalhe).toBe('Linha 3, coluna 21.');
  });

  it('só os erros de estrutura expõem o detail da API', () => {
    const recusa = explicarRecusa(
      problema(422, `${NS}arquivo_vazio`, { detail: 'algo que pode ter conteúdo' }),
      'importacao',
    );

    expect(recusa.detalhe).toBeNull();
  });

  it.each([
    [413, 'Arquivo recusado: nenhuma nota foi gravada.', 'passa de 10 MB'],
    [415, 'Arquivo recusado: nenhuma nota foi gravada.', 'não é de texto'],
    [400, 'Arquivo recusado: nenhuma nota foi gravada.', 'formulário não pôde ser lido'],
  ])('status %i sem código mapeado é recusa sem gravação', (status, titulo, trecho) => {
    const recusa = explicarRecusa(
      problema(status, CLIENT_PROBLEM_CODES.UNEXPECTED_RESPONSE),
      'importacao',
    );

    expect(recusa.titulo).toBe(titulo);
    expect(recusa.explicacao + recusa.orientacao).toContain(trecho);
  });

  it('oferta fora do edital orienta a retificar e divulgar de novo', () => {
    const recusa = explicarRecusa(
      problema(422, `${NS}oferta_de_inscricao_fora_do_edital`),
      'importacao',
    );

    expect(recusa.titulo).toContain('nenhuma nota foi gravada');
    expect(recusa.orientacao).toContain('divulgue-a');
  });

  it('processo sem divulgação é reconhecido pelo código do processo, não pelo do domínio', () => {
    const recusa = explicarRecusa(
      problema(404, 'uniplus.selecao.processo_seletivo.nao_encontrado'),
      'importacao',
    );

    expect(recusa.explicacao).toBe('O processo ainda não tem edital divulgado.');
  });

  it('4xx com código sem mapeamento mostra o título do servidor e que nada foi gravado', () => {
    const recusa = explicarRecusa(problema(409, 'uniplus.selecao.outro_codigo'), 'importacao');

    expect(recusa.titulo).toContain('nenhuma nota foi gravada');
    expect(recusa.explicacao).toBe('Título do servidor');
    expect(recusa.traceId).toBeNull();
  });

  it('4xx sintetizado pelo cliente não repete o título genérico dele', () => {
    const recusa = explicarRecusa(
      problema(404, CLIENT_PROBLEM_CODES.UNEXPECTED_RESPONSE),
      'importacao',
    );

    expect(recusa.explicacao).toBe('A requisição foi recusada.');
  });

  it('rede fora e 5xx não afirmam que nada foi gravado e mandam conferir o histórico', () => {
    for (const status of [0, 500, 503]) {
      const recusa = explicarRecusa(
        problema(status, CLIENT_PROBLEM_CODES.NETWORK_ERROR),
        'importacao',
      );

      expect(recusa.titulo).not.toContain('nenhuma nota foi gravada');
      expect(recusa.orientacao).toContain('Confira o histórico de lotes');
      expect(recusa.traceId).toBe('trace-1');
    }
  });

  it('leiaute indisponível pede a releitura do catálogo', () => {
    const recusa = explicarRecusa(problema(422, `${NS}leiaute_indisponivel`), 'importacao');

    expect(recusa.recarregarCatalogo).toBe(true);
  });
});

describe('explicarRecusa no envio', () => {
  it('edição sem inscritos é aviso, não erro', () => {
    const recusa = explicarRecusa(problema(422, `${NS}edicao_sem_inscritos`), 'envio');

    expect(recusa.nivel).toBe('warning');
  });

  it('falha de servidor manda conferir o histórico de envios, que registra cada geração', () => {
    const recusa = explicarRecusa(problema(502, 'x'), 'envio');

    expect(recusa.orientacao).toContain('histórico de envios');
  });

  it('403 chega como falta de permissão', () => {
    const recusa = explicarRecusa(problema(403, 'uniplus.auth.forbidden'), 'envio');

    expect(recusa.explicacao).toBe('Você não tem permissão para esta operação.');
  });

  it('não aplica à geração os limites de arquivo da importação', () => {
    const recusa = explicarRecusa(problema(413, CLIENT_PROBLEM_CODES.UNEXPECTED_RESPONSE), 'envio');

    expect(recusa.titulo).toBe('Não foi possível gerar o arquivo de envio.');
    expect(recusa.explicacao).toBe('A requisição foi recusada.');
  });
});
