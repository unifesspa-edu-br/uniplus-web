import { of } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { PERMISSAO } from '@uniplus/shared-auth/bootstrap';
import { ok, recusa } from './testes';
import {
  leituras,
  concedidasAgora,
  COMUM,
  abrir,
  assentar,
  presente,
  reiniciarDuplas,
  abrirOFormulario,
  formularioAberto,
} from './perfis.page.testing';

describe('PerfisPage', () => {
  beforeEach(reiniciarDuplas);

  it('lista os perfis com ligação ao detalhe e sem botão de editar', async () => {
    const { host } = await abrir();

    expect(host.textContent).toContain('Operador de inscrições');
    expect(host.querySelector('a[href="/acessos/perfis/p1"]')).not.toBeNull();
    expect(host.querySelector('button[aria-label^="Editar"]')).toBeNull();
    expect(host.querySelector('tr[data-perfil-id="p2"] button')).toBeNull();
    expect(host.textContent).toContain('Governança');
  });

  it('quem só aprova lê a lista sem o botão Novo perfil', async () => {
    const { host } = await abrir(undefined, [PERMISSAO.autorizacao.perfisAprovarProtecaoDeDados]);

    expect(host.textContent).toContain(COMUM.nome);
    expect(
      [...host.querySelectorAll('button')].some((b) => b.textContent?.trim() === 'Novo perfil'),
    ).toBe(false);
  });

  it('mostra e esconde o botão Novo perfil quando a permissão muda com a página aberta', async () => {
    const { fixture, host } = await abrir(undefined, [
      PERMISSAO.autorizacao.perfisAprovarProtecaoDeDados,
    ]);
    const novo = () => host.querySelector('#cfg-perfis-novo');
    expect(novo()).toBeNull();

    concedidasAgora.set([PERMISSAO.autorizacao.perfisManter]);
    await assentar(fixture);
    expect(novo()).not.toBeNull();

    concedidasAgora.set([]);
    await assentar(fixture);
    expect(novo()).toBeNull();
  });

  it('o botão Novo perfil abre o formulário de perfil novo', async () => {
    const aberta = await abrir();

    const formulario = await abrirOFormulario(aberta);

    expect(formularioAberto(aberta.host)).toBe(true);
    expect(formulario.textContent).toContain('Novo perfil');
  });

  it('com a leitura falha, oferece tentar novamente e relê a lista', async () => {
    const { fixture, host } = await abrir(
      recusa('uniplus.internal.unexpected', 500, 'Erro interno'),
    );
    const tentar = presente(
      [...host.querySelectorAll('button')].find((b) => b.textContent?.includes('Tentar novamente')),
    );
    leituras.perfis.mockReturnValue(of(ok([COMUM])));

    tentar.click();
    await assentar(fixture);

    expect(host.textContent).toContain('Operador de inscrições');
  });
});
