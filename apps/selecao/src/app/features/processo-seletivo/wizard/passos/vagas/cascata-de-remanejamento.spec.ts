import { RegraRemanejamentoModalidadeCodigo } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import type { MatrizDaOrdemDeRemanejamento } from '../../documento/edicoes/ordem-de-remanejamento.edicao';
import { CascataSelecionada, DistribuicaoDeVagas } from '../../processo-seletivo.models';
import {
  comandoDaCascata,
  comandoDeRemocaoDaCascata,
  matrizDaRegra,
  ofertaExigeCascata,
  ofertaForaDoRegimeFederal,
  ofertasComCascataForaDoRegimeFederal,
  precisaExibirSecaoDaCascata,
  problemasDaCascata,
} from './cascata-de-remanejamento';
import { ModalidadeDoCatalogo } from './modalidades-da-distribuicao';

const LB_PPI = 'mod-lb-ppi';
const LB_Q = 'mod-lb-q';
const AC = 'mod-ac';

/** Molde reduzido do `declaracaoDaRegra` real de `REMANEJ-CASCATA-LEI-12711` — duas origens, não oito, porque o que o teste prova é o encaixe, não o catálogo inteiro. */
const ESQUEMA_ARGS_REAL = {
  destinoFinalCodigo: 'AC',
  ordens: [
    { origem: 'LB_PPI', destinos: ['LB_Q', 'AC'] },
    { origem: 'LB_Q', destinos: ['LB_PPI', 'AC'] },
  ],
};

/** A fixture já é provada válida em `describe('matrizDaRegra', …)`; aqui só evita `!` nos testes seguintes. */
function matrizReal(): MatrizDaOrdemDeRemanejamento {
  const matriz = matrizDaRegra(ESQUEMA_ARGS_REAL);
  if (matriz === null) throw new Error('ESQUEMA_ARGS_REAL deveria produzir uma matriz válida.');
  return matriz;
}

function modalidade(
  id: string,
  codigo: string,
  regraRemanejamento: string | null = null,
  nome = '',
): ModalidadeDoCatalogo {
  return {
    id,
    codigo,
    nome,
    composicaoVagas: 'RETIRADA_DE_OUTRA_MODALIDADE',
    composicaoOrigemCodigo: null,
    regraRemanejamento,
    remanejamentoDestino: null,
    remanejamentoPar: null,
    remanejamentoFallback: null,
  };
}

// As duas origens que ESQUEMA_ARGS_REAL declara (LB_PPI e LB_Q) seguem a
// cascata no catálogo — como no seed real, onde toda origem que a regra
// ordena é também a modalidade marcada ordem de remanejamento. AC é só o fallback
// terminal: nunca origem, por isso nunca marcado.
const CATALOGO = new Map<string, ModalidadeDoCatalogo>([
  [
    LB_PPI,
    modalidade(LB_PPI, 'LB_PPI', RegraRemanejamentoModalidadeCodigo.SEGUE_ORDEM_DE_REMANEJAMENTO),
  ],
  [LB_Q, modalidade(LB_Q, 'LB_Q', RegraRemanejamentoModalidadeCodigo.SEGUE_ORDEM_DE_REMANEJAMENTO)],
  [AC, modalidade(AC, 'AC')],
]);

function ofertaFederal(
  modalidades: readonly { id: string; codigo: string; nome: string }[],
): DistribuicaoDeVagas {
  return {
    ofertaCursoId: 'oferta-1',
    voBase: '100',
    pr: '0,5',
    regraDistribuicaoCodigo: 'DISTRIB-VAGAS-LEI-12711',
    ramoDaDistribuicao: 'LEI_DE_COTAS',
    regraDistribuicaoVersao: 'v1',
    regraAjusteCodigo: null,
    regraAjusteVersao: null,
    referenciaReservaDemograficaId: 'ref-1',
    ajusteDoQuadro: null,
    modalidades,
    quadro: [],
  };
}

describe('matrizDaRegra', () => {
  it('lê o declaracaoDaRegra real de REMANEJ-CASCATA-LEI-12711', () => {
    expect(matrizDaRegra(ESQUEMA_ARGS_REAL)).toEqual({
      fallbackCodigo: 'AC',
      ordens: [
        { origem: 'LB_PPI', destinos: ['LB_Q', 'AC'] },
        { origem: 'LB_Q', destinos: ['LB_PPI', 'AC'] },
      ],
    });
  });

  it('devolve null para forma não reconhecida', () => {
    expect(matrizDaRegra(null)).toBeNull();
    expect(matrizDaRegra('texto')).toBeNull();
    expect(matrizDaRegra({})).toBeNull();
    expect(matrizDaRegra({ fallbackCodigo: 'AC', ordens: [] })).toBeNull();
    expect(matrizDaRegra({ destinoFinalCodigo: 'AC' })).toBeNull();
    expect(matrizDaRegra({ destinoFinalCodigo: 'AC', ordens: [{ origem: 'X' }] })).toBeNull();
    expect(
      matrizDaRegra({ destinoFinalCodigo: 'AC', ordens: [{ origem: 'X', destinos: [1, 2] }] }),
    ).toBeNull();
  });
});

describe('ofertaExigeCascata / ofertaForaDoRegimeFederal', () => {
  it('exige cascata quando alguma modalidade selecionada segue a cascata única', () => {
    const oferta = ofertaFederal([{ id: LB_PPI, codigo: 'LB_PPI', nome: '' }]);
    expect(ofertaExigeCascata(oferta, CATALOGO)).toBe(true);
  });

  it('não exige cascata sem modalidade ordem de remanejamento selecionada', () => {
    const oferta = ofertaFederal([{ id: AC, codigo: 'AC', nome: '' }]);
    expect(ofertaExigeCascata(oferta, CATALOGO)).toBe(false);
  });

  it('reconhece o ramo federal pelo ramo da distribuição, e não pelo código da regra', () => {
    expect(ofertaForaDoRegimeFederal(ofertaFederal([]))).toBe(false);
    expect(
      ofertaForaDoRegimeFederal({
        ...ofertaFederal([]),
        ramoDaDistribuicao: 'QUADRO_FIXADO_NO_EDITAL',
      }),
    ).toBe(true);
  });
});

describe('precisaExibirSecaoDaCascata', () => {
  it('só quando há oferta federal exigindo cascata', () => {
    const federal = ofertaFederal([{ id: LB_PPI, codigo: 'LB_PPI', nome: '' }]);
    expect(precisaExibirSecaoDaCascata([federal], CATALOGO)).toBe(true);
  });

  it('não quando a única oferta que exige é institucional', () => {
    const institucional = {
      ...ofertaFederal([{ id: LB_PPI, codigo: 'LB_PPI', nome: '' }]),
      ramoDaDistribuicao: 'QUADRO_FIXADO_NO_EDITAL',
    };
    expect(precisaExibirSecaoDaCascata([institucional], CATALOGO)).toBe(false);
  });

  it('não sem nenhuma modalidade ordem de remanejamento', () => {
    const federal = ofertaFederal([{ id: AC, codigo: 'AC', nome: '' }]);
    expect(precisaExibirSecaoDaCascata([federal], CATALOGO)).toBe(false);
  });
});

describe('ofertasComCascataForaDoRegimeFederal', () => {
  it('aponta a oferta que precisaria de cascata mas está fora do ramo federal', () => {
    const foraDoRegime = {
      ...ofertaFederal([{ id: LB_PPI, codigo: 'LB_PPI', nome: '' }]),
      ramoDaDistribuicao: 'QUADRO_FIXADO_NO_EDITAL',
    };
    expect(ofertasComCascataForaDoRegimeFederal([foraDoRegime], CATALOGO)).toEqual([foraDoRegime]);
  });

  it('vazio quando todas as ofertas exigentes são federais', () => {
    const federal = ofertaFederal([{ id: LB_PPI, codigo: 'LB_PPI', nome: '' }]);
    expect(ofertasComCascataForaDoRegimeFederal([federal], CATALOGO)).toEqual([]);
  });
});

describe('problemasDaCascata', () => {
  const matriz = matrizReal();

  it('sem problema quando o fallback e ao menos um destino de cada origem estão na oferta', () => {
    const oferta = ofertaFederal([
      { id: LB_PPI, codigo: 'LB_PPI', nome: '' },
      { id: LB_Q, codigo: 'LB_Q', nome: '' },
      { id: AC, codigo: 'AC', nome: '' },
    ]);
    expect(problemasDaCascata([oferta], CATALOGO, matriz)).toEqual([]);
  });

  /**
   * A tela sempre envia a matriz INTEIRA que a regra declara (cascata de remanejamento de cotas, UNI-REQ-0056) —
   * nunca uma parte da matriz. Uma oferta pode passar em todas as checagens por oferta
   * (fallback presente, cada origem que ELA declara resolve) e mesmo assim
   * deixar de cobrir uma origem ou destino que a matriz declara e nenhuma
   * oferta do processo usa: o handler de gravação aceita — só confere a
   * matriz contra o `declaracaoDaRegra`, não contra o quadro de vagas — e o
   * processo fica impublicável, porque a prontidão de conformidade
   * (`PendenciaDaCascata`/`ExisteCascataOrigemNaoSegueCascata`) recusa depois.
   * Esta checagem é o que evita o PUT aceitar essa configuração calada.
   */
  it('aponta origem e destino da matriz que nenhuma oferta do processo cobre', () => {
    // Só LB_PPI está no quadro. A matriz real também declara LB_Q como
    // origem (com destino LB_PPI/AC) — e LB_Q some do quadro por completo.
    const oferta = ofertaFederal([
      { id: LB_PPI, codigo: 'LB_PPI', nome: '' },
      { id: AC, codigo: 'AC', nome: '' },
    ]);

    const problemas = problemasDaCascata([oferta], CATALOGO, matriz);

    // Sem problema NA oferta: LB_PPI resolve (destino LB_Q está ausente, mas
    // AC também é destino dela e está selecionado) e o fallback está lá.
    expect(problemas.some((p) => p.ofertaCursoId === 'oferta-1')).toBe(false);

    // Mas a origem LB_Q que a regra declara não é ordem de remanejamento em oferta
    // nenhuma do processo — é este o problema que o handler não pega.
    expect(
      problemas.some(
        (p) =>
          p.ofertaCursoId === null &&
          p.mensagem.includes('origem LB_Q') &&
          p.mensagem.includes('seguidora da ordem de remanejamento'),
      ),
    ).toBe(true);
  });

  it('aponta a oferta sem o fallback selecionado', () => {
    const oferta = ofertaFederal([
      { id: LB_PPI, codigo: 'LB_PPI', nome: '' },
      { id: LB_Q, codigo: 'LB_Q', nome: '' },
    ]);
    const problemas = problemasDaCascata([oferta], CATALOGO, matriz);

    // O fallback ausente do quadro é apontado nos dois níveis: por oferta
    // (é ali que o operador corrige) e sobre a união (nenhuma oferta o
    // oferece) — os dois é que fecham a mesma causa raiz.
    expect(
      problemas.some((p) => p.ofertaCursoId === 'oferta-1' && p.mensagem.includes('destino final')),
    ).toBe(true);
    expect(
      problemas.some(
        (p) => p.ofertaCursoId === null && p.mensagem.includes('AC como destino final'),
      ),
    ).toBe(true);
  });

  it('aponta a origem sem nenhum destino resolvível na oferta', () => {
    // Só a própria origem está no quadro: nem o fallback (AC) nem o outro
    // destino declarado para LB_PPI (LB_Q) estão selecionados nesta oferta.
    const oferta = ofertaFederal([{ id: LB_PPI, codigo: 'LB_PPI', nome: '' }]);
    const problemas = problemasDaCascata([oferta], CATALOGO, matriz);

    expect(problemas.some((p) => p.mensagem.includes('destino final'))).toBe(true);
    expect(problemas.some((p) => p.mensagem.includes('Nenhum destino'))).toBe(true);
  });

  it('ignora ofertas fora do ramo federal e ofertas que não exigem cascata', () => {
    // Matriz de uma origem só: o que este teste prova é que as duas ofertas
    // não geram problema de encaixe POR OFERTA, não a cobertura de uma
    // matriz de duas origens — essa é `matrizReal()`, usada nos demais.
    const matrizDeUmaOrigem = matrizDaRegra({
      destinoFinalCodigo: 'AC',
      ordens: [{ origem: 'LB_PPI', destinos: ['AC'] }],
    });
    if (matrizDeUmaOrigem === null) throw new Error('Fixture inválida.');

    const foraDoRegime = {
      ...ofertaFederal([{ id: LB_PPI, codigo: 'LB_PPI', nome: '' }]),
      ramoDaDistribuicao: 'QUADRO_FIXADO_NO_EDITAL',
    };
    // Federal e sem ordem de remanejamento — ofereceria o fallback à União, se
    // precisasse: aqui cobre AC para a matriz fechar sem pendência.
    const semCascata = ofertaFederal([{ id: AC, codigo: 'AC', nome: '' }]);

    expect(problemasDaCascata([foraDoRegime, semCascata], CATALOGO, matrizDeUmaOrigem)).toEqual([]);
  });

  it('aponta origem que a regra escolhida não declara', () => {
    const catalogoComOrigemDesconhecida = new Map(CATALOGO).set(
      'mod-outra',
      modalidade(
        'mod-outra',
        'LI_EP',
        RegraRemanejamentoModalidadeCodigo.SEGUE_ORDEM_DE_REMANEJAMENTO,
      ),
    );
    // O fallback (AC) está selecionado — só a origem desconhecida sobra como problema.
    const oferta = ofertaFederal([
      { id: 'mod-outra', codigo: 'LI_EP', nome: '' },
      { id: AC, codigo: 'AC', nome: '' },
    ]);
    const problemas = problemasDaCascata([oferta], catalogoComOrigemDesconhecida, matriz);
    expect(
      problemas.some(
        (p) => p.ofertaCursoId === 'oferta-1' && p.mensagem.includes('não declara essa origem'),
      ),
    ).toBe(true);
  });
});

describe('comandoDaCascata / comandoDeRemocaoDaCascata', () => {
  it('monta o comando com a matriz inteira, ordem 1-based por origem', () => {
    const selecao: CascataSelecionada = {
      regraCodigo: 'REMANEJ-CASCATA-LEI-12711',
      regraVersao: 'v1',
    };
    const comando = comandoDaCascata(selecao, matrizReal());

    expect(comando).toEqual({
      regraCodigo: 'REMANEJ-CASCATA-LEI-12711',
      regraVersao: 'v1',
      fallbackCodigo: 'AC',
      destinos: [
        { modalidadeOrigemCodigo: 'LB_PPI', ordem: 1, modalidadeDestinoCodigo: 'LB_Q' },
        { modalidadeOrigemCodigo: 'LB_PPI', ordem: 2, modalidadeDestinoCodigo: 'AC' },
        { modalidadeOrigemCodigo: 'LB_Q', ordem: 1, modalidadeDestinoCodigo: 'LB_PPI' },
        { modalidadeOrigemCodigo: 'LB_Q', ordem: 2, modalidadeDestinoCodigo: 'AC' },
      ],
    });
  });

  it('o comando de remoção traz os quatro campos nulos', () => {
    expect(comandoDeRemocaoDaCascata()).toEqual({
      regraCodigo: null,
      regraVersao: null,
      fallbackCodigo: null,
      destinos: null,
    });
  });
});

describe('problemasDaCascata — nome da modalidade nas mensagens', () => {
  const matriz = matrizReal();
  const catalogo = new Map<string, ModalidadeDoCatalogo>([
    [
      LB_PPI,
      modalidade(
        LB_PPI,
        'LB_PPI',
        RegraRemanejamentoModalidadeCodigo.SEGUE_ORDEM_DE_REMANEJAMENTO,
        'Modalidade de teste Alfa',
      ),
    ],
    [AC, modalidade(AC, 'AC', null, 'Modalidade de teste Beta')],
  ]);

  it('cita o código com o nome, e só o código quando a modalidade não tem nome', () => {
    const oferta = ofertaFederal([{ id: LB_PPI, codigo: 'LB_PPI', nome: '' }]);

    const mensagens = problemasDaCascata([oferta], catalogo, matriz).map((p) => p.mensagem);

    expect(mensagens).toContain(
      'O destino final da cascata (AC — Modalidade de teste Beta) não está selecionado no quadro de vagas desta oferta.',
    );
    expect(mensagens).toContain(
      'Nenhum destino de LB_PPI — Modalidade de teste Alfa (LB_Q, AC — Modalidade de teste Beta) está selecionado no quadro de vagas desta oferta.',
    );
  });
});
