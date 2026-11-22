import { describe, expect, it } from 'vitest';

import { umaEtapaDoCronograma, umRecursoDaEtapa } from '../etapa-do-cronograma.testing';
import { umaFaseDoCronograma } from '../fase-do-cronograma.testing';
import {
  chaveDaParteDoLugar,
  conteudoDoLugar,
  lugarDaRecusaDaPublicacao,
  type CronogramaConferido,
} from './lugar-da-recusa-da-publicacao';

const ETAPA = 'etapa-1';
const RECURSO = 'recurso-1';
const daFase = (identificador: string) => ({ lista: 'fases', identificador });
const daEtapa = (identificador: string) => ({ lista: 'etapas', identificador });
const doRecurso = (identificador: string) => ({ lista: 'recursos', identificador });

const CRONOGRAMA: CronogramaConferido = {
  fases: [
    umaFaseDoCronograma({ codigo: 'INSCRICAO', faseCanonicaId: 'f1' }),
    umaFaseDoCronograma({ codigo: 'CLASSIFICACAO', faseCanonicaId: 'f2' }),
  ],
  etapas: [
    umaEtapaDoCronograma({
      id: ETAPA,
      recursos: [umRecursoDaEtapa({ id: 'outro' }), umRecursoDaEtapa({ id: RECURSO })],
    }),
  ],
};

const DUAS_PUBLICACOES = [
  { atoCodigo: 'RESULTADO_PRELIMINAR', papel: 'PRELIMINAR' },
  { atoCodigo: 'RESULTADO_FINAL', papel: 'DEFINITIVO' },
];
const COM_PUBLICACOES: CronogramaConferido = {
  ...CRONOGRAMA,
  fases: [
    umaFaseDoCronograma({ codigo: 'INSCRICAO', faseCanonicaId: 'f1', produtos: DUAS_PUBLICACOES }),
  ],
};

describe('lugarDaRecusaDaPublicacao: linha da lista de publicações', () => {
  const doItem = (campo: string) =>
    lugarDaRecusaDaPublicacao({ campo, identificadores: [daFase('INSCRICAO')] }, COM_PUBLICACOES);

  it('liga a recusa à linha que a posição aponta, no ato ou no papel dela', () => {
    expect(doItem('fases[0].produtos[1].atoCodigo')).toMatchObject({
      campo: 'produtos.1.atoCodigo',
    });
    expect(doItem('fases[0].produtos[0].papel')).toMatchObject({ campo: 'produtos.0.papel' });
  });

  it('dá lugares diferentes à mesma recusa em linhas diferentes', () => {
    const primeira = doItem('fases[0].produtos[0].atoCodigo');
    const segunda = doItem('fases[0].produtos[1].atoCodigo');

    expect(primeira).not.toEqual(segunda);
  });

  it('leva à lista a recusa de uma posição que a fase de hoje não tem', () => {
    expect(doItem('fases[0].produtos[2].atoCodigo')).toMatchObject({ campo: 'produtos' });
  });
});

describe('lugarDaRecusaDaPublicacao: fase', () => {
  it('liga o Fim à fase pelo código, seja qual for a posição que a API deu', () => {
    const lugar = lugarDaRecusaDaPublicacao(
      { campo: 'fases[0].fim', identificadores: [daFase('CLASSIFICACAO')] },
      CRONOGRAMA,
    );

    expect(lugar).toEqual({
      tipo: 'fase',
      codigo: 'CLASSIFICACAO',
      campo: 'fim',
      parte: 'fase',
      bancaAusente: false,
    });
  });

  it('liga a lista de publicações pelo campo da lista', () => {
    const lugar = lugarDaRecusaDaPublicacao(
      { campo: 'fases[1].produtos', identificadores: [daFase('CLASSIFICACAO')] },
      CRONOGRAMA,
    );

    expect(lugar).toMatchObject({ tipo: 'fase', campo: 'produtos' });
  });

  it('lê o ponteiro do documento como o caminho em pontos e colchetes', () => {
    const lugar = lugarDaRecusaDaPublicacao(
      { campo: '/cronograma/fases/9/fim', identificadores: [daFase('INSCRICAO')] },
      CRONOGRAMA,
    );

    expect(lugar).toMatchObject({ tipo: 'fase', codigo: 'INSCRICAO', campo: 'fim' });
  });

  it('põe a recusa da regra de recurso na parte da regra, e a de banca no campo da lista', () => {
    const regra = lugarDaRecusaDaPublicacao(
      { campo: 'fases[0].regraRecurso.prazoValor', identificadores: [daFase('INSCRICAO')] },
      CRONOGRAMA,
    );
    const banca = lugarDaRecusaDaPublicacao(
      { campo: 'fases[0].bancasRequeridas[2].quorum', identificadores: [daFase('INSCRICAO')] },
      CRONOGRAMA,
    );

    expect(regra).toMatchObject({ campo: 'recurso.prazoValor', parte: 'regraDeRecurso' });
    expect(banca).toMatchObject({ campo: 'bancasRequeridas', parte: 'fase' });
  });

  it('leva a regra de uma banca requerida ao campo da lista de bancas, mesmo que a banca exista', () => {
    const comBancas: CronogramaConferido = {
      ...CRONOGRAMA,
      fases: [
        umaFaseDoCronograma({
          codigo: 'INSCRICAO',
          bancasRequeridas: [
            {
              id: null,
              identificadorLocal: 'banca',
              copiaDoTipo: null,
              tipoBancaId: 'banca',
              categoriasDocumentoIds: [],
              regraDeDeliberacao: null,
            },
          ],
        }),
      ],
    };

    const lugar = lugarDaRecusaDaPublicacao(
      {
        campo: 'fases[0].bancasRequeridas[0].regraDeDeliberacao.quorum',
        identificadores: [daFase('INSCRICAO')],
      },
      comBancas,
    );

    expect(lugar).toMatchObject({ tipo: 'fase', campo: 'bancasRequeridas' });
  });

  it('põe no topo da fase a recusa de campo que a tela não conhece', () => {
    const lugar = lugarDaRecusaDaPublicacao(
      { campo: 'fases[0].campoQueNaoExiste', identificadores: [daFase('INSCRICAO')] },
      CRONOGRAMA,
    );

    expect(lugar).toMatchObject({ tipo: 'fase', campo: '' });
  });

  it('a fase que não existe mais leva a recusa ao passo, e não a outra fase', () => {
    const lugar = lugarDaRecusaDaPublicacao(
      { campo: 'fases[0].fim', identificadores: [daFase('REMOVIDA')] },
      CRONOGRAMA,
    );

    expect(lugar).toEqual({ tipo: 'passo' });
  });
});

describe('lugarDaRecusaDaPublicacao: etapa e recurso', () => {
  it('liga o campo da etapa pelo Id dela', () => {
    const lugar = lugarDaRecusaDaPublicacao(
      { campo: 'etapas[5].notaMaxima', identificadores: [daEtapa(ETAPA)] },
      CRONOGRAMA,
    );

    expect(lugar).toEqual({
      tipo: 'etapa',
      etapaId: ETAPA,
      campo: 'notaMaxima',
      recursoId: null,
      bancaAusente: false,
    });
  });

  it('liga o campo do recurso pelo Id dele, na posição que ele tem hoje', () => {
    const lugar = lugarDaRecusaDaPublicacao(
      {
        campo: 'etapas[5].recursos[0].prazoValor',
        identificadores: [daEtapa(ETAPA), doRecurso(RECURSO)],
      },
      CRONOGRAMA,
    );

    expect(lugar).toEqual({
      tipo: 'etapa',
      etapaId: ETAPA,
      campo: 'recursos.1.prazoValor',
      recursoId: RECURSO,
    });
  });

  it('o Id de recurso que não existe mais deixa a recusa no topo da etapa, sem apontar outro', () => {
    const lugar = lugarDaRecusaDaPublicacao(
      {
        campo: 'etapas[0].recursos[1].prazoValor',
        identificadores: [daEtapa(ETAPA), doRecurso('regravado')],
      },
      CRONOGRAMA,
    );

    expect(lugar).toEqual({ tipo: 'recursoRegravado', etapaId: ETAPA });
  });

  it('sem Id de recurso na recusa, deixa a recusa no topo da etapa', () => {
    const lugar = lugarDaRecusaDaPublicacao(
      { campo: 'etapas[0].recursos[1].prazoValor', identificadores: [daEtapa(ETAPA)] },
      CRONOGRAMA,
    );

    expect(lugar).toEqual({ tipo: 'recursoRegravado', etapaId: ETAPA });
  });

  it('leva o item de uma lista sem identificador ao campo da lista', () => {
    const lugar = lugarDaRecusaDaPublicacao(
      { campo: 'etapas[0].itensDeAvaliacao[3].rotulo', identificadores: [daEtapa(ETAPA)] },
      CRONOGRAMA,
    );

    expect(lugar).toMatchObject({ tipo: 'etapa', campo: 'itensDeAvaliacao' });
  });

  it('leva a regra de uma banca da etapa ao campo das bancas, que a publicação mostra no bloco delas', () => {
    const lugar = lugarDaRecusaDaPublicacao(
      {
        campo: 'etapas[0].bancas[1].regraDeDeliberacao.quorum',
        identificadores: [daEtapa(ETAPA)],
      },
      CRONOGRAMA,
    );

    expect(lugar).toMatchObject({ tipo: 'etapa', campo: 'bancas' });
  });

  it('a etapa que não existe mais leva a recusa ao passo', () => {
    const lugar = lugarDaRecusaDaPublicacao(
      { campo: 'etapas[0].notaMaxima', identificadores: [daEtapa('removida')] },
      CRONOGRAMA,
    );

    expect(lugar).toEqual({ tipo: 'passo' });
  });
});

describe('lugarDaRecusaDaPublicacao: sem lugar', () => {
  it.each([
    ['sem identificadores', 'fases[0].fim', []],
    ['de campo que não é fase nem etapa', 'identificacao.nome', [daFase('INSCRICAO')]],
    ['geral, sem campo', '', [daFase('INSCRICAO')]],
    ['com identificador de outra lista', 'fases[0].fim', [daEtapa(ETAPA)]],
  ])('a recusa %s não tem lugar', (_caso, campo, identificadores) => {
    expect(lugarDaRecusaDaPublicacao({ campo, identificadores }, CRONOGRAMA)).toBeNull();
  });
});

describe('conteudoDoLugar e chaveDaParteDoLugar', () => {
  const lugarDaFase = { tipo: 'fase', codigo: 'INSCRICAO', campo: 'fim', parte: 'fase' } as const;
  const lugarDoRecurso = {
    tipo: 'etapa',
    etapaId: ETAPA,
    campo: 'recursos.1.prazoValor',
    recursoId: RECURSO,
  } as const;

  it('muda o conteúdo da parte quando a fase muda, e não quando só a posição muda', () => {
    const [inscricao] = CRONOGRAMA.fases;
    const alterado = { ...CRONOGRAMA, fases: [{ ...inscricao, fim: '2026-03-10T18:00:00-03:00' }] };
    const renumerado = { ...CRONOGRAMA, fases: [{ ...inscricao, ordem: 9 }] };

    expect(conteudoDoLugar(lugarDaFase, alterado)).not.toEqual(
      conteudoDoLugar(lugarDaFase, CRONOGRAMA),
    );
    expect(conteudoDoLugar(lugarDaFase, renumerado)).toEqual(
      conteudoDoLugar(lugarDaFase, CRONOGRAMA),
    );
  });

  it('acha o recurso pelo Id, e devolve nulo quando ele não existe', () => {
    expect(conteudoDoLugar(lugarDoRecurso, CRONOGRAMA)).toMatchObject({ id: RECURSO });
    expect(conteudoDoLugar({ ...lugarDoRecurso, recursoId: 'x' }, CRONOGRAMA)).toBeNull();
    expect(conteudoDoLugar({ tipo: 'passo' }, CRONOGRAMA)).toBeNull();
  });

  it('identifica a parte do cadastro de cada lugar, e o lugar sem parte não tem chave', () => {
    expect(chaveDaParteDoLugar(lugarDaFase)).toBe('fase|INSCRICAO|fase');
    expect(chaveDaParteDoLugar(lugarDoRecurso)).toBe(`etapa|${ETAPA}|${RECURSO}`);
    expect(chaveDaParteDoLugar({ tipo: 'passo' })).toBeNull();
    expect(chaveDaParteDoLugar({ tipo: 'recursoRegravado', etapaId: ETAPA })).toBeNull();
  });
});
