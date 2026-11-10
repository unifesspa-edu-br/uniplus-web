import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ok } from '../testes';
import { itemDaJanela, janelaDeMigracao } from './janela.testing';
import { abrirJanela, api, botao, linhaDe, presente } from './pagina-da-janela.testing';

const PROPRIA = itemDaJanela({
  concessaoId: 'c3',
  beneficiarioNome: 'Rebeca Teste',
  ehDoLeitor: true,
});

describe('lote em que todas as concessões são de quem envia', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    document.body.innerHTML = '';
  });

  it('oferece o envio da lista vazia, sem pedir confirmação de exclusão', async () => {
    const janela = janelaDeMigracao({ itens: [PROPRIA] });
    api.enviarLote.mockReturnValue(of(ok(janela)));
    const { host, responder } = await abrirJanela(janela);

    expect(host.textContent).toContain('Enviar o lote retém as suas');
    expect(linhaDe(host, 'c3').querySelector('input')).toBeNull();
    presente(botao(host, 'Enviar o lote')).click();
    await responder(janelaDeMigracao({ itens: [PROPRIA], loteEnviado: true }));

    expect(host.querySelector('cfg-exclusao-dialog dialog')?.hasAttribute('open')).toBe(false);
    expect(api.enviarLote).toHaveBeenCalledWith(
      janela.perfilId,
      { decisoes: [], confirmacaoDeExclusao: false },
      expect.anything(),
    );
  });

  it('sem nenhuma concessão para o lote, não oferece o envio', async () => {
    const { host } = await abrirJanela(janelaDeMigracao({ itens: [] }));

    expect(host.textContent).toContain('Nenhuma concessão aguarda o lote.');
    expect(botao(host, 'Enviar o lote')).toBeUndefined();
  });
});
