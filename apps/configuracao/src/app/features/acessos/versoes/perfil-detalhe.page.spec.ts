import { of } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { perfilDoDetalhe, versaoPendente } from './perfis.testing';
import type { PerfilDto } from '@uniplus/shared-data/autorizacao';
import { ok, recusa } from '../testes';
import {
  abrir,
  assentar,
  botao,
  leitura,
  presente,
  reiniciarDuplas,
  perfilComEncerrada,
} from './perfil-detalhe.testing';

const SUSPENSAO_EM_RETOMADA = {
  desde: '2026-11-09T15:00:00Z',
  papelDeQuemSuspendeu: 'gestao_de_acessos',
  etapasExigidasAgora: ['gestao_de_acessos', 'protecao_de_dados'],
  etapasDecididas: ['gestao_de_acessos'],
};

describe('PerfilDetalhePage', () => {
  beforeEach(reiniciarDuplas);

  it('mostra a versão em vigor com o protocolo e as permissões, e as ações do perfil ativo', async () => {
    const { host } = await abrir();

    expect(host.querySelector('h1')?.textContent).toContain('Operador de inscrições');
    expect(host.textContent).toContain('Em vigor');
    expect(host.textContent).toContain('P-1/2026');
    expect(host.textContent).toContain('selecao:processos:consultar');
    expect(botao(host, 'Propor nova versão')).toBeDefined();
    expect(botao(host, 'Remover permissões')).toBeDefined();
    expect(botao(host, 'Desativar')).toBeDefined();
    expect(botao(host, 'Cancelar versão pendente')).toBeUndefined();
  });

  it('com versão pendente, mostra o que muda, a etapa e oferece cancelar em vez de propor outra', async () => {
    const { host } = await abrir(ok(perfilDoDetalhe({ versaoPendente: versaoPendente() })));

    expect(host.textContent).toContain('Versão pendente de aprovação');
    expect(host.textContent).toContain('Aguarda gestão de acessos');
    expect(host.textContent).toContain('Acrescentadas (1)');
    expect(host.textContent).toContain('Aprovar processos');
    expect(botao(host, 'Cancelar versão pendente')).toBeDefined();
    expect(botao(host, 'Propor nova versão')).toBeUndefined();
  });

  it('diz que a versão pendente foi proposta por quem lê', async () => {
    const { host } = await abrir(
      ok(perfilDoDetalhe({ versaoPendente: versaoPendente({ propostaPorQuemLe: true }) })),
    );

    expect(host.textContent).toContain('Você propôs esta versão.');
  });

  it('não diz isso da versão pendente que outra pessoa propôs', async () => {
    const { host } = await abrir(ok(perfilDoDetalhe({ versaoPendente: versaoPendente() })));

    expect(host.textContent).not.toContain('Você propôs esta versão.');
  });

  it('com a janela de migração aberta, mostra o prazo e o caminho para a janela e não propõe versão nova', async () => {
    const janela = { id: 'j1', prazo: '2026-11-12T12:00:00Z', situacao: 'aberta' };
    const { host } = await abrir(ok(perfilDoDetalhe({ janela })));

    expect(host.textContent).toContain('Janela de migração aberta');
    expect(host.textContent).toContain('12/11/2026');
    expect(host.querySelector('a[href="/acessos/perfis/p1/janela"]')?.textContent).toContain(
      'Abrir a janela de migração',
    );
    expect(botao(host, 'Propor nova versão')).toBeUndefined();
    expect(botao(host, 'Remover permissões')).toBeDefined();
  });

  it('sem janela de migração, não mostra o aviso', async () => {
    const { host } = await abrir(ok(perfilDoDetalhe({ janela: null })));

    expect(host.textContent).not.toContain('Janela de migração');
  });

  it('perfil suspenso mostra o estado, desde quando e as etapas da retomada', async () => {
    const { host } = await abrir(ok(perfilDoDetalhe({ suspensao: SUSPENSAO_EM_RETOMADA })));

    expect(host.querySelector('.cfg-tags')?.textContent).toContain('Suspenso');
    expect(host.querySelector('cfg-suspensao-do-perfil')?.textContent).toContain(
      'Retomada pelo Representante do controlador: aguarda a decisão',
    );
  });

  it('perfil desativado mostra desde quando', async () => {
    const { host } = await abrir(
      ok(perfilDoDetalhe({ ativo: false, desativadoDesde: '2026-11-08T15:00:00Z' })),
    );

    expect(host.querySelector('.cfg-tags')?.textContent).toContain('Desativado');
    expect(host.querySelector('.cfg-tags')?.textContent).toContain('desde 08/11/2026');
  });

  it('perfil desativado só se reativa', async () => {
    const { host } = await abrir(ok(perfilDoDetalhe({ ativo: false })));

    expect(host.textContent).toContain('Desativado');
    expect(botao(host, 'Reativar')).toBeDefined();
    expect(botao(host, 'Desativar')).toBeUndefined();
    expect(botao(host, 'Propor nova versão')).toBeUndefined();
  });

  it('o perfil de governança não oferece nenhuma ação', async () => {
    const { host } = await abrir(ok(perfilDoDetalhe({ governanca: 'gestor' })));

    expect(host.querySelector('.page-header__actions button')).toBeNull();
  });

  it('avisa que a última versão proposta não entrou em vigor', async () => {
    const { host } = await abrir(ok(perfilComEncerrada('recusada', 3)));

    expect(host.textContent).toContain('A última versão proposta não entrou em vigor');
    expect(host.textContent).toContain('A versão 3 foi recusada.');
  });

  it('perfil que não existe mostra a recusa sem oferecer nova tentativa', async () => {
    const { host } = await abrir(recusa('uniplus.autorizacao.perfil.nao_encontrado', 404));

    expect(host.textContent).toContain('Perfil não encontrado');
    expect(botao(host, 'Tentar novamente')).toBeUndefined();
  });

  it('com a leitura falha, oferece tentar novamente', async () => {
    const { fixture, host } = await abrir(
      recusa('uniplus.internal.unexpected', 500, 'Erro interno'),
    );
    leitura.mockReturnValue(of(ok<PerfilDto>(perfilDoDetalhe())));

    presente(botao(host, 'Tentar novamente')).click();
    await assentar(fixture);

    expect(host.querySelector('h1')?.textContent).toContain('Operador de inscrições');
  });
});
