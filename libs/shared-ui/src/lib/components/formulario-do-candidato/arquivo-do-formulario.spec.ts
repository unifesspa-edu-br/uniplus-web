import { lerArquivoDoFormulario } from './arquivo-do-formulario';
import type { FormularioDoCandidato } from './formulario-do-candidato.model';
import { apresentacaoDaEtapa, campoRenderizavel } from './formularios-de-exemplo.testing';
import { interpretarFormulario } from './interpretador/interpretador';

const casos = import.meta.glob<Record<string, unknown>>('./interpretador/casos/*.json', {
  eager: true,
  import: 'default',
});

const BASE = {
  finalidade: 'INSCRICAO',
  regras: {},
  etapas: [],
  termos: [],
  coleta: { itens: [], grupos: [] },
  pressupostos: { fatos: [] },
};
const APRESENTACAO = {
  rotulo: 'Parentesco',
  tipoDeCampo: 'ESCOLHA_UNICA',
  pedirConfirmacao: false,
};
const OCORRENCIAS = { minimo: 0, incluiCandidato: false };
const SEMPRE = { obrigatoriedade: { tipo: 'SEMPRE' } };

describe('arquivo importado no simulador', () => {
  it('o arquivo fora da forma é recusado com o caminho do problema, antes de qualquer interpretação', () => {
    expect(
      lerArquivoDoFormulario(
        '{"regras": {}, "finalidade": "INSCRICAO", "coleta": {"itens": [], "grupos": []}, "etapas": "x"}',
      ),
    ).toEqual({
      valido: false,
      caminho: 'etapas',
      mensagem: expect.any(String),
    });
    expect(lerArquivoDoFormulario('{').valido).toBe(false);
  });

  it('as regras do arquivo são conferidas antes de montar a apresentação, com o caminho dentro delas', () => {
    expect(lerArquivoDoFormulario('{"regras": {"etapas": {}}}')).toEqual({
      valido: false,
      caminho: 'regras.etapas',
      mensagem: expect.any(String),
    });
  });

  it('o elemento da apresentação fora da forma é recusado com o caminho dele', () => {
    const arquivo = { ...BASE, coleta: { itens: [null], grupos: [] } };

    expect(lerArquivoDoFormulario(JSON.stringify(arquivo))).toMatchObject({
      valido: false,
      caminho: 'coleta.itens[0]',
    });
  });

  it('os valores de um subitem de grupo são conferidos, com o caminho dentro do grupo', () => {
    const subitem = {
      fatoCodigo: 'PARENTESCO',
      ordem: 0,
      apresentacao: APRESENTACAO,
      valoresSelecionaveis: [null],
    };
    const grupo = { codigo: 'G', ordem: 0, rotulo: 'G', ocorrencias: OCORRENCIAS };
    const arquivo = { ...BASE, coleta: { itens: [], grupos: [{ ...grupo, subitens: [subitem] }] } };

    expect(lerArquivoDoFormulario(JSON.stringify(arquivo))).toMatchObject({
      valido: false,
      caminho: 'coleta.grupos[0].subitens[0].valoresSelecionaveis[0]',
    });
  });

  it('a finalidade, o indicador de inclusão do candidato e a base legal do termo são conferidos', () => {
    const grupo = { codigo: 'G', ordem: 0, rotulo: 'G', ocorrencias: { minimo: 0 }, subitens: [] };
    const termo = {
      codigo: 'T',
      codigoNasRegras: 'T',
      ordem: 0,
      conteudo: { nome: 'T', texto: 'x' },
    };

    expect(
      lerArquivoDoFormulario(JSON.stringify({ ...BASE, finalidade: undefined })),
    ).toMatchObject({ valido: false, caminho: 'finalidade' });
    const coleta = { itens: [], grupos: [grupo] };
    expect(lerArquivoDoFormulario(JSON.stringify({ ...BASE, coleta }))).toMatchObject({
      valido: false,
      caminho: 'coleta.grupos[0].ocorrencias.incluiCandidato',
    });
    expect(lerArquivoDoFormulario(JSON.stringify({ ...BASE, termos: [termo] }))).toMatchObject({
      valido: false,
      caminho: 'termos[0].conteudo.baseLegal',
    });
  });

  it('as respostas de um caso são conferidas na forma que a simulação lê', () => {
    expect(
      lerArquivoDoFormulario(JSON.stringify({ regras: {}, grupos: { BENS: {} } })),
    ).toMatchObject({ valido: false, caminho: 'grupos.BENS' });
    expect(
      lerArquivoDoFormulario(JSON.stringify({ regras: {}, etapasConcluidas: 1 })),
    ).toMatchObject({ valido: false, caminho: 'etapasConcluidas' });
  });

  it('os pressupostos do formulário importado são conferidos, com o caminho', () => {
    expect(
      lerArquivoDoFormulario(JSON.stringify({ ...BASE, pressupostos: { fatos: 'TRABALHA' } })),
    ).toMatchObject({
      valido: false,
      caminho: 'pressupostos.fatos',
    });
    expect(
      lerArquivoDoFormulario(
        JSON.stringify({
          ...BASE,
          pressupostos: { fatos: [{ fatoCodigo: 'IDADE', calculadoDe: 'DATA_NASCIMENTO' }] },
        }),
      ),
    ).toMatchObject({
      valido: false,
      caminho: 'pressupostos.fatos[0].calculadoDe',
    });
  });

  it('o termo de um caso aparece no bloco de revisão e aceite, que o caso não declara', () => {
    const caso = {
      regras: {
        etapas: [],
        termos: [{ codigo: 'VERACIDADE', regras: { obrigatoriedade: { tipo: 'SEMPRE' } } }],
      },
    };
    const lido = lerArquivoDoFormulario(JSON.stringify(caso));

    expect(lido.valido && lido.formulario.etapas.map((e) => e.bloco ?? null)).toEqual([
      'REVISAO_E_ACEITE',
    ]);
  });

  it('o caso do corpus abre com a apresentação montada das regras e com as respostas dele', () => {
    const [caso] = Object.values(casos).filter((c) => JSON.stringify(c).includes('TIPO_ENDERECO'));
    const lido = lerArquivoDoFormulario(JSON.stringify(caso));

    expect(lido.valido).toBe(true);
    if (!lido.valido) return;
    expect(
      lido.formulario.coleta.itens.find((c) => c.fatoCodigo === 'TIPO_ENDERECO')?.apresentacao
        .tipoDeCampo,
    ).toBe('ESCOLHA_UNICA');
    expect(lido.simulacao?.respostas).toEqual({ TIPO_ENDERECO: 'URBANO' });
  });

  it('o campo cujas opções vêm de outras respostas abre como seleção no caso importado', () => {
    const caso = {
      regras: {
        etapas: [
          {
            codigo: 'DADOS',
            itens: [
              {
                fatoCodigo: 'CURSOS',
                regras: { obrigatoriedade: { tipo: 'NUNCA' } },
                oferta: ['MED', 'ENF'],
              },
              {
                fatoCodigo: 'ESPERA',
                regras: {
                  obrigatoriedade: { tipo: 'SEMPRE' },
                  restricoes: [{ tipo: 'OPCOES_DAS_RESPOSTAS', fatos: ['CURSOS'] }],
                },
              },
            ],
          },
        ],
      },
    };
    const lido = lerArquivoDoFormulario(JSON.stringify(caso));

    expect(
      lido.valido &&
        lido.formulario.coleta.itens.find((c) => c.fatoCodigo === 'ESPERA')?.apresentacao
          .tipoDeCampo,
    ).toBe('ESCOLHA_UNICA');
  });

  it('o tipo do campo de um caso sai das condições que o citam, inclusive as de grupo', () => {
    const caso = {
      regras: {
        etapas: [
          {
            codigo: 'DADOS',
            itens: [
              { fatoCodigo: 'TEM_DEPENDENTES', regras: SEMPRE },
              { fatoCodigo: 'IDADE', regras: SEMPRE },
              {
                fatoCodigo: 'RESPONSAVEL',
                regras: {
                  ...SEMPRE,
                  exibicao: [[{ fato: 'IDADE', operador: 'MENOR_IGUAL', valor: 17 }]],
                },
              },
            ],
            grupos: [
              {
                codigo: 'DEPENDENTES',
                ocorrencias: { minimo: 0, incluiCandidato: false },
                regras: {
                  ...SEMPRE,
                  exibicao: [[{ fato: 'TEM_DEPENDENTES', operador: 'IGUAL', valor: true }]],
                },
                subitens: [],
              },
            ],
          },
        ],
      },
    };
    const lido = lerArquivoDoFormulario(JSON.stringify(caso));
    const tipo = (fato: string): string | undefined =>
      lido.valido
        ? lido.formulario.coleta.itens.find((c) => c.fatoCodigo === fato)?.apresentacao.tipoDeCampo
        : undefined;

    expect([tipo('TEM_DEPENDENTES'), tipo('IDADE')]).toEqual(['SIM_OU_NAO', 'NUMERO']);
  });

  it('o formulário exportado, importado de volta, produz a mesma simulação', () => {
    const formulario: FormularioDoCandidato = {
      finalidade: 'INSCRICAO',
      etapas: [
        {
          codigo: 'DADOS',
          codigoNasRegras: 'DADOS',
          ordem: 0,
          tipo: 'SECAO',
          apresentacao: apresentacaoDaEtapa('Dados'),
        },
      ],
      termos: [],
      coleta: { itens: [campoRenderizavel('IDADE', 'Idade', 'NUMERO')], grupos: [] },
      pressupostos: { fatos: [] },
      regras: {
        etapas: [
          {
            codigo: 'DADOS',
            itens: [
              {
                fatoCodigo: 'IDADE',
                regras: { ...SEMPRE, restricoes: [{ tipo: 'FAIXA_NUMERICA', minimo: 16 }] },
              },
            ],
          },
        ],
      },
    };
    const simulacao = { respostas: { IDADE: 15 } };

    const lido = lerArquivoDoFormulario(JSON.stringify(formulario));

    expect(lido.valido && lido.formulario).toEqual(formulario);
    expect(lido.valido && interpretarFormulario(lido.formulario.regras, simulacao)).toEqual(
      interpretarFormulario(formulario.regras, simulacao),
    );
  });
});
