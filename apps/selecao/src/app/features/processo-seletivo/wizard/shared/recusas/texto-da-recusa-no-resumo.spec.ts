import { describe, expect, it } from 'vitest';

import type { ProblemDetails } from '@uniplus/shared-core/http';

import {
  RECUSA_MOSTRADA_NOS_CAMPOS,
  resumoDaGravacaoRecusada,
  resumoDasRecusasSemLugar,
  textoDaRecusaNoResumo,
} from './texto-da-recusa-no-resumo';

const PAGINAS = 'https://exemplo.unifesspa.edu.br/erros/';

function problema(errors: ProblemDetails['errors']): ProblemDetails {
  return {
    type: `${PAGINAS}uniplus.validacao`,
    code: 'uniplus.validacao',
    title: 'Validação',
    status: 422,
    traceId: '',
    errors,
  };
}

describe('textoDaRecusaNoResumo', () => {
  it('diz a mensagem da API e o código', () => {
    expect(
      textoDaRecusaNoResumo({ mensagem: 'A fase não existe.', codigo: 'uniplus.x', pagina: null }),
    ).toBe('A fase não existe. (código uniplus.x)');
  });

  it('acrescenta a página quando a API a oferece', () => {
    const texto = textoDaRecusaNoResumo({
      mensagem: 'A fase não existe.',
      codigo: 'uniplus.x',
      pagina: 'https://exemplo.unifesspa.edu.br/erros/uniplus.x',
    });

    expect(texto).toBe(
      'A fase não existe. (código uniplus.x; entenda a recusa em https://exemplo.unifesspa.edu.br/erros/uniplus.x)',
    );
  });

  it('começa pela posição da publicação, contada de um, quando a recusa é a uma linha da lista', () => {
    const texto = textoDaRecusaNoResumo({
      campo: 'fases[5].produtos[1].atoCodigo',
      mensagem: 'Sem ato.',
      codigo: 'uniplus.x',
      pagina: null,
    });

    expect(texto).toBe('Publicação 2: Sem ato. (código uniplus.x)');
  });

  it.each(['fases[5].produtos', 'fases[5].fim', 'fases[5].bancasRequeridas[1]'])(
    'não põe posição na recusa de %s, que não é a uma linha da lista de publicações',
    (campo) => {
      const texto = textoDaRecusaNoResumo({
        campo,
        mensagem: 'Recusada.',
        codigo: 'uniplus.x',
        pagina: null,
      });

      expect(texto).toBe('Recusada. (código uniplus.x)');
    },
  );

  describe('resumoDasRecusasSemLugar', () => {
    it('mantém no resumo a mesma recusa a duas linhas da lista, cada uma com a sua posição', () => {
      const daLinha = (posicao: number) => ({
        campo: `fases[5].produtos[${posicao}].atoCodigo`,
        mensagem: 'Sem ato.',
        codigo: 'uniplus.x',
        pagina: null,
      });

      expect(resumoDasRecusasSemLugar(problema([]), [daLinha(0), daLinha(1)])).toEqual([
        'Publicação 1: Sem ato. (código uniplus.x)',
        'Publicação 2: Sem ato. (código uniplus.x)',
      ]);
    });

    it('mantém a mesma mensagem em campos diferentes e junta a repetição do mesmo campo e código', () => {
      const doCampo = (campo: string, mensagem = 'Nome inválido.') => ({
        campo,
        mensagem,
        codigo: 'uniplus.x',
        pagina: null,
      });
      const semLugar = [
        doCampo('etapas[7].nome'),
        doCampo('etapas[8].nome'),
        doCampo('etapas[7].nome', 'Outro texto da mesma recusa.'),
      ];

      expect(resumoDasRecusasSemLugar(problema([]), semLugar)).toEqual([
        'Nome inválido. (código uniplus.x)',
        'Nome inválido. (código uniplus.x)',
      ]);
    });

    it('fica vazio quando nenhuma recusa ficou sem lugar e não há causa geral', () => {
      expect(resumoDasRecusasSemLugar(problema([]), [])).toEqual([]);
    });

    it('diz a causa geral com mensagem, código e página, uma vez só', () => {
      const geral = { code: 'uniplus.x', message: 'Algo geral.' };

      expect(resumoDasRecusasSemLugar(problema([geral, geral]), [])).toEqual([
        `Algo geral. (código uniplus.x; entenda a recusa em ${PAGINAS}uniplus.x)`,
      ]);
    });

    it('põe a recusa sem lugar antes da causa geral', () => {
      const semLugar = { codigo: 'uniplus.y', mensagem: 'Sem lugar.', pagina: null };

      expect(
        resumoDasRecusasSemLugar(problema([{ code: 'uniplus.x', message: 'Geral.' }]), [semLugar]),
      ).toEqual([
        'Sem lugar. (código uniplus.y)',
        `Geral. (código uniplus.x; entenda a recusa em ${PAGINAS}uniplus.x)`,
      ]);
    });
  });
});

describe('resumoDaGravacaoRecusada', () => {
  const titulo = () => 'Título da API.';
  const campo = { field: 'etapas[0].nome', code: 'uniplus.x', message: 'Do campo.' };

  it('explica pelo título a recusa da raiz sem causa nenhuma', () => {
    expect(resumoDaGravacaoRecusada(problema([]), [], { doCodigo: null, titulo })).toEqual([
      'Título da API.',
    ]);
  });

  it('explica pelo texto do código a recusa da raiz sem causa nenhuma', () => {
    const raiz = { doCodigo: 'Faça assim.', titulo };

    expect(resumoDaGravacaoRecusada(problema([]), [], raiz)).toEqual(['Faça assim.']);
  });

  it('diz onde ver quando toda causa achou o campo dela, nunca devolve lista vazia', () => {
    const resumo = resumoDaGravacaoRecusada(problema([campo]), [], { doCodigo: null, titulo });

    expect(resumo).toEqual([RECUSA_MOSTRADA_NOS_CAMPOS]);
  });

  it('põe o texto do código antes do que não achou campo', () => {
    const semLugar = { codigo: 'uniplus.y', mensagem: 'Sem lugar.', pagina: null };

    const resumo = resumoDaGravacaoRecusada(problema([campo]), [semLugar], {
      doCodigo: 'Do código.',
      titulo,
    });

    expect(resumo).toEqual(['Do código.', 'Sem lugar. (código uniplus.y)']);
  });
});
