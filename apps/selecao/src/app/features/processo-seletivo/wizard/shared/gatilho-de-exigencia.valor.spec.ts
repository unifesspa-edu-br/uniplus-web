import { describe, expect, it } from 'vitest';

import {
  alcanceDaCondicao,
  comOperador,
  comValorEscalar,
  comValoresDeLista,
  condicaoNova,
  problemasDoGatilho,
  valorEscalarDe,
  valoresDeListaDe,
} from './gatilho-de-exigencia';
import {
  FAIXA_ETARIA,
  PCD,
  SEXO,
  catalogo,
  escolhivel,
  exigencia,
} from './gatilho-de-exigencia.testing';

describe('o valor da condição na forma que o wire exige', () => {
  it('categórico viaja como texto JSON; numérico, como número cru', () => {
    const doSexo = comValorEscalar(condicaoNova(escolhivel(SEXO), 1), escolhivel(SEXO), 'FEMININO');
    expect(doSexo.valor).toBe('"FEMININO"');
    expect(valorEscalarDe(doSexo)).toBe('FEMININO');

    const daIdade = comValorEscalar(
      condicaoNova(escolhivel(FAIXA_ETARIA), 1),
      escolhivel(FAIXA_ETARIA),
      '18',
    );
    expect(daIdade.valor).toBe('18');
    expect(valorEscalarDe(daIdade)).toBe('18');
  });

  /**
   * O domínio recusa decimal, e a tela acusa em vez de truncar: truncar gravaria um número
   * diferente do que fica visível (17.9 na tela, 17 gravado).
   */
  it('decimal é preservado na tela e acusado pela conferência, nunca truncado em silêncio', () => {
    const fato = escolhivel(FAIXA_ETARIA);
    const daIdade = comValorEscalar(condicaoNova(fato, 1), fato, '17.9');

    expect(daIdade.valor).toBe('17.9');
    expect(valorEscalarDe(daIdade)).toBe('17.9');
    expect(problemasDoGatilho(exigencia({ condicoes: [daIdade] }), catalogo())).toEqual([
      '"Faixa etária" aceita número inteiro',
    ]);
  });

  /** O que está sendo digitado sobrevive ao caractere que ainda não completa o número. */
  it('número em digitação não é apagado pelo caminho', () => {
    const fato = escolhivel(FAIXA_ETARIA);
    expect(valorEscalarDe(comValorEscalar(condicaoNova(fato, 1), fato, '1'))).toBe('1');
    expect(valorEscalarDe(comValorEscalar(condicaoNova(fato, 1), fato, '18'))).toBe('18');
  });

  /**
   * Fato ainda não escolhido não é fato desconhecido: dizer que o fato "" não está no catálogo
   * manda procurar no cadastro institucional o que só falta selecionar na tela.
   */
  it('condição sem fato escolhido pede a escolha, não acusa catálogo', () => {
    const semFato = exigencia({
      condicoes: [{ clausula: 1, fato: '', operador: 'IGUAL', valor: '' }],
    });

    expect(problemasDoGatilho(semFato, catalogo())).toEqual(['escolha o fato do candidato']);
  });

  /**
   * Digitação que não seja exatamente `true` ou `false` não é lido como "não" em silêncio: quem
   * escrevesse "Sim" para dizer "o laudo é de quem se declarou PCD" gravaria o oposto, e o
   * servidor aceitaria, porque "não" também é booleano JSON válido.
   */
  it('sim-ou-não só aceita os dois valores do domínio, e recusa o resto', () => {
    const fato = escolhivel(PCD);
    const nova = condicaoNova(fato, 1);

    expect(comValorEscalar(nova, fato, 'true').valor).toBe('true');
    expect(comValorEscalar(nova, fato, 'false').valor).toBe('false');
    expect(comValorEscalar(nova, fato, 'Sim').valor).toBe('');
    expect(comValorEscalar(nova, fato, '1').valor).toBe('');
  });

  /** O valor recusado fica vazio, e a conferência cobra — em vez de gravar o contrário calado. */
  it('sim-ou-não sem resposta escolhida é acusado antes de gravar', () => {
    const fato = escolhivel(PCD);
    const semResposta = exigencia({
      condicoes: [comValorEscalar(condicaoNova(fato, 1), fato, 'Sim')],
    });

    expect(problemasDoGatilho(semResposta, catalogo())).toEqual([
      '"Pessoa com deficiência" está sem valor',
    ]);
  });

  /** A dupla negação passa despercebida escrita; lida em prosa, não. */
  it('diz em prosa o que a condição de sim-ou-não alcança', () => {
    const fato = escolhivel(PCD);
    const sim = comValorEscalar(condicaoNova(fato, 1), fato, 'true');
    const naoENao = comValorEscalar(
      { ...condicaoNova(fato, 1), operador: 'DIFERENTE' },
      fato,
      'false',
    );

    expect(alcanceDaCondicao(sim, fato)).toBe('Alcança quem respondeu que sim.');
    expect(alcanceDaCondicao(naoENao, fato)).toBe('Alcança quem respondeu que sim.');
  });

  it('condição recém-declarada nasce sem valor, e não afirma nada', () => {
    const nova = condicaoNova(escolhivel(SEXO), 1);
    expect(nova.valor).toBe('');
    expect(valorEscalarDe(nova)).toBe('');
  });

  /**
   * Trocar "é" por "não é" não pode apagar o valor escolhido; trocar para "é um de" o
   * converte em lista de um item, e de volta, no primeiro item dela.
   */
  it('trocar a comparação preserva o valor quando a forma é a mesma, e o converte quando não', () => {
    const fato = escolhivel(SEXO);
    const igual = comValorEscalar(condicaoNova(fato, 1), fato, 'FEMININO');

    const diferente = comOperador(igual, fato, 'DIFERENTE');
    expect(valorEscalarDe(diferente)).toBe('FEMININO');

    const emLista = comOperador(diferente, fato, 'NENHUM_DE');
    expect(valoresDeListaDe(emLista)).toEqual(['FEMININO']);

    const comDois = comValoresDeLista(emLista, ['FEMININO', 'INTERSEXO']);
    expect(valorEscalarDe(comOperador(comDois, fato, 'IGUAL'))).toBe('FEMININO');
  });

  it('lista esvaziada volta ao estado sem valor, em vez de viajar como lista vazia', () => {
    const fato = escolhivel(SEXO);
    const comValores = comValoresDeLista(condicaoNova(fato, 1), ['FEMININO']);
    expect(comValoresDeLista(comValores, []).valor).toBe('');
  });
});

describe('o que a condição alcança', () => {
  /**
   * A diferença que motiva mostrar isto na tela: "não é feminino" alcança também quem
   * declarou intersexo, "é masculino" não. As duas formas parecem a mesma coisa escritas, e
   * não são.
   */
  it('negar um valor não é o mesmo que afirmar o outro', () => {
    const fato = escolhivel(SEXO);
    const naoFeminino = comValorEscalar(
      { ...condicaoNova(fato, 1), operador: 'DIFERENTE' },
      fato,
      'FEMININO',
    );
    const masculino = comValorEscalar(condicaoNova(fato, 1), fato, 'MASCULINO');

    expect(alcanceDaCondicao(naoFeminino, fato)).toBe('Alcança MASCULINO, INTERSEXO.');
    expect(alcanceDaCondicao(masculino, fato)).toBe('Alcança MASCULINO.');
  });

  it('condição que não alcança valor nenhum do domínio é dita como tal', () => {
    const fato = escolhivel(SEXO);
    const nenhum = comValoresDeLista({ ...condicaoNova(fato, 1), operador: 'NENHUM_DE' }, [
      'MASCULINO',
      'FEMININO',
      'INTERSEXO',
    ]);
    expect(alcanceDaCondicao(nenhum, fato)).toBe('Não alcança valor nenhum do domínio declarado.');
  });
});
