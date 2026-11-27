import { OperadorCodigo } from '@uniplus/shared-data/selecao';
import { conteudoInicial, REGRAS_INICIAIS } from '@uniplus/shared-inscricao/formulario';
import { describe, expect, it } from 'vitest';

import {
  camposSemUsoDeclarado,
  citantesDoRascunho,
  quemCitaNoProcesso,
  remocoesTravadasPor,
} from './citantes-no-processo';
import {
  ID_TITULO,
  secao,
  item,
  inscricaoGravada,
  formularioCom,
  formularioDoRascunho,
  exigenciaCom,
  rascunhoCom,
  NENHUMA_EXIGENCIA,
  MAIOR_IDADE,
} from './formulario-de-inscricao.testing';

describe('quem cita cada fato no processo', () => {
  const nomes = {
    documento: (id: string) => (id === ID_TITULO ? 'Título de eleitor' : id),
    fato: (codigo: string) => codigo.toLowerCase(),
  };

  it('junta exigências, regras de derivação e desempate, e trava a remoção dizendo quem depende', () => {
    const citantes = quemCitaNoProcesso(
      {
        documentos: rascunhoCom(
          exigenciaCom(ID_TITULO, [{ fato: 'PCD', operador: OperadorCodigo.IGUAL, valor: 'true' }]),
        ),
        derivacao: [
          {
            codigoFato: 'MODALIDADE',
            regras: [
              {
                contribui: 'LB_PCD',
                quando: [[{ fato: 'PCD', operador: OperadorCodigo.IGUAL, valor: true }]],
              },
            ],
          },
        ],
        desempate: [MAIOR_IDADE],
      },
      nomes,
    );

    expect(citantes.get('PCD')).toEqual([
      'o documento “Título de eleitor”',
      'as regras que calculam “modalidade”',
    ]);
    expect(citantes.get('DATA_NASCIMENTO')).toEqual(['o desempate por maior idade']);
    expect(remocoesTravadasPor(citantes).get('PCD')).toContain('dependem deste dado');
  });

  it('trava o fato que a regra de uma modalidade ofertada cita, nomeando a modalidade', () => {
    const citantes = quemCitaNoProcesso({
      documentos: NENHUMA_EXIGENCIA,
      derivacao: [],
      desempate: [],
      modalidades: [
        {
          codigo: 'AC_PCD',
          descricao: null,
          regra: [[{ fato: 'CONCORRER_PCD', operador: OperadorCodigo.IGUAL, valor: true }]],
        },
      ],
    });

    expect(citantes.get('CONCORRER_PCD')).toEqual(['a regra de quem concorre em AC_PCD']);
  });

  it('trava na inscrição o fato que outro formulário cita, nomeando o formulário; o que ela cita dos próprios campos fica de fora', () => {
    const habilitacao = conteudoInicial();
    const citaPcd = [[{ fato: 'PCD', operador: OperadorCodigo.IGUAL, valor: 'true' }]];
    const citantes = quemCitaNoProcesso({
      documentos: NENHUMA_EXIGENCIA,
      derivacao: [],
      desempate: [],
      outrosFormularios: [
        formularioDoRascunho(
          {
            ...habilitacao,
            paginas: [secao('H1', 0), ...(habilitacao.paginas ?? [])],
            itens: [
              item('LAUDO', 0, 'H1', { regras: { ...REGRAS_INICIAIS, exibicao: citaPcd } }),
              item('CID', 1, 'H1', {
                regras: {
                  ...REGRAS_INICIAIS,
                  exibicao: [[{ fato: 'LAUDO', operador: OperadorCodigo.IGUAL, valor: 'true' }]],
                },
              }),
            ],
          },
          { codigo: 'HABILITACAO', faseCodigo: 'HABILITACAO' },
        ),
      ],
    });

    expect(remocoesTravadasPor(citantes).get('PCD')).toBe(
      'Não pode sair: o formulário HABILITACAO depende deste dado. Desfaça a dependência antes de remover o campo.',
    );
    expect(citantes.has('LAUDO')).toBe(false);
  });
});

const INSCRICOES = new Set(['INSCRICAO']);
const camposSemUso = (rascunho: Parameters<typeof camposSemUsoDeclarado>[0]) =>
  camposSemUsoDeclarado(rascunho, [], INSCRICOES);

describe('campos que nada no certame usa', () => {
  it('aponta o campo do certame que nada usa, e não os dados básicos', () => {
    const semUso = camposSemUso({
      formulario: formularioCom(inscricaoGravada()),
      documentos: NENHUMA_EXIGENCIA,
      desempate: [],
    });

    expect(semUso.map((c) => c.fatoCodigo)).toEqual(['PCD']);
  });

  it('não aponta o campo que uma exigência, a derivação ou outra regra do formulário cita', () => {
    const quando = [[{ fato: 'PCD', operador: OperadorCodigo.IGUAL, valor: true }]];

    expect(
      camposSemUso({
        formulario: formularioCom(inscricaoGravada()),
        documentos: rascunhoCom(
          exigenciaCom(ID_TITULO, [{ fato: 'PCD', operador: OperadorCodigo.IGUAL, valor: 'true' }]),
        ),
        desempate: [],
      }),
    ).toEqual([]);
    expect(
      camposSemUso({
        formulario: formularioCom(inscricaoGravada(), {
          derivacao: [{ codigoFato: 'MODALIDADE', regras: [{ quando }] }],
        }),
        documentos: NENHUMA_EXIGENCIA,
        desempate: [],
      }),
    ).toEqual([]);
    const citadoPorSecao = inscricaoGravada();
    expect(
      camposSemUso({
        formulario: formularioCom({
          ...citadoPorSecao,
          paginas: [...(citadoPorSecao.paginas ?? []), secao('S2', 1.5, { exibicao: quando })],
        }),
        documentos: NENHUMA_EXIGENCIA,
        desempate: [],
      }),
    ).toEqual([]);
  });
});

describe('citantes do rascunho', () => {
  it('reúne as referências e as modalidades recebidas', () => {
    const formulario = formularioCom(inscricaoGravada());
    const rascunho = { formulario, documentos: NENHUMA_EXIGENCIA, desempate: [MAIOR_IDADE] };
    expect(citantesDoRascunho(rascunho, [], INSCRICOES)).toEqual({
      documentos: rascunho.documentos,
      derivacao: formulario.derivacao,
      desempate: rascunho.desempate,
      outrosFormularios: [],
      modalidades: [],
    });
  });
});
