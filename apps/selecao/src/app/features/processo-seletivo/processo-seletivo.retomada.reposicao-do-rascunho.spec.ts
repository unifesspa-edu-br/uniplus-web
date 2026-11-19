import { TestBed } from '@angular/core/testing';
import { errorResult, mockProblemDetails } from '@uniplus/shared-core/http';
import { PublicacaoDoProcessoApi } from '@uniplus/shared-data/selecao';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { VERSAO_DO_RASCUNHO } from './wizard/shared/rascunho-da-publicacao';
import {
  PROCESSO_ID,
  MONTAGEM_LENTA,
  rascunhoGuardado,
  montar,
  propagar,
} from './processo-seletivo.retomada.testing';

describe('ProcessoSeletivoPage — reposição do rascunho da publicação', MONTAGEM_LENTA, () => {
  beforeEach(() => TestBed.resetTestingModule());

  /**
   * O defeito que motivou a entrega: o operador transcreve sete campos do Diário Oficial e um
   * recarregamento os apaga. Antes desta rota, `publicacao` voltava vazia de qualquer retomada.
   */
  it('repõe o bloco do ato ao reabrir o processo por endereço', async () => {
    const cenario = montar({
      obterRascunho: rascunhoGuardado({
        numero: '07/2027',
        periodoInscricaoInicio: '',
        periodoInscricaoFim: '',
        ato: {
          orgao: 'REITORIA',
          serie: 'EDITAL',
          ano: '2027',
          dataDoAto: '2027-01-15',
          assinante: 'Reitor',
          tipoAtoCodigo: 'EDITAL_ABERTURA',
        },
      }),
    });
    await propagar();

    const publicacao = cenario.store.draft().publicacao;
    expect(publicacao.numero).toBe('07/2027');
    expect(publicacao.ato.orgao).toBe('REITORIA');
    expect(publicacao.ato.assinante).toBe('Reitor');
    expect(cenario.componente.rascunhoSalvoEm()).toBe('2026-09-14T14:32:00Z');
  });

  /** A hora do rascunho é a do certame, e não a do relógio de quem o grava. */
  it('mostra a hora em que o rascunho foi salvo no fuso institucional', async () => {
    const cenario = montar({ obterRascunho: rascunhoGuardado({ numero: '07/2027' }) });
    await propagar();

    cenario.store.goTo(cenario.store.totalDePassos - 1);
    cenario.fixture.detectChanges();

    expect(cenario.host.querySelector('.rascunho-publicacao__carimbo')?.textContent?.trim()).toBe(
      'Rascunho salvo às 11:32',
    );
  });

  /**
   * `projetarSecao` é patch raso e a seção tem QUATRO chaves de topo. Repor só `ato` deixaria
   * `numero` e o par de período do processo ANTERIOR em tela — o vazamento entre processos que
   * a limpeza do editor existe para impedir.
   */
  it('repõe as quatro chaves da seção, e não só o ato', async () => {
    const cenario = montar({ obterRascunho: rascunhoGuardado({ ato: { orgao: 'REITORIA' } }) });
    await propagar();

    const publicacao = cenario.store.draft().publicacao;
    expect(publicacao.numero).toBe('');
    expect(publicacao.periodoInscricaoInicio).toBe('');
    expect(publicacao.periodoInscricaoFim).toBe('');
    expect(publicacao.ato.orgao).toBe('REITORIA');
  });

  /**
   * Meio preenchido com campos de um formato que a tela não entende é pior que vazio: o
   * operador publicaria acreditando ter conferido.
   */
  it('descarta com aviso o rascunho de outro formato, em vez de reidratá-lo', async () => {
    const cenario = montar({
      obterRascunho: rascunhoGuardado({ ato: { orgao: 'REITORIA' } }, VERSAO_DO_RASCUNHO - 1),
    });
    await propagar();

    expect(cenario.store.draft().publicacao.ato.orgao).toBe('');
    expect(cenario.componente.avisoDoRascunho()).toContain('formato anterior');
  });

  /**
   * Falha não é ausência. Um 500 passageiro deixava o editor abrir em branco e calado, e
   * gravar dali substituía um rascunho que o operador nunca viu.
   */
  it('avisa quando não conseguiu ler o rascunho, em vez de abrir em branco calado', async () => {
    const cenario = montar({
      obterRascunho: vi.fn(() => of(errorResult(mockProblemDetails({ status: 500 })))),
    });
    await propagar();

    expect(cenario.componente.avisoDoRascunho()).toContain('Recarregue antes de salvar');
  });

  /** Não ter rascunho é o caso comum — e não merece aviso nenhum. */
  it('abre sem aviso quando não há rascunho guardado', async () => {
    const cenario = montar();
    await propagar();

    expect(cenario.componente.avisoDoRascunho()).toBeNull();
    expect(cenario.componente.rascunhoSalvoEm()).toBeNull();
    expect(cenario.store.draft().publicacao.ato.orgao).toBe('');
  });

  /**
   * A invariante que impede o conserto de virar o defeito: `retomar()` limpa o editor ANTES de
   * hidratar, e uma gravação disparada nessa limpeza apagaria no servidor exatamente o que ela
   * ia buscar em seguida.
   */
  it('retomar não grava nada — só lê', async () => {
    const salvar = vi.fn();
    const descartar = vi.fn();
    const cenario = montar({ obterRascunho: rascunhoGuardado({ ato: { orgao: 'REITORIA' } }) });
    const api = TestBed.inject(PublicacaoDoProcessoApi) as unknown as Record<string, unknown>;
    api['salvarRascunhoDaPublicacao'] = salvar;
    api['descartarRascunhoDaPublicacao'] = descartar;

    await propagar();

    expect(salvar).not.toHaveBeenCalled();
    expect(descartar).not.toHaveBeenCalled();
    expect(cenario.obterRascunho).toHaveBeenCalledWith(PROCESSO_ID);
  });
});
