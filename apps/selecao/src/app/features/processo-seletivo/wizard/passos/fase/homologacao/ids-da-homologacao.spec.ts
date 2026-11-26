import { describe, expect, it } from 'vitest';

import {
  alvosDaRecusaDaHomologacao,
  sufixoDaCondicao,
  sufixoDaRecusaDaHomologacao,
  sufixoDoCampoDaHomologacao,
} from './ids-da-homologacao';

const id = (sufixo: string): string => `fase-X-${sufixo}`;

describe('ids da regra de homologação', () => {
  it('nomeia o elemento do campo trocando os pontos por hífens', () => {
    expect(sufixoDoCampoDaHomologacao('homologacao.alternativas.0.condicoes.1.tipo')).toBe(
      'homologacao-alternativas-0-condicoes-1-tipo',
    );
  });

  it('dá ao controle da condição o mesmo nome que o campo da recusa lhe dá', () => {
    expect(sufixoDaCondicao(0, 1, 'tipo')).toBe(
      sufixoDoCampoDaHomologacao('homologacao.alternativas.0.condicoes.1.tipo'),
    );
  });

  it('liga o bloco das recusas ao campo', () => {
    expect(sufixoDaRecusaDaHomologacao('homologacao.resultado')).toBe(
      'homologacao-resultado-recusa',
    );
  });
});

describe('alvosDaRecusaDaHomologacao', () => {
  it.each(['tipo', 'edicaoDoExame', 'motivoDesfavoravelCodigo'] as const)(
    'leva a recusa ao controle %s e, na falta dele, ao bloco das recusas',
    (controle) => {
      const campo = `homologacao.alternativas.1.condicoes.0.${controle}`;

      expect(alvosDaRecusaDaHomologacao(campo, id)).toEqual([
        `fase-X-homologacao-alternativas-1-condicoes-0-${controle}`,
        `fase-X-homologacao-alternativas-1-condicoes-0-${controle}-recusa`,
      ]);
    },
  );

  it('leva a recusa ao enquadramento só ao bloco das recusas', () => {
    expect(
      alvosDaRecusaDaHomologacao('homologacao.alternativas.0.condicoes.0.enquadramento', id),
    ).toEqual(['fase-X-homologacao-alternativas-0-condicoes-0-enquadramento-recusa']);
  });

  it('leva a recusa à regra inteira só ao bloco das recusas', () => {
    expect(alvosDaRecusaDaHomologacao('homologacao', id)).toEqual(['fase-X-homologacao-recusa']);
  });

  it('leva a recusa ao resultado ao seletor dele', () => {
    expect(alvosDaRecusaDaHomologacao('homologacao.resultado', id)).toEqual([
      'fase-X-homologacao-resultado',
      'fase-X-homologacao-resultado-recusa',
    ]);
  });

  it('leva a recusa à alternativa inteira ao grupo dela', () => {
    expect(alvosDaRecusaDaHomologacao('homologacao.alternativas.2', id)).toEqual([
      'fase-X-homologacao-alternativas-2',
      'fase-X-homologacao-alternativas-2-recusa',
    ]);
  });
});
