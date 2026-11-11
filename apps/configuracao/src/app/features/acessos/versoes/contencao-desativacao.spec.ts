import { TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { IDEMPOTENCY_KEY_TOKEN } from '@uniplus/shared-core/idempotency';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ok, recusa } from '../testes';
import {
  abrirPerfil,
  api,
  assentar,
  botao,
  leituras,
  notificacoes,
  presente,
} from './contencao-do-perfil.testing';
import { perfilDoDetalhe, versaoPendente } from './perfis.testing';

const DESATIVADO = perfilDoDetalhe({ ativo: false, desativadoDesde: '2026-11-08T15:00:00Z' });

describe('desativar e reativar o perfil', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.resetTestingModule();
  });

  const motivo = (host: HTMLElement): HTMLTextAreaElement =>
    presente(host.querySelector<HTMLTextAreaElement>('cfg-motivo-dialog textarea'));

  async function digitar(
    fixture: Parameters<typeof assentar>[0],
    host: HTMLElement,
    texto: string,
  ): Promise<void> {
    const campo = motivo(host);
    campo.value = texto;
    campo.dispatchEvent(new Event('input'));
    await assentar(fixture);
  }

  it('desativar pede o motivo, que a API recebe aparado, e relê o perfil', async () => {
    api.desativar.mockReturnValue(of(ok(undefined)));
    const { fixture, host } = await abrirPerfil();

    presente(botao(host, 'Desativar')).click();
    await assentar(fixture);
    expect(host.querySelector('cfg-motivo-dialog')?.textContent).toContain('Desativar o perfil');
    await digitar(fixture, host, '  Perfil sem uso.  ');
    presente(botao(host, 'Desativar perfil')).click();
    await assentar(fixture);

    expect(api.desativar).toHaveBeenCalledWith(
      'p1',
      { motivo: 'Perfil sem uso.' },
      expect.anything(),
    );
    expect(api.desativar.mock.calls[0]?.[2].get(IDEMPOTENCY_KEY_TOKEN)).toBeTruthy();
    expect(notificacoes.success).toHaveBeenCalledWith('Perfil desativado');
    expect(leituras.perfil).toHaveBeenCalledTimes(2);
  });

  it('sem motivo, marca o campo e não chama a API', async () => {
    const { fixture, host } = await abrirPerfil();

    presente(botao(host, 'Desativar')).click();
    await assentar(fixture);
    presente(botao(host, 'Desativar perfil')).click();
    await assentar(fixture);

    expect(api.desativar).not.toHaveBeenCalled();
    expect(motivo(host).getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(motivo(host));
  });

  it('reativar mostra no diálogo a recusa de quem desativou, sem fechá-lo', async () => {
    api.reativar.mockReturnValue(
      of(recusa('uniplus.autorizacao.perfil.reativacao_por_quem_desativou')),
    );
    const { fixture, host } = await abrirPerfil(DESATIVADO);

    presente(botao(host, 'Reativar')).click();
    await assentar(fixture);
    await digitar(fixture, host, 'Voltou a ser usado.');
    presente(botao(host, 'Reativar perfil')).click();
    await assentar(fixture);

    const dialogo = presente(host.querySelector('cfg-motivo-dialog'));
    expect(dialogo.textContent).toContain('Quem desativou o perfil não o reativa.');
    expect(notificacoes.success).not.toHaveBeenCalled();
    expect(motivo(host).value).toBe('Voltou a ser usado.');
  });

  it('repete o mesmo comando sob a mesma chave depois de falha de rede', async () => {
    api.reativar
      .mockReturnValueOnce(of(recusa('uniplus.client.network_error', 0)))
      .mockReturnValueOnce(of(ok(undefined)));
    const { fixture, host } = await abrirPerfil(DESATIVADO);

    presente(botao(host, 'Reativar')).click();
    await assentar(fixture);
    await digitar(fixture, host, 'Voltou a ser usado.');
    presente(botao(host, 'Reativar perfil')).click();
    await assentar(fixture);
    presente(botao(host, 'Reativar perfil')).click();
    await assentar(fixture);

    const chave = (n: number): unknown =>
      api.reativar.mock.calls[n]?.[2].get(IDEMPOTENCY_KEY_TOKEN);
    expect(api.reativar).toHaveBeenCalledTimes(2);
    expect(chave(1)).toBe(chave(0));
    expect(notificacoes.success).toHaveBeenCalledWith('Perfil reativado');
  });

  it('bloqueia as outras ações enquanto grava', async () => {
    const resposta = new Subject<ReturnType<typeof ok<void>>>();
    api.desativar.mockReturnValue(resposta);
    const { fixture, host } = await abrirPerfil();

    presente(botao(host, 'Desativar')).click();
    await assentar(fixture);
    await digitar(fixture, host, 'Perfil sem uso.');
    presente(botao(host, 'Desativar perfil')).click();
    fixture.detectChanges();

    expect(presente(botao(host, 'Propor nova versão')).disabled).toBe(true);
    expect(presente(botao(host, 'Remover permissões')).disabled).toBe(true);
    resposta.next(ok(undefined));
    resposta.complete();
    await assentar(fixture);
  });

  it('quem não tem a permissão da gestão de acessos não vê desativar nem reativar', async () => {
    const { host } = await abrirPerfil(perfilDoDetalhe(), []);

    expect(botao(host, 'Desativar')).toBeUndefined();
    expect(botao(host, 'Reativar')).toBeUndefined();
  });

  it('leva o foco ao campo do diálogo da contenção, não ao do cancelamento deixado inválido', async () => {
    const { fixture, host } = await abrirPerfil(
      perfilDoDetalhe({ versaoPendente: versaoPendente() }),
    );

    presente(botao(host, 'Cancelar versão pendente')).click();
    await assentar(fixture);
    presente(botao(host, 'Cancelar versão')).click();
    await assentar(fixture);
    expect(motivo(host).getAttribute('aria-invalid')).toBe('true');
    presente(botao(host, 'Cancelar')).click();
    await assentar(fixture);

    presente(botao(host, 'Desativar')).click();
    await assentar(fixture);
    presente(botao(host, 'Desativar perfil')).click();
    await assentar(fixture);

    expect(host.querySelectorAll('cfg-motivo-dialog textarea[aria-invalid="true"]')).toHaveLength(
      2,
    );
    expect(document.activeElement?.tagName).toBe('TEXTAREA');
    expect(document.activeElement?.closest('cfg-motivo-dialog')?.textContent).toContain(
      'Desativar o perfil',
    );
  });
});
