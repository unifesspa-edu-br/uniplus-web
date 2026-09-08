import { describe, expect, it } from 'vitest';

import { CascataSelecionada, DistribuicaoDeVagas } from '../../processo-seletivo.models';
import {
  comandoDaCascata,
  comandoDeRemocaoDaCascata,
  MatrizDaRegra,
  matrizDaRegra,
  ofertaExigeCascata,
  ofertaForaDoRegimeFederal,
  ofertasComCascataForaDoRegimeFederal,
  precisaExibirSecaoDaCascata,
  problemasDaCascata,
} from './cascata-de-remanejamento';
import { ModalidadeDoCatalogo } from './distribuicao-de-vagas';

const LB_PPI = 'mod-lb-ppi';
const LB_Q = 'mod-lb-q';
const AC = 'mod-ac';

/** Molde reduzido do `esquemaArgs` real de `REMANEJ-CASCATA-LEI-12711` — duas origens, não oito, porque o que o teste prova é o encaixe, não o catálogo inteiro. */
const ESQUEMA_ARGS_REAL = {
  fallbackCodigo: 'AC',
  ordens: [
    { origem: 'LB_PPI', destinos: ['LB_Q', 'AC'] },
    { origem: 'LB_Q', destinos: ['LB_PPI', 'AC'] },
  ],
};

/** A fixture já é provada válida em `describe('matrizDaRegra', …)`; aqui só evita `!` nos testes seguintes. */
function matrizReal(): MatrizDaRegra {
  const matriz = matrizDaRegra(ESQUEMA_ARGS_REAL);
  if (matriz === null) throw new Error('ESQUEMA_ARGS_REAL deveria produzir uma matriz válida.');
  return matriz;
}

function modalidade(
  id: string,
  codigo: string,
  regraRemanejamento: string | null = null,
): ModalidadeDoCatalogo {
  return {
    id,
    codigo,
    composicaoVagas: 'RETIRA_DE',
    composicaoOrigemCodigo: null,
    regraRemanejamento,
    remanejamentoDestino: null,
    remanejamentoPar: null,
    remanejamentoFallback: null,
  };
}

// As duas origens que ESQUEMA_ARGS_REAL declara (LB_PPI e LB_Q) seguem a
// cascata no catálogo — como no seed real, onde toda origem que a regra
// ordena é também a modalidade marcada SEGUE_CASCATA. AC é só o fallback
// terminal: nunca origem, por isso nunca marcado.
const CATALOGO = new Map<string, ModalidadeDoCatalogo>([
  [LB_PPI, modalidade(LB_PPI, 'LB_PPI', 'SEGUE_CASCATA')],
  [LB_Q, modalidade(LB_Q, 'LB_Q', 'SEGUE_CASCATA')],
  [AC, modalidade(AC, 'AC')],
]);

function ofertaFederal(modalidades: readonly { id: string; codigo: string }[]): DistribuicaoDeVagas {
  return {
    ofertaCursoId: 'oferta-1',
    voBase: '100',
    pr: '0,5',
    regraDistribuicaoCodigo: 'DISTRIB-VAGAS-LEI-12711',
    regraDistribuicaoVersao: 'v1',
    regraAjusteCodigo: null,
    regraAjusteVersao: null,
    referenciaReservaDemograficaId: 'ref-1',
    modalidades,
    quadro: [],
  };
}

describe('matrizDaRegra', () => {
  it('lê o esquemaArgs real de REMANEJ-CASCATA-LEI-12711', () => {
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
    expect(matrizDaRegra({ fallbackCodigo: 'AC' })).toBeNull();
    expect(matrizDaRegra({ fallbackCodigo: 'AC', ordens: [{ origem: 'X' }] })).toBeNull();
    expect(
      matrizDaRegra({ fallbackCodigo: 'AC', ordens: [{ origem: 'X', destinos: [1, 2] }] }),
    ).toBeNull();
  });
});

describe('ofertaExigeCascata / ofertaForaDoRegimeFederal', () => {
  it('exige cascata quando alguma modalidade selecionada segue a cascata única', () => {
    const oferta = ofertaFederal([{ id: LB_PPI, codigo: 'LB_PPI' }]);
    expect(ofertaExigeCascata(oferta, CATALOGO)).toBe(true);
  });

  it('não exige cascata sem modalidade SEGUE_CASCATA selecionada', () => {
    const oferta = ofertaFederal([{ id: AC, codigo: 'AC' }]);
    expect(ofertaExigeCascata(oferta, CATALOGO)).toBe(false);
  });

  it('reconhece o ramo federal em qualquer variação da Lei 12.711', () => {
    expect(ofertaForaDoRegimeFederal(ofertaFederal([]))).toBe(false);
    expect(
      ofertaForaDoRegimeFederal({
        ...ofertaFederal([]),
        regraDistribuicaoCodigo: 'DISTRIB-VAGAS-INSTITUCIONAL',
      }),
    ).toBe(true);
  });
});

describe('precisaExibirSecaoDaCascata', () => {
  it('só quando há oferta federal exigindo cascata', () => {
    const federal = ofertaFederal([{ id: LB_PPI, codigo: 'LB_PPI' }]);
    expect(precisaExibirSecaoDaCascata([federal], CATALOGO)).toBe(true);
  });

  it('não quando a única oferta que exige é institucional', () => {
    const institucional = {
      ...ofertaFederal([{ id: LB_PPI, codigo: 'LB_PPI' }]),
      regraDistribuicaoCodigo: 'DISTRIB-VAGAS-INSTITUCIONAL',
    };
    expect(precisaExibirSecaoDaCascata([institucional], CATALOGO)).toBe(false);
  });

  it('não sem nenhuma modalidade SEGUE_CASCATA', () => {
    const federal = ofertaFederal([{ id: AC, codigo: 'AC' }]);
    expect(precisaExibirSecaoDaCascata([federal], CATALOGO)).toBe(false);
  });
});

describe('ofertasComCascataForaDoRegimeFederal', () => {
  it('aponta a oferta que precisaria de cascata mas está fora do ramo federal', () => {
    const foraDoRegime = {
      ...ofertaFederal([{ id: LB_PPI, codigo: 'LB_PPI' }]),
      regraDistribuicaoCodigo: 'DISTRIB-VAGAS-INSTITUCIONAL',
    };
    expect(ofertasComCascataForaDoRegimeFederal([foraDoRegime], CATALOGO)).toEqual([foraDoRegime]);
  });

  it('vazio quando todas as ofertas exigentes são federais', () => {
    const federal = ofertaFederal([{ id: LB_PPI, codigo: 'LB_PPI' }]);
    expect(ofertasComCascataForaDoRegimeFederal([federal], CATALOGO)).toEqual([]);
  });
});

describe('problemasDaCascata', () => {
  const matriz = matrizReal();

  it('sem problema quando o fallback e ao menos um destino de cada origem estão na oferta', () => {
    const oferta = ofertaFederal([
      { id: LB_PPI, codigo: 'LB_PPI' },
      { id: LB_Q, codigo: 'LB_Q' },
      { id: AC, codigo: 'AC' },
    ]);
    expect(problemasDaCascata([oferta], CATALOGO, matriz)).toEqual([]);
  });

  /**
   * A tela sempre envia a matriz INTEIRA que a regra declara (RN-CASCATA-5) —
   * nunca um recorte. Uma oferta pode passar em todas as checagens por oferta
   * (fallback presente, cada origem que ELA declara resolve) e mesmo assim
   * deixar de cobrir uma origem ou destino que a matriz declara e nenhuma
   * oferta do processo usa: o handler de gravação aceita — só confere a
   * matriz contra o `esquemaArgs`, não contra o quadro de vagas — e o
   * processo fica impublicável, porque o preflight de conformidade
   * (`PendenciaDaCascata`/`ExisteCascataOrigemNaoSegueCascata`) recusa depois.
   * Esta checagem é o que evita o PUT aceitar essa configuração calada.
   */
  it('aponta origem e destino da matriz que nenhuma oferta do processo cobre', () => {
    // Só LB_PPI está no quadro. A matriz real também declara LB_Q como
    // origem (com destino LB_PPI/AC) — e LB_Q some do quadro por completo.
    const oferta = ofertaFederal([
      { id: LB_PPI, codigo: 'LB_PPI' },
      { id: AC, codigo: 'AC' },
    ]);

    const problemas = problemasDaCascata([oferta], CATALOGO, matriz);

    // Sem problema NA oferta: LB_PPI resolve (destino LB_Q está ausente, mas
    // AC também é destino dela e está selecionado) e o fallback está lá.
    expect(problemas.some((p) => p.ofertaCursoId === 'oferta-1')).toBe(false);

    // Mas a origem LB_Q que a regra declara não é SEGUE_CASCATA em oferta
    // nenhuma do processo — é este o problema que o handler não pega.
    expect(
      problemas.some(
        (p) =>
          p.ofertaCursoId === null &&
          p.mensagem.includes('origem LB_Q') &&
          p.mensagem.includes('SEGUE_CASCATA'),
      ),
    ).toBe(true);
  });

  it('aponta a oferta sem o fallback selecionado', () => {
    const oferta = ofertaFederal([
      { id: LB_PPI, codigo: 'LB_PPI' },
      { id: LB_Q, codigo: 'LB_Q' },
    ]);
    const problemas = problemasDaCascata([oferta], CATALOGO, matriz);

    // O fallback ausente do quadro é apontado nos dois níveis: por oferta
    // (é ali que o operador corrige) e sobre a união (nenhuma oferta o
    // oferece) — os dois é que fecham a mesma causa raiz.
    expect(
      problemas.some(
        (p) => p.ofertaCursoId === 'oferta-1' && p.mensagem.includes('fallback'),
      ),
    ).toBe(true);
    expect(
      problemas.some((p) => p.ofertaCursoId === null && p.mensagem.includes('fallback AC')),
    ).toBe(true);
  });

  it('aponta a origem sem nenhum destino resolvível na oferta', () => {
    // Só a própria origem está no quadro: nem o fallback (AC) nem o outro
    // destino declarado para LB_PPI (LB_Q) estão selecionados nesta oferta.
    const oferta = ofertaFederal([{ id: LB_PPI, codigo: 'LB_PPI' }]);
    const problemas = problemasDaCascata([oferta], CATALOGO, matriz);

    expect(problemas.some((p) => p.mensagem.includes('fallback'))).toBe(true);
    expect(problemas.some((p) => p.mensagem.includes('Nenhum destino'))).toBe(true);
  });

  it('ignora ofertas fora do ramo federal e ofertas que não exigem cascata', () => {
    // Matriz de uma origem só: o que este teste prova é que as duas ofertas
    // não geram problema de encaixe POR OFERTA, não a cobertura de uma
    // matriz de duas origens — essa é `matrizReal()`, usada nos demais.
    const matrizDeUmaOrigem = matrizDaRegra({
      fallbackCodigo: 'AC',
      ordens: [{ origem: 'LB_PPI', destinos: ['AC'] }],
    });
    if (matrizDeUmaOrigem === null) throw new Error('Fixture inválida.');

    const foraDoRegime = {
      ...ofertaFederal([{ id: LB_PPI, codigo: 'LB_PPI' }]),
      regraDistribuicaoCodigo: 'DISTRIB-VAGAS-INSTITUCIONAL',
    };
    // Federal e sem SEGUE_CASCATA — ofereceria o fallback à União, se
    // precisasse: aqui cobre AC para a matriz fechar sem pendência.
    const semCascata = ofertaFederal([{ id: AC, codigo: 'AC' }]);

    expect(problemasDaCascata([foraDoRegime, semCascata], CATALOGO, matrizDeUmaOrigem)).toEqual(
      [],
    );
  });

  it('aponta origem que a regra escolhida não declara', () => {
    const catalogoComOrigemDesconhecida = new Map(CATALOGO).set(
      'mod-outra',
      modalidade('mod-outra', 'LI_EP', 'SEGUE_CASCATA'),
    );
    // O fallback (AC) está selecionado — só a origem desconhecida sobra como problema.
    const oferta = ofertaFederal([
      { id: 'mod-outra', codigo: 'LI_EP' },
      { id: AC, codigo: 'AC' },
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
    const selecao: CascataSelecionada = { regraCodigo: 'REMANEJ-CASCATA-LEI-12711', regraVersao: 'v1' };
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
