import { SituacaoDaMigracao } from '@uniplus/shared-data/autorizacao';
import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { itemDaJanela, janelaDeMigracao } from './janela.testing';
import { abrirJanela } from './pagina-da-janela.testing';

const PROPRIA = { concessaoId: 'c1', beneficiarioNome: 'Rebeca Teste', ehDoLeitor: true };

describe('orientação das concessões do próprio leitor', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    document.body.innerHTML = '';
  });

  it('a retida aguarda outra pessoa da gestão de acessos', async () => {
    const janela = janelaDeMigracao({
      decisoesEnviadas: true,
      itens: [itemDaJanela({ ...PROPRIA, situacao: SituacaoDaMigracao.RETIDA })],
    });
    const { host } = await abrirJanela(janela);

    expect(host.textContent).toContain('decididas por outra pessoa da gestão de acessos');
    expect(host.textContent).not.toContain('outro Representante do controlador');
  });

  it('a que aguarda a proteção de dados aguarda outra pessoa dessa etapa', async () => {
    const janela = janelaDeMigracao({
      decisoesEnviadas: true,
      itens: [
        itemDaJanela({ ...PROPRIA, situacao: SituacaoDaMigracao.AGUARDANDO_PROTECAO_DE_DADOS }),
      ],
    });
    const { host } = await abrirJanela(janela);

    expect(host.textContent).toContain('aguardam a decisão de outro Representante do controlador');
    expect(host.textContent).not.toContain('Retidas: outra pessoa decide');
  });
});
