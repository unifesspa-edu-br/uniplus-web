import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { recusa } from '../testes';
import { itemDaJanela, janelaDeMigracao } from './janela.testing';
import { abrirJanela, api, botao, linhaDe, presente } from './pagina-da-janela.testing';

const NAO_ENCONTRADA = 'uniplus.autorizacao.revisao_das_concessoes.revisao_nao_encontrada';
const BETINA = itemDaJanela({
  concessaoId: 'c1',
  beneficiarioNome: 'Betina Teste',
  situacao: 'retida',
});
const ABERTA = janelaDeMigracao({ decisoesEnviadas: true, itens: [BETINA] });
const ENCERRADA = janelaDeMigracao({
  situacao: 'encerrada',
  decisoesEnviadas: true,
  itens: [{ ...BETINA, situacao: 'nao_migrada' }],
});

describe('revisão encerrada por outra pessoa durante a ação', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    document.body.innerHTML = '';
  });

  it('a decisão recusada com revisão não encontrada relê a revisão e tira as ações antigas', async () => {
    api.decidirRetida.mockReturnValue(of(recusa(NAO_ENCONTRADA, 404)));
    const { host, responder } = await abrirJanela(ABERTA);

    presente(botao(linhaDe(host, 'c1'), 'Migrar')).click();
    await responder(ENCERRADA);

    expect(host.textContent).toContain('A janela mudou');
    expect(host.textContent).toContain('Não migrada no prazo');
    expect(host.querySelector('cfg-retidas-da-janela')).toBeNull();
    expect(botao(host, 'Migrar')).toBeUndefined();
  });

  it.each([
    ['prazo_encerrado', 422, 'O prazo da revisão das concessões terminou'],
    ['revisao_encerrada', 422, 'A revisão das concessões já terminou'],
    ['revisao_nao_encontrada', 404, 'Revisão das concessões não encontrada'],
    ['revisao_em_encerramento', 409, 'A revisão das concessões está sendo encerrada'],
    ['decisoes_ja_enviadas', 409, 'As decisões já foram enviadas'],
    ['concessao_ja_decidida', 409, 'A concessão já foi decidida'],
  ])('a recusa %s relê a revisão e mantém o aviso', async (codigo, status, titulo) => {
    api.enviarLote.mockReturnValue(
      of(recusa(`uniplus.autorizacao.revisao_das_concessoes.${codigo}`, status)),
    );
    const aberta = janelaDeMigracao({
      itens: [itemDaJanela({ concessaoId: 'c1', ehDoLeitor: true })],
    });
    const { host, responder } = await abrirJanela(aberta);

    presente(botao(host, 'Enviar o lote')).click();
    await responder(ENCERRADA);

    expect(host.textContent).toContain('A janela mudou');
    expect(host.textContent).toContain(titulo);
    expect(botao(host, 'Enviar o lote')).toBeUndefined();
  });
});
