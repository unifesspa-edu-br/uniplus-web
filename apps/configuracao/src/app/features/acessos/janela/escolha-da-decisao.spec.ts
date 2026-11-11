import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { itemDaJanela, janelaDeMigracao } from './janela.testing';
import { abrirJanela, linhaDe, presente } from './pagina-da-janela.testing';

const BETINA = itemDaJanela({ concessaoId: 'c1', beneficiarioNome: 'Betina Teste' });
const LEANDRO = itemDaJanela({
  concessaoId: 'c2',
  beneficiarioNome: 'Leandro Teste',
  situacao: 'aguardando_protecao_de_dados',
  exigeProtecaoDeDados: true,
});

function grupoDe(linha: HTMLElement): HTMLFieldSetElement {
  return presente(linha.querySelector('fieldset'));
}

/** O fieldset sem `role` explícito é o grupo, e a primeira `legend` filha dá o nome acessível. */
const nomeDoGrupo = (grupo: HTMLFieldSetElement): string | undefined =>
  grupo.querySelector(':scope > legend')?.textContent?.trim();

describe('grupo de escolha da decisão', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    document.body.innerHTML = '';
  });

  it('no lote, o grupo mantém a semântica do fieldset e é nomeado pela pessoa', async () => {
    const { host } = await abrirJanela(janelaDeMigracao({ itens: [BETINA] }));

    const grupo = grupoDe(linhaDe(host, 'c1'));
    expect(grupo.hasAttribute('role')).toBe(false);
    expect(nomeDoGrupo(grupo)).toBe('Decisão para Betina Teste');
  });

  it('na proteção de dados, o grupo mantém a semântica do fieldset e é nomeado pela pessoa', async () => {
    const { host } = await abrirJanela(janelaDeMigracao({ loteEnviado: true, itens: [LEANDRO] }));

    const grupo = grupoDe(linhaDe(host, 'c2'));
    expect(grupo.hasAttribute('role')).toBe(false);
    expect(nomeDoGrupo(grupo)).toBe('Decisão para Leandro Teste');
  });
});
