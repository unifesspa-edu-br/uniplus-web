import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { type DecisaoDaProtecaoDto } from '@uniplus/shared-data/configuracao';
import { type MockInstance, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  URL_DA_FILA,
  URL_DAS_DECISOES,
  botaoPorTexto,
  clicar,
  detalheDoLaudo,
  laudo,
  montarPagina,
  problema,
  type PaginaMontada,
} from './protecao-do-catalogo.testing';
import {
  TEXTO_TENTANDO,
  situacaoDoBotao,
} from '../../shared/foco/situacao-da-nova-tentativa.testing';

const APROVAR = 'configuracao:protecao-do-catalogo:aprovar';
const ERRO_INTERNO = problema(500, 'uniplus.erro_interno', 'Erro interno');

const decisao: DecisaoDaProtecaoDto = {
  cadastro: 'TIPO_DOCUMENTO',
  itemId: laudo.id,
  itemCodigo: laudo.codigo,
  itemNome: laudo.nome,
  ato: 'REPROVACAO',
  instante: '2026-10-31T13:00:00Z',
  atorNome: 'Caroline Ribeiro',
  classificacaoProtecao: 'INTERNO',
  hipoteseLegal: 'EXECUCAO_POLITICAS_PUBLICAS',
  finalidadeTratamento: 'Conferir o laudo.',
  classificacaoRecomendada: null,
  justificativa: 'Falta a base legal.',
};

describe('Aba Decisões — leitura, nova tentativa e foco', () => {
  let pagina: PaginaMontada;
  let avisoDeErro: MockInstance<NotificationService['errorFromProblem']>;

  const pedidoDaLista = () => pagina.controller.expectOne((r) => r.url === URL_DAS_DECISOES);
  const pedidoDoHistorico = () =>
    pagina.controller.expectOne(`${URL_DA_FILA}/tipos-documento/${laudo.id}`);
  const aguardarARota = async (): Promise<void> => {
    await new Promise((resolver) => setTimeout(resolver, 0));
    await pagina.assentar();
    await pagina.assentar();
  };

  beforeEach(async () => {
    pagina = montarPagina([APROVAR]);
    avisoDeErro = vi.spyOn(TestBed.inject(NotificationService), 'errorFromProblem');
    await pagina.carregarFila([]);
    await TestBed.inject(Router).navigateByUrl('/?aba=decisoes');
    await aguardarARota();
  });

  afterEach(() => pagina.encerrar());

  it('erro do servidor na leitura avisa uma vez e a recusa 4xx fica só no alerta', async () => {
    pedidoDaLista().flush(...ERRO_INTERNO);
    await pagina.assentar();
    expect(avisoDeErro).toHaveBeenCalledTimes(1);

    clicar(botaoPorTexto(pagina.tela, 'Tentar novamente'));
    await pagina.assentar();
    pedidoDaLista().flush(...problema(403, 'uniplus.auth.proibido', 'Sem permissão'));
    await pagina.assentar();

    expect(avisoDeErro).toHaveBeenCalledTimes(1);
    expect(pagina.tela.textContent).toContain('Sem permissão');
  });

  it('"Tentar novamente" fica ocupado durante a carga e, se der certo, leva o foco ao título', async () => {
    pedidoDaLista().flush(...ERRO_INTERNO);
    await pagina.assentar();
    const tentar = botaoPorTexto(pagina.tela, 'Tentar novamente');
    tentar.focus();
    clicar(tentar);
    await pagina.assentar();

    expect(tentar.getAttribute('aria-disabled')).toBe('true');
    expect(tentar.getAttribute('aria-busy')).toBe('true');
    expect(situacaoDoBotao(tentar)).toBe(TEXTO_TENTANDO);
    expect(tentar.matches(':disabled')).toBe(false);
    expect(document.activeElement).toBe(tentar);
    clicar(tentar);
    await pagina.assentar();

    pedidoDaLista().flush([decisao]);
    await pagina.assentar();
    await pagina.assentar();

    expect(document.activeElement).toBe(pagina.tela.querySelector('#cfg-decisoes-titulo'));
  });

  describe('histórico da decisão', () => {
    beforeEach(async () => {
      pedidoDaLista().flush([decisao]);
      await pagina.assentar();
      clicar(pagina.tela.querySelector('tbody .table-responsive__alvo'), 'a linha');
      await pagina.assentar();
    });

    it('"Tentar novamente" leva o foco à região dos dados da decisão quando dá certo', async () => {
      pedidoDoHistorico().flush(...ERRO_INTERNO);
      await pagina.assentar();
      const painel = pagina.tela.querySelector(
        'dialog[aria-label="Detalhe da decisão"]',
      ) as Element;
      const tentar = botaoPorTexto(painel, 'Tentar novamente');
      tentar.focus();
      clicar(tentar);
      await pagina.assentar();
      await pagina.assentar();
      expect(tentar.getAttribute('aria-disabled')).toBe('true');
      expect(tentar.getAttribute('aria-busy')).toBe('true');
      expect(document.activeElement).toBe(tentar);

      pedidoDoHistorico().flush(detalheDoLaudo);
      await pagina.assentar();
      await pagina.assentar();

      expect(document.activeElement?.id).toBe('cfg-decisao-dados');
    });

    it('erro do servidor na leitura do histórico avisa uma vez', async () => {
      pedidoDoHistorico().flush(...ERRO_INTERNO);
      await pagina.assentar();

      expect(avisoDeErro).toHaveBeenCalledTimes(1);
    });

    it.each([403, 404])('recusa %i na leitura do histórico não vira aviso', async (status) => {
      pedidoDoHistorico().flush(...problema(status, 'uniplus.recusa', 'Recusa'));
      await pagina.assentar();

      expect(avisoDeErro).not.toHaveBeenCalled();
    });

    it('falha que se repete mantém o botão e o foco', async () => {
      pedidoDoHistorico().flush(...ERRO_INTERNO);
      await pagina.assentar();
      const painel = pagina.tela.querySelector(
        'dialog[aria-label="Detalhe da decisão"]',
      ) as Element;
      const tentar = botaoPorTexto(painel, 'Tentar novamente');
      tentar.focus();
      clicar(tentar);
      await pagina.assentar();
      await pagina.assentar();

      pedidoDoHistorico().flush(...ERRO_INTERNO);
      await pagina.assentar();
      await pagina.assentar();

      expect(document.activeElement).toBe(tentar);
      expect(tentar.getAttribute('aria-disabled')).toBeNull();
    });
  });
});
