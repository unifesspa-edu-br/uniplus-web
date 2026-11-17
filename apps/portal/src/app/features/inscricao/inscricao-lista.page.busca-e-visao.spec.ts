import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  CenarioDaListaDeInscricoes,
  CHAVE_DA_VISAO,
  INSCRICOES,
} from './inscricao-lista.page.testing';

describe('InscricaoListaPage', () => {
  let cenario: CenarioDaListaDeInscricoes;

  beforeEach(() => {
    cenario = CenarioDaListaDeInscricoes.preparar();
  });

  afterEach(() => cenario.restaurar());

  it('exibe estado vazio sem filtro quando não há inscrições', async () => {
    await cenario.carregar([]);

    expect(cenario.tela().textContent).toContain('Não há inscrições cadastradas.');
  });

  it('busca sem resultado exibe estado vazio filtrado', async () => {
    await cenario.carregar(INSCRICOES);

    cenario.buscar('xyzzy-nao-existe-em-nenhum-registro');

    expect(cenario.tela().textContent).toContain('Nenhuma inscrição encontrada.');
    expect(cenario.tela().textContent).toContain('todas as inscrições');
  });

  it('busca normaliza acento: "Auxilio" encontra "Auxílio estudantil 2026"', async () => {
    await cenario.carregar(INSCRICOES);

    cenario.buscar('Auxilio');

    expect(cenario.itens().length).toBeGreaterThan(0);
    expect(cenario.tela().textContent).not.toContain('Nenhuma inscrição encontrada.');
  });

  it('busca normaliza maiúscula: "MORADA" encontra "Morada estudantil"', async () => {
    await cenario.carregar(INSCRICOES);

    cenario.buscar('MORADA');

    expect(cenario.itens().length).toBeGreaterThan(0);
  });

  it('"Limpar" redefine a busca e exibe todas as inscrições', async () => {
    await cenario.carregar(INSCRICOES);

    cenario.buscar('nao-existe');
    expect(cenario.tela().textContent).toContain('Nenhuma inscrição encontrada.');

    cenario.botao('Limpar')?.click();
    cenario.fixture.detectChanges();

    expect(cenario.itens().length).toBe(INSCRICOES.length);
  });

  it('abaixo de 600px trava a visualização em lista e oculta o controle de alternância', async () => {
    await cenario.carregar(INSCRICOES);

    const estreita = await cenario.abrirEmTelaEstreita();
    cenario.escolherVisao('cards', estreita);

    expect(cenario.visaoEfetiva(estreita)).toBe('lista');
    expect((estreita.nativeElement as HTMLElement).querySelector('ui-segmented')).toBeNull();
  });

  it('lembra a visão escolhida entre visitas (localStorage)', async () => {
    await cenario.carregar(INSCRICOES);

    cenario.escolherVisao('cards');

    expect(localStorage.getItem(CHAVE_DA_VISAO)).toBe('cards');
  });
});
