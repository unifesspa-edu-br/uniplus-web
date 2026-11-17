import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ligarRelogioControlado, passarOTempo } from '@uniplus/shared-testing';
import type { DependenciasDaAvaliacao, SimulacaoDoFormulario } from '@uniplus/shared-ui/components';

import {
  ESPERA_DA_CONSULTA_MS,
  type AvaliacaoDaInscricaoEstado,
  impressaoDasDependencias,
} from './avaliacao-da-inscricao.estado';
import {
  type ServicoDublê,
  criarEstado,
  inicioPadrao,
  mudar,
} from './avaliacao-da-inscricao.estado.testing';

const impressao = (
  simulacao: SimulacaoDoFormulario,
  dependencias: DependenciasDaAvaliacao | null,
): string | null => impressaoDasDependencias(simulacao, dependencias);

const familia = (
  ...integrantes: { id: string; respostas?: Record<string, number | string> }[]
) => ({
  grupos: { FAMILIA: integrantes },
});

describe('impressão das dependências da avaliação', () => {
  it('sem dependências não há impressão', () => {
    expect(impressao({ respostas: { CONCORRER_EP: true } }, null)).toBeNull();
  });

  it('o fato simples sem resposta vale nulo, e as respostas falsas valem como são', () => {
    const dependencias = { fatos: ['A', 'B', 'C', 'D'], grupos: [] };

    expect(impressao({ respostas: { B: false, C: 0, D: '' } }, dependencias)).toBe(
      '[[["A",null],["B",false],["C",0],["D",""]],[]]',
    );
  });

  it('o subitem GRUPO.FATO lista a resposta de cada integrante pelo id, nulo quando falta', () => {
    const dependencias = { fatos: ['FAMILIA.RENDA'], grupos: ['FAMILIA'] };
    const simulacao = familia({ id: 'm1', respostas: { RENDA: 900 } }, { id: 'm2' });

    expect(impressao(simulacao, dependencias)).toBe(
      '[[["FAMILIA.RENDA",[["m1",900],["m2",null]]]],[["FAMILIA",["m1","m2"]]]]',
    );
  });

  it('o grupo ausente da simulação vale lista vazia, no subitem e nas ocorrências', () => {
    const dependencias = { fatos: ['FAMILIA.RENDA'], grupos: ['FAMILIA'] };

    expect(impressao({ respostas: {} }, dependencias)).toBe(
      '[[["FAMILIA.RENDA",[]]],[["FAMILIA",[]]]]',
    );
  });

  it('a simulação vazia e a que traz respostas e grupos nulos dão a mesma impressão', () => {
    const dependencias = { fatos: ['CONCORRER_EP', 'FAMILIA.RENDA'], grupos: ['FAMILIA'] };

    expect(impressao({}, dependencias)).toBe(
      impressao({ respostas: {}, grupos: {} }, dependencias),
    );
  });

  it('a ordem das ocorrências muda a impressão', () => {
    const dependencias = { fatos: [], grupos: ['FAMILIA'] };
    const emOrdem = impressao(familia({ id: 'm1' }, { id: 'm2' }), dependencias);
    const invertida = impressao(familia({ id: 'm2' }, { id: 'm1' }), dependencias);

    expect(emOrdem).toBe('[[],[["FAMILIA",["m1","m2"]]]]');
    expect(invertida).toBe('[[],[["FAMILIA",["m2","m1"]]]]');
  });

  it('a ordem em que a avaliação declara os fatos e os grupos é a da impressão', () => {
    const respostas = { A: 1, B: 2 };

    expect(impressao({ respostas }, { fatos: ['A', 'B'], grupos: ['X', 'Y'] })).toBe(
      '[[["A",1],["B",2]],[["X",[]],["Y",[]]]]',
    );
    expect(impressao({ respostas }, { fatos: ['B', 'A'], grupos: ['Y', 'X'] })).toBe(
      '[[["B",2],["A",1]],[["Y",[]],["X",[]]]]',
    );
  });

  it('só o que a avaliação declara entra: resposta e grupo alheios não aparecem', () => {
    const simulacao = { respostas: { EMAIL: 'a@b.c' }, ...familia({ id: 'm1' }) };

    expect(impressao(simulacao, { fatos: ['A'], grupos: [] })).toBe('[[["A",null]],[]]');
  });

  it('o fato com mais de um ponto usa só o segundo trecho como subitem', () => {
    const simulacao = familia({ id: 'm1', respostas: { RENDA: 900, EXTRA: 1 } });

    expect(impressao(simulacao, { fatos: ['FAMILIA.RENDA.EXTRA'], grupos: [] })).toBe(
      '[[["FAMILIA.RENDA.EXTRA",[["m1",900]]]],[]]',
    );
  });
});

describe('o que a impressão decide consultar', () => {
  let estado: AvaliacaoDaInscricaoEstado;
  let servico: ServicoDublê;

  const depoisDaEspera = (): Promise<void> => passarOTempo(ESPERA_DA_CONSULTA_MS);

  beforeEach(() => {
    ligarRelogioControlado();
  });
  afterEach(() => vi.useRealTimers());

  const abrirCom = (simulacao: SimulacaoDoFormulario): void => {
    ({ estado, servico } = criarEstado({ simulacao }));
  };

  it('a mesma simulação do início não consulta', async () => {
    abrirCom({ respostas: { CONCORRER_EP: true }, ...familia({ id: 'm1' }) });

    mudar(estado, { respostas: { CONCORRER_EP: true }, ...familia({ id: 'm1' }) });
    await depoisDaEspera();

    expect(servico.consultas).toHaveLength(0);
  });

  it('mudar o fato de que a avaliação depende consulta, e o não dependente não', async () => {
    abrirCom({ respostas: { CONCORRER_EP: true, EMAIL: 'a@b.c' } });

    mudar(estado, { respostas: { CONCORRER_EP: true, EMAIL: 'x@y.z', TELEFONE: '1' } });
    await depoisDaEspera();
    expect(servico.consultas).toHaveLength(0);

    mudar(estado, { respostas: { CONCORRER_EP: false, EMAIL: 'x@y.z' } });
    await depoisDaEspera();
    expect(servico.corpos().map((c) => c.respostas)).toEqual([
      { CONCORRER_EP: false, EMAIL: 'x@y.z' },
    ]);
  });

  it('mudar o subitem não dependente de um integrante, ou um grupo alheio, não consulta', async () => {
    abrirCom(familia({ id: 'm1', respostas: { RENDA: 900, NOME: 'a' } }));

    mudar(estado, {
      grupos: {
        ...familia({ id: 'm1', respostas: { RENDA: 900, NOME: 'b' } }).grupos,
        OUTRO: [{ id: 'o1' }],
      },
    });
    await depoisDaEspera();

    expect(servico.consultas).toHaveLength(0);
  });

  it('mudar o subitem dependente de um integrante consulta', async () => {
    abrirCom(familia({ id: 'm1', respostas: { RENDA: 900 } }));

    mudar(estado, familia({ id: 'm1', respostas: { RENDA: 1900 } }));
    await depoisDaEspera();

    expect(servico.consultas).toHaveLength(1);
  });

  it('acrescentar, remover ou reordenar integrantes consulta', async () => {
    abrirCom(familia({ id: 'm1' }, { id: 'm2' }));

    for (const integrantes of [
      [{ id: 'm2' }, { id: 'm1' }],
      [{ id: 'm2' }],
      [{ id: 'm2' }, { id: 'm3' }],
    ]) {
      mudar(estado, familia(...integrantes));
      await depoisDaEspera();
    }

    expect(servico.consultas).toHaveLength(3);
  });

  it('o que a consulta levou vira a nova base: repetir a mesma resposta não consulta de novo', async () => {
    abrirCom({});

    mudar(estado, { respostas: { CONCORRER_EP: true } });
    await depoisDaEspera();
    mudar(estado, { respostas: { CONCORRER_EP: true } });
    await depoisDaEspera();

    expect(servico.consultas).toHaveLength(1);
  });

  it('o corpo só é montado quando a impressão mudou', () => {
    abrirCom({ respostas: { CONCORRER_EP: true } });
    const corpo = vi.fn(() => ({ respostas: {}, grupos: null }));

    estado.respostasMudaram({ respostas: { CONCORRER_EP: true } }, corpo);
    expect(corpo).not.toHaveBeenCalled();

    estado.respostasMudaram({ respostas: { CONCORRER_EP: false } }, corpo);
    expect(corpo).toHaveBeenCalledTimes(1);
  });

  it('sem dependências, nenhuma mudança consulta, nem monta o corpo', async () => {
    ({ estado, servico } = criarEstado({ dependencias: undefined }));
    const corpo = vi.fn(() => ({ respostas: {}, grupos: null }));

    estado.respostasMudaram({ respostas: { CONCORRER_EP: true } }, corpo);
    await depoisDaEspera();

    expect(corpo).not.toHaveBeenCalled();
    expect(servico.consultas).toHaveLength(0);
  });

  it('iniciar de novo troca a base de comparação', async () => {
    abrirCom({ respostas: { CONCORRER_EP: true } });
    estado.iniciar(inicioPadrao({ simulacao: { respostas: { CONCORRER_EP: false } } }));

    mudar(estado, { respostas: { CONCORRER_EP: false } });
    await depoisDaEspera();
    expect(servico.consultas).toHaveLength(0);

    mudar(estado, { respostas: { CONCORRER_EP: true } });
    await depoisDaEspera();
    expect(servico.consultas).toHaveLength(1);
  });
});
