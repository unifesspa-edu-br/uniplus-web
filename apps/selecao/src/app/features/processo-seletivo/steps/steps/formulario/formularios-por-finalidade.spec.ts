import {
  conteudoInicial,
  type ConteudoDoFormulario,
  type ItemDoFormulario,
} from '@uniplus/shared-ui/components';
import { describe, expect, it } from 'vitest';

import {
  abaPelaTecla,
  faseEfetiva,
  finalidadesParaAcrescentar,
  finalidadesQueAtende,
  ordemDeGravacao,
  type FaseQueRespondeFormulario,
} from './formularios-por-finalidade';

const item = (
  fatoCodigo: string,
  ordem: number,
  extra: Partial<ItemDoFormulario> = {},
): ItemDoFormulario => ({
  fatoCodigo,
  ordem,
  rotulo: fatoCodigo,
  tipoRenderizacao: 'BOOLEANO',
  obrigatoriedade: 'SEMPRE',
  precondicao: null,
  etapaCodigo: null,
  predicadoObrigatoriedade: null,
  ajuda: null,
  pedirConfirmacao: false,
  ...extra,
});

const com = (...itens: ItemDoFormulario[]): ConteudoDoFormulario => ({
  ...conteudoInicial(),
  itens,
});
const citando = (fato: string) => ({ precondicao: [[{ fato, operador: 'IGUAL', valor: 'true' }]] });

const fase = (
  codigo: string,
  extra: Partial<FaseQueRespondeFormulario> = {},
): FaseQueRespondeFormulario => ({
  codigo,
  coletaInscricao: false,
  coletaSolicitacaoIsencao: false,
  ...extra,
});
const INSCRICAO = fase('INSCRICAO', { coletaInscricao: true });
const ISENCAO = fase('SOLICITACAO_ISENCAO', { coletaSolicitacaoIsencao: true });
const HABILITACAO = fase('HABILITACAO');

describe('a ordem em que as finalidades gravam', () => {
  it('sem dependência entre elas, a inscrição, a isenção e a habilitação', () => {
    expect(
      ordemDeGravacao([
        { finalidade: 'HABILITACAO', servidor: null, desejado: com(item('LAUDO', 0)) },
        { finalidade: 'INSCRICAO', servidor: com(), desejado: com(item('PCD', 0)) },
      ]),
    ).toEqual(['INSCRICAO', 'HABILITACAO']);
  });

  it('o fato que muda de formulário sai do que o perde antes de entrar no que o ganha', () => {
    expect(
      ordemDeGravacao([
        { finalidade: 'INSCRICAO', servidor: com(), desejado: com(item('RENDA', 0)) },
        { finalidade: 'ISENCAO_TAXA', servidor: com(item('RENDA', 0)), desejado: com() },
      ]),
    ).toEqual(['ISENCAO_TAXA', 'INSCRICAO']);
  });

  it('a inscrição que ganha um fato grava antes da finalidade que passa a citá-lo', () => {
    // A inscrição espera a habilitação, de quem recebe RENDA; a isenção, que passa a citar PCD,
    // espera a inscrição, e não grava primeiro só por vir antes na ordem das finalidades.
    expect(
      ordemDeGravacao([
        {
          finalidade: 'INSCRICAO',
          servidor: com(),
          desejado: com(item('PCD', 0), item('RENDA', 1)),
        },
        {
          finalidade: 'ISENCAO_TAXA',
          servidor: com(item('BOLSA', 0)),
          desejado: com(item('BOLSA', 0, citando('PCD'))),
        },
        { finalidade: 'HABILITACAO', servidor: com(item('RENDA', 0)), desejado: com() },
      ]),
    ).toEqual(['HABILITACAO', 'INSCRICAO', 'ISENCAO_TAXA']);
  });

  it('a inscrição que perde um fato citado no servidor por outra finalidade grava depois dela', () => {
    expect(
      ordemDeGravacao([
        { finalidade: 'INSCRICAO', servidor: com(item('PCD', 0)), desejado: com() },
        {
          finalidade: 'HABILITACAO',
          servidor: com(item('LAUDO', 0, citando('PCD'))),
          desejado: com(item('LAUDO', 0)),
        },
      ]),
    ).toEqual(['HABILITACAO', 'INSCRICAO']);
  });
});

describe('as finalidades que podem ganhar formulário', () => {
  const oferecidas = (
    existentes: readonly string[],
    cobraTaxa: boolean,
    fases: readonly FaseQueRespondeFormulario[],
  ) => finalidadesParaAcrescentar(existentes, cobraTaxa, fases).map((opcao) => opcao.valor);

  it('oferece as que faltam e têm fase no cronograma', () => {
    expect(oferecidas(['INSCRICAO'], true, [INSCRICAO, ISENCAO, HABILITACAO])).toEqual([
      'ISENCAO_TAXA',
      'HABILITACAO',
    ]);
  });

  it('não oferece isenção em processo que não cobra taxa, mesmo com a fase de isenção', () => {
    expect(oferecidas(['INSCRICAO'], false, [INSCRICAO, ISENCAO, HABILITACAO])).toEqual([
      'HABILITACAO',
    ]);
  });

  it('não oferece habilitação sem a fase de habilitação no cronograma', () => {
    expect(oferecidas(['INSCRICAO'], true, [INSCRICAO, ISENCAO])).toEqual(['ISENCAO_TAXA']);
  });
});

describe('as finalidades que a fase atende', () => {
  it('a fase que coleta inscrição e isenção atende os dois formulários, e a de habilitação, o dela', () => {
    expect(
      finalidadesQueAtende(
        fase('INSCRICAO', { coletaInscricao: true, coletaSolicitacaoIsencao: true }),
      ),
    ).toEqual(['INSCRICAO', 'ISENCAO_TAXA']);
    expect(finalidadesQueAtende(HABILITACAO)).toEqual(['HABILITACAO']);
    expect(finalidadesQueAtende(fase('RESULTADO'))).toEqual([]);
  });
});

describe('a fase do formulário', () => {
  it('preenche sozinha quando só uma fase serve, e não fica com a escolhida que deixou de servir', () => {
    expect(faseEfetiva('', [HABILITACAO])).toBe('HABILITACAO');
    expect(faseEfetiva('INSCRICAO', [HABILITACAO, fase('OUTRA')])).toBe('');
  });
});

describe('o teclado nas abas', () => {
  it('as setas andam em círculo, Home e End vão às pontas, e outra tecla não troca de aba', () => {
    expect([abaPelaTecla('ArrowRight', 2, 3), abaPelaTecla('ArrowLeft', 0, 3)]).toEqual([0, 2]);
    expect([abaPelaTecla('Home', 2, 3), abaPelaTecla('End', 0, 3)]).toEqual([0, 2]);
    expect(abaPelaTecla('Enter', 1, 3)).toBeNull();
  });
});
