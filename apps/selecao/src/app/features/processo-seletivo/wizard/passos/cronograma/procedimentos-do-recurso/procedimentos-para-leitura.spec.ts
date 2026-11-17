import { describe, expect, it } from 'vitest';

import { procedimentoParaDocumento, procedimentosParaLeitura } from './procedimentos-para-leitura';
import { procedimento, procedimentoDoDocumento, regraDoCatalogo } from './procedimentos.testing';

const CATALOGO = [
  regraDoCatalogo('PROCEDIMENTO-RECURSO-COLEGIADO', 'Resolução CONSEPE 12/2020, art. 4º'),
  regraDoCatalogo('PROCEDIMENTO-RECURSO-MONOCRATICO', 'Resolução CONSEPE 12/2020, art. 5º'),
];

describe('procedimentosParaLeitura', () => {
  it('lê o documento pela chave local do item, mesmo antes de salvar', () => {
    const declarado = procedimentoDoDocumento({ alvo: { itemDeAvaliacaoChave: 'clareza' } });
    const [linha] = procedimentosParaLeitura([declarado], CATALOGO, [
      { chave: 'clareza', rotulo: 'Clareza' },
    ]);
    expect(linha.alvo).toBe('Clareza');
    expect(linha.regra).toContain('PROCEDIMENTO-RECURSO-COLEGIADO');
    expect(linha.sugestao).toBeNull();
    expect(declarado.alvo).toEqual({ itemDeAvaliacaoChave: 'clareza' });
  });

  it('não trata o identificador do modelo antigo como chave local', () => {
    const declarado = procedimentoDoDocumento({ alvo: { itemDeAvaliacaoChave: 'chave-local' } });
    const [linha] = procedimentosParaLeitura(
      [declarado],
      [],
      [{ id: 'chave-local', rotulo: 'Outro item', pontuacaoMaxima: '4' }],
    );
    expect(linha.alvo).toBe('item da etapa');
  });

  it('conserva referências incompletas importadas sem fabricar código ou versão', () => {
    const declarado = procedimentoDoDocumento({ regra: {} });
    expect(procedimentosParaLeitura([declarado], [], [])[0].regra).toBe('');
    expect(declarado.regra).toEqual({});
  });

  it('lê alvo vazio como decisão inteira, da mesma forma que a edição do documento', () => {
    const declarado = procedimentoDoDocumento({ alvo: {} });
    expect(procedimentosParaLeitura([declarado], [], [])[0].alvo).toBeNull();
    expect(declarado.alvo).toEqual({});
  });

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
    const alvo = { itemDeAvaliacaoId: 'item-1' };

    expect(procedimentosParaLeitura([procedimento({ alvo })], CATALOGO, itens)[0].alvo).toBe(
      'Clareza',
    );
  });

  it('descreve o item que a etapa já não tem sem expor o identificador', () => {
    const alvo = { itemDeAvaliacaoId: 'item-removido' };

    expect(procedimentosParaLeitura([procedimento({ alvo })], CATALOGO, [])[0].alvo).toBe(
      'item da etapa',
    );
  });

  it('mostra a área do ENEM contestada e deixa sem alvo o procedimento da decisão inteira', () => {
    const alvo = { areaDoEnem: 'Matemática' };

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

describe('normalização da declaração para edição', () => {
  it('preserva o documento recebido, inclusive a referência incompleta', () => {
    const documento = procedimentoDoDocumento({ regra: {} });
    expect(procedimentoParaDocumento(documento, [])).toBe(documento);
  });

  it('transporta a chave existente do item sem usar o identificador como substituto', () => {
    const antigo = procedimento({
      tipoDeDecisao: 'NOTA_DA_ETAPA',
      alvo: { itemDeAvaliacaoId: 'id-do-item' },
    });
    const itens = [
      { id: 'id-do-item', chave: 'chave-do-item', rotulo: 'Coerência', pontuacaoMaxima: '5' },
    ];
    expect(procedimentoParaDocumento(antigo, itens)?.alvo).toEqual({
      itemDeAvaliacaoChave: 'chave-do-item',
    });
    expect(antigo.alvo).toEqual({ itemDeAvaliacaoId: 'id-do-item' });
  });

  it.each([
    procedimento({ tipoDeDecisao: 'TIPO_DESCONHECIDO' }),
    procedimento({ tipoDeDecisao: 'NOTA_DA_ETAPA', alvo: { areaDoEnem: 'AREA_DESCONHECIDA' } }),
    procedimento({ tipoDeDecisao: 'NOTA_DA_ETAPA', alvo: { itemDeAvaliacaoId: 'sem-chave' } }),
  ])('mantém em leitura o que não tem correspondência documental', (antigo) => {
    const itens = [{ id: 'sem-chave', rotulo: 'Coerência', pontuacaoMaxima: '5' }];
    expect(procedimentoParaDocumento(antigo, itens)).toBeUndefined();
  });
});
