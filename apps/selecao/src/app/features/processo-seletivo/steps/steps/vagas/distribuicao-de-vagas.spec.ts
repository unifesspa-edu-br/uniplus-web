import { describe, expect, it } from 'vitest';

import { DistribuicaoDeVagas } from '../../processo-seletivo.models';
import {
  decodificarComposicaoVagas,
  seguemOMesmoPadrao,
  problemaDeSomaDoQuadro,
  problemaDeVagasAutorizadas,
  ModalidadeDoCatalogo,
  modalidadesExigidasPelaLei,
  ofertasRepetidas,
  problemasDaDistribuicao,
  totalFixadoDoVo,
  REGRA_LEI_12711,
} from './distribuicao-de-vagas';

const AC = modalidade({ id: 'm-ac', codigo: 'AC', composicaoVagas: 'RESIDUAL_DO_VO' });
const LI_PPI = modalidade({ id: 'm-li-ppi', codigo: 'LI_PPI', composicaoVagas: 'DENTRO_DO_VR' });
const PCD_PURO = modalidade({
  id: 'm-pcd',
  codigo: 'PCD_PURO',
  composicaoVagas: 'RETIRA_DE',
  composicaoOrigemCodigo: 'AC',
});
const INSTITUCIONAL = modalidade({
  id: 'm-inst',
  codigo: 'AC_I',
  composicaoVagas: 'SUPLEMENTAR_AO_TOTAL',
});

const CATALOGO = catalogo([AC, LI_PPI, PCD_PURO, INSTITUCIONAL]);

function modalidade(
  base: Partial<ModalidadeDoCatalogo> & { id: string; codigo: string },
): ModalidadeDoCatalogo {
  return {
    composicaoVagas: 'DENTRO_DO_VR',
    composicaoOrigemCodigo: null,
    regraRemanejamento: null,
    remanejamentoDestino: null,
    remanejamentoPar: null,
    remanejamentoFallback: null,
    ...base,
  };
}

/** A oferta guarda o par id+código; o código é como as demais dimensões a nomeiam. */
function par(modalidade: ModalidadeDoCatalogo): { id: string; codigo: string } {
  return { id: modalidade.id, codigo: modalidade.codigo };
}

/** O texto de cada recusa, sem o escopo que diz onde ela deve ser dita. */
function mensagens(problemas: readonly { readonly mensagem: string }[]): string[] {
  return problemas.map((problema) => problema.mensagem);
}

function catalogo(
  itens: readonly ModalidadeDoCatalogo[],
): ReadonlyMap<string, ModalidadeDoCatalogo> {
  return new Map(itens.map((item) => [item.id, item]));
}

function distribuicao(base: Partial<DistribuicaoDeVagas> = {}): DistribuicaoDeVagas {
  return {
    ofertaCursoId: 'oferta-1',
    voBase: '40',
    pr: '0,5',
    regraDistribuicaoCodigo: 'DISTRIB-VAGAS-INSTITUCIONAL',
    regraDistribuicaoVersao: '1.0',
    regraAjusteCodigo: null,
    regraAjusteVersao: null,
    referenciaReservaDemograficaId: null,
    modalidades: [par(INSTITUCIONAL)],
    quadro: [{ modalidadeId: INSTITUCIONAL.id, quantidade: '10' }],
    ...base,
  };
}

function federal(base: Partial<DistribuicaoDeVagas> = {}): DistribuicaoDeVagas {
  return distribuicao({
    regraDistribuicaoCodigo: REGRA_LEI_12711,
    regraAjusteCodigo: 'AJUSTE-ART-11',
    regraAjusteVersao: '1.0',
    referenciaReservaDemograficaId: 'ref-1',
    modalidades: [par(AC), par(LI_PPI)],
    quadro: [],
    ...base,
  });
}

describe('problemasDaDistribuicao — forma básica (UNI-REQ-0134)', () => {
  it('aceita uma distribuição institucional completa', () => {
    expect(problemasDaDistribuicao(distribuicao(), CATALOGO)).toEqual([]);
  });

  it.each([['0'], ['-5'], [''], ['dez'], ['1e2'], ['0x10']])(
    'recusa total de vagas %j',
    (voBase) => {
      const problemas = problemasDaDistribuicao(distribuicao({ voBase }), CATALOGO);
      expect(mensagens(problemas).some((p) => p.includes('total de vagas'))).toBe(true);
    },
  );

  /** Art. 10, II: piso legal de 50% e teto de 100%. */
  it.each([['0,4'], ['0,49'], ['1,01'], ['2']])('recusa PR %j fora do intervalo legal', (pr) => {
    const problemas = problemasDaDistribuicao(distribuicao({ pr }), CATALOGO);
    expect(mensagens(problemas).some((p) => p.includes('entre 0,5 e 1,0'))).toBe(true);
  });

  it.each([['0,5'], ['0,75'], ['1'], ['1,0']])('aceita PR %j', (pr) => {
    expect(problemasDaDistribuicao(distribuicao({ pr }), CATALOGO)).toEqual([]);
  });

  it('recusa PR com mais de quatro casas decimais', () => {
    const problemas = problemasDaDistribuicao(distribuicao({ pr: '0,50001' }), CATALOGO);
    expect(
      mensagens(problemas).some((p) => p.includes('quatro casas') || p.includes('4 casas')),
    ).toBe(true);
  });

  it('recusa oferta sem modalidade', () => {
    const problemas = problemasDaDistribuicao(
      distribuicao({ modalidades: [], quadro: [] }),
      CATALOGO,
    );
    expect(mensagens(problemas).some((p) => p.includes('ao menos uma modalidade'))).toBe(true);
  });

  it('recusa a mesma modalidade duas vezes na oferta', () => {
    const problemas = problemasDaDistribuicao(
      distribuicao({ modalidades: [par(INSTITUCIONAL), par(INSTITUCIONAL)] }),
      CATALOGO,
    );
    expect(mensagens(problemas).some((p) => p.includes('uma vez nesta oferta'))).toBe(true);
  });
});

describe('problemasDaDistribuicao — fronteira da quantidade', () => {
  /** Fora do ramo federal, o edital fixa toda quantidade. */
  it('exige quantidade de toda modalidade fora da Lei 12.711', () => {
    const problemas = problemasDaDistribuicao(distribuicao({ quadro: [] }), CATALOGO);
    expect(mensagens(problemas).some((p) => p.includes('Informe a quantidade de vagas'))).toBe(
      true,
    );
  });

  /** No ramo federal o motor calcula, e fixar é recusado. */
  it('recusa quantidade em modalidade calculada pela Lei 12.711', () => {
    const problemas = problemasDaDistribuicao(
      federal({ quadro: [{ modalidadeId: LI_PPI.id, quantidade: '8' }] }),
      CATALOGO,
    );
    expect(mensagens(problemas).some((p) => p.includes('é calculada pela Lei 12.711'))).toBe(true);
  });

  it('aceita as calculadas sem quantidade no ramo federal', () => {
    expect(problemasDaDistribuicao(federal(), CATALOGO)).toEqual([]);
  });

  /** Retirada e suplemento continuam sendo do edital, mesmo no ramo federal. */
  it('exige quantidade de modalidade que retira, no ramo federal', () => {
    const problemas = problemasDaDistribuicao(
      federal({ modalidades: [par(AC), par(PCD_PURO)], quadro: [] }),
      CATALOGO,
    );
    expect(
      mensagens(problemas).some((p) => p.includes('Informe a quantidade de vagas de PCD_PURO')),
    ).toBe(true);
  });

  it('recusa quadro com modalidade não selecionada na oferta', () => {
    const problemas = problemasDaDistribuicao(
      distribuicao({ quadro: [{ modalidadeId: AC.id, quantidade: '5' }] }),
      CATALOGO,
    );
    expect(mensagens(problemas).some((p) => p.includes('não está selecionada'))).toBe(true);
  });

  it('recusa quantidade negativa', () => {
    const problemas = problemasDaDistribuicao(
      distribuicao({ quadro: [{ modalidadeId: INSTITUCIONAL.id, quantidade: '-1' }] }),
      CATALOGO,
    );
    expect(mensagens(problemas).some((p) => p.includes('inteiro não negativo'))).toBe(true);
  });

  it('recusa a mesma modalidade repetida no quadro', () => {
    const problemas = problemasDaDistribuicao(
      distribuicao({
        quadro: [
          { modalidadeId: INSTITUCIONAL.id, quantidade: '5' },
          { modalidadeId: INSTITUCIONAL.id, quantidade: '7' },
        ],
      }),
      CATALOGO,
    );
    expect(mensagens(problemas).some((p) => p.includes('não pode repetir'))).toBe(true);
  });
});

describe('problemasDaDistribuicao — exigências da Lei 12.711', () => {
  it('exige referência de reserva demográfica', () => {
    const problemas = problemasDaDistribuicao(
      federal({ referenciaReservaDemograficaId: null }),
      CATALOGO,
    );
    expect(mensagens(problemas).some((p) => p.includes('referência de reserva demográfica'))).toBe(
      true,
    );
  });

  it('exige a regra de ajuste', () => {
    const problemas = problemasDaDistribuicao(
      federal({ regraAjusteCodigo: null, regraAjusteVersao: null }),
      CATALOGO,
    );
    expect(mensagens(problemas).some((p) => p.includes('regra de ajuste'))).toBe(true);
  });

  /** Fora do ramo federal a referência demográfica não se aplica. */
  it('recusa referência demográfica fora da Lei 12.711', () => {
    const problemas = problemasDaDistribuicao(
      distribuicao({ referenciaReservaDemograficaId: 'ref-1' }),
      CATALOGO,
    );
    expect(mensagens(problemas).some((p) => p.includes('só se aplica'))).toBe(true);
  });

  /** Trocar a regra muda o que o formulário exige, nos dois sentidos. */
  it('muda as exigências ao trocar a regra', () => {
    const comoInstitucional = distribuicao({ modalidades: [par(AC)], quadro: [] });
    expect(problemasDaDistribuicao(comoInstitucional, CATALOGO).length).toBeGreaterThan(0);

    const mesmaComoFederal = federal({ modalidades: [par(AC)], quadro: [] });
    expect(problemasDaDistribuicao(mesmaComoFederal, CATALOGO)).toEqual([]);
  });
});

describe('problemasDaDistribuicao — dependências entre modalidades', () => {
  it('exige a origem da retirada selecionada na mesma oferta', () => {
    const problemas = problemasDaDistribuicao(
      federal({
        modalidades: [par(PCD_PURO)],
        quadro: [{ modalidadeId: PCD_PURO.id, quantidade: '2' }],
      }),
      CATALOGO,
    );
    expect(mensagens(problemas).some((p) => p.includes('exige a origem da retirada (AC)'))).toBe(
      true,
    );
  });

  it('exige o destino do remanejamento', () => {
    const comDestino = modalidade({
      id: 'm-dest',
      codigo: 'LI_EP',
      composicaoVagas: 'DENTRO_DO_VR',
      regraRemanejamento: 'DESTINO_UNICO',
      remanejamentoDestino: 'AC',
    });

    const problemas = problemasDaDistribuicao(
      federal({ modalidades: [par(comDestino)], quadro: [] }),
      catalogo([comDestino]),
    );
    expect(mensagens(problemas).some((p) => p.includes('destino do remanejamento (AC)'))).toBe(
      true,
    );
  });

  it('exige par e fallback do remanejamento cruzado', () => {
    const cruzada = modalidade({
      id: 'm-cruz',
      codigo: 'LI_PPI',
      composicaoVagas: 'DENTRO_DO_VR',
      regraRemanejamento: 'CRUZADO',
      remanejamentoPar: 'LI_EP',
      remanejamentoFallback: 'AC',
    });

    const problemas = problemasDaDistribuicao(
      federal({ modalidades: [par(cruzada)], quadro: [] }),
      catalogo([cruzada]),
    );
    expect(mensagens(problemas).some((p) => p.includes('par do remanejamento (LI_EP)'))).toBe(true);
    expect(mensagens(problemas).some((p) => p.includes('fallback do remanejamento (AC)'))).toBe(
      true,
    );
  });
});

describe('ofertasRepetidas', () => {
  /** UNI-REQ-0134: cada oferta participa de no máximo uma distribuição. */
  it('aponta a oferta usada duas vezes', () => {
    const repetidas = ofertasRepetidas([
      distribuicao({ ofertaCursoId: 'oferta-1' }),
      distribuicao({ ofertaCursoId: 'oferta-2' }),
      distribuicao({ ofertaCursoId: 'oferta-1' }),
    ]);

    expect(repetidas).toEqual(['oferta-1']);
  });

  it('não aponta nada quando cada oferta aparece uma vez', () => {
    expect(
      ofertasRepetidas([
        distribuicao({ ofertaCursoId: 'oferta-1' }),
        distribuicao({ ofertaCursoId: 'oferta-2' }),
      ]),
    ).toEqual([]);
  });
});

describe('modalidadesExigidasPelaLei', () => {
  const CATALOGO_COMPLETO = [
    { codigo: 'AC', naturezaLegal: 'AMPLA' },
    { codigo: 'LB_PPI', naturezaLegal: 'COTA_RESERVADA' },
    { codigo: 'LB_Q', naturezaLegal: 'COTA_RESERVADA' },
    { codigo: 'AC_PCD', naturezaLegal: 'OUTRA_MODALIDADE' },
  ];

  /** As oito cotas e a ampla; o que o art. 8º não alcança fica de fora. */
  it('inclui as cotas reservadas e a ampla concorrência', () => {
    expect(modalidadesExigidasPelaLei(CATALOGO_COMPLETO).map((m) => m.codigo)).toEqual([
      'AC',
      'LB_PPI',
      'LB_Q',
    ]);
  });

  it('deixa a modalidade institucional de fora', () => {
    expect(modalidadesExigidasPelaLei(CATALOGO_COMPLETO)).not.toContainEqual(
      expect.objectContaining({ codigo: 'AC_PCD' }),
    );
  });

  /** Natureza desconhecida não entra — o atalho some em vez de marcar errado. */
  it('ignora natureza que o catálogo não classificou', () => {
    expect(modalidadesExigidasPelaLei([{ codigo: 'X', naturezaLegal: 'NOVA' }])).toEqual([]);
  });
});

describe('decodificarComposicaoVagas', () => {
  /** O catálogo de Configuração publica o token canônico. */
  it.each([['RETIRA_DE'], ['DENTRO_DO_VR'], ['RESIDUAL_DO_VO'], ['SUPLEMENTAR_AO_TOTAL']])(
    'reconhece o token canônico %j',
    (token) => {
      expect(decodificarComposicaoVagas(token)).toBe(token);
    },
  );

  /** O detalhe de Seleção emite o nome do membro do enum (uniplus-api#1294). */
  it.each([
    ['RetiraDe', 'RETIRA_DE'],
    ['DentroDoVr', 'DENTRO_DO_VR'],
    ['ResidualDoVo', 'RESIDUAL_DO_VO'],
    ['SuplementarAoTotal', 'SUPLEMENTAR_AO_TOTAL'],
  ])('traduz %j do detalhe para %j', (wire, canonico) => {
    expect(decodificarComposicaoVagas(wire)).toBe(canonico);
  });

  /** Grafia desconhecida é ausência de informação, não composição a inventar. */
  it.each([[''], ['COMPOSICAO_NOVA'], ['RETIRA'], ['retira_de_algo']])(
    'recusa %j',
    (desconhecida) => {
      expect(decodificarComposicaoVagas(desconhecida)).toBeNull();
    },
  );
});

describe('problemaDeVagasAutorizadas', () => {
  /** O processo não distribui mais vagas do que o ato de autorização concede. */
  it('recusa total acima do autorizado', () => {
    expect(problemaDeVagasAutorizadas('41', 40)).toBe(
      'O total de vagas (41) passa das 40 autorizadas para a oferta.',
    );
  });

  it.each([['40'], ['39'], ['1']])('aceita total %j dentro do autorizado', (voBase) => {
    expect(problemaDeVagasAutorizadas(voBase, 40)).toBeNull();
  });

  /** Ausência do dado não é permissão nem proibição: não há teto a aplicar. */
  it('não impõe teto quando a oferta não registra vagas autorizadas', () => {
    expect(problemaDeVagasAutorizadas('99999', null)).toBeNull();
  });

  /** A forma do campo já é recusada em outro lugar; não empilhar mensagem. */
  it.each([[''], ['0'], ['-5'], ['dez'], ['1e2']])('ignora total malformado %j', (voBase) => {
    expect(problemaDeVagasAutorizadas(voBase, 40)).toBeNull();
  });
});

describe('soma do quadro contra o total de vagas', () => {
  const SUPLEMENTAR = modalidade({
    id: 'm-supl',
    codigo: 'IND',
    composicaoVagas: 'SUPLEMENTAR_AO_TOTAL',
  });
  const CATALOGO_DA_SOMA = catalogo([AC, PCD_PURO, SUPLEMENTAR]);

  function quadro(itens: Record<string, string>): DistribuicaoDeVagas {
    return distribuicao({
      voBase: '40',
      modalidades: [par(AC), par(PCD_PURO), par(SUPLEMENTAR)],
      quadro: Object.entries(itens).map(([modalidadeId, quantidade]) => ({
        modalidadeId,
        quantidade,
      })),
    });
  }

  /** As declaradas dividem o total da oferta; não o ampliam. */
  it('recusa soma acima do total de vagas', () => {
    const problema = problemaDeSomaDoQuadro(
      quadro({ [AC.id]: '40', [PCD_PURO.id]: '2' }),
      CATALOGO_DA_SOMA,
    );

    expect(problema).toBe(
      'As quantidades fixadas somam 42 e passam do total de 40 vagas da oferta.',
    );
  });

  it.each([
    ['exata', { [AC.id]: '38', [PCD_PURO.id]: '2' }],
    ['abaixo', { [AC.id]: '10', [PCD_PURO.id]: '2' }],
  ])('aceita soma %s', (_caso, itens) => {
    expect(problemaDeSomaDoQuadro(quadro(itens), CATALOGO_DA_SOMA)).toBeNull();
  });

  /**
   * Sob a Lei 12.711 a suplementar acresce vagas ao total em vez de disputá-las
   * (Portaria MEC 18/2012 art. 12), então somá-la faria o edital ser recusado
   * por oferecer exatamente o que a norma permite acrescentar.
   */
  it('não conta a modalidade suplementar no ramo federal', () => {
    const comSuplementar = federal({
      voBase: '40',
      modalidades: [par(AC), par(SUPLEMENTAR)],
      quadro: [
        { modalidadeId: AC.id, quantidade: '40' },
        { modalidadeId: SUPLEMENTAR.id, quantidade: '10' },
      ],
    });

    expect(totalFixadoDoVo(comSuplementar, CATALOGO_DA_SOMA)).toBe(40);
    expect(problemaDeSomaDoQuadro(comSuplementar, CATALOGO_DA_SOMA)).toBeNull();
  });

  /**
   * Fora do ramo federal não há cálculo: o total publicado é a soma do quadro
   * inteiro, suplementar inclusive. Num certame exclusivo de indígenas e
   * quilombolas — sem ampla concorrência — são elas que compõem o total, e
   * deixá-las de fora da soma dispensaria do teto as únicas modalidades que o
   * quadro tem.
   */
  it('conta a modalidade suplementar no ramo institucional', () => {
    const exclusivo = quadro({ [SUPLEMENTAR.id]: '41' });

    expect(totalFixadoDoVo(exclusivo, CATALOGO_DA_SOMA)).toBe(41);
    expect(problemaDeSomaDoQuadro(exclusivo, CATALOGO_DA_SOMA)).toBe(
      'As quantidades fixadas somam 41 e passam do total de 40 vagas da oferta.',
    );
  });

  /** A forma do total já é recusada em outro lugar. */
  it.each([[''], ['0'], ['dez']])('ignora total malformado %j', (voBase) => {
    const invalido = { ...quadro({ [AC.id]: '99' }), voBase };
    expect(problemaDeSomaDoQuadro(invalido, CATALOGO_DA_SOMA)).toBeNull();
  });

  it('entra na lista de problemas da distribuição', () => {
    const problemas = problemasDaDistribuicao(
      quadro({ [AC.id]: '40', [PCD_PURO.id]: '2', [SUPLEMENTAR.id]: '5' }),
      CATALOGO_DA_SOMA,
    );

    expect(mensagens(problemas).some((p) => p.includes('passam do total de 40 vagas'))).toBe(true);
  });
});

describe('seguemOMesmoPadrao', () => {
  const PADRAO = {
    regraDistribuicaoCodigo: 'DISTRIB-VAGAS-INSTITUCIONAL',
    regraDistribuicaoVersao: '1.0',
    regraAjusteCodigo: null,
    regraAjusteVersao: null,
    referenciaReservaDemograficaId: null,
    modalidades: [par(AC), par(PCD_PURO)],
    pr: '0,5',
  };

  it('aceita a oferta que repete o padrão', () => {
    expect(seguemOMesmoPadrao(distribuicao({ modalidades: PADRAO.modalidades }), PADRAO)).toBe(true);
  });

  /** A ordem é de gravação, não de significado. */
  it('ignora a ordem das modalidades', () => {
    const invertida = distribuicao({ modalidades: [par(PCD_PURO), par(AC)] });

    expect(seguemOMesmoPadrao(invertida, PADRAO)).toBe(true);
  });

  it.each([
    ['a regra', { regraDistribuicaoCodigo: 'DISTRIB-VAGAS-LEI-12711' }],
    ['a versão da regra', { regraDistribuicaoVersao: '2.0' }],
    ['o ajuste', { regraAjusteCodigo: 'AJUSTE-ART-11' }],
    ['a referência demográfica', { referenciaReservaDemograficaId: 'ref-1' }],
    ['o percentual', { pr: '0,75' }],
  ])('recusa quando %s difere', (_caso, diferenca) => {
    const oferta = distribuicao({ modalidades: PADRAO.modalidades, ...diferenca });

    expect(seguemOMesmoPadrao(oferta, PADRAO)).toBe(false);
  });

  it.each([
    ['a mais', [par(AC), par(PCD_PURO), par(INSTITUCIONAL)]],
    ['a menos', [par(AC)]],
    ['trocada', [par(AC), par(INSTITUCIONAL)]],
  ])('recusa com modalidade %s', (_caso, modalidades) => {
    expect(seguemOMesmoPadrao(distribuicao({ modalidades }), PADRAO)).toBe(false);
  });
});
