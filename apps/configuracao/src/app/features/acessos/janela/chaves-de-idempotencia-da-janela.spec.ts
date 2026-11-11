import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { IDEMPOTENCY_KEY_TOKEN } from '@uniplus/shared-core/idempotency';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ok, recusa } from '../testes';
import { itemDaJanela, janelaDeMigracao } from './janela.testing';
import { abrirJanela, api, botao, linhaDe, presente } from './pagina-da-janela.testing';

const BETINA = itemDaJanela({
  concessaoId: 'c1',
  beneficiarioNome: 'Betina Teste',
  situacao: 'retida',
});
const LEANDRO = itemDaJanela({
  concessaoId: 'c2',
  beneficiarioNome: 'Leandro Teste',
  situacao: 'retida',
});
const DEPOIS_DO_LOTE = janelaDeMigracao({ loteEnviado: true, itens: [BETINA, LEANDRO] });
const SEM_RESPOSTA = () => of(recusa('uniplus.client.network_error', 0));
const RECUSADA = () => of(recusa('uniplus.autorizacao.migracao.concessao_propria', 422));

const chaveDa = (chamada: number): unknown =>
  api.decidirRetida.mock.calls[chamada]?.[3].get(IDEMPOTENCY_KEY_TOKEN);

describe('chaves de idempotência da janela', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    document.body.innerHTML = '';
  });

  it('depois de falha de rede, repete o mesmo comando sob a mesma chave', async () => {
    api.decidirRetida.mockImplementationOnce(SEM_RESPOSTA).mockImplementationOnce(RECUSADA);
    const { host, assentar } = await abrirJanela(DEPOIS_DO_LOTE);

    presente(botao(linhaDe(host, 'c1'), 'Migrar')).click();
    await assentar();
    presente(botao(linhaDe(host, 'c1'), 'Migrar')).click();
    await assentar();

    expect(api.decidirRetida).toHaveBeenCalledTimes(2);
    expect(chaveDa(1)).toBe(chaveDa(0));
  });

  it('outra ação entre a falha de rede e a nova tentativa não descarta a chave da primeira', async () => {
    api.decidirRetida
      .mockImplementationOnce(SEM_RESPOSTA)
      .mockImplementationOnce(RECUSADA)
      .mockImplementationOnce(() => of(ok(DEPOIS_DO_LOTE)));
    const { host, assentar, responder } = await abrirJanela(DEPOIS_DO_LOTE);

    presente(botao(linhaDe(host, 'c1'), 'Migrar')).click();
    await assentar();
    presente(botao(linhaDe(host, 'c2'), 'Migrar')).click();
    await assentar();
    presente(botao(linhaDe(host, 'c1'), 'Migrar')).click();
    await responder(DEPOIS_DO_LOTE);

    expect(chaveDa(1)).not.toBe(chaveDa(0));
    expect(chaveDa(2)).toBe(chaveDa(0));
    expect(api.decidirRetida.mock.calls[2]?.[1]).toBe('c1');
  });
});
