import { interpretarFormulario } from './interpretador';
import type { RegrasDoFormulario, SimulacaoDoFormulario, ValorJson } from './regras-do-formulario';

/**
 * O corpus de casos compartilhado com a API (`contracts/formularios/casos` do uniplus-api, copiado em
 * `casos/` por `scripts/sincronizar-casos-do-formulario.sh`): cada caso é o corpo da avaliação sem
 * cadastro mais o resultado esperado, que tem de estar contido no que o interpretador devolve. Um caso
 * que diverge aqui é regra que o front interpreta diferente do servidor.
 */
interface Caso extends SimulacaoDoFormulario {
  readonly descricao: string;
  readonly regras: RegrasDoFormulario;
  readonly esperado: ValorJson;
}

const casos = Object.entries(
  import.meta.glob<Caso>('./casos/*.json', { eager: true, import: 'default' }),
).map(([arquivo, caso]) => [arquivo.replace('./casos/', ''), caso] as const);

describe('interpretador do formulário — corpus compartilhado com a API', () => {
  it('tem casos', () => {
    expect(casos.length).toBeGreaterThan(0);
  });

  it.each(casos)('%s', (_arquivo, caso) => {
    const resultado = interpretarFormulario(caso.regras, caso);

    expect(resultado.valida, resultado.valida ? '' : JSON.stringify(resultado.erro)).toBe(true);
    if (!resultado.valida) return;
    expect(
      divergencias(caso.esperado, resultado.avaliacao as unknown as ValorJson, 'esperado'),
      caso.descricao,
    ).toEqual([]);
  });
});

const FAIXA_DE_NASCIMENTO = (
  dataMinima: unknown,
  dataMaxima: unknown,
): Parameters<typeof interpretarFormulario>[0] =>
  ({
    etapas: [
      {
        codigo: 'DADOS',
        itens: [
          {
            fatoCodigo: 'NASCIMENTO',
            obrigatoriedade: 'SEMPRE',
            restricoes: [{ tipo: 'FAIXA_DE_DATA', dataMinima, dataMaxima }],
          },
        ],
      },
    ],
  }) as Parameters<typeof interpretarFormulario>[0];

describe('interpretador do formulário — faixa de data', () => {
  it('recusa a mínima que fica depois da máxima seja qual for o dia do envio', () => {
    const resultado = interpretarFormulario(
      FAIXA_DE_NASCIMENTO(
        { ancora: 'ENVIO', anos: 1, dias: 1 },
        { ancora: 'ENVIO', anos: 0, dias: 0 },
      ),
      {},
    );

    expect(resultado).toEqual({
      valida: false,
      erro: {
        caminho: 'etapas[0].itens[0].restricoes[0]',
        mensagem: expect.stringContaining('mínima'),
      },
    });
  });

  it('aceita os limites cuja ordem depende do dia do envio', () => {
    const resultado = interpretarFormulario(
      FAIXA_DE_NASCIMENTO(
        { ancora: 'ENVIO', anos: 1, dias: -400 },
        { ancora: 'ENVIO', anos: 0, dias: 0 },
      ),
      {},
    );

    expect(resultado.valida).toBe(true);
  });

  it('recusa a data fixa com deslocamento e o limite do envio com data', () => {
    expect(
      interpretarFormulario(
        FAIXA_DE_NASCIMENTO({ ancora: 'DATA_FIXA', data: '2000-01-01', anos: 1 }, null),
        {},
      ),
    ).toMatchObject({
      valida: false,
      erro: { caminho: 'etapas[0].itens[0].restricoes[0].dataMinima' },
    });
    expect(
      interpretarFormulario(
        FAIXA_DE_NASCIMENTO(null, { ancora: 'ENVIO', data: '2000-01-01', anos: 0 }),
        {},
      ),
    ).toMatchObject({
      valida: false,
      erro: { caminho: 'etapas[0].itens[0].restricoes[0].dataMaxima.data' },
    });
  });

  it('recusa o envio de fuso desconhecido e o de instante fora do calendário', () => {
    const regras = FAIXA_DE_NASCIMENTO(null, { ancora: 'ENVIO', anos: 0, dias: 0 });

    expect(
      interpretarFormulario(regras, {
        envio: { instante: '2026-10-11T12:00:00Z', fuso: 'Marte/Olimpo' },
      }),
    ).toMatchObject({ valida: false, erro: { caminho: 'envio.fuso' } });
    expect(
      interpretarFormulario(regras, {
        envio: { instante: '0001-01-01T00:00:00Z', fuso: 'America/Belem' },
      }),
    ).toMatchObject({ valida: false, erro: { caminho: 'envio.instante' } });
  });
});

describe('interpretador do formulário — recusas', () => {
  it('recusa as regras fora da forma com o caminho do problema', () => {
    const resultado = interpretarFormulario(
      {
        etapas: [{ codigo: 'DADOS', itens: [{ fatoCodigo: 'IDADE', obrigatoriedade: 'QUANDO' }] }],
      },
      {},
    );

    expect(resultado).toEqual({
      valida: false,
      erro: {
        caminho: 'etapas[0].itens[0].obrigatoriedade',
        mensagem: expect.stringContaining('QUANDO com ele'),
      },
    });
  });
});

/**
 * O esperado contido no resultado: cada propriedade do objeto esperado confere com a do resultado; cada
 * objeto de uma lista esperada confere com algum objeto da lista do resultado; e o valor simples —
 * inclusive a lista de valores simples — é igual.
 */
function divergencias(
  esperado: ValorJson | undefined,
  real: ValorJson | undefined,
  caminho: string,
): string[] {
  if (ehObjeto(esperado)) {
    if (!ehObjeto(real)) return [`${caminho}: esperado um objeto, veio ${JSON.stringify(real)}`];
    return Object.entries(esperado).flatMap(([chave, valor]) =>
      divergencias(valor, real[chave], `${caminho}.${chave}`),
    );
  }
  if (Array.isArray(esperado) && esperado.some(ehObjeto)) {
    if (!Array.isArray(real))
      return [`${caminho}: esperada uma lista, veio ${JSON.stringify(real)}`];
    return esperado.flatMap((elemento, i) =>
      real.some((dele) => divergencias(elemento, dele, '').length === 0)
        ? []
        : [`${caminho}[${i}]: nenhum elemento do resultado contém ${JSON.stringify(elemento)}`],
    );
  }
  return JSON.stringify(esperado) === JSON.stringify(real)
    ? []
    : [`${caminho}: esperado ${JSON.stringify(esperado)}, veio ${JSON.stringify(real)}`];
}

function ehObjeto(valor: ValorJson | undefined): valor is { readonly [chave: string]: ValorJson } {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}
