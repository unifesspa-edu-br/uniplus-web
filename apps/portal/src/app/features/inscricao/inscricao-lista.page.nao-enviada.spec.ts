import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  MotivoDasInscricoesFechadasCodigo,
  SituacaoInscricaoCodigo,
} from '@uniplus/shared-data/selecao';

import {
  CenarioDaListaDeInscricoes,
  inscricao,
  rascunhoSemContinuar,
} from './inscricao-lista.page.testing';

const RASCUNHO = SituacaoInscricaoCodigo.RASCUNHO;
const ENVIADA = SituacaoInscricaoCodigo.ENVIADA;
const CANCELADA = SituacaoInscricaoCodigo.CANCELADA;

const MENSAGEM_PRAZO_ENCERRADO =
  'O prazo de inscrições foi encerrado. Como sua inscrição não foi enviada dentro do prazo, ela não foi efetivada e não poderá mais ser concluída.';
const MENSAGEM_NAO_INICIADO =
  'O período de inscrições deste processo seletivo ainda não começou. Você poderá continuar sua inscrição quando ele começar.';
const MENSAGEM_SEM_INSCRICAO =
  'Este processo seletivo não recebe inscrição pelo sistema. Sua inscrição em rascunho não pode ser continuada.';
const MENSAGEM_NEUTRA = 'Não é possível continuar esta inscrição agora.';

interface CasoDeMotivo {
  readonly descricao: string;
  readonly motivo: string | null;
  readonly status: string;
  readonly mensagem: string;
}

const CASOS: readonly CasoDeMotivo[] = [
  {
    descricao: 'período encerrado',
    motivo: MotivoDasInscricoesFechadasCodigo.PERIODO_ENCERRADO,
    status: 'Não enviada',
    mensagem: MENSAGEM_PRAZO_ENCERRADO,
  },
  {
    descricao: 'período não iniciado',
    motivo: MotivoDasInscricoesFechadasCodigo.PERIODO_NAO_INICIADO,
    status: 'Rascunho',
    mensagem: MENSAGEM_NAO_INICIADO,
  },
  {
    descricao: 'processo sem inscrição pelo sistema',
    motivo: MotivoDasInscricoesFechadasCodigo.PROCESSO_SEM_INSCRICAO,
    status: 'Rascunho',
    mensagem: MENSAGEM_SEM_INSCRICAO,
  },
  {
    descricao: 'período não confirmado',
    motivo: MotivoDasInscricoesFechadasCodigo.PERIODO_NAO_CONFIRMADO,
    status: 'Rascunho',
    mensagem: MENSAGEM_NEUTRA,
  },
  { descricao: 'motivo ausente', motivo: null, status: 'Rascunho', mensagem: MENSAGEM_NEUTRA },
  {
    descricao: 'código que a tela não conhece',
    motivo: 'MOTIVO_NOVO_DA_API',
    status: 'Rascunho',
    mensagem: MENSAGEM_NEUTRA,
  },
  {
    descricao: 'código com o nome de um membro de objeto',
    motivo: 'toString',
    status: 'Rascunho',
    mensagem: MENSAGEM_NEUTRA,
  },
];

const COM_CURSO = [{ ordem: 1, cursoNome: 'Medicina', cursoGrau: 'Bacharelado' }];

describe('InscricaoListaPage — rascunho que a API não permite continuar', () => {
  let cenario: CenarioDaListaDeInscricoes;

  beforeEach(() => {
    cenario = CenarioDaListaDeInscricoes.preparar();
  });

  afterEach(() => cenario.restaurar());

  const statusDe = (cartao: Element): string | undefined =>
    cartao.querySelector('ui-tag')?.textContent?.trim();

  const paragrafosDe = (cartao: Element): string[] =>
    Array.from(cartao.querySelectorAll('p:not(.ptl-meta)')).map((p) => p.textContent?.trim() ?? '');

  describe.each(CASOS)('com $descricao', ({ motivo, status, mensagem }) => {
    it('mostra o status e a mensagem do motivo', async () => {
      await cenario.carregar([rascunhoSemContinuar('p1', 'Auxílio', motivo)]);

      const [cartao] = Array.from(cenario.itens());
      expect(statusDe(cartao)).toBe(status);
      expect(paragrafosDe(cartao)).toEqual([mensagem]);
    });

    it('não oferece continuar, concluir nem descartar', async () => {
      await cenario.carregar([rascunhoSemContinuar('p1', 'Auxílio', motivo)]);

      expect(cenario.rotulosDe(cenario.itens()[0])).toEqual([]);
    });

    it('mantém o nome do processo e os cursos escolhidos', async () => {
      const comCurso = {
        ...rascunhoSemContinuar('p1', 'Auxílio estudantil', motivo),
        opcoesDeCurso: COM_CURSO,
      };
      await cenario.carregar([comCurso]);

      const texto = cenario.itens()[0].textContent;
      expect(texto).toContain('Auxílio estudantil');
      expect(texto).toContain('Medicina (Bacharelado)');
    });
  });

  it('só o período encerrado fala em prazo encerrado e em inscrição não efetivada', async () => {
    const outros = CASOS.filter((caso) => caso.status === 'Rascunho');
    await cenario.carregar(
      outros.map((caso, i) => rascunhoSemContinuar(`p${i}`, 'X', caso.motivo)),
    );

    for (const cartao of Array.from(cenario.itens())) {
      expect(cartao.textContent).not.toContain('Não enviada');
      expect(cartao.textContent).not.toContain('encerrado');
      expect(cartao.textContent).not.toContain('efetivada');
    }
  });

  it('oferece descartar o rascunho sem envio quando a API o permite', async () => {
    const semEnvio = {
      ...rascunhoSemContinuar('p1', 'Auxílio', MotivoDasInscricoesFechadasCodigo.PERIODO_ENCERRADO),
      acoes: {
        podeContinuar: false,
        podeCorrigir: false,
        podeCancelar: false,
        podeDescartar: true,
      },
    };
    await cenario.carregar([semEnvio]);

    expect(cenario.rotulosDe(cenario.itens()[0])).toEqual(['Descartar rascunho']);
  });

  it('o rascunho dentro do prazo segue como rascunho, com as ações de continuar e descartar', async () => {
    await cenario.carregar([inscricao('p1', RASCUNHO, 'Auxílio', true)]);

    const [cartao] = Array.from(cenario.itens());
    expect(statusDe(cartao)).toBe('Rascunho');
    expect(paragrafosDe(cartao)).toEqual([
      'Sua inscrição está em rascunho. Conclua e envie dentro do prazo.',
    ]);
    expect(cenario.rotulosDe(cartao)).toEqual(['Continuar inscrição', 'Descartar rascunho']);
  });

  it('a enviada e a cancelada seguem como estão, ainda que a API informe um motivo', async () => {
    const motivo = { codigo: MotivoDasInscricoesFechadasCodigo.PERIODO_ENCERRADO, rotulo: 'x' };
    await cenario.carregar([
      { ...inscricao('p1', ENVIADA, 'Bolsa', false), motivoDasInscricoesFechadas: motivo },
      { ...inscricao('p2', CANCELADA, 'Morada', false), motivoDasInscricoesFechadas: motivo },
    ]);

    const [enviada, cancelada] = Array.from(cenario.itens());
    expect(statusDe(enviada)).toBe('Enviada');
    expect(paragrafosDe(enviada)).toEqual([]);
    expect(statusDe(cancelada)).toBe('Cancelada');
    expect(cancelada.textContent).not.toContain('prazo');
  });

  describe('ordem de leitura', () => {
    const ordemDe = (cartao: Element): string[] => {
      const partes = [
        ['nome', 'h2'],
        ['status', 'ui-tag'],
        ['mensagem', 'p:not(.ptl-meta)'],
        ['cursos', '.inscricao-curso'],
      ];
      return partes
        .map(([nome, seletor]) => ({ nome, no: cartao.querySelector(seletor) as Node }))
        .sort((a, b) =>
          a.no.compareDocumentPosition(b.no) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
        )
        .map(({ nome }) => nome);
    };

    const comCursoEMensagem = () => ({
      ...rascunhoSemContinuar('p1', 'Auxílio', MotivoDasInscricoesFechadasCodigo.PERIODO_ENCERRADO),
      opcoesDeCurso: COM_CURSO,
    });

    it('na lista é nome do processo, status, mensagem e cursos', async () => {
      await cenario.carregar([comCursoEMensagem()]);

      expect(ordemDe(cenario.itens()[0])).toEqual(['nome', 'status', 'mensagem', 'cursos']);
    });

    it('nos cards é nome do processo, status, mensagem e cursos', async () => {
      cenario.escolherVisao('cards');
      await cenario.carregar([comCursoEMensagem()]);

      const cartao = cenario.tela().querySelector('article.card') as Element;
      expect(ordemDe(cartao)).toEqual(['nome', 'status', 'mensagem', 'cursos']);
    });
  });
});
