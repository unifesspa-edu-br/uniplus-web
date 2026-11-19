import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PERMISSAO } from '@uniplus/shared-auth/bootstrap';
import { janelaDeMigracao } from './janela.testing';
import {
  GESTAO_DE_ACESSOS,
  PROTECAO_DE_DADOS,
  abrirJanela,
  presente,
} from './pagina-da-janela.testing';

const LINK = 'a[href^="/acessos/perfis/"]';
const JANELA = janelaDeMigracao();

describe('JanelaDaMigracaoPage: link do perfil', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    document.body.innerHTML = '';
  });

  it.each([
    ['quem mantém perfis', PERMISSAO.autorizacao.perfisManter],
    ['quem aprova pela gestão de acessos', GESTAO_DE_ACESSOS],
    ['quem aprova pela proteção de dados', PROTECAO_DE_DADOS],
  ])('mostra o link do perfil a %s', async (_quem, permissao) => {
    const { host } = await abrirJanela(JANELA, [permissao]);

    const link = presente(host.querySelector(LINK));
    expect(link.textContent).toContain('Perfil de acesso');
  });

  it('não mostra o link do perfil a quem não o abre', async () => {
    const { host } = await abrirJanela(JANELA, []);

    expect(host.querySelector(LINK)).toBeNull();
  });

  it('mostra o link quando a permissão é concedida com a página aberta', async () => {
    const concedidas = signal<readonly string[]>([]);
    const { fixture, host, assentar } = await abrirJanela(JANELA, concedidas);
    expect(host.querySelector(LINK)).toBeNull();

    concedidas.set([PROTECAO_DE_DADOS]);
    await assentar();
    fixture.detectChanges();

    expect(host.querySelector(LINK)).not.toBeNull();
  });
});
