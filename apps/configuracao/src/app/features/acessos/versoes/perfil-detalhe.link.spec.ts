import type { ComponentFixture } from '@angular/core/testing';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PERMISSAO } from '@uniplus/shared-auth/bootstrap';
import { perfilDoDetalhe, versaoPendente } from './perfis.testing';
import type { PerfilDetalhePage } from './perfil-detalhe.page';
import { ok } from '../testes';
import {
  abrir,
  assentar,
  leitura,
  presente,
  reiniciarDuplas,
  perfilComEncerrada,
} from './perfil-detalhe.testing';

const OUTRO_PERFIL = perfilDoDetalhe({
  id: 'p2',
  versaoPendente: versaoPendente({ versaoId: 'v7' }),
});

function abrirNoLinkDaPendente() {
  const resposta = ok(perfilDoDetalhe({ versaoPendente: versaoPendente() }));
  return abrir(resposta, { versaoId: 'v2' });
}

async function trocarParaOutroLink(fixture: ComponentFixture<PerfilDetalhePage>) {
  leitura.mockReturnValue(of(ok(OUTRO_PERFIL)));
  fixture.componentRef.setInput('id', 'p2');
  fixture.componentRef.setInput('versaoId', 'v7');
  await assentar(fixture);
}

describe('PerfilDetalhePage: link da versão', () => {
  beforeEach(reiniciarDuplas);

  const rolagemOriginal = Element.prototype.scrollIntoView;

  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    Element.prototype.scrollIntoView = rolagemOriginal;
  });

  it.each([
    ['quem aprova', [PERMISSAO.autorizacao.perfisAprovarProtecaoDeDados]],
    ['quem mantém', [PERMISSAO.autorizacao.perfisManter]],
  ])(
    'com a versão pendente, rola até ela e põe o foco no título para %s',
    async (_, concedidas) => {
      const { host } = await abrir(ok(perfilDoDetalhe({ versaoPendente: versaoPendente() })), {
        concedidas,
        versaoId: 'v2',
      });

      const titulo = presente(host.querySelector<HTMLElement>('#cfg-perfil-pendente'));
      expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
      expect(document.activeElement).toBe(titulo);
      expect(host.textContent).toContain('Versão do link aberto');
      expect(host.textContent).not.toContain('A versão do link já não está pendente');
    },
  );

  it('não tira o foco de quem já está noutro controle quando a leitura chega', async () => {
    const outro = document.body.appendChild(document.createElement('button'));
    outro.focus();

    await abrir(ok(perfilDoDetalhe({ versaoPendente: versaoPendente() })), {
      concedidas: [PERMISSAO.autorizacao.perfisManter],
      versaoId: 'v2',
    });

    expect(document.activeElement).toBe(outro);
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('Versão do link aberto');
    outro.remove();
  });

  it('sem versão no link, não move o foco', async () => {
    const { host } = await abrir(ok(perfilDoDetalhe({ versaoPendente: versaoPendente() })));

    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
    expect(host.textContent).not.toContain('Versão do link aberto');
  });

  it('com a versão cancelada, mostra o aviso e o perfil, sem versão pendente', async () => {
    const { host } = await abrir(ok(perfilComEncerrada('cancelada', 2)), {
      versaoId: 'v2',
      concedidas: [PERMISSAO.autorizacao.perfisAprovarProtecaoDeDados],
    });

    expect(host.textContent).toContain('A versão do link já não está pendente');
    expect(host.textContent).toContain('A última versão proposta, a 2, foi cancelada.');
    expect(host.textContent).not.toContain('A última versão proposta não entrou em vigor');
    expect(host.textContent).toContain('Versão em vigor');
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  });

  it('com outra versão pendente, usa o texto neutro', async () => {
    const { host } = await abrir(ok(perfilDoDetalhe({ versaoPendente: versaoPendente() })), {
      versaoId: 'v1-antiga',
    });

    expect(host.textContent).toContain('Abaixo está a situação atual do perfil.');
    expect(host.textContent).toContain('Versão pendente de aprovação');
  });

  it('com a versão do link em vigor e uma proposta posterior recusada, mostra os dois avisos', async () => {
    const { host } = await abrir(ok(perfilComEncerrada('recusada', 2)), {
      versaoId: 'v1',
    });

    expect(host.textContent).toContain('Esta versão foi aprovada e está em vigor.');
    expect(host.textContent).toContain('A última versão proposta não entrou em vigor');
    expect(host.textContent).toContain('A versão 2 foi recusada.');
  });

  it('ao trocar a versão do link na mesma página, rola até a nova versão', async () => {
    const { fixture } = await abrirNoLinkDaPendente();
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1);

    await trocarParaOutroLink(fixture);

    expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(2);
  });

  it('ao trocar a versão do link na mesma página, leva o foco ao título da nova versão', async () => {
    const { fixture, host } = await abrirNoLinkDaPendente();

    await trocarParaOutroLink(fixture);

    expect(document.activeElement).toBe(host.querySelector('#cfg-perfil-pendente'));
  });
});
