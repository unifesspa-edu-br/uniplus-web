import { describe, expect, it } from 'vitest';

import {
  acrescentarItem,
  acrescentarSecao,
  distribuirRecusas,
  fatosCitadosPelasRegras,
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
  it('oferece só o coletável ativo do candidato que o formulário ainda não tem, sem o município', () => {
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

    expect(fatosParaAcrescentar(atual, catalogo).map((f) => f.codigo)).toEqual(['NOVO']);
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

  it('os fatos citados pelas regras incluem os do impedimento e os da exibição da seção, sem repetir', () => {
    const atual = conteudo({
      etapas: [secao('S1', 0, exibidoQuando('P'))],
      itens: [
        item('A', 0, 'S1', { impedimento: { quando: exibidoQuando('A'), mensagem: null } }),
        item('B', 1, 'S1', { precondicao: exibidoQuando('A') }),
      ],
    });

    expect(fatosCitadosPelasRegras(atual)).toEqual(['A', 'P']);
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
