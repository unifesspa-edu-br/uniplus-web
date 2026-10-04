import { describe, expect, it } from 'vitest';

import {
  acrescentarCampo,
  acrescentarItem,
  alternativaSemOProprioCampo,
  comImpedimento,
  impedimentoCabe,
  problemaDaRestricao,
  quantidadeNoTeto,
  restricoesParaAcrescentar,
  acrescentarTermo,
  pressupostosParaAcrescentar,
  removerPressuposto,
  acrescentarSecao,
  distribuirRecusas,
  fatosCitaveisPeloItem,
  fatosParaAcrescentar,
  fatosQueExigemResposta,
  moverEtapa,
  moverItem,
  removerItem,
  renderizacaoDe,
  semDadosBasicos,
  type ConteudoDoFormulario,
  type EtapaDoFormulario,
  type FatoDoFormulario,
  type ItemDoFormulario,
} from './formulario-editavel';

function secao(codigo: string, ordem: number, exibicao: EtapaDoFormulario['exibicao'] = null): EtapaDoFormulario {
  return { codigo, ordem, tipo: 'SECAO', bloco: null, titulo: codigo, descricao: null, aviso: null, exibicao };
}

const REVISAO: EtapaDoFormulario = {
  codigo: 'REVISAO_E_ACEITE',
  ordem: 9,
  tipo: 'BLOCO',
  bloco: 'REVISAO_E_ACEITE',
  titulo: 'Revisão e aceite',
  descricao: null,
  aviso: null,
};

function item(fatoCodigo: string, ordem: number, etapaCodigo: string, extra: Partial<ItemDoFormulario> = {}): ItemDoFormulario {
  return {
    fatoCodigo,
    ordem,
    rotulo: fatoCodigo,
    tipoRenderizacao: 'BOOLEANO',
    obrigatoriedade: 'SEMPRE',
    precondicao: null,
    etapaCodigo,
    pedirConfirmacao: false,
    ...extra,
  };
}

const exibidoQuando = (fato: string, operador = 'IGUAL'): ItemDoFormulario['precondicao'] => [[{ fato, operador, valor: true }]];

function conteudo(parcial: Partial<ConteudoDoFormulario>): ConteudoDoFormulario {
  return { titulo: null, etapas: [], itens: [], termos: [], pressupostos: [], grupos: [], ...parcial };
}

function fato(codigo: string, extra: Partial<FatoDoFormulario> = {}): FatoDoFormulario {
  return {
    codigo,
    nome: codigo,
    dominio: 'BOOLEANO',
    binding: `CAMPO_FORMULARIO:${codigo}`,
    cardinalidade: 'ESCALAR',
    fonteValores: null,
    escopo: 'CANDIDATO',
    ativo: true,
    ...extra,
  };
}

const NOMES = new Map<string, string>([['A', 'Campo A']]);

describe('renderizacaoDe', () => {
  it.each([
    ['BOOLEANO', 'ESCALAR', null, 'BOOLEANO'],
    ['NUMERICO', 'ESCALAR', null, 'NUMERO'],
    ['TEXTO', 'ESCALAR', null, 'TEXTO'],
    ['DATA', 'ESCALAR', null, 'DATA'],
    ['ENDERECO', 'ESCALAR', null, 'ENDERECO'],
    ['CATEGORICO', 'ESCALAR', 'GLOBAL', 'SELECAO_UNICA'],
    ['CATEGORICO', 'MULTIVALORADO', 'GLOBAL', 'SELECAO_MULTIPLA'],
    ['CATEGORICO', 'ESCALAR', 'GEO_MUNICIPIO', 'MUNICIPIO'],
    ['TEXTO', 'MULTIVALORADO', null, null],
  ])('%s %s (%s) → %s, como a API confere', (dominio, cardinalidade, fonteValores, esperado) => {
    expect(renderizacaoDe({ dominio, cardinalidade, fonteValores })).toBe(esperado);
  });
});

describe('fatosParaAcrescentar', () => {
  it('oferece só o coletável ativo do candidato que o formulário ainda não tem', () => {
    const catalogo = [
      fato('JA_NO_FORMULARIO'),
      fato('NOVO'),
      fato('DESATIVADO', { ativo: false }),
      fato('DE_MEMBRO', { escopo: 'MEMBRO_GRUPO' }),
      fato('DERIVADO', { binding: 'REGRA_DERIVACAO:DERIVADO' }),
      fato('MUNICIPIO', { dominio: 'CATEGORICO', fonteValores: 'GEO_MUNICIPIO' }),
      fato('NOMES', { dominio: 'TEXTO', cardinalidade: 'MULTIVALORADO' }),
    ];
    const atual = conteudo({ etapas: [secao('S1', 0)], itens: [item('JA_NO_FORMULARIO', 0, 'S1')] });

    expect(fatosParaAcrescentar(atual, catalogo).map((f) => f.codigo)).toEqual(['MUNICIPIO', 'NOVO']);
  });
});

describe('numeração', () => {
  it('acrescenta no fim da seção e numera itens e grupos numa ordem única que segue a das seções', () => {
    const atual = conteudo({
      etapas: [secao('S1', 0), secao('S2', 1), REVISAO],
      itens: [item('A', 0, 'S1'), item('C', 2, 'S2')],
      grupos: [
        {
          codigo: 'FAMILIA',
          ordem: 1,
          rotulo: 'Família',
          etapaCodigo: 'S1',
          minimo: 0,
          maximo: null,
          exibicao: null,
          obrigatoriedade: 'SEMPRE',
          predicadoObrigatoriedade: null,
          subitens: [],
          incluiCandidato: true,
        },
      ],
    });

    const novo = acrescentarItem(atual, fato('B'), 'S1');

    expect(novo.itens?.map((i) => [i.fatoCodigo, i.ordem])).toEqual([
      ['A', 0],
      ['C', 3],
      ['B', 2],
    ]);
    expect(novo.grupos?.[0].ordem).toBe(1);
  });

  it('a seção nova entra antes da revisão e aceite, que continua a última', () => {
    const novo = acrescentarSecao(conteudo({ etapas: [secao('SECAO_1', 0), REVISAO] }), 'Nova');

    expect(novo.etapas?.map((e) => [e.codigo, e.ordem])).toEqual([
      ['SECAO_1', 0],
      ['SECAO_2', 1],
      ['REVISAO_E_ACEITE', 2],
    ]);
  });
});

describe('moverItem', () => {
  const base = conteudo({
    etapas: [secao('S1', 0), REVISAO],
    itens: [item('A', 0, 'S1'), item('B', 1, 'S1', { precondicao: exibidoQuando('A') }), item('C', 2, 'S1')],
  });

  it('troca de lugar com o vizinho quando nenhuma citação se inverte', () => {
    const resultado = moverItem(base, 'C', -1, NOMES);

    expect(resultado.ok && resultado.conteudo.itens?.map((i) => [i.fatoCodigo, i.ordem])).toEqual([
      ['A', 0],
      ['B', 2],
      ['C', 1],
    ]);
  });

  it.each([
    ['o item que cita para antes do citado', 'B', -1 as const],
    ['o citado para depois do item que o cita', 'A', 1 as const],
  ])('recusa mover %s, explicando quem cita quem', (_caso, fatoCodigo, direcao) => {
    const resultado = moverItem(base, fatoCodigo, direcao, NOMES);

    expect(resultado).toEqual({ ok: false, recusa: '“B” cita “Campo A”, que ficaria depois. Mova primeiro o campo citado.' });
  });

  it('recusa descer o campo para depois do grupo cujo campo o cita', () => {
    const comGrupo = conteudo({
      etapas: [secao('S1', 0)],
      itens: [item('A', 0, 'S1')],
      grupos: [
        {
          codigo: 'FAMILIA',
          ordem: 1,
          rotulo: 'Família',
          etapaCodigo: 'S1',
          minimo: 0,
          maximo: null,
          exibicao: null,
          obrigatoriedade: 'SEMPRE',
          predicadoObrigatoriedade: null,
          subitens: [item('PARENTESCO', 0, 'S1', { precondicao: exibidoQuando('A') })],
          incluiCandidato: false,
        },
      ],
    });

    expect(moverItem(comGrupo, 'A', 1, NOMES)).toEqual({
      ok: false,
      recusa: 'O grupo “Família” cita “Campo A”, que ficaria depois. Mova primeiro o campo citado.',
    });
  });

  it('o pressuposto é conhecido antes de todo item e não trava o movimento', () => {
    const comPressuposto = conteudo({ ...base, pressupostos: ['A'], itens: [item('B', 0, 'S1', { precondicao: exibidoQuando('A') }), item('C', 1, 'S1')] });

    expect(moverItem(comPressuposto, 'B', 1, NOMES).ok).toBe(true);
  });
});

describe('moverEtapa', () => {
  it('recusa pôr antes a seção cujo item cita fato da seção que fica depois', () => {
    const atual = conteudo({
      etapas: [secao('S1', 0), secao('S2', 1), REVISAO],
      itens: [item('A', 0, 'S1'), item('B', 1, 'S2', { predicadoObrigatoriedade: exibidoQuando('A') })],
    });

    expect(moverEtapa(atual, 'S2', -1, NOMES).ok).toBe(false);
  });

  it('recusa quando a exibição da seção passaria a citar fato posterior', () => {
    const atual = conteudo({
      etapas: [secao('S1', 0), secao('S2', 1, exibidoQuando('A')), REVISAO],
      itens: [item('A', 0, 'S1'), item('B', 1, 'S2')],
    });

    expect(moverEtapa(atual, 'S2', -1, NOMES).ok).toBe(false);
  });

  it('leva os itens junto e os renumera na ordem nova das seções', () => {
    const atual = conteudo({
      etapas: [secao('S1', 0), secao('S2', 1), REVISAO],
      itens: [item('A', 0, 'S1'), item('B', 1, 'S2')],
    });

    const resultado = moverEtapa(atual, 'S2', -1, NOMES);

    expect(resultado.ok && resultado.conteudo.itens?.map((i) => [i.fatoCodigo, i.ordem])).toEqual([
      ['A', 1],
      ['B', 0],
    ]);
  });
});

describe('removerItem', () => {
  it('recusa remover o campo que outra regra cita, inclusive o impedimento de outro campo', () => {
    const atual = conteudo({
      etapas: [secao('S1', 0)],
      itens: [
        item('A', 0, 'S1'),
        item('B', 1, 'S1', { impedimento: { quando: exibidoQuando('A'), mensagem: 'Não pode.' } }),
      ],
    });

    expect(removerItem(atual, 'A', NOMES)).toEqual({ ok: false, recusa: 'Não é possível remover “Campo A”: o campo “B” cita esse campo.' });
    expect(removerItem(atual, 'B', NOMES).ok).toBe(true);
  });
});

describe('regras espelhadas', () => {
  it('as condições do item citam só os campos anteriores e os pressupostos, nunca o próprio', () => {
    const atual = conteudo({
      etapas: [secao('S1', 0)],
      pressupostos: ['P'],
      itens: [item('A', 0, 'S1'), item('B', 1, 'S1'), item('C', 2, 'S1')],
    });

    expect([...fatosCitaveisPeloItem(atual, 'B')].sort()).toEqual(['A', 'P']);
  });

  it('o campo citado por negação ou com impedimento precisa de resposta; o citado por igualdade não', () => {
    const atual = conteudo({
      itens: [
        item('X', 0, 'S1', { precondicao: [[{ fato: 'NEGADO', operador: 'NAO_EM', valor: ['A'] }, { fato: 'IGUAL', operador: 'IGUAL', valor: true }]] }),
        item('IMPEDIDO', 1, 'S1', { impedimento: { quando: null, mensagem: null } }),
      ],
    });

    expect([...fatosQueExigemResposta(atual)].sort()).toEqual(['IMPEDIDO', 'NEGADO']);
  });

  it('o envio deixa de fora a seção dos dados básicos, que a API repõe', () => {
    const atual = conteudo({
      etapas: [secao('DADOS_BASICOS', 0), secao('S1', 1)],
      itens: [item('NOME', 0, 'DADOS_BASICOS'), item('A', 1, 'S1')],
    });

    const enviado = semDadosBasicos(atual);

    expect(enviado.etapas?.map((e) => e.codigo)).toEqual(['S1']);
    expect(enviado.itens?.map((i) => i.fatoCodigo)).toEqual(['A']);
  });
});

describe('distribuirRecusas', () => {
  it('leva a recusa ao item e à etapa pelo índice enviado, e a sem índice ao resumo', () => {
    const enviado = conteudo({ etapas: [secao('S1', 0)], itens: [item('A', 0, 'S1'), item('B', 1, 'S1')] });

    const recusas = distribuirRecusas(
      [
        { field: 'conteudo.itens[1].rotulo', message: 'Rótulo longo.' },
        { field: 'Conteudo.Etapas[0].titulo', message: 'Título vazio.' },
        { field: 'conteudo', message: 'O item B cita fato posterior.' },
      ],
      enviado,
    );

    expect(recusas.porItem.get('B')).toEqual(['Rótulo longo.']);
    expect(recusas.porEtapa.get('S1')).toEqual(['Título vazio.']);
    expect(recusas.gerais).toEqual(['O item B cita fato posterior.']);
  });
});

describe('termos e pressupostos', () => {
  const lgpd = { termoId: 'T1', nome: 'Consentimento à LGPD', versoes: [{ versaoId: 'V2', rotulo: 'nova' }, { versaoId: 'V1', rotulo: 'antiga' }] };

  it('exige o termo na versão mais nova, com código do nome sem acento e sem repetir o de outro termo', () => {
    const comUm = acrescentarTermo(conteudo({}), lgpd);
    const comDois = acrescentarTermo(comUm, { ...lgpd, termoId: 'T2' });

    expect(comDois.termos?.map((t) => [t.codigo, t.versaoId, t.ordem])).toEqual([
      ['CONSENTIMENTO_A_LGPD', 'V2', 0],
      ['CONSENTIMENTO_A_LGPD_2', 'V2', 1],
    ]);
  });

  it('o fato pressuposto não é oferecido como campo: vem do formulário anterior ou é coletado aqui, nunca os dois', () => {
    const atual = conteudo({ etapas: [secao('S1', 0)], pressupostos: ['P'] });

    expect(fatosParaAcrescentar(atual, [fato('P'), fato('Q')]).map((f) => f.codigo)).toEqual(['Q']);
  });

  it('o termo novo vem depois da maior ordem gravada, mesmo com buraco na numeração', () => {
    const gravado = conteudo({
      termos: [{ codigo: 'A', ordem: 2, termoId: 'TA', versaoId: 'VA', exibicao: null, obrigatoriedade: 'SEMPRE', predicadoObrigatoriedade: null }],
    });

    expect(acrescentarTermo(gravado, lgpd).termos?.at(-1)?.ordem).toBe(3);
  });

  it('a inscrição não tem pressuposto, e o fato já coletado pelo formulário não é oferecido', () => {
    const atual = conteudo({ etapas: [secao('S1', 0)], itens: [item('A', 0, 'S1')] });
    const catalogo = [fato('A'), fato('B')];

    expect(pressupostosParaAcrescentar(atual, catalogo, 'INSCRICAO')).toEqual([]);
    expect(pressupostosParaAcrescentar(atual, catalogo, 'HABILITACAO').map((f) => f.codigo)).toEqual(['B']);
  });

  it('recusa retirar o pressuposto que uma regra cita', () => {
    const atual = conteudo({ etapas: [secao('S1', 0)], pressupostos: ['P'], itens: [item('A', 0, 'S1', { precondicao: exibidoQuando('P') })] });

    expect(removerPressuposto(atual, 'P', new Map([['P', 'Forma de conclusão']]))).toEqual({
      ok: false,
      recusa: 'Não é possível retirar “Forma de conclusão”: o campo “A” cita esse fato.',
    });
  });
});

describe('restrições, município e impedimento', () => {
  it.each([
    [{ tipo: 'FAIXA_NUMERICA', minimo: null, maximo: null }, 'Informe ao menos um limite.'],
    [{ tipo: 'FAIXA_NUMERICA', minimo: 10, maximo: 5 }, 'O mínimo é maior que o máximo.'],
    [{ tipo: 'FAIXA_NUMERICA', minimo: 0.12345, maximo: null }, 'Use no máximo 4 casas decimais.'],
    [{ tipo: 'FAIXA_NUMERICA', minimo: 0.0000001, maximo: null }, 'Use no máximo 4 casas decimais.'],
    [{ tipo: 'TAMANHO_TEXTO', minimo: 1.5, maximo: null }, 'Os limites são números inteiros, a partir de zero.'],
    [{ tipo: 'TAMANHO_TEXTO', minimo: -1, maximo: null }, 'Os limites são números inteiros, a partir de zero.'],
    [{ tipo: 'OPCOES_PERMITIDAS', entradas: [{ quando: null, valores: [] }] }, 'Escolha ao menos um valor permitido.'],
  ])('a restrição %o é recusada antes de ir à API', (restricao, problema) => {
    expect(problemaDaRestricao(restricao)).toBe(problema);
  });

  it('a faixa com um limite só e o tamanho coerente passam', () => {
    expect(problemaDaRestricao({ tipo: 'FAIXA_NUMERICA', minimo: null, maximo: 99.5 })).toBeNull();
    expect(problemaDaRestricao({ tipo: 'TAMANHO_TEXTO', minimo: 0, maximo: 200 })).toBeNull();
  });

  it('oferece só a restrição que cabe no tipo do campo, uma por tipo', () => {
    const numero = item('IDADE', 0, 'S1', { tipoRenderizacao: 'NUMERO' });
    const selecao = item('COR', 0, 'S1', { tipoRenderizacao: 'SELECAO_UNICA' });

    expect(restricoesParaAcrescentar(numero, false).map((r) => r.valor)).toEqual(['FAIXA_NUMERICA']);
    expect(restricoesParaAcrescentar({ ...numero, restricoes: [{ tipo: 'FAIXA_NUMERICA', minimo: 0 }] }, false)).toEqual([]);
    expect(restricoesParaAcrescentar(selecao, false), 'sem valores conhecidos não há o que marcar').toEqual([]);
    expect(restricoesParaAcrescentar(selecao, true).map((r) => r.valor)).toEqual(['OPCOES_PERMITIDAS']);
  });

  const uf = fato('UF', { dominio: 'CATEGORICO', fonteValores: 'GEO_UF' });
  const municipio = fato('MUNICIPIO', { dominio: 'CATEGORICO', fonteValores: 'GEO_MUNICIPIO' });

  it('o município nasce restrito à UF respondida antes', () => {
    const comUf = conteudo({ etapas: [secao('S1', 0)], itens: [item('UF', 0, 'S1', { tipoRenderizacao: 'SELECAO_UNICA' })] });

    const resultado = acrescentarCampo(comUf, municipio, 'S1', [uf, municipio]);

    expect(resultado.ok && resultado.conteudo.itens?.find((i) => i.fatoCodigo === 'MUNICIPIO')?.restricoes).toEqual([
      { tipo: 'MUNICIPIOS_DA_UF', fatos: ['UF'] },
    ]);
  });

  it('sem campo de UF antes, o município é recusado com a orientação', () => {
    const resultado = acrescentarCampo(conteudo({ etapas: [secao('S1', 0)] }), municipio, 'S1', [uf, municipio]);

    expect(resultado).toEqual({
      ok: false,
      recusa: 'Acrescente antes o campo de UF: “MUNICIPIO” escolhe entre os municípios da UF respondida antes.',
    });
  });

  it('o impedimento só cabe na inscrição, em tipo admitido e com o próprio campo citável', () => {
    expect(impedimentoCabe('INSCRICAO', 'BOOLEANO', true)).toBe(true);
    expect(impedimentoCabe('HABILITACAO', 'BOOLEANO', true)).toBe(false);
    expect(impedimentoCabe('INSCRICAO', 'TEXTO', true)).toBe(false);
    expect(impedimentoCabe('INSCRICAO', 'MUNICIPIO', true)).toBe(false);
    expect(impedimentoCabe('INSCRICAO', 'SELECAO_UNICA', false)).toBe(false);
  });

  it('ligar o impedimento deixa o campo obrigatório sempre na mesma edição', () => {
    const opcional = item('VINCULO', 0, 'S1', { obrigatoriedade: 'QUANDO', predicadoObrigatoriedade: exibidoQuando('X') });

    const ligado = comImpedimento(opcional, exibidoQuando('VINCULO'));

    expect([ligado.obrigatoriedade, ligado.predicadoObrigatoriedade]).toEqual(['SEMPRE', null]);
  });

  it('acusa a alternativa do impedimento que não cita o próprio campo', () => {
    expect(alternativaSemOProprioCampo([[{ fato: 'V', operador: 'IGUAL', valor: true }]], 'V')).toBe(false);
    expect(alternativaSemOProprioCampo([[{ fato: 'V', operador: 'IGUAL', valor: true }], [{ fato: 'X', operador: 'IGUAL', valor: true }]], 'V')).toBe(true);
    expect(alternativaSemOProprioCampo(null, 'V')).toBe(true);
  });

  it('o teto conta itens, grupos e campos de grupo, como a API', () => {
    const atual = conteudo({
      itens: [item('A', 0, 'S1')],
      grupos: [
        {
          codigo: 'G', ordem: 1, rotulo: 'G', etapaCodigo: 'S1', minimo: 0, maximo: null, exibicao: null,
          obrigatoriedade: 'SEMPRE', predicadoObrigatoriedade: null, subitens: [item('M1', 0, 'S1'), item('M2', 1, 'S1')], incluiCandidato: false,
        },
      ],
    });

    expect(quantidadeNoTeto(atual)).toBe(4);
  });
});
