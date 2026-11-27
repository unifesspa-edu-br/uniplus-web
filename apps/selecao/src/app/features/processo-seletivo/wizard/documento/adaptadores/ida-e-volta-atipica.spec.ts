import {
  DocumentoDaConfiguracaoTaxaDeInscricaoFundamentos as Fundamento,
  type DocumentoDaConfiguracao,
} from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import { catalogoPorCodigo } from '../catalogos-por-codigo';
import { documentoSemNada } from '../exemplos.testing';
import * as atendimento from './atendimento.adaptador';
import * as fada from './fada.adaptador';
import * as formula from './formula.adaptador';
import * as identificacao from './identificacao.adaptador';
import * as pagamento from './pagamento.adaptador';
import * as tipo from './tipo-processo.adaptador';
import * as vagas from './vagas.adaptador';

const SEM_CATALOGO = catalogoPorCodigo([]);

type IdaEVolta = (documento: DocumentoDaConfiguracao) => DocumentoDaConfiguracao;

const TIPO: IdaEVolta = (d) => tipo.edicaoDoPasso(tipo.valoresDoFormulario(d))(d);
const IDENTIFICACAO: IdaEVolta = (d) =>
  identificacao.edicaoDoPasso(identificacao.valoresDoFormulario(d, { unidades: SEM_CATALOGO }))(d);
const PAGAMENTO: IdaEVolta = (d) => pagamento.edicaoDoPasso(pagamento.valoresDoFormulario(d))(d);
const VAGAS: IdaEVolta = (d) =>
  vagas.edicaoDoPasso(
    vagas.valoresDoFormulario(d, { ofertas: SEM_CATALOGO, modalidades: SEM_CATALOGO }),
  )(d);
const FADA: IdaEVolta = (d) => fada.edicaoDoPasso(fada.valoresDoFormulario(d))(d);
const ATENDIMENTO: IdaEVolta = (d) =>
  atendimento.edicaoDoPasso(
    atendimento.valoresDoFormulario(d, {
      condicoes: SEM_CATALOGO,
      recursos: SEM_CATALOGO,
      tiposDeficiencia: SEM_CATALOGO,
    }),
  )(d);
const FORMULA: IdaEVolta = (d) => formula.edicaoDoPasso(formula.valoresDoFormulario(d))(d);

function comSecao(secao: Partial<DocumentoDaConfiguracao>): DocumentoDaConfiguracao {
  return { ...documentoSemNada(), ...secao };
}

/** Valores que o esquema admite e que a leitura do formulário poderia normalizar sem querer. */
const ATIPICOS: readonly [string, IdaEVolta, DocumentoDaConfiguracao][] = [
  [
    'Tipo com espaços no código',
    TIPO,
    comSecao({ identificacao: { tipoProcessoCodigo: ' TIPO ', tipoProcessoNome: ' Nome ' } }),
  ],
  [
    'Identificação com espaços nos textos',
    IDENTIFICACAO,
    comSecao({
      identificacao: {
        nome: ' Processo ',
        identificadorLegivel: ' ID-1 ',
        unidadeAdministradoraCodigo: ' UNI ',
        unidadeAdministradoraNome: 'Unidade',
        unidadeAdministradoraSigla: 'UN',
        localidadeCodigoIbge: ' 1505304 ',
        localidadeNome: 'Município',
        localidadeUf: 'PA',
      },
    }),
  ],
  [
    'Identificação com texto em branco',
    IDENTIFICACAO,
    comSecao({ identificacao: { nome: '', identificadorLegivel: '   ' } }),
  ],
  [
    'Pagamento com valor de mais de duas casas',
    PAGAMENTO,
    comSecao({
      taxaDeInscricao: {
        cobra: true,
        valor: 50.005,
        fundamentos: [Fundamento.CADASTRO_UNICO],
      },
    }),
  ],
  [
    'Pagamento sem cobrança e com lista vazia',
    PAGAMENTO,
    comSecao({ taxaDeInscricao: { cobra: false, fundamentos: [] } }),
  ],
  [
    'Vagas com referências vazias, notação científica e destinos intercalados',
    VAGAS,
    comSecao({
      distribuicaoVagas: [
        {
          ofertaCursoCodigo: 'OFERTA_1',
          percentualDaReservaLegal: 1e-7,
          regraDistribuicao: {},
          regraAjuste: {},
          referenciaDemograficaCodigo: ' CENSO ',
          modalidades: [{ codigo: 'AC' }, { codigo: 'LB', quantidadeDeclarada: 3 }],
        },
      ],
      ordemDeRemanejamento: {
        regra: {},
        destinoFinalCodigo: ' AC ',
        destinos: [
          { modalidadeOrigemCodigo: 'B', modalidadeDestinoCodigo: 'AC' },
          { modalidadeOrigemCodigo: 'A', modalidadeDestinoCodigo: 'B' },
          { modalidadeOrigemCodigo: 'B', modalidadeDestinoCodigo: 'A' },
        ],
      },
    }),
  ],
  [
    'FADA com referência vazia, textos com espaço e chave antes de outra seção',
    FADA,
    comSecao({
      fada: {
        aplica: true,
        regra: {},
        fator: 1e-7,
        baseLegalCodigo: ' BASE ',
        descricao: 'Descrição gravada',
        codigoDoDadoDeElegibilidade: ' FATO ',
      },
      identificacao: { nome: 'Depois do FADA' },
    }),
  ],
  [
    'FADA que não aplica, antes de outra seção',
    FADA,
    comSecao({ fada: { aplica: false }, identificacao: { nome: 'Depois do FADA' } }),
  ],
  [
    'Atendimento com itens de código repetido em cada lista',
    ATENDIMENTO,
    comSecao({
      atendimento: {
        condicoes: [
          { condicaoCodigo: 'C1', condicaoNome: 'Primeira' },
          { condicaoCodigo: 'C1', condicaoNome: 'Segunda' },
        ],
        recursos: [
          { recursoCodigo: 'R1', recursoNome: 'Libras' },
          { recursoCodigo: 'R2' },
          { recursoCodigo: 'R1', recursoNome: 'Libras de novo' },
        ],
        tiposDeficiencia: [
          { tipoDeficienciaCodigo: 'T1', tipoDeficienciaNome: 'Visual' },
          { tipoDeficienciaCodigo: 'T1', tipoDeficienciaNome: 'Visual repetido' },
        ],
      },
    }),
  ],
  [
    'Vagas com modalidades de código repetido e quantidades diferentes',
    VAGAS,
    comSecao({
      distribuicaoVagas: [
        {
          ofertaCursoCodigo: 'OFERTA_1',
          modalidades: [
            { codigo: 'AC', descricao: 'Primeira', quantidadeDeclarada: 1 },
            { codigo: 'LB' },
            { codigo: 'AC', descricao: 'Segunda', quantidadeDeclarada: 2 },
            { codigo: 'AC', quantidadeDeclarada: null },
          ],
        },
      ],
    }),
  ],
  [
    'Cascata com o mesmo destino repetido na mesma origem',
    VAGAS,
    comSecao({
      ordemDeRemanejamento: {
        destinos: [
          { modalidadeOrigemCodigo: 'A', modalidadeDestinoCodigo: 'B' },
          { modalidadeOrigemCodigo: 'A', modalidadeDestinoCodigo: 'B' },
          { modalidadeOrigemCodigo: 'A', modalidadeDestinoCodigo: 'C' },
        ],
      },
    }),
  ],
  ['Atendimento com o bloco vazio', ATENDIMENTO, comSecao({ atendimento: {} })],
  [
    'Atendimento com uma lista vazia e outra ausente',
    ATENDIMENTO,
    comSecao({
      atendimento: {
        condicoes: [],
        recursos: [{ recursoCodigo: 'LIBRAS', recursoNome: 'Libras' }],
      },
    }),
  ],
  [
    'Fórmula com referências vazias, textos com espaço e escala em notação científica',
    FORMULA,
    comSecao({
      classificacao: {
        regraCalculo: {},
        regraArredondamento: { codigo: 'ARREDONDA' },
        casasArredondamento: 0,
        escalaNotaFinal: 1e-7,
        baseadoEmEnem: true,
        resolucaoPesoAreaEnem: ' RESOLUCAO ',
        quadroPesoAreaEnem: [{ grupoAreaEnemCodigo: 'G', areas: [] }],
      },
    }),
  ],
];

describe('ida e volta com valores atípicos que o esquema admite', () => {
  it.each(ATIPICOS)('%s volta idêntico, na mesma ordem das chaves', (_nome, idaEVolta, doc) => {
    expect(JSON.stringify(idaEVolta(doc))).toBe(JSON.stringify(doc));
  });

  it('editar outro campo da identificação não apara o nome lido', () => {
    const documento = comSecao({ identificacao: { nome: ' Processo ' } });
    const valores = identificacao.valoresDoFormulario(documento, { unidades: SEM_CATALOGO });

    const editado = identificacao.edicaoDoPasso({ ...valores, identificadorLegivel: ' Novo ' })(
      documento,
    );

    expect(editado.identificacao).toEqual({ nome: ' Processo ', identificadorLegivel: 'Novo' });
  });

  it('o nome que a pessoa digita é aparado', () => {
    const documento = comSecao({ identificacao: { nome: ' Processo ' } });
    const valores = identificacao.valoresDoFormulario(documento, { unidades: SEM_CATALOGO });

    const editado = identificacao.edicaoDoPasso({ ...valores, nome: ' Outro ' })(documento);

    expect(editado.identificacao?.nome).toBe('Outro');
  });

  it('a referência vazia só sai quando a pessoa limpa a escolha', () => {
    const documento = comSecao({ classificacao: { regraCalculo: {}, baseadoEmEnem: false } });
    const valores = formula.valoresDoFormulario(documento);

    const mantida = formula.edicaoDoPasso(valores)(documento);
    const limpa = formula.edicaoDoPasso({ ...valores, regraDeCalculo: null })(documento);

    expect(mantida.classificacao?.regraCalculo).toBe(documento.classificacao?.regraCalculo);
    expect(limpa.classificacao).not.toHaveProperty('regraCalculo');
  });

  it('editar uma lista de atendimento com código repetido guarda as entradas que não mudaram', () => {
    const documento = comSecao({
      atendimento: {
        recursos: [
          { recursoCodigo: 'R1', recursoNome: 'Primeiro' },
          { recursoCodigo: 'R1', recursoNome: 'Segundo' },
        ],
      },
    });
    const catalogos = {
      condicoes: SEM_CATALOGO,
      recursos: SEM_CATALOGO,
      tiposDeficiencia: SEM_CATALOGO,
    };
    const valores = atendimento.valoresDoFormulario(documento, catalogos);

    const editado = atendimento.edicaoDoPasso({
      ...valores,
      recursos: [...valores.recursos, { codigo: 'R2', nome: 'Novo' }],
    })(documento);

    expect(editado.atendimento?.recursos).toEqual([
      { recursoCodigo: 'R1', recursoNome: 'Primeiro' },
      { recursoCodigo: 'R1', recursoNome: 'Segundo' },
      { recursoCodigo: 'R2' },
    ]);
    expect(editado.atendimento?.recursos?.[1]).toBe(documento.atendimento?.recursos?.[1]);
  });

  it('a quantidade de uma modalidade repetida muda só na ocorrência editada', () => {
    const documento = comSecao({
      distribuicaoVagas: [
        {
          ofertaCursoCodigo: 'OFERTA_1',
          modalidades: [
            { codigo: 'AC', quantidadeDeclarada: 1 },
            { codigo: 'AC', quantidadeDeclarada: 2 },
          ],
        },
      ],
    });
    const catalogos = { ofertas: SEM_CATALOGO, modalidades: SEM_CATALOGO };
    const valores = vagas.valoresDoFormulario(documento, catalogos);
    const [oferta] = valores.ofertas;
    const modalidades = [oferta.modalidades[0], { ...oferta.modalidades[1], quantidade: '9' }];

    const editado = vagas.edicaoDoPasso({ ...valores, ofertas: [{ ...oferta, modalidades }] })(
      documento,
    );

    expect(editado.distribuicaoVagas?.[0].modalidades).toEqual([
      { codigo: 'AC', quantidadeDeclarada: 1 },
      { codigo: 'AC', quantidadeDeclarada: 9 },
    ]);
  });
});
