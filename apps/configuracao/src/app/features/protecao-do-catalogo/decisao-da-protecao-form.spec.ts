import { FormControl } from '@angular/forms';
import { describe, expect, it, beforeAll } from 'vitest';
import {
  comandoDeJustificativa,
  comandoPara,
  justificativaPreenchida,
  recomendacoesPara,
} from './decisao-da-protecao-form';
import { detalheDoLaudo, compilarPaginaUmaVez } from './protecao-do-catalogo.testing';

describe('formulário da decisão da proteção', () => {
  beforeAll(compilarPaginaUmaVez);
  it('a justificativa só de espaços não conta como preenchida', () => {
    expect(justificativaPreenchida(new FormControl('   ', { nonNullable: true }))).toEqual({
      required: true,
    });
    expect(
      justificativaPreenchida(new FormControl('Falta a base.', { nonNullable: true })),
    ).toBeNull();
  });

  it('sem item aberto não há classificação a recomendar', () => {
    expect(recomendacoesPara(null)).toEqual([]);
  });

  it('recomenda só classificação diferente da atual e compatível com a hipótese legal', () => {
    const valores = recomendacoesPara(detalheDoLaudo).map((opcao) => opcao.valor);

    expect(valores).toContain('SENSIVEL');
    expect(valores).not.toContain(detalheDoLaudo.classificacaoProtecao);
  });

  it('a aprovação leva a proteção que a tela mostrou, com o ciclo e as manifestações lidos', () => {
    expect(comandoPara(detalheDoLaudo)).toEqual({
      cadastro: 'TIPO_DOCUMENTO',
      itemId: detalheDoLaudo.id,
      decisao: 'APROVAR',
      classificacaoProtecao: 'INTERNO',
      hipoteseLegal: 'EXECUCAO_POLITICAS_PUBLICAS',
      finalidadeTratamento: detalheDoLaudo.finalidadeTratamento,
      ciclo: 2,
      manifestacoesNoCiclo: 0,
    });
  });

  it('a reprovação leva a justificativa e nenhuma classificação recomendada', () => {
    const comando = comandoDeJustificativa(detalheDoLaudo, 'REPROVAR', 'Falta a base.', 'PESSOAL');

    expect(comando).toMatchObject({ decisao: 'REPROVAR', justificativa: 'Falta a base.' });
    expect('classificacaoRecomendada' in comando).toBe(false);
  });

  it('o ajuste sem justificativa leva a justificativa nula', () => {
    const comando = comandoDeJustificativa(detalheDoLaudo, 'RECOMENDAR_AJUSTE', '', 'SENSIVEL');

    expect(comando).toMatchObject({
      decisao: 'RECOMENDAR_AJUSTE',
      classificacaoRecomendada: 'SENSIVEL',
      justificativa: null,
    });
  });

  it('a aprovação diante de manifestação leva a justificativa, sem classificação recomendada', () => {
    const comando = comandoDeJustificativa(detalheDoLaudo, 'APROVAR', 'A classificação basta.', '');

    expect(comando).toMatchObject({ decisao: 'APROVAR', justificativa: 'A classificação basta.' });
    expect('classificacaoRecomendada' in comando).toBe(false);
  });
});
