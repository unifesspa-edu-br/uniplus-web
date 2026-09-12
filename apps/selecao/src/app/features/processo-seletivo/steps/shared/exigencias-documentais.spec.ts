import { describe, expect, it } from 'vitest';
import type { ProcessoSeletivoDto } from '@uniplus/shared-data/selecao';
import type { DocumentoConfig } from '../processo-seletivo.models';
import { arvoreDeExigencias, documentosDe } from './exigencias-documentais';

const ID_ISENCAO = '01960000-0000-7000-0000-0000000000f1';
const ID_HABILITACAO = '01960000-0000-7000-0000-0000000000f2';
const ID_ETAPA_RENDA = '01960000-0000-7000-0000-0000000000e1';
const ID_RG = '01960000-0000-7000-0000-0000000000d1';

const FASES = new Map([
  ['ISENCAO', ID_ISENCAO],
  ['HABILITACAO', ID_HABILITACAO],
]);

function config(patch: Partial<DocumentoConfig> = {}): DocumentoConfig {
  return {
    included: true,
    todasEtapas: false,
    etapas: ['HABILITACAO'],
    modalidades: [],
    modalidadesRecortadas: false,
    etapaPorFase: {},
    ...patch,
  };
}

describe('arvoreDeExigencias — do rascunho para o comando', () => {
  it('expande o documento em uma folha por fase em que ele vale', () => {
    const raizes = arvoreDeExigencias(
      { [ID_RG]: config({ etapas: ['ISENCAO', 'HABILITACAO'] }) },
      FASES,
      ['AC'],
    );

    expect(raizes).toHaveLength(2);
    expect(raizes.map((raiz) => raiz.documento?.exigidoNaFaseId)).toEqual([
      ID_ISENCAO,
      ID_HABILITACAO,
    ]);
    expect(raizes.every((raiz) => raiz.tipo === 'FOLHA')).toBe(true);
  });

  it('leva a etapa que coleta o documento naquela fase', () => {
    const raizes = arvoreDeExigencias(
      {
        [ID_RG]: config({
          etapas: ['ISENCAO', 'HABILITACAO'],
          etapaPorFase: { HABILITACAO: ID_ETAPA_RENDA },
        }),
      },
      FASES,
      ['AC'],
    );

    expect(raizes[0].documento?.exigidoNaEtapaId).toBeNull();
    expect(raizes[1].documento?.exigidoNaEtapaId).toBe(ID_ETAPA_RENDA);
  });

  /** "Vale em todas as fases" é o cronograma inteiro, não uma lista congelada. */
  it('expande em todas as fases do cronograma quando o documento vale em todas', () => {
    const raizes = arvoreDeExigencias(
      { [ID_RG]: config({ todasEtapas: true, etapas: [] }) },
      FASES,
      ['AC'],
    );

    expect(raizes.map((raiz) => raiz.documento?.exigidoNaFaseId)).toEqual([
      ID_ISENCAO,
      ID_HABILITACAO,
    ]);
  });

  /**
   * A fase saiu do cronograma depois de o documento ser marcado nela: enviar a
   * exigência assim mesmo seria pedir ao servidor uma fase que não existe.
   */
  it('descarta a fase que saiu do cronograma', () => {
    const raizes = arvoreDeExigencias(
      { [ID_RG]: config({ etapas: ['HABILITACAO', 'RECURSOS'] }) },
      FASES,
      ['AC'],
    );

    expect(raizes).toHaveLength(1);
    expect(raizes[0].documento?.exigidoNaFaseId).toBe(ID_HABILITACAO);
  });

  it('não envia documento que a fase deixou de exigir', () => {
    expect(arvoreDeExigencias({ [ID_RG]: config({ included: false }) }, FASES, ['AC'])).toEqual([]);
  });

  it('sem recorte de modalidade, o documento é exigido de todo candidato', () => {
    const [raiz] = arvoreDeExigencias({ [ID_RG]: config() }, FASES, ['AC', 'LB_PPI']);

    expect(raiz.documento?.aplicabilidade).toBe('GERAL');
    expect(raiz.documento?.condicoes).toEqual([]);
  });

  it('o recorte de modalidade vira a cláusula do gatilho', () => {
    const [raiz] = arvoreDeExigencias(
      { [ID_RG]: config({ modalidades: ['LB_PPI'], modalidadesRecortadas: true }) },
      FASES,
      ['AC', 'LB_PPI'],
    );

    expect(raiz.documento?.aplicabilidade).toBe('CONDICIONAL');
    expect(raiz.documento?.condicoes).toEqual([
      { clausula: 1, fato: 'MODALIDADE', operador: 'EM', valor: '["LB_PPI"]' },
    ]);
  });

  /**
   * Recorte que sobrou vazio depois de o quadro de vagas mudar não pode virar cláusula
   * vazia — o agregado a recusa, e "ninguém entrega" não é o que o operador declarou.
   */
  it('recorte esvaziado pelo quadro de vagas volta a valer para todos', () => {
    const [raiz] = arvoreDeExigencias(
      { [ID_RG]: config({ modalidades: ['LI_Q'], modalidadesRecortadas: true }) },
      FASES,
      ['AC', 'LB_PPI'],
    );

    expect(raiz.documento?.aplicabilidade).toBe('GERAL');
  });

  it('recorte que alcança todas as modalidades ofertadas não vira gatilho', () => {
    const [raiz] = arvoreDeExigencias(
      { [ID_RG]: config({ modalidades: ['AC', 'LB_PPI'], modalidadesRecortadas: true }) },
      FASES,
      ['AC', 'LB_PPI'],
    );

    expect(raiz.documento?.aplicabilidade).toBe('GERAL');
  });
});

describe('documentosDe — do processo de volta ao rascunho', () => {
  function dto(exigencias: readonly unknown[]): ProcessoSeletivoDto {
    return {
      cronogramaFases: [
        { id: ID_ISENCAO, codigo: 'ISENCAO' },
        { id: ID_HABILITACAO, codigo: 'HABILITACAO' },
      ],
      documentosExigidos: exigencias,
    } as unknown as ProcessoSeletivoDto;
  }

  function exigencia(patch: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      tipoDocumentoOrigemId: ID_RG,
      exigidoNaFaseId: ID_HABILITACAO,
      exigidoNaEtapaId: null,
      condicoes: [],
      ...patch,
    };
  }

  it('agrupa as duas fases do mesmo documento numa entrada só', () => {
    const documentos = documentosDe(
      dto([exigencia({ exigidoNaFaseId: ID_ISENCAO }), exigencia()]),
    );

    expect(Object.keys(documentos)).toEqual([ID_RG]);
    expect(documentos[ID_RG].etapas).toEqual(['ISENCAO', 'HABILITACAO']);
    expect(documentos[ID_RG].included).toBe(true);
  });

  it('indexa a etapa que coleta pela fase em que ela acontece', () => {
    const documentos = documentosDe(
      dto([
        exigencia({ exigidoNaFaseId: ID_ISENCAO }),
        exigencia({ exigidoNaEtapaId: ID_ETAPA_RENDA }),
      ]),
    );

    expect(documentos[ID_RG].etapaPorFase).toEqual({ HABILITACAO: ID_ETAPA_RENDA });
  });

  it('reconstrói o recorte de modalidade a partir do gatilho', () => {
    const documentos = documentosDe(
      dto([
        exigencia({
          condicoes: [
            { id: 'c1', clausula: 1, fato: 'MODALIDADE', operador: 'EM', valor: '["LB_Q"]' },
          ],
        }),
      ]),
    );

    expect(documentos[ID_RG].modalidadesRecortadas).toBe(true);
    expect(documentos[ID_RG].modalidades).toEqual(['LB_Q']);
  });

  /**
   * Um recorte inventado a partir de um valor ilegível mentiria sobre quem precisa
   * entregar o documento.
   */
  it('gatilho com valor ilegível não vira recorte', () => {
    const documentos = documentosDe(
      dto([
        exigencia({
          condicoes: [
            { id: 'c1', clausula: 1, fato: 'MODALIDADE', operador: 'EM', valor: 'não é json' },
          ],
        }),
      ]),
    );

    expect(documentos[ID_RG].modalidadesRecortadas).toBe(false);
  });

  it('descarta a exigência cuja fase não está no cronograma lido', () => {
    expect(
      documentosDe(dto([exigencia({ exigidoNaFaseId: '01960000-0000-7000-0000-00000000ffff' })])),
    ).toEqual({});
  });
});
