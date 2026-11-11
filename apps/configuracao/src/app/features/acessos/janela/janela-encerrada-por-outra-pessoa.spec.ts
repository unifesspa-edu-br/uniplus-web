import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { recusa } from '../testes';
import { itemDaJanela, janelaDeMigracao } from './janela.testing';
import { abrirJanela, api, botao, linhaDe, presente } from './pagina-da-janela.testing';

const NAO_ENCONTRADA = 'uniplus.autorizacao.migracao.janela_nao_encontrada';
const BETINA = itemDaJanela({
  concessaoId: 'c1',
  beneficiarioNome: 'Betina Teste',
  situacao: 'retida',
});
const ABERTA = janelaDeMigracao({ loteEnviado: true, itens: [BETINA] });
const ENCERRADA = janelaDeMigracao({
  situacao: 'encerrada',
  loteEnviado: true,
  itens: [{ ...BETINA, situacao: 'nao_migrada' }],
});

describe('janela encerrada por outra pessoa durante a ação', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    document.body.innerHTML = '';
  });

  it('a decisão recusada com janela não encontrada relê a janela e tira as ações antigas', async () => {
    api.decidirRetida.mockReturnValue(of(recusa(NAO_ENCONTRADA, 404)));
    const { host, responder } = await abrirJanela(ABERTA);

    presente(botao(linhaDe(host, 'c1'), 'Migrar')).click();
    await responder(ENCERRADA);

    expect(host.textContent).toContain('A janela mudou');
    expect(host.textContent).toContain('Não migrada no prazo');
    expect(host.querySelector('cfg-retidas-da-janela')).toBeNull();
    expect(botao(host, 'Migrar')).toBeUndefined();
  });

  it('o envio do lote com janela não encontrada relê a janela', async () => {
    api.enviarLote.mockReturnValue(of(recusa(NAO_ENCONTRADA, 404)));
    const aberta = janelaDeMigracao({
      itens: [itemDaJanela({ concessaoId: 'c1', ehDoLeitor: true })],
    });
    const { host, responder } = await abrirJanela(aberta);

    presente(botao(host, 'Enviar o lote')).click();
    await responder(ENCERRADA);

    expect(host.textContent).toContain('A janela mudou');
    expect(botao(host, 'Enviar o lote')).toBeUndefined();
  });
});
