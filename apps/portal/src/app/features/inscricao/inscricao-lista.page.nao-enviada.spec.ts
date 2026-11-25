import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SituacaoInscricaoCodigo } from '@uniplus/shared-data/selecao';

import { MENSAGEM_NAO_ENVIADA, itemDaLista } from './inscricao-lista.model';
import { CenarioDaListaDeInscricoes, inscricao } from './inscricao-lista.page.testing';

const RASCUNHO = SituacaoInscricaoCodigo.RASCUNHO;
const ENVIADA = SituacaoInscricaoCodigo.ENVIADA;
const CANCELADA = SituacaoInscricaoCodigo.CANCELADA;

describe('InscricaoListaPage — rascunho após o encerramento do prazo', () => {
  let cenario: CenarioDaListaDeInscricoes;

  beforeEach(() => {
    cenario = CenarioDaListaDeInscricoes.preparar();
  });

  afterEach(() => cenario.restaurar());

  it('o rascunho com o prazo encerrado é "Não enviada" e traz a mensagem do prazo', async () => {
    await cenario.carregar([inscricao('p1', RASCUNHO, 'Auxílio', false)]);

    const [card] = Array.from(cenario.itens());
    expect(card.querySelector('ui-tag')?.textContent?.trim()).toBe('Não enviada');
    expect(card.textContent).toContain(MENSAGEM_NAO_ENVIADA);
    expect(MENSAGEM_NAO_ENVIADA).toBe(
      'O prazo de inscrições foi encerrado. Como sua inscrição não foi enviada dentro do prazo, ela não foi efetivada e não poderá mais ser concluída.',
    );
  });

  it('não oferece continuar, concluir nem descartar', async () => {
    await cenario.carregar([inscricao('p1', RASCUNHO, 'Auxílio', false)]);

    expect(cenario.rotulosDe(cenario.itens()[0])).toEqual([]);
  });

  it('não oferece ação nem com a API permitindo, por engano, descartar', async () => {
    const item = itemDaLista({
      ...inscricao('p1', RASCUNHO, 'Auxílio', false),
      acoes: {
        podeContinuar: false,
        podeCorrigir: false,
        podeCancelar: false,
        podeDescartar: true,
      },
    });

    expect(item.naoEnviada).toBe(true);
  });

  it('mantém o nome do processo e os cursos escolhidos', async () => {
    const comCurso = {
      ...inscricao('p1', RASCUNHO, 'Auxílio estudantil', false),
      opcoesDeCurso: [{ ordem: 1, cursoNome: 'Medicina', cursoGrau: 'Bacharelado' }],
    };
    await cenario.carregar([comCurso]);

    const texto = cenario.itens()[0].textContent;
    expect(texto).toContain('Auxílio estudantil');
    expect(texto).toContain('Medicina (Bacharelado)');
  });

  it('o rascunho dentro do prazo segue como rascunho e pode continuar', async () => {
    await cenario.carregar([inscricao('p1', RASCUNHO, 'Auxílio', true)]);

    const [card] = Array.from(cenario.itens());
    expect(card.textContent).not.toContain('Não enviada');
    expect(cenario.rotulosDe(card)).toEqual(['Continuar inscrição', 'Descartar rascunho']);
  });

  it('a enviada e a cancelada, com o prazo encerrado, não viram "Não enviada"', async () => {
    await cenario.carregar([
      inscricao('p1', ENVIADA, 'Bolsa', false),
      inscricao('p2', CANCELADA, 'Morada', false),
    ]);

    for (const card of Array.from(cenario.itens())) {
      expect(card.textContent).not.toContain('Não enviada');
      expect(card.textContent).not.toContain(MENSAGEM_NAO_ENVIADA);
    }
  });
});
