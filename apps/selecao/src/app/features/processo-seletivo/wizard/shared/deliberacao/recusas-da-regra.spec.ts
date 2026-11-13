import { describe, expect, it } from 'vitest';

import {
  CAMPOS_DA_BANCA,
  campoDaRegraNoCaminho,
  errosDaBancaPorCampo,
  recusaDaRegra,
} from './recusas-da-regra';

const PREFIXO = 'uniplus.selecao.banca.';

describe('recusaDaRegra', () => {
  it.each([
    ['integrantes_invalidos', 'integrantes'],
    ['suplentes_invalidos', 'suplentes'],
    ['modo_de_deliberacao_invalido', 'modo'],
    ['quorum_fora_do_intervalo', 'quorum'],
    ['quorum_incoerente', 'quorum'],
    ['criterio_obrigatorio', 'criterio'],
    ['encerramento_obrigatorio', 'encerramento'],
    ['desempate_obrigatorio', 'desempate'],
    ['desempate_nao_se_aplica', 'desempate'],
    ['sem_unanimidade_obrigatoria', 'semUnanimidade'],
    ['sem_unanimidade_nao_se_aplica', 'semUnanimidade'],
    ['ato_individual_sem_votacao', 'modo'],
    ['regra_de_deliberacao_obrigatoria', 'regra'],
    ['integrantes_abaixo_do_minimo', 'integrantes'],
  ])('leva %s para o campo %s, com texto em português', (codigo, campo) => {
    const recusa = recusaDaRegra(`${PREFIXO}${codigo}`);

    expect(recusa?.campo).toBe(campo);
    expect(recusa?.mensagem.length).toBeGreaterThan(10);
  });

  it('devolve nulo para o código que não é da regra da banca', () => {
    expect(recusaDaRegra('uniplus.selecao.cronograma.recurso_sem_banca')).toBeNull();
    expect(recusaDaRegra(`${PREFIXO}codigo_que_nao_existe`)).toBeNull();
  });

  it('prefere a mensagem do servidor quando o mínimo de integrantes só vem nela', () => {
    const recusa = recusaDaRegra(
      `${PREFIXO}integrantes_abaixo_do_minimo`,
      'A banca precisa de ao menos 3 integrantes.',
    );

    expect(recusa?.mensagem).toBe('A banca precisa de ao menos 3 integrantes.');
  });

  it('mantém o texto próprio nos demais códigos, ignorando a mensagem do servidor', () => {
    const recusa = recusaDaRegra(`${PREFIXO}quorum_fora_do_intervalo`, 'detalhe do servidor');

    expect(recusa?.mensagem).not.toContain('detalhe do servidor');
  });
});

describe('campoDaRegraNoCaminho', () => {
  it('lê o campo que o caminho aponta, sem distinguir a caixa', () => {
    expect(campoDaRegraNoCaminho('fases[0].bancasRequeridas[1].regraDeDeliberacao.quorum')).toBe(
      'quorum',
    );
    expect(campoDaRegraNoCaminho('etapas[2].bancas[0].RegraDeDeliberacao.SemUnanimidade')).toBe(
      'semUnanimidade',
    );
  });

  it('devolve nulo quando o caminho aponta a banca ou a regra inteira', () => {
    expect(campoDaRegraNoCaminho('fases[0].bancasRequeridas[1]')).toBeNull();
    expect(campoDaRegraNoCaminho('fases[0].bancasRequeridas[1].regraDeDeliberacao')).toBeNull();
    expect(
      campoDaRegraNoCaminho('fases[0].bancasRequeridas[1].regraDeDeliberacao.outro'),
    ).toBeNull();
  });
});

describe('errosDaBancaPorCampo', () => {
  it('reúne só os campos que têm erro', () => {
    const erros = errosDaBancaPorCampo((campo) => (campo === 'quorum' ? 'fora' : null));

    expect(erros).toEqual({ quorum: 'fora' });
  });

  it('ignora o erro vazio ou indefinido', () => {
    expect(errosDaBancaPorCampo((campo) => (campo === 'modo' ? '' : undefined))).toEqual({});
  });

  it('consulta cada lugar sob o qual a recusa pode aparecer', () => {
    const consultados: string[] = [];
    errosDaBancaPorCampo((campo) => {
      consultados.push(campo);
      return null;
    });

    expect(consultados).toEqual([...CAMPOS_DA_BANCA]);
  });
});
