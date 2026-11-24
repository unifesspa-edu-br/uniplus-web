import { OperadorCodigo } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import {
  comExigidoDeTodos,
  comModalidades,
  comModalidadesEscolhidas,
} from './exigencias/modalidades-da-exigencia';
import {
  clausulasDoGatilho,
  comClausula,
  comCondicao,
  comCondicaoTrocada,
  comValorEscalar,
  nomesDoCatalogo,
  problemasDoGatilho,
  semClausula,
  semCondicao,
} from './gatilho-de-exigencia';
import {
  CATALOGO,
  COR_RACA,
  FAIXA_ETARIA,
  NACIONALIDADE,
  SEXO,
  catalogo,
  escolhivel,
  exigencia,
} from './gatilho-de-exigencia.testing';

describe('as alternativas do gatilho', () => {
  /**
   * Exemplo: o título de eleitor não se cobra de estrangeiro, de mulher
   * nem de menor de dezoito. São três condições que valem JUNTAS — uma cláusula só.
   */
  it('o título de eleitor se escreve como três condições de uma mesma alternativa', () => {
    const sexo = escolhivel(SEXO);
    const nacionalidade = escolhivel(NACIONALIDADE);
    const idade = escolhivel(FAIXA_ETARIA);

    let titulo = comCondicao(exigencia(), 1, nacionalidade);
    titulo = comCondicaoTrocada(
      titulo,
      0,
      comValorEscalar(
        { ...titulo.condicoes[0], operador: 'DIFERENTE' },
        nacionalidade,
        'ESTRANGEIRA',
      ),
    );
    titulo = comCondicao(titulo, 1, sexo);
    titulo = comCondicaoTrocada(
      titulo,
      1,
      comValorEscalar({ ...titulo.condicoes[1], operador: 'DIFERENTE' }, sexo, 'FEMININO'),
    );
    titulo = comCondicao(titulo, 1, idade);
    titulo = comCondicaoTrocada(
      titulo,
      2,
      comValorEscalar({ ...titulo.condicoes[2], operador: 'MAIOR_IGUAL' }, idade, '18'),
    );

    expect(titulo.condicoes).toEqual([
      { clausula: 1, fato: 'NACIONALIDADE', operador: 'DIFERENTE', valor: '"ESTRANGEIRA"' },
      { clausula: 1, fato: 'SEXO', operador: 'DIFERENTE', valor: '"FEMININO"' },
      { clausula: 1, fato: 'FAIXA_ETARIA', operador: 'MAIOR_IGUAL', valor: '18' },
    ]);
    expect(clausulasDoGatilho(titulo)).toHaveLength(1);
    expect(problemasDoGatilho(titulo, catalogo())).toEqual([]);
  });

  /**
   * A quitação militar não se cobra de indígena — e indígena é um valor de COR_RACA, não uma
   * exceção ao sexo. A alternativa serve quando os caminhos são mesmo independentes.
   */
  it('a alternativa é um segundo caminho pelo qual o documento passa a ser cobrado', () => {
    const comDuas = comClausula(
      comCondicao(exigencia(), 1, escolhivel(SEXO)),
      escolhivel(COR_RACA),
    );

    const clausulas = clausulasDoGatilho(comDuas);
    expect(clausulas.map((c) => c.numero)).toEqual([1, 2]);
    expect(clausulas[1].condicoes[0].condicao.fato).toBe('COR_RACA');
  });

  /**
   * O alcance por modalidade vale para o gatilho INTEIRO. Escrevê-lo só na primeira alternativa
   * diria "(modalidade E o resto) OU (a outra alternativa, para qualquer modalidade)" — o
   * oposto do que quem restringiu quis.
   */
  it('o alcance por modalidade acompanha cada alternativa', () => {
    const comDuas = comClausula(
      comCondicao(exigencia(), 1, escolhivel(SEXO)),
      escolhivel(COR_RACA),
    );
    const restritaPorModalidade = comModalidades(comDuas, ['LB_PPI']);

    const daModalidade = restritaPorModalidade.condicoes.filter((c) => c.fato === 'MODALIDADE');
    expect(daModalidade.map((c) => c.clausula)).toEqual([1, 2]);
  });

  /** Uma alternativa nova nasce já sob o alcance por modalidade que estava valendo, não fora dele. */
  it('alternativa acrescentada depois do alcance por modalidade também o carrega', () => {
    const restritaPorModalidade = comModalidades(comCondicao(exigencia(), 1, escolhivel(SEXO)), [
      'LB_PPI',
    ]);
    const comDuas = comClausula(restritaPorModalidade, escolhivel(COR_RACA));

    const naSegunda = comDuas.condicoes.filter((c) => c.clausula === 2);
    expect(naSegunda.map((c) => c.fato)).toContain('MODALIDADE');
  });

  /** O controle de "quem deve entregar" é quem edita a modalidade; ela não se repete aqui. */
  it('a condição de modalidade não aparece entre as alternativas editáveis', () => {
    const restritaPorModalidade = comModalidades(comCondicao(exigencia(), 1, escolhivel(SEXO)), [
      'LB_PPI',
    ]);
    const fatos = clausulasDoGatilho(restritaPorModalidade).flatMap((c) =>
      c.condicoes.map((p) => p.condicao.fato),
    );
    expect(fatos).toEqual(['SEXO']);
  });

  it('remover a última condição de uma alternativa remove a alternativa junto', () => {
    const comDuas = comClausula(
      comCondicao(exigencia(), 1, escolhivel(SEXO)),
      escolhivel(COR_RACA),
    );
    const semASegunda = semCondicao(comDuas, 1);

    expect(clausulasDoGatilho(semASegunda).map((c) => c.numero)).toEqual([1]);
  });

  /** Buraco na numeração faria a tela mostrar "alternativa 3" onde só há duas. */
  it('remover a alternativa do meio renumera as que ficam', () => {
    let documento = comCondicao(exigencia(), 1, escolhivel(SEXO));
    documento = comClausula(documento, escolhivel(COR_RACA));
    documento = comClausula(documento, escolhivel(NACIONALIDADE));

    const semAMeio = semClausula(documento, 2);
    expect(clausulasDoGatilho(semAMeio).map((c) => c.numero)).toEqual([1, 2]);
  });
});

describe('o que a tela recusa antes de gravar', () => {
  it('condição sem valor é acusada nomeando o fato', () => {
    const semValor = comCondicao(exigencia(), 1, escolhivel(SEXO));
    expect(problemasDoGatilho(semValor, catalogo())).toEqual(['"Sexo" está sem valor']);
  });

  it('fato que saiu do catálogo é acusado pelo código', () => {
    const orfa = exigencia({
      condicoes: [{ clausula: 1, fato: 'RELIGIAO', operador: 'IGUAL', valor: '"X"' }],
    });
    expect(problemasDoGatilho(orfa, catalogo())).toEqual([
      'o fato "RELIGIAO" não está no catálogo',
    ]);
  });

  it('comparação que o domínio não admite é acusada', () => {
    const incompativel = exigencia({
      condicoes: [{ clausula: 1, fato: 'PCD', operador: 'MAIOR_IGUAL', valor: 'true' }],
    });
    expect(problemasDoGatilho(incompativel, catalogo())).toEqual([
      '"Pessoa com deficiência" não admite a comparação escolhida',
    ]);
  });

  it('valor fora do domínio declarado é acusado antes do servidor', () => {
    const fora = exigencia({
      condicoes: [{ clausula: 1, fato: 'SEXO', operador: 'IGUAL', valor: '"OUTRO"' }],
    });
    expect(problemasDoGatilho(fora, catalogo())).toEqual([
      '"Sexo" cita OUTRO, fora do domínio declarado',
    ]);
  });

  /**
   * Fato que está no catálogo mas cujo domínio vem da oferta do processo, e o processo parou de
   * ofertar valor algum: dizer que ele "não está no catálogo" mandaria procurar no lugar
   * errado — o cadastro institucional —, quando o que falta é a oferta deste certame.
   */
  it('fato sem valor ofertado é acusado pela oferta, não pelo catálogo', () => {
    const semOferta = exigencia({
      condicoes: [
        { clausula: 1, fato: 'CONDICAO_ATENDIMENTO', operador: 'EM', valor: '["LIBRAS"]' },
      ],
    });

    expect(problemasDoGatilho(semOferta, catalogo(), nomesDoCatalogo(CATALOGO))).toEqual([
      '"Condição de atendimento especializado" não tem valor nenhum ofertado por este processo',
    ]);
  });

  /** O alcance por modalidade é conferido pelo seu próprio controle, não por este. */
  it('a condição de modalidade não é conferida aqui', () => {
    const restritaPorModalidade = comModalidades(exigencia(), ['LB_PPI']);
    expect(problemasDoGatilho(restritaPorModalidade, catalogo())).toEqual([]);
  });
});

describe('o alcance por modalidade e o alcance declarado', () => {
  /**
   * Remarcar todas as modalidades tira a cláusula e devolve a aplicabilidade a "todos": deixá-la
   * em "de quem satisfaz", sem condição nenhuma, seria "cobrada de ninguém" e o documento
   * sumiria do edital para todo mundo.
   */
  it('marcar todas as modalidades devolve o documento a todo candidato', () => {
    const restrita = comModalidades(exigencia(), ['LB_PPI']);

    const todas = comModalidadesEscolhidas(restrita, ['AC', 'LB_PPI'], ['AC', 'LB_PPI']);

    expect(todas.aplicabilidade).toBe('GERAL');
    expect(todas.condicoes).toEqual([]);
  });

  /** Restando outra condição, a exigência continua sendo de quem a satisfaz. */
  it('marcar todas as modalidades não alarga a exigência que tem outra condição', () => {
    const porSexo = comCondicao(exigencia(), 1, escolhivel(SEXO));
    const restrita = comModalidades(porSexo, ['LB_PPI']);

    const todas = comModalidadesEscolhidas(restrita, ['AC', 'LB_PPI'], ['AC', 'LB_PPI']);

    expect(todas.aplicabilidade).toBe('CONDICIONAL');
    expect(todas.condicoes.map((c) => c.fato)).toEqual(['SEXO']);
  });

  /** Alcance parcial é restrição: a cláusula é escrita e a exigência passa a ser condicional. */
  it('marcar parte das modalidades escreve a restrição por modalidade', () => {
    const restritaPorModalidade = comModalidadesEscolhidas(
      exigencia({ aplicabilidade: 'GERAL' }),
      ['LB_PPI'],
      ['AC', 'LB_PPI'],
    );

    expect(restritaPorModalidade.aplicabilidade).toBe('CONDICIONAL');
    expect(restritaPorModalidade.condicoes).toEqual([
      { clausula: 1, fato: 'MODALIDADE', operador: OperadorCodigo.ALGUM_DE, valor: '["LB_PPI"]' },
    ]);
  });

  /**
   * Declarar que o documento é de todo candidato descarta o gatilho inteiro — o agregado
   * recusa a exigência geral que carrega condição. É por isso que a tela avisa antes.
   */
  it('exigir de todos descarta o alcance por modalidade e as condições', () => {
    const comAmbos = comModalidades(comCondicao(exigencia(), 1, escolhivel(SEXO)), ['LB_PPI']);

    const deTodos = comExigidoDeTodos(comAmbos, true);

    expect(deTodos.aplicabilidade).toBe('GERAL');
    expect(deTodos.condicoes).toEqual([]);
  });
});
