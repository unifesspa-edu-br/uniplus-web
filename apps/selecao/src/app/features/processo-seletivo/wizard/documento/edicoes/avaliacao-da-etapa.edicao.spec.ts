import {
  TipoDeDecisaoDoDocumento,
  type DocumentoDaConfiguracao,
} from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import { documentoSemNada } from '../exemplos.testing';
import {
  acrescentarItemDeAvaliacao,
  acrescentarNivelDeAtendimento,
  comAvaliacao,
} from './avaliacao-da-etapa.edicao';
import { naEtapa } from './na-etapa';

function comEtapaAvaliada(): DocumentoDaConfiguracao {
  return {
    ...documentoSemNada(),
    etapas: [
      {
        chave: 'redacao',
        itensDeAvaliacao: [
          { chave: 'coesao', rotulo: 'Coesão', pontuacaoMaxima: 40 },
          { chave: 'argumentacao', rotulo: 'Argumentação', pontuacaoMaxima: 60 },
        ],
        escalaDeAtendimento: [
          { chave: 'plena', rotulo: 'Plena', fracao: 1 },
          { chave: 'parcial', rotulo: 'Parcial', fracao: 0.3 },
        ],
      },
    ],
    motivos: [],
  };
}

function itensDaEtapa(documento: DocumentoDaConfiguracao): string[] {
  return (documento.etapas?.[0].itensDeAvaliacao ?? []).map((item) => item.chave);
}

describe('acrescentar item e nível', () => {
  it('o item novo vai ao fim, com chave própria dentro da etapa', () => {
    const editado = acrescentarItemDeAvaliacao(comEtapaAvaliada(), 'redacao', 'Norma culta', {
      original: comEtapaAvaliada(),
      criadas: [],
    });

    expect(editado.etapas?.[0].itensDeAvaliacao?.at(-1)).toEqual({
      chave: 'norma-culta',
      rotulo: 'Norma culta',
    });
  });

  it('não repete a chave de item que uma referência ainda cita', () => {
    const documento: DocumentoDaConfiguracao = {
      ...comEtapaAvaliada(),
      etapas: [{ chave: 'redacao', itensDeAvaliacao: [] }],
      cronograma: {
        fases: [
          {
            chave: 'f',
            faseCanonicaCodigo: 'INSCRICOES',
            noMesmoMomentoDaAnterior: false,
            regraRecurso: {
              procedimentosDeRecurso: [
                {
                  tipoDeDecisao: TipoDeDecisaoDoDocumento.CLASSIFICACAO,
                  alvo: { itemDeAvaliacaoChave: 'coesao' },
                  regra: {},
                },
              ],
            },
          },
        ],
      },
    };

    const editado = acrescentarItemDeAvaliacao(documento, 'redacao', 'Coesão', {
      original: documento,
      criadas: [],
    });

    expect(itensDaEtapa(editado)).toEqual(['coesao-2']);
  });

  it('o nível novo vai ao fim da escala', () => {
    const editado = acrescentarNivelDeAtendimento(comEtapaAvaliada(), 'redacao', 'Não atende', {
      original: comEtapaAvaliada(),
      criadas: [],
    });

    expect(editado.etapas?.[0].escalaDeAtendimento?.at(-1)).toEqual({
      chave: 'nao-atende',
      rotulo: 'Não atende',
    });
  });

  it('reserva a chave do item removido e as criadas na edição', () => {
    const original = comEtapaAvaliada();
    const removido = naEtapa(original, 'redacao', (etapa) => ({
      ...etapa,
      itensDeAvaliacao: [],
      escalaDeAtendimento: [],
    }));
    const reservas = { original, criadas: ['coesao-2', 'plena-2'] };
    const comItem = acrescentarItemDeAvaliacao(removido, 'redacao', 'Coesão', reservas);
    expect(comItem.etapas?.[0].itensDeAvaliacao?.[0].chave).toBe('coesao-3');
  });

  it('reserva a chave do nível removido e as criadas na edição', () => {
    const original = comEtapaAvaliada();
    const removido = naEtapa(original, 'redacao', (etapa) => ({
      ...etapa,
      escalaDeAtendimento: [],
    }));
    const editado = acrescentarNivelDeAtendimento(removido, 'redacao', 'Plena', {
      original,
      criadas: ['plena-2'],
    });
    expect(editado.etapas?.[0].escalaDeAtendimento?.[0].chave).toBe('plena-3');
  });

  it('etapa que o documento não tem não recebe nada', () => {
    const documento = comEtapaAvaliada();

    expect(
      acrescentarItemDeAvaliacao(documento, 'sem-etapa', 'Item', {
        original: documento,
        criadas: [],
      }),
    ).toBe(documento);
  });
});

describe('avaliação da etapa', () => {
  const itens = [
    { origem: 0, chave: 'coesao', rotulo: 'Coesão', pontuacaoMaxima: '40' },
    { origem: 1, chave: 'argumentacao', rotulo: 'Argumentação', pontuacaoMaxima: '60' },
  ];
  const niveis = [
    { origem: 0, chave: 'plena', rotulo: 'Plena', percentual: '100' },
    { origem: 1, chave: 'parcial', rotulo: 'Parcial', percentual: '30' },
  ];

  function avaliar(
    documento: DocumentoDaConfiguracao,
    novosItens = itens,
    novosNiveis = niveis,
  ): DocumentoDaConfiguracao {
    return naEtapa(documento, 'redacao', (etapa) => comAvaliacao(etapa, novosItens, novosNiveis));
  }

  it('reordenar os itens os move no documento, sem tocar na chave', () => {
    const editado = avaliar(comEtapaAvaliada(), [itens[1], itens[0]]);

    expect(itensDaEtapa(editado)).toEqual(['argumentacao', 'coesao']);
  });

  it('renomear o item mantém a chave e a pontuação', () => {
    const editado = avaliar(comEtapaAvaliada(), [
      { ...itens[0], rotulo: 'Coesão textual' },
      itens[1],
    ]);

    expect(editado.etapas?.[0].itensDeAvaliacao?.[0]).toEqual({
      chave: 'coesao',
      rotulo: 'Coesão textual',
      pontuacaoMaxima: 40,
    });
  });

  it('o percentual digitado vira fração; o lido volta como estava', () => {
    const editado = avaliar(comEtapaAvaliada(), itens, [
      niveis[0],
      { ...niveis[1], percentual: '7,25' },
    ]);

    expect(editado.etapas?.[0].escalaDeAtendimento?.map((nivel) => nivel.fracao)).toEqual([
      1, 0.0725,
    ]);
  });

  it('retirar todos os itens deixa a lista vazia; sem lista, continua sem lista', () => {
    const vazia = avaliar(comEtapaAvaliada(), [], niveis);
    const semLista: DocumentoDaConfiguracao = {
      ...documentoSemNada(),
      etapas: [{ chave: 'redacao' }],
    };

    expect(vazia.etapas?.[0].itensDeAvaliacao).toEqual([]);
    expect(avaliar(semLista, [], []).etapas?.[0]).toEqual({ chave: 'redacao' });
  });

  it('item de chave repetida não colapsa e cada ocorrência guarda o que tinha', () => {
    const documento: DocumentoDaConfiguracao = {
      ...documentoSemNada(),
      etapas: [
        {
          chave: 'redacao',
          itensDeAvaliacao: [
            { chave: 'x', rotulo: 'Primeiro', pontuacaoMaxima: 1 },
            { chave: 'x', rotulo: 'Segundo', pontuacaoMaxima: 2 },
          ],
        },
      ],
    };
    const lidos = [
      { origem: 0, chave: 'x', rotulo: 'Primeiro', pontuacaoMaxima: '1' },
      { origem: 1, chave: 'x', rotulo: 'Segundo', pontuacaoMaxima: '2' },
    ];

    expect(JSON.stringify(avaliar(documento, lidos, []))).toBe(JSON.stringify(documento));
  });
});
