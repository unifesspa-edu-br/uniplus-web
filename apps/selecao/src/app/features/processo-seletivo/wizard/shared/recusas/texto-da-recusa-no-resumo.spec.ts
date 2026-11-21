import { describe, expect, it } from 'vitest';

import type { ProblemDetails } from '@uniplus/shared-core/http';

import { resumoDasRecusasSemLugar, textoDaRecusaNoResumo } from './texto-da-recusa-no-resumo';

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

  describe('resumoDasRecusasSemLugar', () => {
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
