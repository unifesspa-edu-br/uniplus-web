import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ok, recusa } from '../testes';
import {
  GESTAO,
  PROTECAO,
  abrirPerfil,
  api,
  assentar,
  botao,
  notificacoes,
  presente,
} from './contencao-do-perfil.testing';
import { perfilDoDetalhe } from './perfis.testing';

const SUSPENSO = perfilDoDetalhe({
  suspensao: {
    desde: '2026-11-09T15:00:00Z',
    papelDeQuemSuspendeu: 'gestao_de_acessos',
    etapasExigidasAgora: ['gestao_de_acessos', 'protecao_de_dados'],
    etapasDecididas: [],
  },
});

describe('retomar o perfil suspenso', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.resetTestingModule();
  });

  async function decidir(
    fixture: Parameters<typeof assentar>[0],
    host: HTMLElement,
    botaoDaEtapa: string,
  ): Promise<void> {
    presente(botao(host, botaoDaEtapa)).click();
    await assentar(fixture);
    const campo = presente(host.querySelector<HTMLTextAreaElement>('cfg-motivo-dialog textarea'));
    campo.value = 'Incidente resolvido.';
    campo.dispatchEvent(new Event('input'));
    await assentar(fixture);
    presente(botao(host, 'Decidir a retomada')).click();
    await assentar(fixture);
  }

  it('cada etapa exigida tem a própria decisão, oferecida a quem tem a permissão dela', async () => {
    const { host } = await abrirPerfil(SUSPENSO, [GESTAO, PROTECAO]);

    expect(botao(host, 'Retomar: gestão de acessos')).toBeDefined();
    expect(botao(host, 'Retomar: proteção de dados')).toBeDefined();
  });

  it('quem só tem a permissão da gestão de acessos não vê a etapa da proteção de dados', async () => {
    const { host } = await abrirPerfil(SUSPENSO, [GESTAO]);

    expect(botao(host, 'Retomar: gestão de acessos')).toBeDefined();
    expect(botao(host, 'Retomar: proteção de dados')).toBeUndefined();
  });

  it('decide a etapa com o motivo e avisa o que ainda falta', async () => {
    api.retomar.mockReturnValue(
      of(ok({ concluida: false, etapasPendentes: ['protecao_de_dados'] })),
    );
    const { fixture, host } = await abrirPerfil(SUSPENSO, [GESTAO]);

    await decidir(fixture, host, 'Retomar: gestão de acessos');

    expect(api.retomar).toHaveBeenCalledWith(
      'p1',
      { etapa: 'gestao_de_acessos', motivo: 'Incidente resolvido.' },
      expect.anything(),
    );
    expect(notificacoes.success).toHaveBeenCalledWith(
      'Etapa decidida. Falta a decisão do Representante do controlador',
    );
  });

  it('avisa que o perfil foi retomado quando a última etapa é decidida', async () => {
    api.retomar.mockReturnValue(of(ok({ concluida: true, etapasPendentes: [] })));
    const { fixture, host } = await abrirPerfil(SUSPENSO, [PROTECAO]);

    await decidir(fixture, host, 'Retomar: proteção de dados');

    expect(api.retomar.mock.calls[0]?.[1]).toEqual({
      etapa: 'protecao_de_dados',
      motivo: 'Incidente resolvido.',
    });
    expect(notificacoes.success).toHaveBeenCalledWith(
      'Perfil retomado: as concessões voltam a valer',
    );
  });

  it.each([
    ['retomada_por_quem_suspendeu', 'Quem suspendeu o perfil não decide a retomada.', 422],
    ['etapa_da_retomada_ja_decidida', 'A etapa da retomada já foi decidida.', 409],
    ['nao_suspenso', 'O perfil não está suspenso.', 422],
  ])('mostra junto à ação a recusa %s vinda da API', async (codigo, texto, status) => {
    api.retomar.mockReturnValue(of(recusa(`uniplus.autorizacao.perfil.${codigo}`, status)));
    const { fixture, host } = await abrirPerfil(SUSPENSO, [GESTAO]);

    await decidir(fixture, host, 'Retomar: gestão de acessos');

    expect(host.querySelector('cfg-motivo-dialog')?.textContent).toContain(texto);
    expect(notificacoes.success).not.toHaveBeenCalled();
  });

  it.each([
    ['etapa_invalida', 'O perfil não exige essa etapa da retomada agora.', 422],
    ['mesmo_decisor_nas_duas_etapas', 'Você já decidiu a outra etapa da retomada.', 422],
    ['sem_permissao_na_etapa', 'Falta a permissão da etapa da retomada.', 403],
  ])('na retomada, %s fala da etapa da retomada e não da versão', async (codigo, texto, status) => {
    api.retomar.mockReturnValue(of(recusa(`uniplus.autorizacao.perfil.${codigo}`, status)));
    const { fixture, host } = await abrirPerfil(SUSPENSO, [GESTAO]);

    await decidir(fixture, host, 'Retomar: gestão de acessos');

    const dialogo = host.querySelector('cfg-motivo-dialog')?.textContent ?? '';
    expect(dialogo).toContain(texto);
    expect(dialogo).not.toContain('versão');
  });

  it('o perfil sem suspensão não oferece retomada', async () => {
    const { host } = await abrirPerfil(perfilDoDetalhe(), [GESTAO, PROTECAO]);

    expect(botao(host, 'Retomar: gestão de acessos')).toBeUndefined();
  });
});
