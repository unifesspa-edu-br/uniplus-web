import { describe, expect, it } from 'vitest';
import {
  TipoDaObrigatoriedadeDoFormulario as Obrigatoriedade,
  TipoDaRestricaoDoFormulario as Restricao,
  ReferenciaDoLimiteDeData as ReferenciaDoLimite,
  OperadorDaCondicao,
} from '@uniplus/shared-data/selecao';
import { conteudoDoDocumento, documentoDoConteudo } from './conversao-do-formulario';
import { aceita, editar, formulario, CATALOGOS } from './conversao.testing';

describe('conversão do documento e do conteúdo do editor', () => {
  it('apresenta os valores da ausência, sem gravá-los na ida e volta', () => {
    const original = formulario();
    const lido = aceita(conteudoDoDocumento(original, CATALOGOS));
    expect(lido.conteudo.itens?.[0]).toMatchObject({
      ordem: 0,
      apresentacao: { pedirConfirmacao: false, tipoRenderizacao: 'NUMERO' },
    });
    expect(lido.conteudo.grupos?.[0].ocorrencias).toEqual({
      minimo: 0,
      incluiCandidato: false,
      maximo: null,
    });
    expect(lido.conteudo.pressupostos).toEqual([]);
    const volta = aceita(
      documentoDoConteudo(lido, { conteudo: lido.conteudo, camposEditados: [] }, CATALOGOS),
    );
    expect(volta.formulario).toEqual(original);
    expect(volta.formulario.itens?.[0]).not.toHaveProperty('ordem');
    expect(volta.formulario.grupos?.[0]).not.toHaveProperty('minimo');
  });

  it('grava só o mínimo confirmado em zero, mesmo sem mudar o valor mostrado', () => {
    const original = formulario();
    const volta = aceita(
      editar(original, (conteudo) => conteudo, [['grupos', 'familia', 'ocorrencias', 'minimo']]),
    );
    expect(volta.formulario.grupos).toEqual([{ ...original.grupos?.[0], minimo: 0 }]);
    expect(volta.formulario.grupos?.[0]).not.toHaveProperty('incluiCandidato');
    expect(volta.formulario.itens).toEqual(original.itens);
  });

  it('editar o título conserva listas ausentes, vazias e a origem do modelo', () => {
    const original = { ...formulario(), itens: [], grupos: undefined, termos: undefined };
    const volta = aceita(editar(original, (conteudo) => ({ ...conteudo, titulo: 'Cadastro' })));
    expect(volta.formulario).toEqual({ ...original, titulo: 'Cadastro' });
    expect(volta.formulario.itens).toEqual([]);
    expect(volta.formulario.grupos).toBeUndefined();
    expect(volta.formulario.modeloOrigemCodigo).toBe('MODELO');
  });

  it('preserva predicados vazios e nulos quando outro campo é editado', () => {
    const original = {
      ...formulario(),
      itens: [{ fatoCodigo: 'RENDA', precondicao: [], impedimento: null }],
    };
    const volta = aceita(editar(original, (conteudo) => ({ ...conteudo, titulo: 'Cadastro' })));
    expect(volta.formulario.itens).toEqual(original.itens);
  });

  it('transforma a obrigatoriedade condicional sem gravar o tipo de renderização', () => {
    const volta = aceita(
      editar(formulario(), (conteudo) => ({
        ...conteudo,
        itens:
          conteudo.itens?.map((item) => ({
            ...item,
            regras: {
              ...item.regras,
              obrigatoriedade: {
                tipo: 'QUANDO',
                predicado: [[{ fato: 'PARENTESCO', operador: 'IGUAL', valor: 'PROPRIO' }]],
              },
            },
          })) ?? null,
      })),
    );
    expect(volta.formulario.itens?.[0].obrigatoriedade).toEqual({
      tipo: Obrigatoriedade.QUANDO,
      predicado: [[{ fato: 'PARENTESCO', operador: OperadorDaCondicao.IGUAL, valor: 'PROPRIO' }]],
    });
    expect(volta.formulario.itens?.[0]).not.toHaveProperty('tipoRenderizacao');
    expect(volta.formulario.itens?.[0]).not.toHaveProperty('predicadoObrigatoriedade');
    expect(volta.formulario.itens?.[0].opcoes).toEqual(formulario().itens?.[0].opcoes);
  });

  it('a mudança para sempre retira o predicado da obrigatoriedade', () => {
    const original = {
      ...formulario(),
      itens: [
        {
          fatoCodigo: 'RENDA',
          obrigatoriedade: {
            tipo: Obrigatoriedade.QUANDO,
            predicado: [],
          },
        },
      ],
    };
    const volta = aceita(
      editar(original, (conteudo) => ({
        ...conteudo,
        itens:
          conteudo.itens?.map((item) => ({
            ...item,
            regras: { ...item.regras, obrigatoriedade: { tipo: 'SEMPRE', predicado: null } },
          })) ?? null,
      })),
    );
    expect(volta.formulario.itens?.[0].obrigatoriedade).toEqual({ tipo: Obrigatoriedade.SEMPRE });
  });

  it('converte os limites numéricos e de data do grupo e de seus subitens', () => {
    const volta = aceita(
      editar(formulario(), (conteudo) => ({
        ...conteudo,
        grupos: conteudo.grupos?.map((grupo) => ({
          ...grupo,
          ocorrencias: { ...grupo.ocorrencias, minimo: '1', maximo: '3' },
          subitens: grupo.subitens.map((item) => ({
            ...item,
            regras: {
              ...item.regras,
              restricoes: [
                { tipo: 'FAIXA_NUMERICA', minimo: '1.25', maximo: null },
                { tipo: 'FAIXA_DE_DATA', dataMinima: { ancora: 'ENVIO', anos: '2', dias: '1' } },
              ],
            },
          })),
        })),
      })),
    );
    expect(volta.formulario.grupos?.[0]).toMatchObject({
      minimo: 1,
      maximo: 3,
      subitens: [
        {
          restricoes: [
            { tipo: Restricao.FAIXA_NUMERICA, minimo: 1.25, maximo: null },
            {
              tipo: Restricao.FAIXA_DE_DATA,
              dataMinima: { ancora: ReferenciaDoLimite.ENVIO, anos: 2, dias: 1 },
            },
          ],
        },
      ],
    });
  });

  it('grava o candidato, o mínimo e as mudanças dos subitens feitas pela mesma ação', () => {
    const volta = aceita(
      editar(
        formulario(),
        (conteudo) => ({
          ...conteudo,
          grupos: conteudo.grupos?.map((grupo) => ({
            ...grupo,
            ocorrencias: { ...grupo.ocorrencias, incluiCandidato: true, minimo: 1 },
            subitens: grupo.subitens.map((item) => ({
              ...item,
              regras: {
                exibicao: null,
                obrigatoriedade: { tipo: 'SEMPRE', predicado: null },
                restricoes: [
                  { tipo: 'OPCOES_PERMITIDAS', entradas: [{ quando: null, valores: ['PROPRIO'] }] },
                ],
              },
            })),
          })),
        }),
        [['grupos', 'familia', 'ocorrencias', 'incluiCandidato']],
      ),
    );
    expect(volta.formulario.grupos?.[0]).toMatchObject({
      incluiCandidato: true,
      minimo: 1,
      subitens: [{ restricoes: [{ tipo: Restricao.OPCOES_PERMITIDAS }] }],
    });
    expect(volta.camposEditados).toContainEqual(['grupos', 'familia', 'ocorrencias', 'minimo']);
    expect(volta.formulario).not.toHaveProperty('camposEditados');
  });

  it('resolve a versão exata sem persistir os identificadores do banco', () => {
    const volta = aceita(
      editar(formulario(), (conteudo) => ({
        ...conteudo,
        termos:
          conteudo.termos?.map((termo) => ({
            ...termo,
            termo: { ...termo.termo, versaoId: 'segunda' },
          })) ?? null,
      })),
    );
    expect(volta.formulario.termos).toEqual([
      { codigo: 'aceite', termoCodigo: 'CONSENTIMENTO', versaoNumero: 2 },
    ]);
    expect(volta.formulario.termos?.[0]).not.toHaveProperty('versaoId');
    expect(volta.formulario.termos?.[0]).not.toHaveProperty('termoId');
  });

  it('conserva as ausências quando a edição seguinte muda outro campo', () => {
    const primeiro = aceita(
      editar(formulario(), (conteudo) => conteudo, [
        ['grupos', 'familia', 'ocorrencias', 'minimo'],
      ]),
    );
    const segundo = aceita(
      documentoDoConteudo(
        primeiro,
        { conteudo: { ...primeiro.conteudo, titulo: 'Cadastro' }, camposEditados: [['titulo']] },
        CATALOGOS,
      ),
    );
    expect(segundo.formulario.grupos?.[0]).toMatchObject({ minimo: 0 });
    expect(segundo.formulario.grupos?.[0]).not.toHaveProperty('incluiCandidato');
    expect(segundo.formulario.grupos?.[0]).not.toHaveProperty('ordem');
  });
  it('remover a última restrição declara uma lista vazia, preservando as outras ausências', () => {
    const original = {
      ...formulario(),
      itens: [{ fatoCodigo: 'RENDA', restricoes: [{ tipo: Restricao.FAIXA_NUMERICA, minimo: 0 }] }],
    };
    const volta = aceita(
      editar(original, (conteudo) => ({
        ...conteudo,
        itens:
          conteudo.itens?.map((item) => ({
            ...item,
            regras: { ...item.regras, restricoes: null },
          })) ?? null,
      })),
    );
    expect(volta.formulario.itens?.[0].restricoes).toEqual([]);
    expect(volta.formulario.itens?.[0]).not.toHaveProperty('ordem');
  });

  it('editar os valores de uma opção mantém ausente a condição não editada', () => {
    const original = {
      ...formulario(),
      itens: [
        {
          fatoCodigo: 'RENDA',
          restricoes: [{ tipo: Restricao.OPCOES_PERMITIDAS, entradas: [{ valores: ['A'] }] }],
        },
      ],
    };
    const volta = aceita(
      editar(original, (conteudo) => ({
        ...conteudo,
        itens:
          conteudo.itens?.map((item) => ({
            ...item,
            regras: {
              ...item.regras,
              restricoes: item.regras.restricoes?.map((restricao) => ({
                ...restricao,
                entradas: restricao.entradas?.map((entrada) => ({ ...entrada, valores: ['B'] })),
              })),
            },
          })) ?? null,
      })),
    );
    expect(volta.formulario.itens?.[0].restricoes?.[0].entradas).toEqual([{ valores: ['B'] }]);
  });

  it('confirmar uma condição nula grava somente essa condição na opção', () => {
    const original = {
      ...formulario(),
      itens: [
        {
          fatoCodigo: 'RENDA',
          restricoes: [{ tipo: Restricao.OPCOES_PERMITIDAS, entradas: [{ valores: ['A'] }] }],
        },
      ],
    };
    const volta = aceita(
      editar(original, (conteudo) => conteudo, [
        ['itens', 'RENDA', 'restricoes', '0', 'entradas', '0', 'quando'],
      ]),
    );
    expect(volta.formulario.itens?.[0].restricoes?.[0].entradas).toEqual([
      { valores: ['A'], quando: null },
    ]);
  });
  it('converte a condição e a mensagem do impedimento sem alterar opções fora do editor', () => {
    const volta = aceita(
      editar(formulario(), (conteudo) => ({
        ...conteudo,
        itens:
          conteudo.itens?.map((item) => ({
            ...item,
            regras: {
              ...item.regras,
              impedimento: {
                quando: [[{ fato: 'RENDA', operador: 'IGUAL', valor: 0 }]],
                mensagem: 'A resposta impede a inscrição.',
              },
            },
          })) ?? null,
      })),
    );
    expect(volta.formulario.itens?.[0].impedimento).toEqual({
      quando: [[{ fato: 'RENDA', operador: OperadorDaCondicao.IGUAL, valor: 0 }]],
      mensagem: 'A resposta impede a inscrição.',
    });
    expect(volta.formulario.itens?.[0].opcoes).toEqual(formulario().itens?.[0].opcoes);
  });

  it.each([
    { quando: null, mensagem: 'A resposta impede a inscrição.' },
    { quando: [], mensagem: null },
  ])('recusa o impedimento sem condição ou mensagem', (impedimento) => {
    const recusada = editar(formulario(), (conteudo) => ({
      ...conteudo,
      itens:
        conteudo.itens?.map((item) => ({ ...item, regras: { ...item.regras, impedimento } })) ??
        null,
    }));
    expect(recusada.ok).toBe(false);
    if (!recusada.ok) expect(recusada.impedimentos[0].caminho).toBe('/itens/0/impedimento');
  });

  it('esvaziar o título retira o campo sem escrever nulo onde o esquema não aceita', () => {
    const original = { ...formulario(), titulo: 'Cadastro' };
    const volta = aceita(editar(original, (conteudo) => ({ ...conteudo, titulo: null })));
    expect(volta.formulario).not.toHaveProperty('titulo');
  });

  it('as etapas novas usam os enums do contrato e conservam seu predicado vazio', () => {
    const volta = aceita(
      editar(formulario(), (conteudo) => ({
        ...conteudo,
        etapas: [
          ...(conteudo.etapas ?? []),
          {
            codigo: 'outra',
            ordem: 1,
            tipo: 'SECAO',
            bloco: null,
            apresentacao: { titulo: 'Outros dados', descricao: null, aviso: null },
            exibicao: [],
          },
        ],
      })),
    );
    expect(volta.formulario.etapas?.[1]).toMatchObject({
      codigo: 'outra',
      tipo: 'SECAO',
      exibicao: [],
    });
  });

  it('recusa uma etapa com tipo desconhecido sem substituir as outras partes', () => {
    const recusada = editar(formulario(), (conteudo) => ({
      ...conteudo,
      etapas: conteudo.etapas?.map((etapa) => ({ ...etapa, tipo: 'tipo desconhecido' })) ?? null,
    }));
    expect(recusada.ok).toBe(false);
    if (!recusada.ok) expect(recusada.impedimentos[0].mensagem).toBe('Selecione uma opção válida.');
  });
});
