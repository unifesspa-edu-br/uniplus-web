import { documentoSemNada } from '../../../documento/exemplos.testing';
import type { ProblemDetails } from '@uniplus/shared-core/http';
import { describe, expect, it } from 'vitest';

import { recusasDosProcedimentosDaFase } from '../recusas-do-servidor-ao-procedimento';
import { HOMOLOGACAO, montarEdicao, seletorDa } from './procedimentos-do-recurso.edicao.testing';
import { procedimentoDoDocumento as procedimento } from './procedimentos.testing';
import { textoDaRecusaDoProcedimento } from './textos-das-recusas-do-procedimento';

const CODIGO = 'uniplus.selecao.regra_recurso_fase.procedimento_de_recurso_desconhecido';
const PROBLEMA: ProblemDetails = {
  type: 'https://developers.example.test/erros/uniplus.selecao.validacao_falhou',
  title: 'Validação',
  status: 422,
  code: 'uniplus.selecao.validacao_falhou',
  traceId: '',
  errors: [
    {
      field: '/cronograma/fases/0/regraRecurso/procedimentosDeRecurso/0/regra',
      code: CODIGO,
      message: 'texto livre que o servidor escreveu',
    },
  ],
};

describe('ProcedimentosDoRecursoComponent: a recusa que vem do servidor', () => {
  it('mostra junto ao seletor o texto da tela, o código e a página, e não o texto do servidor', async () => {
    const enviados = [procedimento({ tipoDeDecisao: HOMOLOGACAO })];

    const { raiz } = await montarEdicao({
      procedimentos: enviados,
      recusas: recusasDosProcedimentosDaFase(PROBLEMA, 0, {
        ...documentoSemNada(),
        cronograma: {
          fases: [
            {
              chave: 'homologacao',
              faseCanonicaCodigo: 'INSCRICOES',
              noMesmoMomentoDaAnterior: false,
              regraRecurso: { procedimentosDeRecurso: enviados },
            },
          ],
        },
      }),
    });

    const recusa = raiz.querySelector('ui-recusa-do-campo') as HTMLElement;
    expect(recusa.textContent).toContain(textoDaRecusaDoProcedimento(CODIGO));
    expect(recusa.textContent).not.toContain('texto livre');
    expect(recusa.querySelector('code')?.textContent).toBe(CODIGO);
    expect(recusa.querySelector('a')?.getAttribute('href')).toBe(
      `https://developers.example.test/erros/${CODIGO}`,
    );
    expect(seletorDa(raiz).getAttribute('aria-invalid')).toBe('true');
  });
});
