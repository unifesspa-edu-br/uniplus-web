import { ConsequenciaDoDescumprimentoCodigo } from '@uniplus/shared-data/selecao';
import { conteudoInicial } from '@uniplus/shared-inscricao/formulario';
import { describe, expect, it } from 'vitest';

import { formularioCom, formularioDoRascunho } from './formulario-de-inscricao.testing';
import {
  codigoDeFormularioValido,
  comAFaseEfetiva,
  comFormulario,
  conteudoDaInscricao,
  consequenciaDoCodigo,
  emOrdemDoCronograma,
  faseEfetiva,
  fatosColetadosPelasOutras,
  formularioDaInscricao,
  formularioDoCodigo,
  rotuloDoFormulario,
  semFormulario,
} from './formularios-do-rascunho';

const INSCRICOES = new Set(['INSCRICAO']);
const habilitacao = () =>
  formularioDoRascunho(conteudoInicial(), { codigo: 'HABILITACAO', faseCodigo: 'HABILITACAO' });

describe('o código do formulário', () => {
  it('começa com letra maiúscula, tem só maiúsculas, números e sublinhado, e até 60 caracteres', () => {
    expect(codigoDeFormularioValido('INSCRICAO_2027')).toBe(true);
    expect(codigoDeFormularioValido('1INSCRICAO')).toBe(false);
    expect(codigoDeFormularioValido('inscricao')).toBe(false);
    expect(codigoDeFormularioValido('A'.repeat(60))).toBe(true);
    expect(codigoDeFormularioValido('A'.repeat(61))).toBe(false);
  });
});

describe('a fase efetiva no rascunho', () => {
  const rascunho = formularioCom(conteudoInicial(), {}, [habilitacao()]);

  it('troca a fase guardada que deixou de servir pela única que serve', () => {
    const fases = new Map([['INSCRICAO', { escolhida: 'NOVA' }]]);

    const alinhado = comAFaseEfetiva(rascunho, fases, (formulario) => formulario);

    expect(alinhado?.formularios.map((f) => f.faseCodigo)).toEqual(['NOVA', 'HABILITACAO']);
  });

  it('aplica o que a nova fase impõe, como a obrigatoriedade, ao formulário que mudou de fase', () => {
    const fases = new Map([['INSCRICAO', { escolhida: 'NOVA' }]]);

    const alinhado = comAFaseEfetiva(rascunho, fases, (formulario) => ({
      ...formulario,
      obrigatorio: false,
    }));

    expect(alinhado?.formularios.map((f) => f.obrigatorio)).toEqual([false, true]);
  });

  it('não muda nada, e devolve nulo, quando a fase guardada já é a efetiva ou não há efetiva', () => {
    const fases = new Map([
      ['INSCRICAO', { escolhida: 'INSCRICAO' }],
      ['HABILITACAO', { escolhida: '' }],
    ]);

    expect(comAFaseEfetiva(rascunho, fases, (formulario) => formulario)).toBeNull();
  });
});

describe('a fase do formulário', () => {
  it('preenche sozinha quando só uma fase serve, e não fica com a escolhida que deixou de servir', () => {
    expect(faseEfetiva('', [{ codigo: 'HABILITACAO' }])).toBe('HABILITACAO');
    expect(faseEfetiva('INSCRICAO', [{ codigo: 'HABILITACAO' }, { codigo: 'OUTRA' }])).toBe('');
    expect(faseEfetiva('OUTRA', [{ codigo: 'HABILITACAO' }, { codigo: 'OUTRA' }])).toBe('OUTRA');
  });
});

describe('os formulários do rascunho', () => {
  it('troca o formulário no lugar, ou o acrescenta ao fim, e o código muda antes de gravar', () => {
    const base = formularioCom(conteudoInicial());

    const com = comFormulario(base, habilitacao());
    expect(com.formularios.map((f) => f.codigo)).toEqual(['INSCRICAO', 'HABILITACAO']);

    const renomeado = comFormulario(com, { ...habilitacao(), codigo: 'OUTRO' }, 'HABILITACAO');
    expect(renomeado.formularios.map((f) => f.codigo)).toEqual(['INSCRICAO', 'OUTRO']);
    expect(formularioDoCodigo(renomeado, 'OUTRO')).not.toBeNull();
    expect(formularioDoCodigo(renomeado, 'HABILITACAO')).toBeNull();
  });

  it('retira só o formulário do código', () => {
    const base = comFormulario(formularioCom(conteudoInicial()), habilitacao());

    expect(semFormulario(base, 'HABILITACAO').formularios.map((f) => f.codigo)).toEqual([
      'INSCRICAO',
    ]);
  });

  it('a inscrição é o obrigatório de fase que coleta inscrição, e sem ela o conteúdo é o inicial', () => {
    const base = comFormulario(formularioCom(conteudoInicial()), habilitacao());

    expect(formularioDaInscricao(base, INSCRICOES)?.codigo).toBe('INSCRICAO');
    expect(formularioDaInscricao(base, new Set())).toBeNull();
    expect(conteudoDaInscricao(base, new Set())).toEqual(conteudoInicial());
  });

  it('os fatos que as outras coletam são os dos formulários de outro código', () => {
    const itens = [
      {
        fatoCodigo: 'RENDA',
        ordem: 0,
        paginaCodigo: null,
        apresentacao: { rotulo: 'Renda', tipoDeCampo: 'SIM_OU_NAO' },
      },
    ] as never;
    const outro = formularioDoRascunho(
      { ...conteudoInicial(), itens },
      { codigo: 'HABILITACAO', faseCodigo: 'HABILITACAO' },
    );
    const base = formularioCom(conteudoInicial(), {}, [outro]);

    expect(fatosColetadosPelasOutras(base.formularios, 'INSCRICAO')).toEqual(['RENDA']);
    expect(fatosColetadosPelasOutras(base.formularios, 'HABILITACAO')).toEqual([]);
  });
});

describe('a ordem pelo cronograma', () => {
  it('segue o cronograma, o obrigatório primeiro, e o sem fase vai ao fim', () => {
    const f = (faseCodigo: string, obrigatorio: boolean) => ({ faseCodigo, obrigatorio });
    const ordenados = emOrdemDoCronograma(
      [f('', true), f('B', false), f('B', true), f('A', true)],
      ['A', 'B'],
    );

    expect(ordenados.map((x) => `${x.faseCodigo}${x.obrigatorio ? '+' : '-'}`)).toEqual([
      'A+',
      'B+',
      'B-',
      '+',
    ]);
  });
});

describe('o rótulo do formulário', () => {
  const base = { codigo: 'HAB', obrigatorio: false, conteudo: conteudoInicial() };

  it('é o título, quando há', () => {
    expect(
      rotuloDoFormulario(
        { ...base, conteudo: { ...base.conteudo, titulo: ' Laudo ' } },
        'Avaliação',
      ),
    ).toBe('Laudo');
  });

  it('sem título, é o nome da fase e a obrigatoriedade', () => {
    expect(rotuloDoFormulario(base, 'Avaliação')).toBe('Avaliação — facultativo');
    expect(rotuloDoFormulario({ ...base, obrigatorio: true }, 'Avaliação')).toBe(
      'Avaliação — obrigatório',
    );
  });

  it('sem título nem fase, é o código', () => {
    expect(rotuloDoFormulario(base, null)).toBe('HAB');
  });
});

describe('a consequência do vocabulário do servidor', () => {
  it('só reconhece os códigos do contrato', () => {
    expect(consequenciaDoCodigo('ELIMINA_DO_PROCESSO')).toBe(
      ConsequenciaDoDescumprimentoCodigo.ELIMINA_DO_PROCESSO,
    );
    expect(consequenciaDoCodigo('QUALQUER')).toBeNull();
  });
});
