import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { IDEMPOTENCY_KEY_TOKEN } from '@uniplus/shared-core/idempotency';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ok, recusa } from '../testes';
import {
  PROTECAO,
  abrirPerfil,
  api,
  assentar,
  botao,
  leituras,
  notificacoes,
  presente,
} from './contencao-do-perfil.testing';
import { perfilDoDetalhe } from './perfis.testing';

const SUSPENSO = perfilDoDetalhe({
  suspensao: {
    desde: '2026-11-09T15:00:00Z',
    papelDeQuemSuspendeu: 'gestao_de_acessos',
    etapasExigidasAgora: ['gestao_de_acessos'],
    etapasDecididas: [],
  },
});

describe('suspender o perfil', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.resetTestingModule();
  });

  async function suspender(
    fixture: Parameters<typeof assentar>[0],
    host: HTMLElement,
    motivo: string,
  ): Promise<void> {
    presente(botao(host, 'Suspender')).click();
    await assentar(fixture);
    const campo = presente(host.querySelector<HTMLTextAreaElement>('cfg-motivo-dialog textarea'));
    campo.value = motivo;
    campo.dispatchEvent(new Event('input'));
    await assentar(fixture);
    presente(botao(host, 'Suspender perfil')).click();
    await assentar(fixture);
  }

  it('suspende com o motivo, avisa e relê o perfil', async () => {
    api.suspender.mockReturnValue(of(ok(undefined)));
    const { fixture, host } = await abrirPerfil();

    await suspender(fixture, host, 'Incidente de segurança.');

    expect(api.suspender).toHaveBeenCalledWith(
      'p1',
      { motivo: 'Incidente de segurança.' },
      expect.anything(),
    );
    expect(api.suspender.mock.calls[0]?.[2].get(IDEMPOTENCY_KEY_TOKEN)).toBeTruthy();
    expect(notificacoes.success).toHaveBeenCalledWith('Perfil suspenso');
    expect(leituras.perfil).toHaveBeenCalledTimes(2);
  });

  it('mostra no diálogo a recusa de perfil já suspenso', async () => {
    api.suspender.mockReturnValue(of(recusa('uniplus.autorizacao.perfil.ja_suspenso')));
    const { fixture, host } = await abrirPerfil();

    await suspender(fixture, host, 'Incidente de segurança.');

    expect(host.querySelector('cfg-motivo-dialog')?.textContent).toContain(
      'O perfil já está suspenso.',
    );
    expect(notificacoes.success).not.toHaveBeenCalled();
  });

  it('quem só tem a permissão da proteção de dados também suspende, mas não desativa', async () => {
    const { host } = await abrirPerfil(perfilDoDetalhe(), [PROTECAO]);

    expect(botao(host, 'Suspender')).toBeDefined();
    expect(botao(host, 'Desativar')).toBeUndefined();
  });

  it('o perfil já suspenso não oferece suspender', async () => {
    const { host } = await abrirPerfil(SUSPENSO);

    expect(botao(host, 'Suspender')).toBeUndefined();
  });
});
