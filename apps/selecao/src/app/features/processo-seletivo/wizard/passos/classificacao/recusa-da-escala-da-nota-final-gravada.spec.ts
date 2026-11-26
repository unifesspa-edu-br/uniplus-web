import { describe, expect, it } from 'vitest';

import { NOME_DO_PASSO_DA_FORMULA } from '../../processo-seletivo.data';
import {
  componente,
  montarEliminacao,
  prepararClassificacaoLocal,
  store,
} from '../eliminacao/eliminacao.testing';
import { aceitarGravacao, recusarGravacao } from './recusa-da-gravacao.testing';

describe('recusa da escala da nota final na gravação da classificação', () => {
  montarEliminacao();

  it('a recusa da escala da nota final vai ao campo do passo Fórmula, e a gravação certa a apaga', async () => {
    prepararClassificacaoLocal();
    store.patchObjectSection('classificacao', { escalaNotaFinal: '0' });
    const codigo = 'uniplus.selecao.configuracao_classificacao.escala_nota_final_invalida';

    const recusada = componente.persistir();
    recusarGravacao({
      title: 'Escala inválida.',
      code: codigo,
      errors: [
        { field: 'escalaNotaFinal', code: codigo, message: 'A escala deve ser maior que zero.' },
      ],
    });

    const resultado = await recusada;
    const esperada = 'A escala deve ser maior que zero.';
    expect(resultado.messages).toEqual([
      `Escala da nota final, no passo ${NOME_DO_PASSO_DA_FORMULA}: ${esperada}`,
    ]);
    expect(store.classificacao.recusaDaEscalaDaNotaFinal()).toBe(esperada);

    store.patchObjectSection('classificacao', { escalaNotaFinal: '100' });
    const aceita = componente.persistir();
    aceitarGravacao();
    await aceita;
    expect(store.classificacao.recusaDaEscalaDaNotaFinal()).toBeNull();
  });

  it('uma recusa que não traz erro da escala mantém a recusa guardada dela', async () => {
    prepararClassificacaoLocal();
    store.classificacao.recusaDaEscalaDaNotaFinal.set('Recusa anterior da escala.');

    const gravacao = componente.persistir();
    recusarGravacao({
      title: 'Campos inválidos.',
      code: 'uniplus.selecao.validacao',
      errors: [
        {
          field: 'casasArredondamento',
          code: 'uniplus.selecao.configuracao_classificacao.casas_arredondamento_obrigatorio',
          message: 'As casas decimais de arredondamento são obrigatórias.',
        },
      ],
    });

    const resultado = await gravacao;
    expect(store.classificacao.recusaDaEscalaDaNotaFinal()).toBe('Recusa anterior da escala.');
    expect(resultado.messages).toEqual(['Campos inválidos.']);
  });
});
