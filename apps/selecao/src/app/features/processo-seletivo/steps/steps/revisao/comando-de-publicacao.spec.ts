import { describe, expect, it } from 'vitest';

import { DOCUMENTO_ID, atoCompleto, congeladosBase, draftVazio, fase } from './publicacao.testing';
import { comoComandoDePublicacao, mensagensDePublicacao } from './comando-de-publicacao';

describe('comoComandoDePublicacao — ARMADILHA do período (#486)', () => {
  it('com fase de coleta, envia NULL nos dois campos de período mesmo que o rascunho tenha algo digitado', () => {
    const draft = draftVazio();
    draft.cronograma.fases = [
      fase({
        ordem: 1,
        congelados: { ...congeladosBase, coletaInscricao: true },
        inicio: '2027-01-01T00:00:00Z',
        fim: '2027-01-31T23:59:59Z',
      }),
    ];
    draft.publicacao = {
      numero: '001/2027',
      // Preenchido de propósito — o mapeador tem de IGNORAR e mandar null,
      // nunca vazar um valor que o servidor recusaria com 422.
      periodoInscricaoInicio: '2027-05-01T08:00',
      periodoInscricaoFim: '2027-05-10T18:00',
      ato: atoCompleto(),
      anexos: [],
    };

    const comando = comoComandoDePublicacao(draft, DOCUMENTO_ID);

    expect(comando.periodoInscricaoInicio).toBeNull();
    expect(comando.periodoInscricaoFim).toBeNull();
  });

  it('sem fase de coleta, envia os dois campos como instante ISO do fuso institucional', () => {
    const draft = draftVazio();
    draft.publicacao = {
      numero: '',
      periodoInscricaoInicio: '2027-05-01T08:00',
      periodoInscricaoFim: '2027-05-10T18:00',
      ato: atoCompleto(),
      anexos: [],
    };

    const comando = comoComandoDePublicacao(draft, DOCUMENTO_ID);

    expect(comando.periodoInscricaoInicio).not.toBeNull();
    expect(comando.periodoInscricaoInicio).toMatch(/^2027-05-01T08:00:00[+-]\d{2}:\d{2}$/);
    expect(comando.periodoInscricaoFim).toMatch(/^2027-05-10T18:00:00[+-]\d{2}:\d{2}$/);
  });

  it('número vazio vira null; documentoEditalId e ato viajam como informados', () => {
    const draft = draftVazio();
    draft.publicacao = {
      numero: '   ',
      periodoInscricaoInicio: '2027-05-01T08:00',
      periodoInscricaoFim: '2027-05-10T18:00',
      ato: atoCompleto(),
      anexos: [],
    };

    const comando = comoComandoDePublicacao(draft, DOCUMENTO_ID);

    expect(comando.numero).toBeNull();
    expect(comando.documentoEditalId).toBe(DOCUMENTO_ID);
    expect(comando.ato).toEqual({
      orgao: 'Reitoria',
      serie: '1',
      ano: 2027,
      dataPublicacao: '2027-01-15',
      assinante: 'Reitor',
      tipoAtoCodigo: 'PORTARIA',
    });
  });
});

describe('mensagensDePublicacao', () => {
  it('cobra documento, os dois campos de período sem fase de coleta, e cada campo do ato', () => {
    const draft = draftVazio();

    const mensagens = mensagensDePublicacao(draft, null);

    expect(mensagens).toContain(
      'Escolha o documento do edital confirmado que será publicado, na Identificação.',
    );
    expect(mensagens.some((m) => m.includes('início do período'))).toBe(true);
    expect(mensagens.some((m) => m.includes('fim do período'))).toBe(true);
    expect(mensagens.some((m) => m.includes('órgão'))).toBe(true);
    expect(mensagens.some((m) => m.includes('tipo'))).toBe(true);
  });

  it('não cobra período quando há fase de coleta', () => {
    const draft = draftVazio();
    draft.cronograma.fases = [
      fase({ ordem: 1, congelados: { ...congeladosBase, coletaInscricao: true } }),
    ];

    const mensagens = mensagensDePublicacao(draft, DOCUMENTO_ID);

    expect(mensagens.some((m) => m.includes('período'))).toBe(false);
  });

  /**
   * Ano zero atravessava a conferência porque `0` é número válido — e só era recusado pelo
   * servidor, depois de o operador confirmar a publicação num diálogo que exibia "Ano: 0".
   * Publicar é o único clique do wizard que não se desfaz.
   */
  it('cobra o ano do ato quando ele é zero, não só quando está vazio', () => {
    const draft = draftVazio();
    draft.publicacao = {
      numero: '',
      periodoInscricaoInicio: '2027-05-01T08:00',
      periodoInscricaoFim: '2027-05-10T18:00',
      ato: { ...atoCompleto(), ano: '0' },
      anexos: [],
    };

    expect(mensagensDePublicacao(draft, DOCUMENTO_ID)).toContain(
      'Informe o ano do ato de publicação.',
    );
  });

  it('acusa o período de inscrição invertido antes de publicar', () => {
    const draft = draftVazio();
    draft.publicacao = {
      numero: '',
      periodoInscricaoInicio: '2027-05-10T18:00',
      periodoInscricaoFim: '2027-05-01T08:00',
      ato: atoCompleto(),
      anexos: [],
    };

    expect(mensagensDePublicacao(draft, DOCUMENTO_ID)).toContain(
      'O fim do período de inscrição não pode anteceder o início.',
    );
  });

  /** Os limites são de coluna: o nome de um órgão com a hierarquia inteira passa de 200. */
  it('acusa o campo do ato que passa do limite do registro', () => {
    const draft = draftVazio();
    draft.publicacao = {
      numero: 'N'.repeat(61),
      periodoInscricaoInicio: '2027-05-01T08:00',
      periodoInscricaoFim: '2027-05-10T18:00',
      ato: { ...atoCompleto(), orgao: 'O'.repeat(201) },
      anexos: [],
    };

    const mensagens = mensagensDePublicacao(draft, DOCUMENTO_ID);

    expect(mensagens).toContain(
      'O número do ato passa de 60 caracteres, que é o limite do registro.',
    );
    expect(mensagens).toContain(
      'O órgão do ato passa de 200 caracteres, que é o limite do registro.',
    );
  });

  it('vazio quando documento escolhido, ato completo e período preenchido', () => {
    const draft = draftVazio();
    draft.publicacao = {
      numero: '',
      periodoInscricaoInicio: '2027-05-01T08:00',
      periodoInscricaoFim: '2027-05-10T18:00',
      ato: atoCompleto(),
      anexos: [],
    };

    expect(mensagensDePublicacao(draft, DOCUMENTO_ID)).toEqual([]);
  });

  it('barra a publicação com anexo que não foi enviado por completo', () => {
    const draft = draftVazio();
    draft.publicacao = {
      numero: '',
      periodoInscricaoInicio: '2027-05-01T08:00',
      periodoInscricaoFim: '2027-05-10T18:00',
      ato: atoCompleto(),
      anexos: [{ id: 'a', nomeArquivo: 'a.pdf', nome: 'a', progress: 40, fase: 'enviando' }],
    };

    expect(mensagensDePublicacao(draft, DOCUMENTO_ID)).toEqual([
      expect.stringContaining('não foi enviado por completo'),
    ]);
  });
});

describe('comoComandoDePublicacao — anexos', () => {
  it('leva os anexos confirmados com documento e nome de exibição', () => {
    const draft = draftVazio();
    draft.publicacao.anexos = [
      {
        id: 'a',
        nomeArquivo: 'cronograma.pdf',
        nome: ' Cronograma ',
        progress: 100,
        fase: 'confirmado',
        documentoAPublicarId: 'doc-a',
      },
    ];

    expect(comoComandoDePublicacao(draft, DOCUMENTO_ID).anexos).toEqual([
      { documentoId: 'doc-a', nome: 'Cronograma' },
    ]);
  });
});
