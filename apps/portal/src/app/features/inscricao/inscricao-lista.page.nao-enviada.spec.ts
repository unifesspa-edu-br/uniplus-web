import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SituacaoInscricaoCodigo } from '@uniplus/shared-data/selecao';

import { MENSAGEM_NAO_ENVIADA } from './inscricao-lista.model';
import { CenarioDaListaDeInscricoes, inscricao } from './inscricao-lista.page.testing';

const RASCUNHO = SituacaoInscricaoCodigo.RASCUNHO;
const ENVIADA = SituacaoInscricaoCodigo.ENVIADA;
const CANCELADA = SituacaoInscricaoCodigo.CANCELADA;

describe('InscricaoListaPage — rascunho que a API não permite continuar', () => {
  let cenario: CenarioDaListaDeInscricoes;

  beforeEach(() => {
    cenario = CenarioDaListaDeInscricoes.preparar();
  });

  afterEach(() => cenario.restaurar());

  it('o rascunho sem permissão de continuar é "Não enviada" e traz a mensagem de que não pode ser continuado', async () => {
    await cenario.carregar([inscricao('p1', RASCUNHO, 'Auxílio', false)]);

    const [cartao] = Array.from(cenario.itens());
    expect(cartao.querySelector('ui-tag')?.textContent?.trim()).toBe('Não enviada');
    expect(cartao.textContent).toContain(MENSAGEM_NAO_ENVIADA);
    expect(MENSAGEM_NAO_ENVIADA).toBe('Este rascunho não pode mais ser continuado.');
  });

  it('não oferece continuar, concluir nem descartar', async () => {
    await cenario.carregar([inscricao('p1', RASCUNHO, 'Auxílio', false)]);

    expect(cenario.rotulosDe(cenario.itens()[0])).toEqual([]);
  });

  it('oferece descartar o rascunho sem envio quando a API o permite', async () => {
    const semEnvio = {
      ...inscricao('p1', RASCUNHO, 'Auxílio', false),
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

  it('o rascunho com permissão de continuar segue como rascunho', async () => {
    await cenario.carregar([inscricao('p1', RASCUNHO, 'Auxílio', true)]);

    const [cartao] = Array.from(cenario.itens());
    expect(cartao.textContent).not.toContain('Não enviada');
    expect(cenario.rotulosDe(cartao)).toEqual(['Continuar inscrição', 'Descartar rascunho']);
  });

  it('a enviada e a cancelada, sem permissão de continuar, não viram "Não enviada"', async () => {
    await cenario.carregar([
      inscricao('p1', ENVIADA, 'Bolsa', false),
      inscricao('p2', CANCELADA, 'Morada', false),
    ]);

    for (const cartao of Array.from(cenario.itens())) {
      expect(cartao.textContent).not.toContain('Não enviada');
      expect(cartao.textContent).not.toContain(MENSAGEM_NAO_ENVIADA);
    }
  });
});
