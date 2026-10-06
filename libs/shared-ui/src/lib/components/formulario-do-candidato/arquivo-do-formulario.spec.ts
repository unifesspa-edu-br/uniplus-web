import { lerArquivoDoFormulario } from './arquivo-do-formulario';
import type { FormularioDoCandidato } from './formulario-do-candidato.model';
import { interpretarFormulario } from './interpretador/interpretador';

const casos = import.meta.glob<Record<string, unknown>>('./interpretador/casos/*.json', {
  eager: true,
  import: 'default',
});

describe('arquivo importado no simulador', () => {
  it('o arquivo fora da forma é recusado com o caminho do problema, antes de qualquer interpretação', () => {
    expect(lerArquivoDoFormulario('{"regras": {}, "fatosColetados": [], "etapas": "x"}')).toEqual({
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
    const arquivo = { regras: {}, etapas: [], termos: [], grupos: [], fatosColetados: [null] };

    expect(lerArquivoDoFormulario(JSON.stringify(arquivo))).toMatchObject({
      valido: false,
      caminho: 'fatosColetados[0]',
    });
  });

  it('os valores de um subitem de grupo são conferidos, com o caminho dentro do grupo', () => {
    const subitem = {
      fatoCodigo: 'PARENTESCO',
      ordem: 0,
      rotulo: 'Parentesco',
      tipoRenderizacao: 'SELECAO_UNICA',
      valoresSelecionaveis: [null],
    };
    const arquivo = {
      regras: {},
      etapas: [],
      termos: [],
      fatosColetados: [],
      grupos: [{ codigo: 'G', ordem: 0, rotulo: 'G', minimo: 0, subitens: [subitem] }],
    };

    expect(lerArquivoDoFormulario(JSON.stringify(arquivo))).toMatchObject({
      valido: false,
      caminho: 'grupos[0].subitens[0].valoresSelecionaveis[0]',
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

  it('o termo de um caso aparece no bloco de revisão e aceite, que o caso não declara', () => {
    const caso = {
      regras: { etapas: [], termos: [{ codigo: 'VERACIDADE', obrigatoriedade: 'SEMPRE' }] },
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
      lido.formulario.fatosColetados.find((c) => c.fatoCodigo === 'TIPO_ENDERECO')
        ?.tipoRenderizacao,
    ).toBe('SELECAO_UNICA');
    expect(lido.simulacao?.respostas).toEqual({ TIPO_ENDERECO: 'URBANO' });
  });

  it('o campo cujas opções vêm de outras respostas abre como seleção no caso importado', () => {
    const caso = {
      regras: {
        etapas: [
          {
            codigo: 'DADOS',
            itens: [
              { fatoCodigo: 'CURSOS', obrigatoriedade: 'NUNCA', oferta: ['MED', 'ENF'] },
              {
                fatoCodigo: 'ESPERA',
                obrigatoriedade: 'SEMPRE',
                restricoes: [{ tipo: 'OPCOES_DAS_RESPOSTAS', fatos: ['CURSOS'] }],
              },
            ],
          },
        ],
      },
    };
    const lido = lerArquivoDoFormulario(JSON.stringify(caso));

    expect(
      lido.valido &&
        lido.formulario.fatosColetados.find((c) => c.fatoCodigo === 'ESPERA')?.tipoRenderizacao,
    ).toBe('SELECAO_UNICA');
  });

  it('o tipo do campo de um caso sai das condições que o citam, inclusive as de grupo', () => {
    const caso = {
      regras: {
        etapas: [
          {
            codigo: 'DADOS',
            itens: [
              { fatoCodigo: 'TEM_DEPENDENTES', obrigatoriedade: 'SEMPRE' },
              { fatoCodigo: 'IDADE', obrigatoriedade: 'SEMPRE' },
              {
                fatoCodigo: 'RESPONSAVEL',
                obrigatoriedade: 'SEMPRE',
                exibicao: [[{ fato: 'IDADE', operador: 'MENOR_IGUAL', valor: 17 }]],
              },
            ],
            grupos: [
              {
                codigo: 'DEPENDENTES',
                obrigatoriedade: 'SEMPRE',
                minimo: 0,
                incluiCandidato: false,
                exibicao: [[{ fato: 'TEM_DEPENDENTES', operador: 'IGUAL', valor: true }]],
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
        ? lido.formulario.fatosColetados.find((c) => c.fatoCodigo === fato)?.tipoRenderizacao
        : undefined;

    expect([tipo('TEM_DEPENDENTES'), tipo('IDADE')]).toEqual(['BOOLEANO', 'NUMERO']);
  });

  it('o formulário exportado, importado de volta, produz a mesma simulação', () => {
    const formulario: FormularioDoCandidato = {
      finalidade: 'INSCRICAO',
      etapas: [
        { codigo: 'DADOS', codigoNasRegras: 'DADOS', ordem: 0, tipo: 'SECAO', titulo: 'Dados' },
      ],
      termos: [],
      grupos: [],
      fatosColetados: [
        { fatoCodigo: 'IDADE', ordem: 0, rotulo: 'Idade', tipoRenderizacao: 'NUMERO' },
      ],
      regras: {
        etapas: [
          {
            codigo: 'DADOS',
            itens: [
              {
                fatoCodigo: 'IDADE',
                obrigatoriedade: 'SEMPRE',
                restricoes: [{ tipo: 'FAIXA_NUMERICA', minimo: 16 }],
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
