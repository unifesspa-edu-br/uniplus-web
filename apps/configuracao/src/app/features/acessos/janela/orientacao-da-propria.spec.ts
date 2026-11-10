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
      loteEnviado: true,
      itens: [itemDaJanela({ ...PROPRIA, situacao: 'retida' })],
    });
    const { host } = await abrirJanela(janela);

    expect(host.textContent).toContain('decididas por outra pessoa da gestão de acessos');
    expect(host.textContent).not.toContain('outra pessoa da proteção de dados');
  });

  it('a que aguarda a proteção de dados aguarda outra pessoa dessa etapa', async () => {
    const janela = janelaDeMigracao({
      loteEnviado: true,
      itens: [itemDaJanela({ ...PROPRIA, situacao: 'aguardando_protecao_de_dados' })],
    });
    const { host } = await abrirJanela(janela);

    expect(host.textContent).toContain('aguardam a decisão de outra pessoa da proteção de dados');
    expect(host.textContent).not.toContain('Retidas: outra pessoa decide');
  });
});
