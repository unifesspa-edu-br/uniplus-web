import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SituacaoInscricaoCodigo } from '@uniplus/shared-data/selecao';

import { itemDaLista } from './inscricao-lista.model';
import { CenarioDaListaDeInscricoes, INSCRICOES, inscricao } from './inscricao-lista.page.testing';

describe('InscricaoListaPage', () => {
  let cenario: CenarioDaListaDeInscricoes;

  beforeEach(() => {
    cenario = CenarioDaListaDeInscricoes.preparar();
  });

  afterEach(() => cenario.restaurar());

  it('inscrição em rascunho exibe "Continuar inscrição" com variante primary', async () => {
    await cenario.carregar(INSCRICOES);

    const btn = cenario.botao('Continuar inscrição', cenario.itens()[0]);
    expect(btn?.textContent?.trim()).toContain('Continuar inscrição');
    // variant 'primary' não adiciona classe extra — ausência de btn--tertiary comprova
    expect(btn?.classList.contains('btn--tertiary')).toBe(false);
  });

  it('inscrição enviada exibe "Ver comprovante" e abre o último comprovante, pelo número que a API informa', async () => {
    await cenario.carregar(INSCRICOES);
    const navegar = cenario.espiarNavegacao();

    const btn = cenario.botao('Ver comprovante', cenario.itens()[1]);
    expect(btn).toBeTruthy();
    btn?.click();

    expect(navegar).toHaveBeenCalledWith(['/inscricao', 'comprovante', 'i-p2', 3]);
  });

  it('as ações vêm das permissões da API: enviada com as inscrições abertas, rascunho e encerrada', async () => {
    await cenario.carregar([
      inscricao('p1', SituacaoInscricaoCodigo.RASCUNHO, 'Auxílio'),
      inscricao('p2', SituacaoInscricaoCodigo.ENVIADA, 'Bolsa'),
      inscricao('p3', SituacaoInscricaoCodigo.ENVIADA, 'Morada', false),
      inscricao('p4', SituacaoInscricaoCodigo.RASCUNHO, 'Auxílio transporte', false),
    ]);

    const itens = cenario.itens();
    expect(cenario.rotulosDe(itens[0])).toEqual(['Continuar inscrição', 'Descartar rascunho']);
    expect(cenario.rotulosDe(itens[1])).toEqual([
      'Corrigir dados',
      'Ver comprovante',
      'Cancelar inscrição',
    ]);
    expect(cenario.rotulosDe(itens[2])).toEqual(['Ver comprovante']);
    expect(cenario.rotulosDe(itens[3])).toEqual([]);
  });

  it('sem número de comprovante da API, a cancelada mostra só os dados básicos, sem "Ver comprovante", e a nova do mesmo processo aparece ao lado, cada uma com a sua chave', async () => {
    const cancelada = {
      ...inscricao('p1', SituacaoInscricaoCodigo.CANCELADA, 'Medicina 2027'),
      inscricaoId: 'i-velha',
      canceladaEm: '2026-12-13T12:00:00Z',
      motivoDoCancelamento: 'Mudei de curso',
    };
    const nova = {
      ...inscricao('p1', SituacaoInscricaoCodigo.RASCUNHO, 'Medicina 2027'),
      inscricaoId: 'i-nova',
    };
    await cenario.carregar([cancelada, nova]);

    const itens = cenario.itens();
    expect(itens.length).toBe(2);
    expect(itens[0].textContent).toContain('Cancelada');
    expect(itens[0].textContent).toContain('Motivo: Mudei de curso');
    expect(cenario.rotulosDe(itens[0])).toEqual([]);
    expect(cenario.rotulosDe(itens[1])).toEqual(['Continuar inscrição', 'Descartar rascunho']);
  });

  it('Corrigir dados abre o formulário do processo', async () => {
    await cenario.carregar(INSCRICOES);
    const navegar = cenario.espiarNavegacao();

    cenario.clicarNoItem(1, 'Corrigir dados');

    expect(navegar).toHaveBeenCalledWith(['/inscricao', 'p2']);
  });

  it('a ação que desfaz a inscrição sai depois das demais, em botão próprio', async () => {
    await cenario.carregar([
      inscricao('p2', SituacaoInscricaoCodigo.ENVIADA, 'Bolsa de iniciação científica'),
    ]);

    const item = cenario.itens()[0];
    expect(cenario.rotulosDe(item)).toEqual([
      'Corrigir dados',
      'Ver comprovante',
      'Cancelar inscrição',
    ]);
    expect(item.querySelector('.inscricao-acao-destrutiva')?.textContent?.trim()).toBe(
      'Cancelar inscrição',
    );
  });

  it('sem edição a seguir, ver o comprovante é a ação principal', async () => {
    await cenario.carregar([
      inscricao('p2', SituacaoInscricaoCodigo.ENVIADA, 'Bolsa de iniciação científica', false),
    ]);

    const botao = cenario.tela().querySelector('li.inscricao-lista-item ui-button button');
    expect(botao?.textContent?.trim()).toBe('Ver comprovante');
    expect(botao?.classList.contains('btn--tertiary')).toBe(false);
  });

  it('clique no botão de ação chama executar com a ação e a inscrição corretas', async () => {
    await cenario.carregar(INSCRICOES);
    cenario.espiarNavegacao();
    const executar = cenario.espiarExecutar();

    cenario.botao('Continuar inscrição')?.click();

    expect(executar).toHaveBeenCalledOnce();
    expect(executar).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: 'continuar' }),
      itemDaLista(INSCRICOES[0]),
    );
  });

  it('títulos de inscrição são h2 (não pula nível de h1)', async () => {
    await cenario.carregar(INSCRICOES);

    const titulos = cenario.tela().querySelectorAll('h2.inscricao-lista-item__titulo');
    expect(titulos.length).toBeGreaterThan(0);
    expect(cenario.tela().querySelector('h3.inscricao-lista-item__titulo')).toBeNull();
  });
});
