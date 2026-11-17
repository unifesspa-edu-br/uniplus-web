import { describe, expect, it } from 'vitest';

import { procedimentosParaLeitura } from './procedimentos-para-leitura';
import { procedimento, regraDoCatalogo } from './procedimentos.testing';

const CATALOGO = [
  regraDoCatalogo('PROCEDIMENTO-RECURSO-COLEGIADO', 'Resolução CONSEPE 12/2020, art. 4º'),
  regraDoCatalogo('PROCEDIMENTO-RECURSO-MONOCRATICO', 'Resolução CONSEPE 12/2020, art. 5º'),
];

describe('procedimentosParaLeitura', () => {
  it('nomeia a regra declarada pelo mesmo formato do seletor de regras', () => {
    const [linha] = procedimentosParaLeitura([procedimento()], CATALOGO, []);

    expect(linha.regra).toBe('PROCEDIMENTO-RECURSO-COLEGIADO — Resolução CONSEPE 12/2020, art. 4º');
  });

  it('mostra a sugestão com o nome da regra sugerida quando o catálogo a tem', () => {
    const [linha] = procedimentosParaLeitura(
      [procedimento({ sugestao: 'PROCEDIMENTO-RECURSO-MONOCRATICO' })],
      CATALOGO,
      [],
    );

    expect(linha.sugestao).toBe(
      'PROCEDIMENTO-RECURSO-MONOCRATICO — Resolução CONSEPE 12/2020, art. 5º',
    );
  });

  it('mostra o código da sugestão quando o catálogo ainda não foi carregado', () => {
    const [linha] = procedimentosParaLeitura(
      [procedimento({ sugestao: 'PROCEDIMENTO-RECURSO-MONOCRATICO' })],
      [],
      [],
    );

    expect(linha.sugestao).toBe('PROCEDIMENTO-RECURSO-MONOCRATICO');
    expect(linha.regra).toBe('PROCEDIMENTO-RECURSO-COLEGIADO — base legal indisponível');
  });

  it('não inventa sugestão quando o servidor não a traz', () => {
    const [linha] = procedimentosParaLeitura([procedimento({ sugestao: null })], CATALOGO, []);

    expect(linha.sugestao).toBeNull();
  });

  it('dá nome ao item contestado pelo rótulo do item da etapa', () => {
    const itens = [{ id: 'item-1', rotulo: 'Clareza', pontuacaoMaxima: '4' }];
    const alvo = { itemDeAvaliacaoId: 'item-1', areaDoEnem: null };

    expect(procedimentosParaLeitura([procedimento({ alvo })], CATALOGO, itens)[0].alvo).toBe(
      'Clareza',
    );
  });

  it('descreve o item que a etapa já não tem sem expor o identificador', () => {
    const alvo = { itemDeAvaliacaoId: 'item-removido', areaDoEnem: null };

    expect(procedimentosParaLeitura([procedimento({ alvo })], CATALOGO, [])[0].alvo).toBe(
      'item da etapa',
    );
  });

  it('mostra a área do ENEM contestada e deixa sem alvo o procedimento da decisão inteira', () => {
    const alvo = { itemDeAvaliacaoId: null, areaDoEnem: 'Matemática' };

    expect(procedimentosParaLeitura([procedimento({ alvo })], CATALOGO, [])[0].alvo).toBe(
      'Matemática',
    );
    expect(procedimentosParaLeitura([procedimento()], CATALOGO, [])[0].alvo).toBeNull();
  });

  it('dá ao tipo de decisão o nome do vocabulário e mantém o código que ele não conhece', () => {
    const [conhecido, desconhecido] = procedimentosParaLeitura(
      [
        procedimento({ tipoDeDecisao: 'HETEROIDENTIFICACAO' }),
        procedimento({ tipoDeDecisao: 'TIPO_DO_FUTURO' }),
      ],
      CATALOGO,
      [],
    );

    expect(conhecido.tipoDeDecisao).toBe('Heteroidentificação');
    expect(desconhecido.tipoDeDecisao).toBe('TIPO_DO_FUTURO');
  });
});
