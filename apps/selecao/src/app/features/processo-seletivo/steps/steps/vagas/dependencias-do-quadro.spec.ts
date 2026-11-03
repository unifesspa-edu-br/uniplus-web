import { describe, expect, it } from 'vitest';

import {
  AC,
  LI_PPI,
  AC_PCD,
  INSTITUCIONAL,
  CATALOGO,
  modalidade,
  par,
  mensagens,
  catalogo,
  distribuicao,
  federal,
} from './distribuicao-de-vagas.testing';
import { problemasDaDistribuicao } from './validacao-da-distribuicao';

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
      federal({ modalidades: [par(AC), par(AC_PCD)], quadro: [] }),
      CATALOGO,
    );
    expect(
      mensagens(problemas).some((p) => p.includes('Informe a quantidade de vagas de AC_PCD')),
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
        modalidades: [par(AC_PCD)],
        quadro: [{ modalidadeId: AC_PCD.id, quantidade: '2' }],
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
    expect(
      mensagens(problemas).some((p) => p.includes('destino final do remanejamento (AC)')),
    ).toBe(true);
  });
});

describe('problemasDaDistribuicao — rol fechado da regra', () => {
  it('sem rol informado (padrão), modalidade fora de nenhum rol declarado não é recusada por isso', () => {
    const problemas = problemasDaDistribuicao(
      distribuicao({
        modalidades: [par(AC)],
        quadro: [{ modalidadeId: AC.id, quantidade: '40' }],
      }),
      CATALOGO,
    );

    expect(problemas.some((p) => p.mensagem.includes('não pertence ao rol'))).toBe(false);
  });

  it('recusa modalidade hidratada fora do rol fechado da regra atual, nomeando-a', () => {
    const problemas = problemasDaDistribuicao(
      distribuicao({ modalidades: [par(AC), par(AC_PCD)] }),
      CATALOGO,
      ['AC'],
    );

    expect(
      mensagens(problemas).some((p) => p.includes('AC_PCD') && p.includes('não pertence ao rol')),
    ).toBe(true);
  });

  it('aceita todas as modalidades quando estão dentro do rol fechado', () => {
    const problemas = problemasDaDistribuicao(
      distribuicao({ modalidades: [par(AC)], quadro: [{ modalidadeId: AC.id, quantidade: '40' }] }),
      CATALOGO,
      ['AC'],
    );

    expect(problemas.some((p) => p.mensagem.includes('não pertence ao rol'))).toBe(false);
  });

  it('recusa rol fechado incompleto, nomeando a modalidade que falta', () => {
    const problemas = problemasDaDistribuicao(distribuicao({ modalidades: [par(AC)] }), CATALOGO, [
      'AC',
      'AC_PCD',
    ]);

    expect(mensagens(problemas).some((p) => p.includes('AC_PCD') && p.includes('exige'))).toBe(
      true,
    );
  });

  it('acusa excesso e falta ao mesmo tempo quando a oferta troca uma modalidade do rol por outra fora dele', () => {
    const problemas = problemasDaDistribuicao(
      distribuicao({ modalidades: [par(AC), par(LI_PPI)] }),
      CATALOGO,
      ['AC', 'AC_PCD'],
    );

    const textos = mensagens(problemas);
    expect(textos.some((p) => p.includes('LI_PPI') && p.includes('não pertence ao rol'))).toBe(
      true,
    );
    expect(textos.some((p) => p.includes('AC_PCD') && p.includes('exige'))).toBe(true);
  });
});

describe('modalidade que saiu do cadastro', () => {
  const SUMIDA = modalidade({
    id: 'm-sumida',
    codigo: 'PCD_ANTIGA',
    composicaoVagas: 'RETIRA_DE',
  });

  /**
   * A distribuição gravada preserva a modalidade que o cadastro excluiu, mas a
   * tela monta as colunas do catálogo vivo: a quantidade dela não aparece e
   * seguiria na gravação sem ninguém ter visto — e sem entrar no teto, porque
   * não há composição que a classifique.
   */
  it('recusa a oferta que referencia modalidade ausente do catálogo', () => {
    const orfa = distribuicao({
      modalidades: [par(INSTITUCIONAL), par(SUMIDA)],
      quadro: [
        { modalidadeId: INSTITUCIONAL.id, quantidade: '10' },
        { modalidadeId: SUMIDA.id, quantidade: '30' },
      ],
    });

    expect(mensagens(problemasDaDistribuicao(orfa, CATALOGO))).toContain(
      'PCD_ANTIGA não está mais no cadastro de modalidades: remova esta oferta do quadro e configure-a novamente.',
    );
  });

  /** Sem catálogo carregado não há como afirmar que a modalidade saiu dele. */
  it('não acusa ausência enquanto o catálogo não carregou', () => {
    expect(problemasDaDistribuicao(distribuicao(), catalogo([]))).toEqual([]);
  });
});
