import {
  DocumentoDaConfiguracaoOpcoesDeCursoNumero as NumeroDeOpcoes,
  TipoDeAjusteDoQuadro,
  type DocumentoDaConfiguracao,
} from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import { catalogoPorCodigo } from '../catalogos-por-codigo';
import { documentoSemNada, exemploDoContrato, NOMES_DOS_EXEMPLOS } from '../exemplos.testing';
import {
  acrescentarOferta,
  declararOfertaSemModalidades,
  definirModalidades,
  removerOferta,
} from '../edicoes/distribuicao-de-vagas.edicao';
import { removerCascata } from '../edicoes/cascata-de-remanejamento.edicao';
import {
  edicaoDoPasso,
  valoresDoFormulario,
  type CatalogosDasVagas,
  type OfertaDasVagas,
  type ValoresDasVagas,
} from './vagas.adaptador';

const CATALOGOS: CatalogosDasVagas = {
  ofertas: catalogoPorCodigo([{ codigo: 'DIREITO_MARABA', rotulo: 'Direito — Marabá' }]),
  modalidades: catalogoPorCodigo([{ codigo: 'PCD', rotulo: 'Pessoa com deficiência' }]),
};

const SEM_VAGAS: ValoresDasVagas = { numeroDeOpcoes: '', ofertas: [], cascata: null };

function valoresDe(documento: DocumentoDaConfiguracao): ValoresDasVagas {
  return valoresDoFormulario(documento, CATALOGOS);
}

function idaEVolta(documento: DocumentoDaConfiguracao): DocumentoDaConfiguracao {
  return edicaoDoPasso(valoresDe(documento))(documento);
}

function primeiraOferta(valores: ValoresDasVagas): OfertaDasVagas {
  return valores.ofertas[0];
}

function comOfertaAlterada(
  valores: ValoresDasVagas,
  alteracao: Partial<OfertaDasVagas>,
): ValoresDasVagas {
  return { ...valores, ofertas: [{ ...primeiraOferta(valores), ...alteracao }] };
}

function documentoComAjusteDoQuadro(): DocumentoDaConfiguracao {
  const documento = exemploDoContrato('inscricao-pelo-sistema');
  const [oferta] = documento.distribuicaoVagas ?? [];
  return {
    ...documento,
    distribuicaoVagas: [
      {
        ...oferta,
        ajusteDoQuadro: { $tipo: TipoDeAjusteDoQuadro.reduzirDe, modalidadeCodigo: 'AC' },
      },
    ],
  };
}

type OfertaDoDocumento = NonNullable<DocumentoDaConfiguracao['distribuicaoVagas']>[number];

const NULOS_EXPLICITOS: readonly [string, (oferta: OfertaDoDocumento) => OfertaDoDocumento][] = [
  ['regraAjuste', (oferta) => ({ ...oferta, regraAjuste: null })],
  ['referenciaDemograficaCodigo', (oferta) => ({ ...oferta, referenciaDemograficaCodigo: null })],
  [
    'quantidadeDeclarada',
    (oferta) => ({
      ...oferta,
      modalidades: (oferta.modalidades ?? []).map((m) => ({ ...m, quantidadeDeclarada: null })),
    }),
  ],
];

function documentoComNulo(comNulo: (oferta: OfertaDoDocumento) => OfertaDoDocumento) {
  const documento = exemploDoContrato('inscricao-pelo-sistema');
  const [oferta] = documento.distribuicaoVagas ?? [];
  return { ...documento, distribuicaoVagas: [comNulo(oferta)] };
}

describe('adaptador do passo Vagas', () => {
  it.each(NOMES_DOS_EXEMPLOS)('devolve o exemplo %s idêntico depois de ler e editar', (nome) => {
    const documento = exemploDoContrato(nome);

    expect(idaEVolta(documento)).toEqual(documento);
  });

  it('lê o número de opções, a oferta e a cascata do exemplo', () => {
    const valores = valoresDe(exemploDoContrato('inscricao-pelo-sistema'));

    expect(valores.numeroDeOpcoes).toBe('1');
    expect(valores.ofertas).toHaveLength(1);
    expect(valores.cascata).toEqual({
      regra: { codigo: 'REMANEJ-CASCATA-LEI-12711', versao: 'v1' },
      matriz: { fallbackCodigo: 'AC', ordens: [{ origem: 'LB_PPI', destinos: ['AC'] }] },
    });
  });

  it('lê a oferta com os rótulos que o processo gravou e o quadro só para mostrar', () => {
    const oferta = primeiraOferta(valoresDe(exemploDoContrato('inscricao-pelo-sistema')));

    expect(oferta).toMatchObject({
      ofertaCodigo: 'ENG_CIVIL_MARABA',
      rotulo: 'Engenharia Civil',
      vagasOfertadasBase: '40',
      percentualDaReserva: { estado: 'valor', texto: '0,5' },
      referenciaDemografica: 'CENSO_2022',
    });
    expect(oferta.modalidades[0]).toEqual({
      codigo: 'AC',
      origem: 0,
      rotulo: 'Ampla concorrência',
      quantidade: '',
    });
    expect(oferta.quadroCalculado).toHaveLength(2);
  });

  it('lê processo sem vagas como nada declarado', () => {
    expect(valoresDe(documentoSemNada())).toEqual(SEM_VAGAS);
  });

  it('não cria nenhuma seção quando nada foi declarado', () => {
    const documento = documentoSemNada();

    expect(edicaoDoPasso(SEM_VAGAS)(documento)).toEqual(documento);
  });

  it('número de opções vazio remove a chave e "2" grava o número', () => {
    const documento = exemploDoContrato('inscricao-pelo-sistema');

    const sem = edicaoDoPasso({ ...valoresDe(documento), numeroDeOpcoes: '' })(documento);
    const duas = edicaoDoPasso({ ...valoresDe(documento), numeroDeOpcoes: '2' })(documento);

    expect(sem.opcoesDeCurso).not.toHaveProperty('numero');
    expect(duas.opcoesDeCurso?.numero).toBe(NumeroDeOpcoes.Value2);
  });

  it('distingue percentual não declarado, quadro fixado no edital e número', () => {
    const documento = exemploDoContrato('inscricao-pelo-sistema');
    const percentual = (p: OfertaDasVagas['percentualDaReserva']) =>
      edicaoDoPasso(comOfertaAlterada(valoresDe(documento), { percentualDaReserva: p }))(documento)
        .distribuicaoVagas?.[0];

    expect(percentual({ estado: 'naoDeclarado' })).not.toHaveProperty('percentualDaReservaLegal');
    expect(percentual({ estado: 'fixadoNoEdital' })?.percentualDaReservaLegal).toBeNull();
    expect(percentual({ estado: 'valor', texto: '0,75' })?.percentualDaReservaLegal).toBe(0.75);
    expect(percentual({ estado: 'valor', texto: 'abc' })).not.toHaveProperty(
      'percentualDaReservaLegal',
    );
  });

  it('devolve idêntico o percentual "fixado no edital", que é um null explícito', () => {
    const documento = exemploDoContrato('inscricao-pelo-sistema');
    const [oferta] = documento.distribuicaoVagas ?? [];
    const fixado = {
      ...documento,
      distribuicaoVagas: [{ ...oferta, percentualDaReservaLegal: null }],
    };

    expect(valoresDe(fixado).ofertas[0].percentualDaReserva).toEqual({ estado: 'fixadoNoEdital' });
    expect(idaEVolta(fixado)).toEqual(fixado);
  });

  it.each(['', '  ', 'abc', '1,5', '-3', '9'.repeat(400)])(
    'remove as vagas base quando o texto é "%s"',
    (texto) => {
      const documento = exemploDoContrato('inscricao-pelo-sistema');
      const valores = comOfertaAlterada(valoresDe(documento), { vagasOfertadasBase: texto });

      expect(edicaoDoPasso(valores)(documento).distribuicaoVagas?.[0]).not.toHaveProperty(
        'vagasOfertadasBase',
      );
    },
  );

  it('acrescenta a oferta só com o código e não repete a que já existe', () => {
    const documento = exemploDoContrato('inscricao-pelo-sistema');

    const comNova = acrescentarOferta(documento, 'DIREITO_MARABA');
    const repetida = acrescentarOferta(comNova, 'DIREITO_MARABA');

    expect(comNova.distribuicaoVagas?.[1]).toEqual({ ofertaCursoCodigo: 'DIREITO_MARABA' });
    expect(repetida.distribuicaoVagas).toHaveLength(2);
  });

  it('remover a oferta não apaga o número de opções nem a cascata', () => {
    const documento = exemploDoContrato('inscricao-pelo-sistema');

    const editado = removerOferta(documento, 'ENG_CIVIL_MARABA');

    expect(editado.distribuicaoVagas).toEqual([]);
    expect(editado.opcoesDeCurso).toEqual(documento.opcoesDeCurso);
    expect(editado.cascataRemanejamento).toEqual(documento.cascataRemanejamento);
  });

  it('a oferta que saiu do formulário sai do documento e a nova entra no fim', () => {
    const documento = exemploDoContrato('inscricao-pelo-sistema');
    const nova: OfertaDasVagas = {
      ...primeiraOferta(valoresDe(documento)),
      ofertaCodigo: 'DIREITO_MARABA',
      modalidades: [],
    };

    const editado = edicaoDoPasso({ ...valoresDe(documento), ofertas: [nova] })(documento);

    expect(editado.distribuicaoVagas?.map((oferta) => oferta.ofertaCursoCodigo)).toEqual([
      'DIREITO_MARABA',
    ]);
  });

  it('a quantidade declarada entra como número e, sem número, volta a ser calculada', () => {
    const documento = exemploDoContrato('inscricao-pelo-sistema');
    const comQuantidade = (texto: string) => (atual: DocumentoDaConfiguracao) =>
      definirModalidades(atual, 0, [
        { origem: 0, codigo: 'AC', quantidade: texto },
        { origem: 1, codigo: 'LB_PPI', quantidade: '' },
      ]);

    const com = comQuantidade('25')(documento);
    const sem = comQuantidade(' ')(com);

    expect(com.distribuicaoVagas?.[0].modalidades?.[0].quantidadeDeclarada).toBe(25);
    expect(sem.distribuicaoVagas?.[0].modalidades?.[0]).not.toHaveProperty('quantidadeDeclarada');
    expect(sem.distribuicaoVagas?.[0].modalidades?.[0].descricao).toBe('Ampla concorrência');
  });

  it('modalidades de oferta que o documento não tem não mudam nada', () => {
    const documento = exemploDoContrato('inscricao-pelo-sistema');

    expect(
      definirModalidades(documento, 9, [{ origem: null, codigo: 'AC', quantidade: '3' }]),
    ).toEqual(documento);
  });

  it('modalidade que sai leva a quantidade dela; a que fica guarda a sua e a nova entra só com o código', () => {
    const documento = definirModalidades(exemploDoContrato('inscricao-pelo-sistema'), 0, [
      { origem: 0, codigo: 'AC', quantidade: '25' },
    ]);
    const valores = valoresDe(documento);
    const oferta = {
      ...primeiraOferta(valores),
      modalidades: [
        valores.ofertas[0].modalidades[0],
        { origem: null, codigo: 'PCD', rotulo: '', quantidade: '' },
      ],
    };

    const editado = edicaoDoPasso({ ...valores, ofertas: [oferta] })(documento);

    expect(editado.distribuicaoVagas?.[0].modalidades).toEqual([
      { codigo: 'AC', descricao: 'Ampla concorrência', quantidadeDeclarada: 25 },
      { codigo: 'PCD' },
    ]);
  });

  it('devolve intactos o ajuste do quadro e os campos só de leitura da oferta', () => {
    const documento = documentoComAjusteDoQuadro();
    const valores = comOfertaAlterada(valoresDe(documento), { vagasOfertadasBase: '50' });

    const oferta = edicaoDoPasso(valores)(documento).distribuicaoVagas?.[0];

    expect(oferta?.vagasOfertadasBase).toBe(50);
    expect(oferta?.ajusteDoQuadro).toEqual(documento.distribuicaoVagas?.[0].ajusteDoQuadro);
    expect(oferta?.quadro).toEqual(documento.distribuicaoVagas?.[0].quadro);
    expect(oferta?.cursoNome).toBe('Engenharia Civil');
    expect(oferta?.totalDeVagasDoEdital).toBe(40);
  });

  it('lê os destinos fora de ordem na ordem de preferência', () => {
    const documento = exemploDoContrato('inscricao-pelo-sistema');
    const destinos = [
      { modalidadeOrigemCodigo: 'LB_PPI', ordem: 2, modalidadeDestinoCodigo: 'AC' },
      { modalidadeOrigemCodigo: 'LB_PPI', ordem: 1, modalidadeDestinoCodigo: 'LB_Q' },
    ];
    const desordenado = {
      ...documento,
      cascataRemanejamento: { ...documento.cascataRemanejamento, destinos },
    };

    expect(valoresDe(desordenado).cascata?.matriz.ordens).toEqual([
      { origem: 'LB_PPI', destinos: ['LB_Q', 'AC'] },
    ]);
  });

  it('processo sem cascata remove o bloco, e remover o que não existe não muda nada', () => {
    const documento = exemploDoContrato('inscricao-pelo-sistema');
    const semOBloco = edicaoDoPasso({ ...valoresDe(documento), cascata: null })(documento);

    expect(semOBloco).not.toHaveProperty('cascataRemanejamento');
    expect(removerCascata(semOBloco)).toBe(semOBloco);
  });

  it('não altera o documento recebido nem o que o passo não edita', () => {
    const documento = exemploDoContrato('inscricao-pelo-sistema');
    const antes = structuredClone(documento);
    const valores = comOfertaAlterada(valoresDe(documento), { vagasOfertadasBase: '10' });

    const editado = edicaoDoPasso(valores)(documento);

    expect({ ...editado, distribuicaoVagas: undefined }).toEqual({
      ...antes,
      distribuicaoVagas: undefined,
    });
    expect(documento).toEqual(antes);
  });

  it.each(NULOS_EXPLICITOS)('devolve idêntico o %s que é null explícito', (_campo, comNulo) => {
    const documento = documentoComNulo(comNulo);

    expect(idaEVolta(documento)).toEqual(documento);
  });

  it.each(NULOS_EXPLICITOS)('editar outro campo mantém o %s como null', (_campo, comNulo) => {
    const documento = documentoComNulo(comNulo);
    const valores = comOfertaAlterada(valoresDe(documento), { vagasOfertadasBase: '10' });

    const editado = edicaoDoPasso(valores)(documento);

    expect(editado.distribuicaoVagas?.[0]).toEqual({
      ...comNulo(documento.distribuicaoVagas[0]),
      vagasOfertadasBase: 10,
    });
  });

  it('esvaziar o campo que tinha valor tira a chave, e escolher um valor troca o null', () => {
    const documento = exemploDoContrato('inscricao-pelo-sistema');
    const semReferencia = comOfertaAlterada(valoresDe(documento), { referenciaDemografica: null });
    const comNulo = documentoComNulo(NULOS_EXPLICITOS[1][1]);
    const comReferencia = comOfertaAlterada(valoresDe(comNulo), { referenciaDemografica: 'X' });

    expect(edicaoDoPasso(semReferencia)(documento).distribuicaoVagas?.[0]).not.toHaveProperty(
      'referenciaDemograficaCodigo',
    );
    expect(edicaoDoPasso(comReferencia)(comNulo).distribuicaoVagas?.[0]).toHaveProperty(
      'referenciaDemograficaCodigo',
      'X',
    );
  });

  it('esvaziar as modalidades ausentes as mantém ausentes, e só a declaração as registra vazias', () => {
    const documento = acrescentarOferta(documentoSemNada(), 'DIREITO_MARABA');

    const declarado = declararOfertaSemModalidades(documento, 0);

    expect(documento.distribuicaoVagas?.[0]).not.toHaveProperty('modalidades');
    expect(declarado.distribuicaoVagas?.[0]).toEqual({
      ofertaCursoCodigo: 'DIREITO_MARABA',
      modalidades: [],
    });
    expect(idaEVolta(declarado)).toEqual(declarado);
  });

  it('percentual e quantidade com centenas de dígitos saem do documento em vez de virar null', () => {
    const documento = exemploDoContrato('inscricao-pelo-sistema');
    const base = valoresDe(documento);
    const [modalidade, ...demais] = primeiraOferta(base).modalidades;
    const valores = comOfertaAlterada(base, {
      percentualDaReserva: { estado: 'valor', texto: '9'.repeat(400) },
      modalidades: [{ ...modalidade, quantidade: '9'.repeat(400) }, ...demais],
    });

    const oferta = edicaoDoPasso(valores)(documento).distribuicaoVagas?.[0];

    expect(oferta).not.toHaveProperty('percentualDaReservaLegal');
    expect(oferta?.modalidades?.[0]).not.toHaveProperty('quantidadeDeclarada');
  });
});

describe('modalidades com código repetido', () => {
  it('preserva a descrição da sobrevivente', () => {
    const documento = {
      ...documentoSemNada(),
      distribuicaoVagas: [
        {
          ofertaCursoCodigo: 'DIREITO_MARABA',
          modalidades: [
            { codigo: 'AC', descricao: 'primeira' },
            { codigo: 'AC', descricao: 'segunda' },
          ],
        },
      ],
    };
    const valores = valoresDe(documento);
    const oferta = primeiraOferta(valores);
    const editado = edicaoDoPasso(
      comOfertaAlterada(valores, { modalidades: oferta.modalidades.slice(1) }),
    )(documento);
    expect(editado.distribuicaoVagas?.[0].modalidades).toEqual([
      { codigo: 'AC', descricao: 'segunda' },
    ]);
  });
});
