import { describe, expect, it } from 'vitest';

import { NOME_DO_PASSO_DA_FORMULA } from '../../processo-seletivo.data';
import {
  componente,
  montarEliminacao,
  prepararClassificacaoLocal,
} from '../eliminacao/eliminacao.testing';
import { recusarGravacao } from './recusa-da-gravacao.testing';

const CODIGO_DAS_CASAS =
  'uniplus.selecao.configuracao_classificacao.casas_arredondamento_invalidas';
const ROTULO_DAS_CASAS = `Casas de arredondamento, no passo ${NOME_DO_PASSO_DA_FORMULA}`;
const TEXTO_GENERICO = 'O servidor recusou as casas de arredondamento. Confira o valor informado.';

describe('recusa das casas de arredondamento na gravação da classificação', () => {
  montarEliminacao();

  async function recusar(message: string) {
    prepararClassificacaoLocal();
    const gravacao = componente.persistir();
    recusarGravacao({
      title: 'Título genérico da raiz.',
      code: 'uniplus.selecao.validacao',
      errors: [{ field: 'casasArredondamento', code: CODIGO_DAS_CASAS, message }],
    });
    return gravacao;
  }

  it('mostra a mensagem da API no resumo, sem o título genérico da raiz', async () => {
    const resultado = await recusar('Mensagem inventada sobre as casas.');

    expect(resultado.messages).toEqual([`${ROTULO_DAS_CASAS}: Mensagem inventada sobre as casas.`]);
  });

  it.each(['redação nova, sem maiúscula nem ponto', 'Outra redação, com ponto final.'])(
    'mostra a redação da API sem alterar a letra inicial nem a pontuação: %s',
    async (mensagem) => {
      const resultado = await recusar(mensagem);

      expect(resultado.messages).toEqual([`${ROTULO_DAS_CASAS}: ${mensagem}`]);
    },
  );

  it.each(['', '   '])(
    'sem mensagem, mostra o texto genérico sem valor digitado: "%s"',
    async (mensagem) => {
      const resultado = await recusar(mensagem);

      expect(resultado.messages).toEqual([`${ROTULO_DAS_CASAS}: ${TEXTO_GENERICO}`]);
    },
  );
});
