import { GuardaDaVagaCodigo, UnidadePrazoCodigo } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import {
  EXPLICACAO_DA_OPCAO_FORA_DO_VOCABULARIO,
  LEITURA_EM_BRANCO,
  PARAMETROS_EM_BRANCO,
  opcoesDaGuarda,
  opcoesParaEscolha,
  parametrosAlterados,
  prazoDaSegundaInstanciaRetirado,
  prazoDaSegundaInstanciaVisivel,
  type LeituraDoRecurso,
  type ParametrosDoRecurso,
} from './parametros-do-recurso';
import { umaLeituraDoRecurso } from './parametros-do-recurso.testing';

const VOCABULARIO = [
  { codigo: UnidadePrazoCodigo.DIAS_UTEIS, rotulo: 'dias úteis' },
  { codigo: UnidadePrazoCodigo.HORAS, rotulo: 'horas' },
];

describe('opcoesParaEscolha', () => {
  it('oferece só as opções do vocabulário quando o valor atual é uma delas', () => {
    expect(opcoesParaEscolha(VOCABULARIO, UnidadePrazoCodigo.HORAS)).toEqual([
      { codigo: UnidadePrazoCodigo.DIAS_UTEIS, rotulo: 'dias úteis', foraDoVocabulario: false },
      { codigo: UnidadePrazoCodigo.HORAS, rotulo: 'horas', foraDoVocabulario: false },
    ]);
  });

  it('oferece só as opções do vocabulário quando ainda não há valor', () => {
    const opcoes = opcoesParaEscolha(VOCABULARIO, '');

    expect(opcoes.map((opcao) => opcao.codigo)).toEqual([
      UnidadePrazoCodigo.DIAS_UTEIS,
      UnidadePrazoCodigo.HORAS,
    ]);
    expect(opcoes.some((opcao) => opcao.foraDoVocabulario)).toBe(false);
  });

  it('acrescenta o valor atual que o vocabulário não oferece, marcado e com o código como nome', () => {
    const opcoes = opcoesParaEscolha(VOCABULARIO, UnidadePrazoCodigo.DIAS);

    expect(opcoes.map((opcao) => opcao.codigo)).toEqual([
      UnidadePrazoCodigo.DIAS_UTEIS,
      UnidadePrazoCodigo.HORAS,
      UnidadePrazoCodigo.DIAS,
    ]);
    expect(opcoes[2]).toEqual({
      codigo: UnidadePrazoCodigo.DIAS,
      rotulo: UnidadePrazoCodigo.DIAS,
      descricao: EXPLICACAO_DA_OPCAO_FORA_DO_VOCABULARIO,
      foraDoVocabulario: true,
    });
  });

  it('prefere o nome que a leitura deu ao valor fora do vocabulário', () => {
    expect(
      opcoesParaEscolha(VOCABULARIO, UnidadePrazoCodigo.DIAS, 'Dias corridos')[2]?.rotulo,
    ).toBe('Dias corridos');
  });

  it('com vocabulário vazio, mostra só o valor atual', () => {
    expect(opcoesParaEscolha([], UnidadePrazoCodigo.HORAS)).toEqual([
      {
        codigo: UnidadePrazoCodigo.HORAS,
        rotulo: UnidadePrazoCodigo.HORAS,
        descricao: EXPLICACAO_DA_OPCAO_FORA_DO_VOCABULARIO,
        foraDoVocabulario: true,
      },
    ]);
  });

  it('com vocabulário vazio e sem valor, não oferece nada', () => {
    expect(opcoesParaEscolha([], '')).toEqual([]);
  });
});

describe('opcoesDaGuarda', () => {
  const GUARDAS = [
    { codigo: GuardaDaVagaCodigo.ATE_O_RESULTADO_DEFINITIVO, rotulo: 'Até o definitivo' },
    { codigo: GuardaDaVagaCodigo.NAO_GUARDA, rotulo: 'Não guarda' },
  ];
  const codigos = (admite: boolean | null, atual: string) =>
    opcoesDaGuarda(GUARDAS, admite, atual).map((opcao) => opcao.codigo);

  it.each([false, null])('com instância superior %s, oferece as duas opções', (admite) => {
    expect(codigos(admite, '')).toEqual([
      GuardaDaVagaCodigo.ATE_O_RESULTADO_DEFINITIVO,
      GuardaDaVagaCodigo.NAO_GUARDA,
    ]);
  });

  it('com instância superior, deixa de oferecer "não guarda"', () => {
    expect(codigos(true, '')).toEqual([GuardaDaVagaCodigo.ATE_O_RESULTADO_DEFINITIVO]);
  });

  it('com instância superior, mantém "não guarda" quando é o valor atual', () => {
    expect(codigos(true, GuardaDaVagaCodigo.NAO_GUARDA)).toEqual([
      GuardaDaVagaCodigo.ATE_O_RESULTADO_DEFINITIVO,
      GuardaDaVagaCodigo.NAO_GUARDA,
    ]);
  });
});

describe('prazoDaSegundaInstanciaVisivel', () => {
  const visivel = (admite: boolean | null, semInstancia = false) =>
    prazoDaSegundaInstanciaVisivel(
      { admiteInstanciaSuperior: admite },
      umaLeituraDoRecurso({ prazoDaSegundaInstanciaSemInstanciaSuperior: semInstancia }),
    );

  it('aparece com instância superior', () => {
    expect(visivel(true)).toBe(true);
  });

  it.each([false, null])(
    'com instância superior %s, só aparece se a leitura o trouxe',
    (admite) => {
      expect(visivel(admite)).toBe(false);
      expect(visivel(admite, true)).toBe(true);
    },
  );
});

describe('parametrosAlterados', () => {
  const comPrazoDaSegunda: ParametrosDoRecurso = {
    ...PARAMETROS_EM_BRANCO,
    admiteInstanciaSuperior: true,
    prazoSegundaInstanciaValor: '3',
    prazoSegundaInstanciaUnidade: UnidadePrazoCodigo.DIAS_UTEIS,
  };
  const leituraComRotulos: LeituraDoRecurso = umaLeituraDoRecurso({
    rotulos: {
      prazoUnidade: 'Dias úteis',
      prazoSegundaInstanciaUnidade: 'Dias úteis',
      guardaDaVaga: 'Não guarda',
    },
  });

  it('troca só o campo mexido e não retira nada', () => {
    const resultado = parametrosAlterados(comPrazoDaSegunda, LEITURA_EM_BRANCO, {
      campo: 'prazoValor',
      valor: '5',
    });

    expect(resultado.parametros).toEqual({ ...comPrazoDaSegunda, prazoValor: '5' });
    expect(resultado.retirado).toBeNull();
  });

  it('guarda o código do vocabulário e deixa vazio o que o vocabulário não conhece', () => {
    const conhecido = parametrosAlterados(PARAMETROS_EM_BRANCO, LEITURA_EM_BRANCO, {
      campo: 'prazoUnidade',
      valor: UnidadePrazoCodigo.HORAS,
    });
    const desconhecido = parametrosAlterados(PARAMETROS_EM_BRANCO, LEITURA_EM_BRANCO, {
      campo: 'prazoUnidade',
      valor: 'semanas',
    });

    expect(conhecido.parametros.prazoUnidade).toBe(UnidadePrazoCodigo.HORAS);
    expect(desconhecido.parametros.prazoUnidade).toBe('');
  });

  it('trocar um campo tira dele o nome que a leitura tinha dado', () => {
    const { leitura } = parametrosAlterados(comPrazoDaSegunda, leituraComRotulos, {
      campo: 'prazoUnidade',
      valor: UnidadePrazoCodigo.HORAS,
    });

    expect(leitura.rotulos).toEqual({
      prazoSegundaInstanciaUnidade: 'Dias úteis',
      guardaDaVaga: 'Não guarda',
    });
  });

  it('marcar Sim com "não guarda" escolhida deixa a guarda vazia e anuncia a retirada', () => {
    const parametros = { ...PARAMETROS_EM_BRANCO, guardaDaVaga: GuardaDaVagaCodigo.NAO_GUARDA };

    const resultado = parametrosAlterados(parametros, leituraComRotulos, {
      campo: 'admiteInstanciaSuperior',
      valor: true,
    });

    expect(resultado.parametros).toMatchObject({ admiteInstanciaSuperior: true, guardaDaVaga: '' });
    expect(resultado.leitura.rotulos).not.toHaveProperty('guardaDaVaga');
    expect(resultado.retirado).toBe('guarda');
  });

  it('marcar Sim com outra guarda não retira nada', () => {
    const parametros = {
      ...PARAMETROS_EM_BRANCO,
      guardaDaVaga: GuardaDaVagaCodigo.ATE_O_RESULTADO_DEFINITIVO,
    };

    const resultado = parametrosAlterados(parametros, LEITURA_EM_BRANCO, {
      campo: 'admiteInstanciaSuperior',
      valor: true,
    });

    expect(resultado.parametros.guardaDaVaga).toBe(GuardaDaVagaCodigo.ATE_O_RESULTADO_DEFINITIVO);
    expect(resultado.retirado).toBeNull();
  });

  it('marcar Não com o prazo da 2ª preenchido esvazia valor e unidade e anuncia a retirada', () => {
    const resultado = parametrosAlterados(comPrazoDaSegunda, leituraComRotulos, {
      campo: 'admiteInstanciaSuperior',
      valor: false,
    });

    expect(resultado.parametros).toMatchObject({
      admiteInstanciaSuperior: false,
      prazoSegundaInstanciaValor: '',
      prazoSegundaInstanciaUnidade: '',
    });
    expect(resultado.leitura.prazoDaSegundaInstanciaSemInstanciaSuperior).toBe(false);
    expect(resultado.leitura.rotulos).not.toHaveProperty('prazoSegundaInstanciaUnidade');
    expect(resultado.retirado).toBe('prazoDaSegundaInstancia');
  });

  it('marcar Não sem prazo da 2ª não anuncia retirada', () => {
    const resultado = parametrosAlterados(PARAMETROS_EM_BRANCO, LEITURA_EM_BRANCO, {
      campo: 'admiteInstanciaSuperior',
      valor: false,
    });

    expect(resultado.retirado).toBeNull();
  });

  it('desfazer não restaura o prazo da 2ª: marcar Sim depois de Não não o devolve', () => {
    const naoDeNovo = parametrosAlterados(comPrazoDaSegunda, LEITURA_EM_BRANCO, {
      campo: 'admiteInstanciaSuperior',
      valor: false,
    });
    const simDeNovo = parametrosAlterados(naoDeNovo.parametros, naoDeNovo.leitura, {
      campo: 'admiteInstanciaSuperior',
      valor: true,
    });

    expect(simDeNovo.parametros.prazoSegundaInstanciaValor).toBe('');
    expect(simDeNovo.parametros.prazoSegundaInstanciaUnidade).toBe('');
  });

  it('desfazer não restaura "não guarda": marcar Não depois de Sim não o devolve', () => {
    const comNaoGuarda = { ...PARAMETROS_EM_BRANCO, guardaDaVaga: GuardaDaVagaCodigo.NAO_GUARDA };
    const sim = parametrosAlterados(comNaoGuarda, LEITURA_EM_BRANCO, {
      campo: 'admiteInstanciaSuperior',
      valor: true,
    });
    const naoDeNovo = parametrosAlterados(sim.parametros, sim.leitura, {
      campo: 'admiteInstanciaSuperior',
      valor: false,
    });

    expect(sim.parametros.guardaDaVaga).toBe('');
    expect(naoDeNovo.parametros.guardaDaVaga).toBe('');
  });
});

describe('prazoDaSegundaInstanciaRetirado', () => {
  it('esvazia valor e unidade, desliga a marca da leitura e anuncia a retirada', () => {
    const parametros: ParametrosDoRecurso = {
      ...PARAMETROS_EM_BRANCO,
      admiteInstanciaSuperior: false,
      prazoSegundaInstanciaValor: '3',
      prazoSegundaInstanciaUnidade: UnidadePrazoCodigo.DIAS_UTEIS,
    };
    const leitura = umaLeituraDoRecurso({
      rotulos: { prazoSegundaInstanciaUnidade: 'Dias úteis' },
      prazoDaSegundaInstanciaSemInstanciaSuperior: true,
    });

    const resultado = prazoDaSegundaInstanciaRetirado(parametros, leitura);

    expect(resultado.parametros).toMatchObject({
      prazoSegundaInstanciaValor: '',
      prazoSegundaInstanciaUnidade: '',
    });
    expect(resultado.leitura).toEqual({
      rotulos: {},
      prazoDaSegundaInstanciaSemInstanciaSuperior: false,
    });
    expect(resultado.retirado).toBe('prazoDaSegundaInstancia');
  });
});
