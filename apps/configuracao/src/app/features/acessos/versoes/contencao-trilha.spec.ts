import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import type { RegistroDaContencaoDto } from '@uniplus/shared-data/autorizacao';
import { PERMISSAO } from '@uniplus/shared-auth/bootstrap';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ok, recusa } from '../testes';
import {
  GESTAO,
  PROTECAO,
  abrirPerfil,
  api,
  assentar,
  botao,
  leituras,
  presente,
} from './contencao-do-perfil.testing';

const CONSULTA = PERMISSAO.autorizacao.perfisConsultarVersoes;
const DIOGO = { emissor: 'https://id.unifesspa.edu.br', sub: 'sub-diogo', nome: 'Diogo Souza' };
const BASE = {
  referenciaId: 's1',
  instante: '2026-11-09T15:00:00Z',
  etapa: null,
  motivo: null,
  origem: null,
  perfilProtegido: false,
  decisorTemConcessao: null,
};
const TRILHA: readonly RegistroDaContencaoDto[] = [
  {
    ...BASE,
    id: 'r2',
    tipo: 'retomada',
    ordem: 2,
    ator: 'sistema',
    pessoa: null,
    origem: 'decisao_da_etapa',
  },
  {
    ...BASE,
    id: 'r1',
    tipo: 'suspensao',
    ordem: 1,
    ator: 'humano',
    pessoa: DIOGO,
    etapa: 'gestao_de_acessos',
    motivo: 'Incidente.',
  },
];

describe('trilha da contenção no detalhe do perfil', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.resetTestingModule();
  });

  const linhas = (host: HTMLElement): string[] =>
    [...host.querySelectorAll('cfg-trilha-da-contencao tbody tr')].map(
      (tr) => tr.textContent?.replace(/\s+/g, ' ').trim() ?? '',
    );

  it('mostra os registros na ordem, com a pessoa e o sistema como "Sistema"', async () => {
    const { host } = await abrirPerfil(undefined, [GESTAO], ok(TRILHA));

    const [suspensao, retomada] = linhas(host);
    expect(suspensao).toContain('Perfil suspenso');
    expect(suspensao).toContain('Diogo Souza');
    expect(suspensao).toContain('Determinada pela gestão de acessos. Motivo: Incidente.');
    expect(retomada).toContain('Suspensão retomada');
    expect(retomada).toContain('Sistema');
  });

  it('relê a trilha depois de uma ação de contenção', async () => {
    api.desativar.mockReturnValue(of(ok(undefined)));
    const { fixture, host } = await abrirPerfil(undefined, [GESTAO], ok(TRILHA));

    presente(botao(host, 'Desativar')).click();
    await assentar(fixture);
    const campo = presente(host.querySelector<HTMLTextAreaElement>('cfg-motivo-dialog textarea'));
    campo.value = 'Perfil sem uso.';
    campo.dispatchEvent(new Event('input'));
    await assentar(fixture);
    presente(botao(host, 'Desativar perfil')).click();
    await assentar(fixture);

    expect(leituras.trilha).toHaveBeenCalledTimes(2);
  });

  it('quem tem só a permissão da proteção de dados também vê a trilha', async () => {
    const { host } = await abrirPerfil(undefined, [PROTECAO], ok(TRILHA));

    expect(linhas(host)).toHaveLength(2);
  });

  it('quem só consulta as versões vê a trilha, sem as ações de contenção', async () => {
    const { host } = await abrirPerfil(undefined, [CONSULTA], ok(TRILHA));

    expect(linhas(host)).toHaveLength(2);
    for (const acao of ['Suspender', 'Desativar', 'Reativar', 'Retomar']) {
      expect(botao(host, acao)).toBeUndefined();
    }
  });

  it('quem não tem permissão de nenhuma etapa não vê a trilha', async () => {
    const { host } = await abrirPerfil(undefined, [], ok(TRILHA));

    expect(host.querySelector('cfg-trilha-da-contencao')).toBeNull();
  });

  it('com a leitura da trilha falha, oferece tentar de novo e relê só a trilha', async () => {
    const falha = recusa('uniplus.internal.unexpected', 500, 'Erro interno');
    const { fixture, host } = await abrirPerfil(undefined, [GESTAO], falha);
    vi.mocked(leituras.trilha).mockReturnValue(of(ok(TRILHA)));

    const tentar = presente(
      [...host.querySelectorAll<HTMLButtonElement>('cfg-trilha-da-contencao button')].find((b) =>
        b.textContent?.includes('Tentar novamente'),
      ),
    );
    tentar.click();
    await assentar(fixture);

    expect(linhas(host)).toHaveLength(2);
    expect(leituras.perfil).toHaveBeenCalledTimes(1);
  });
});
