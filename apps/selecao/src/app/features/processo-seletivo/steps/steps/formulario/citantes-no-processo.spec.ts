import { conteudoInicial } from '@uniplus/shared-ui/components';
import { describe, expect, it } from 'vitest';

import {
  camposSemUsoDeclarado,
  quemCitaNoProcesso,
  remocoesTravadasPor,
} from './citantes-no-processo';
import {
  ID_TITULO,
  secao,
  item,
  inscricaoGravada,
  formularioCom,
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
          exigenciaCom(ID_TITULO, [{ fato: 'PCD', operador: 'IGUAL', valor: 'true' }]),
        ),
        derivacao: [
          {
            codigoFato: 'MODALIDADE',
            regras: [
              { contribui: 'LB_PCD', quando: [[{ fato: 'PCD', operador: 'IGUAL', valor: true }]] },
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
          regra: [[{ fato: 'CONCORRER_PCD', operador: 'IGUAL', valor: true }]],
        },
      ],
    });

    expect(citantes.get('CONCORRER_PCD')).toEqual(['a regra de quem concorre em AC_PCD']);
  });

  it('trava na inscrição o fato que outra finalidade cita, nomeando a finalidade; o que ela cita dos próprios campos fica de fora', () => {
    const habilitacao = conteudoInicial();
    const citaPcd = [[{ fato: 'PCD', operador: 'IGUAL', valor: 'true' }]];
    const citantes = quemCitaNoProcesso({
      documentos: NENHUMA_EXIGENCIA,
      derivacao: [],
      desempate: [],
      outrasFinalidades: [
        {
          finalidade: 'HABILITACAO',
          faseCodigo: 'HABILITACAO',
          conteudo: {
            ...habilitacao,
            etapas: [secao('H1', 0), ...(habilitacao.etapas ?? [])],
            itens: [
              item('LAUDO', 0, 'H1', { precondicao: citaPcd }),
              item('CID', 1, 'H1', {
                precondicao: [[{ fato: 'LAUDO', operador: 'IGUAL', valor: 'true' }]],
              }),
            ],
          },
        },
      ],
    });

    expect(remocoesTravadasPor(citantes).get('PCD')).toBe(
      'Não pode sair: o formulário de habilitação depende deste dado. Desfaça a dependência antes de remover o campo.',
    );
    expect(citantes.has('LAUDO')).toBe(false);
  });
});

describe('campos que nada no certame usa', () => {
  it('aponta o campo do certame que nada usa, e não os dados básicos', () => {
    const semUso = camposSemUsoDeclarado(formularioCom(inscricaoGravada()), NENHUMA_EXIGENCIA);

    expect(semUso.map((c) => c.fatoCodigo)).toEqual(['PCD']);
  });

  it('não aponta o campo que uma exigência, a derivação ou outra regra do formulário cita', () => {
    const quando = [[{ fato: 'PCD', operador: 'IGUAL', valor: true }]];

    expect(
      camposSemUsoDeclarado(
        formularioCom(inscricaoGravada()),
        rascunhoCom(exigenciaCom(ID_TITULO, [{ fato: 'PCD', operador: 'IGUAL', valor: 'true' }])),
      ),
    ).toEqual([]);
    expect(
      camposSemUsoDeclarado(
        formularioCom(inscricaoGravada(), {
          derivacao: [{ codigoFato: 'MODALIDADE', regras: [{ quando }] }],
        }),
        NENHUMA_EXIGENCIA,
      ),
    ).toEqual([]);
    const citadoPorSecao = inscricaoGravada();
    expect(
      camposSemUsoDeclarado(
        formularioCom({
          ...citadoPorSecao,
          etapas: [...(citadoPorSecao.etapas ?? []), secao('S2', 1.5, { exibicao: quando })],
        }),
        NENHUMA_EXIGENCIA,
      ),
    ).toEqual([]);
  });
});
