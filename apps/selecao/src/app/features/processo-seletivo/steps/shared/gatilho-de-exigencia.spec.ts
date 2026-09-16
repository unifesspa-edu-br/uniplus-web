import { describe, expect, it } from 'vitest';

import type { FatoCandidatoView } from '@uniplus/shared-data/configuracao';

import type { ExigenciaDeDocumento } from '../processo-seletivo.models';
import { comExigidoDeTodos, comModalidades, comRecorteEscolhido } from './exigencias-documentais';
import {
  alcanceDaCondicao,
  clausulasDoGatilho,
  comClausula,
  comCondicao,
  comCondicaoTrocada,
  comOperador,
  comValorEscalar,
  comValoresDeLista,
  condicaoNova,
  fatoEscolhivel,
  fatosParaGatilho,
  nomesDoCatalogo,
  operadoresDoFato,
  problemasDoGatilho,
  semClausula,
  semCondicao,
  valorEscalarDe,
  valoresDeListaDe,
  type FatoEscolhivel,
} from './gatilho-de-exigencia';

/** Um fato do catálogo, na forma em que a API o entrega. */
function view(parcial: Partial<FatoCandidatoView> & Pick<FatoCandidatoView, 'codigo'>): FatoCandidatoView {
  return {
    id: `00000000-0000-0000-0000-${parcial.codigo.length.toString().padStart(12, '0')}`,
    nome: parcial.codigo,
    descricao: null,
    dominio: 'CATEGORICO',
    origem: 'DECLARADO',
    cardinalidade: 'ESCALAR',
    valoresDominio: null,
    pontoResolucao: 'INSCRICAO',
    binding: `CAMPO_INSCRICAO:${parcial.codigo}`,
    valoresDominioDeclarados: null,
    ...parcial,
  } as FatoCandidatoView;
}

const SEXO = view({
  codigo: 'SEXO',
  nome: 'Sexo',
  valoresDominio: ['MASCULINO', 'FEMININO', 'INTERSEXO'],
});

const NACIONALIDADE = view({
  codigo: 'NACIONALIDADE',
  nome: 'Nacionalidade',
  valoresDominio: ['BRASILEIRA', 'NATURALIZADA', 'ESTRANGEIRA'],
});

const COR_RACA = view({
  codigo: 'COR_RACA',
  nome: 'Cor ou raça',
  valoresDominio: ['BRANCA', 'PRETA', 'PARDA', 'INDIGENA', 'AMARELA'],
});

const FAIXA_ETARIA = view({
  codigo: 'FAIXA_ETARIA',
  nome: 'Faixa etária',
  dominio: 'NUMERICO',
  origem: 'DERIVADO',
  binding: 'ATRIBUTO_CANDIDATO:FAIXA_ETARIA',
});

const PCD = view({ codigo: 'PCD', nome: 'Pessoa com deficiência', dominio: 'BOOLEANO' });

const MODALIDADE = view({
  codigo: 'MODALIDADE',
  nome: 'Modalidade de concorrência',
  origem: 'DERIVADO',
  cardinalidade: 'MULTIVALORADO',
  binding: 'REGRA_DERIVACAO:MODALIDADE',
});

const CONDICAO_ATENDIMENTO = view({
  codigo: 'CONDICAO_ATENDIMENTO',
  nome: 'Condição de atendimento especializado',
  cardinalidade: 'MULTIVALORADO',
});

const CATALOGO = [SEXO, NACIONALIDADE, COR_RACA, FAIXA_ETARIA, PCD, MODALIDADE, CONDICAO_ATENDIMENTO];

function escolhivel(fato: FatoCandidatoView): FatoEscolhivel {
  const traduzido = fatoEscolhivel(fato);
  if (traduzido === null) throw new Error(`Fato sem domínio conhecido: ${fato.codigo}`);
  return traduzido;
}

function exigencia(parcial: Partial<ExigenciaDeDocumento> = {}): ExigenciaDeDocumento {
  return {
    tipoDocumentoId: 'titulo-de-eleitor',
    faseCodigo: 'INSCRICAO',
    etapaId: null,
    aplicabilidade: 'CONDICIONAL',
    obrigatorio: true,
    consequenciaIndeferimento: '',
    condicoes: [],
    basesLegais: [],
    idadeMaximaEmissao: null,
    formatosPermitidos: 'QUALQUER',
    tamanhoMaximoBytes: null,
    ...parcial,
  };
}

describe('o catálogo na forma que a tela oferece', () => {
  it('categórico com valores declarados é estático; sem eles, dinâmico', () => {
    expect(escolhivel(SEXO).tipoDominio).toBe('CATEGORICO_ESTATICO');
    expect(escolhivel(MODALIDADE).tipoDominio).toBe('CATEGORICO_DINAMICO');
  });

  it('só é coletável o fato perguntado ao candidato na inscrição', () => {
    expect(escolhivel(SEXO).coletavel).toBe(true);
    expect(escolhivel(FAIXA_ETARIA).coletavel).toBe(false);
    expect(escolhivel(MODALIDADE).coletavel).toBe(false);
  });

  /**
   * A modalidade tem controle próprio — "quem deve entregar" — alimentado pelo quadro de
   * vagas. Oferecê-la aqui deixaria duas telas escrevendo a mesma cláusula.
   */
  it('a modalidade não entra no editor de gatilho', () => {
    const codigos = fatosParaGatilho(CATALOGO).map((fato) => fato.codigo);
    expect(codigos).not.toContain('MODALIDADE');
  });

  /**
   * O domínio dinâmico vem do que o processo oferta, não de um catálogo global — é o que o
   * servidor confere. Sem saber a oferta, a tela proporia valor que a gravação recusaria.
   */
  it('fato de domínio dinâmico só é oferecido quando o processo declara o que oferta', () => {
    expect(fatosParaGatilho(CATALOGO).map((f) => f.codigo)).not.toContain('CONDICAO_ATENDIMENTO');

    const comOferta = fatosParaGatilho(
      CATALOGO,
      new Map([['CONDICAO_ATENDIMENTO', ['TEMPO_ADICIONAL', 'LEITOR']]]),
    );
    expect(comOferta.find((f) => f.codigo === 'CONDICAO_ATENDIMENTO')?.valores).toEqual([
      'TEMPO_ADICIONAL',
      'LEITOR',
    ]);
  });

  /** Espelha o validador do domínio: lista só onde há lista, ordem só onde há ordem. */
  it('cada domínio admite as comparações que o servidor aceita', () => {
    expect(operadoresDoFato(escolhivel(PCD)).map((o) => o.valor)).toEqual(['IGUAL', 'DIFERENTE']);
    expect(operadoresDoFato(escolhivel(FAIXA_ETARIA)).map((o) => o.valor)).toEqual([
      'IGUAL',
      'DIFERENTE',
      'MAIOR_IGUAL',
      'MENOR_IGUAL',
    ]);
    expect(operadoresDoFato(escolhivel(SEXO)).map((o) => o.valor)).toEqual([
      'IGUAL',
      'DIFERENTE',
      'EM',
      'NAO_EM',
    ]);
  });
});

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
   * O domínio recusa decimal — e a tela acusa, em vez de truncar. Truncar gravava um número
   * diferente do que ficava visível: quem escrevia 17.9 via 17.9 e gravava 17, porque o campo
   * não era reescrito quando o valor truncado coincidia com o anterior.
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
   * O defeito que este teste fixa: qualquer digitação que não fosse exatamente `true` virava
   * "não". Quem escrevesse "Sim" para dizer "o laudo é de quem se declarou PCD" gravava o
   * oposto — o laudo passava a ser cobrado de quem NÃO é PCD —, e o servidor aceitava, porque
   * "não" também é booleano JSON válido.
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
    const semResposta = exigencia({ condicoes: [comValorEscalar(condicaoNova(fato, 1), fato, 'Sim')] });

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

    const emLista = comOperador(diferente, fato, 'NAO_EM');
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
    const nenhum = comValoresDeLista(
      { ...condicaoNova(fato, 1), operador: 'NAO_EM' },
      ['MASCULINO', 'FEMININO', 'INTERSEXO'],
    );
    expect(alcanceDaCondicao(nenhum, fato)).toBe('Não alcança valor nenhum do domínio declarado.');
  });
});

describe('as alternativas do gatilho', () => {
  /**
   * O caso que dá nome à frente: o título de eleitor não se cobra de estrangeiro, de mulher
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
   * O recorte de modalidade vale para o gatilho INTEIRO. Escrevê-lo só na primeira alternativa
   * diria "(modalidade E o resto) OU (a outra alternativa, para qualquer modalidade)" — o
   * oposto do que quem recortou quis.
   */
  it('o recorte de modalidade acompanha cada alternativa', () => {
    const comDuas = comClausula(
      comCondicao(exigencia(), 1, escolhivel(SEXO)),
      escolhivel(COR_RACA),
    );
    const recortada = comModalidades(comDuas, ['LB_PPI']);

    const daModalidade = recortada.condicoes.filter((c) => c.fato === 'MODALIDADE');
    expect(daModalidade.map((c) => c.clausula)).toEqual([1, 2]);
  });

  /** Uma alternativa nova nasce já sob o recorte que estava valendo, não fora dele. */
  it('alternativa acrescentada depois do recorte também o carrega', () => {
    const recortada = comModalidades(comCondicao(exigencia(), 1, escolhivel(SEXO)), ['LB_PPI']);
    const comDuas = comClausula(recortada, escolhivel(COR_RACA));

    const naSegunda = comDuas.condicoes.filter((c) => c.clausula === 2);
    expect(naSegunda.map((c) => c.fato)).toContain('MODALIDADE');
  });

  /** O controle de "quem deve entregar" é quem edita a modalidade; ela não se repete aqui. */
  it('a condição de modalidade não aparece entre as alternativas editáveis', () => {
    const recortada = comModalidades(comCondicao(exigencia(), 1, escolhivel(SEXO)), ['LB_PPI']);
    const fatos = clausulasDoGatilho(recortada).flatMap((c) =>
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
      condicoes: [{ clausula: 1, fato: 'CONDICAO_ATENDIMENTO', operador: 'EM', valor: '["LIBRAS"]' }],
    });

    expect(problemasDoGatilho(semOferta, catalogo(), nomesDoCatalogo(CATALOGO))).toEqual([
      '"Condição de atendimento especializado" não tem valor nenhum ofertado por este processo',
    ]);
  });

  /** O recorte por modalidade é conferido pelo seu próprio controle, não por este. */
  it('a condição de modalidade não é conferida aqui', () => {
    const recortada = comModalidades(exigencia(), ['LB_PPI']);
    expect(problemasDoGatilho(recortada, catalogo())).toEqual([]);
  });
});

describe('o recorte por modalidade e o alcance declarado', () => {
  /**
   * O defeito que este teste fixa: remarcar todas as modalidades tirava a cláusula e deixava a
   * aplicabilidade em "de quem satisfaz". Sem condição nenhuma, isso é "cobrada de ninguém" —
   * o documento sumia do edital para todo mundo, sem nada na tela nem no preflight.
   */
  it('marcar todas as modalidades devolve o documento a todo candidato', () => {
    const restrita = comModalidades(exigencia(), ['LB_PPI']);

    const todas = comRecorteEscolhido(restrita, ['AC', 'LB_PPI'], ['AC', 'LB_PPI']);

    expect(todas.aplicabilidade).toBe('GERAL');
    expect(todas.condicoes).toEqual([]);
  });

  /** Restando outra condição, a exigência continua sendo de quem a satisfaz. */
  it('marcar todas as modalidades não alarga a exigência que tem outra condição', () => {
    const porSexo = comCondicao(exigencia(), 1, escolhivel(SEXO));
    const restrita = comModalidades(porSexo, ['LB_PPI']);

    const todas = comRecorteEscolhido(restrita, ['AC', 'LB_PPI'], ['AC', 'LB_PPI']);

    expect(todas.aplicabilidade).toBe('CONDICIONAL');
    expect(todas.condicoes.map((c) => c.fato)).toEqual(['SEXO']);
  });

  /** Recorte parcial é recorte: a cláusula é escrita e a exigência passa a ser condicional. */
  it('marcar parte das modalidades escreve o recorte', () => {
    const recortada = comRecorteEscolhido(exigencia({ aplicabilidade: 'GERAL' }), ['LB_PPI'], [
      'AC',
      'LB_PPI',
    ]);

    expect(recortada.aplicabilidade).toBe('CONDICIONAL');
    expect(recortada.condicoes).toEqual([
      { clausula: 1, fato: 'MODALIDADE', operador: 'EM', valor: '["LB_PPI"]' },
    ]);
  });

  /**
   * Declarar que o documento é de todo candidato descarta o gatilho inteiro — o agregado
   * recusa a exigência geral que carrega condição. É por isso que a tela avisa antes.
   */
  it('exigir de todos descarta o recorte e as condições', () => {
    const comAmbos = comModalidades(comCondicao(exigencia(), 1, escolhivel(SEXO)), ['LB_PPI']);

    const deTodos = comExigidoDeTodos(comAmbos, true);

    expect(deTodos.aplicabilidade).toBe('GERAL');
    expect(deTodos.condicoes).toEqual([]);
  });
});

function catalogo(): ReadonlyMap<string, FatoEscolhivel> {
  return new Map(fatosParaGatilho(CATALOGO).map((fato) => [fato.codigo, fato]));
}
