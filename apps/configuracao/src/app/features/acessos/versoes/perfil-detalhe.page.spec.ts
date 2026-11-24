import { EtapaDaVersao, SituacaoDaVersao } from '@uniplus/shared-data/autorizacao';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { perfilDoDetalhe, versaoPendente } from './perfis.testing';
import {
  ACESSO_EM_VIGOR,
  ACESSO_SEM_VERSAO_EM_VIGOR,
  ACESSO_SUSPENSO,
} from './situacao-do-acesso.testing';
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
  papelDeQuemSuspendeu: EtapaDaVersao.GESTAO_DE_ACESSOS,
  etapasExigidasAgora: [EtapaDaVersao.GESTAO_DE_ACESSOS, EtapaDaVersao.PROTECAO_DE_DADOS],
  etapasDecididas: [EtapaDaVersao.GESTAO_DE_ACESSOS],
};

describe('PerfilDetalhePage', () => {
  beforeEach(reiniciarDuplas);

  it('mostra a versão em vigor com o protocolo e as permissões, e as ações do perfil ativo', async () => {
    const { host } = await abrir();

    expect(host.querySelector('h1')?.textContent).toContain('Operador de inscrições');
    expect(host.textContent).toContain(ACESSO_EM_VIGOR.rotulo);
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

  it('com a revisão das concessões do perfil aberta, mostra o prazo e o caminho para a janela e não propõe versão nova', async () => {
    const janela = { id: 'j1', terminaEm: '2026-11-12T12:00:00Z', situacao: 'aberta' };
    const { host } = await abrir(ok(perfilDoDetalhe({ revisaoDasConcessoes: janela })));

    expect(host.textContent).toContain('Revisão das concessões do perfil aberta');
    expect(host.textContent).toContain('12/11/2026');
    expect(host.querySelector('a[href="/acessos/perfis/p1/janela"]')?.textContent).toContain(
      'Abrir a revisão das concessões do perfil',
    );
    expect(botao(host, 'Propor nova versão')).toBeUndefined();
    expect(botao(host, 'Remover permissões')).toBeDefined();
  });

  it('sem revisão das concessões do perfil, não mostra o aviso', async () => {
    const { host } = await abrir(ok(perfilDoDetalhe({ revisaoDasConcessoes: null })));

    expect(host.textContent).not.toContain('Revisão das concessões do perfil');
  });

  it('perfil suspenso mostra o estado, desde quando e as etapas da retomada', async () => {
    const { host } = await abrir(
      ok(perfilDoDetalhe({ situacaoDoAcesso: ACESSO_SUSPENSO, suspensao: SUSPENSAO_EM_RETOMADA })),
    );

    expect(host.querySelector('.cfg-tags')?.textContent).toContain(ACESSO_SUSPENSO.rotulo);
    expect(host.querySelector('cfg-suspensao-do-perfil')?.textContent).toContain(
      'Retomada pelo Representante do controlador: aguarda a decisão',
    );
  });

  it('perfil suspenso mostra a etiqueta e a data da suspensão como partes separadas', async () => {
    const { host } = await abrir(
      ok(perfilDoDetalhe({ situacaoDoAcesso: ACESSO_SUSPENSO, suspensao: SUSPENSAO_EM_RETOMADA })),
    );

    const embrulho = host.querySelector('.cfg-tags cfg-situacao-do-perfil > span');
    expect(embrulho?.textContent).toBe(`${ACESSO_SUSPENSO.rotulo} desde 09/11/2026, 12:00`);
    expect(embrulho?.querySelector('.tag')?.textContent?.trim()).toBe(ACESSO_SUSPENSO.rotulo);
    expect(embrulho?.querySelector('.cfg-muted')?.textContent).toBe('desde 09/11/2026, 12:00');
  });

  it('perfil sem suspensão mostra o rótulo da situação do acesso sem "desde"', async () => {
    const { host } = await abrir();

    expect(host.querySelector('.cfg-tags')?.textContent?.trim()).toBe(ACESSO_EM_VIGOR.rotulo);
    expect(host.querySelector('.cfg-tags .cfg-muted')).toBeNull();
  });

  it.each([
    { acesso: ACESSO_SUSPENSO, suspensao: SUSPENSAO_EM_RETOMADA, variante: 'tag--danger' },
    { acesso: ACESSO_EM_VIGOR, suspensao: null, variante: 'tag--success' },
    { acesso: ACESSO_SEM_VERSAO_EM_VIGOR, suspensao: null, variante: 'tag--warning' },
  ])(
    'a situação do acesso "$acesso.rotulo" tem a cor $variante, pelo código dela',
    async ({ acesso, suspensao, variante }) => {
      const { host } = await abrir(ok(perfilDoDetalhe({ situacaoDoAcesso: acesso, suspensao })));

      expect(host.querySelector('.cfg-tags .tag')?.classList.contains(variante)).toBe(true);
    },
  );

  it('depois da situação do acesso vêm a desativação e a revisão das concessões do perfil, nessa ordem', async () => {
    const janela = { id: 'j1', terminaEm: '2026-11-12T12:00:00Z', situacao: 'aberta' };
    const { host } = await abrir(
      ok(
        perfilDoDetalhe({
          ativo: false,
          desativadoDesde: '2026-11-08T15:00:00Z',
          revisaoDasConcessoes: janela,
        }),
      ),
    );

    const etiquetas = [...host.querySelectorAll('.cfg-tags .tag')].map((tag) =>
      tag.textContent?.trim(),
    );
    expect(etiquetas).toEqual([
      ACESSO_EM_VIGOR.rotulo,
      'Desativado',
      'Revisão das concessões do perfil aberta',
    ]);
  });

  it('perfil desativado mostra desde quando', async () => {
    const { host } = await abrir(
      ok(perfilDoDetalhe({ ativo: false, desativadoDesde: '2026-11-08T15:00:00Z' })),
    );

    expect(host.querySelector('.cfg-tags')?.textContent).toContain('Desativado');
    expect(host.querySelector('.cfg-tags')?.textContent).toContain('desde 08/11/2026');
  });

  it('perfil suspenso e desativado mostra as duas situações e não diz que está em vigor', async () => {
    const { host } = await abrir(
      ok(
        perfilDoDetalhe({
          situacaoDoAcesso: ACESSO_SUSPENSO,
          suspensao: SUSPENSAO_EM_RETOMADA,
          ativo: false,
          desativadoDesde: '2026-11-08T15:00:00Z',
        }),
      ),
    );

    const etiquetas = (host.querySelector('.cfg-tags')?.textContent ?? '')
      .replace(/\s+/g, ' ')
      .trim();
    expect(etiquetas).toBe(
      `${ACESSO_SUSPENSO.rotulo} desde 09/11/2026, 12:00 Desativado desde 08/11/2026, 12:00`,
    );
  });

  it('perfil só desativado segue em vigor, porque desativar não bloqueia o acesso', async () => {
    const { host } = await abrir(
      ok(perfilDoDetalhe({ ativo: false, desativadoDesde: '2026-11-08T15:00:00Z' })),
    );

    const etiquetas = host.querySelector('.cfg-tags')?.textContent ?? '';
    expect(etiquetas).toContain(ACESSO_EM_VIGOR.rotulo);
    expect(etiquetas).toContain('Desativado');
  });

  it('mostra o rótulo que a API devolve para a situação do acesso', async () => {
    const acesso = { ...ACESSO_SEM_VERSAO_EM_VIGOR, rotulo: 'Sem versão aprovada' };
    const { host } = await abrir(
      ok(perfilDoDetalhe({ situacaoDoAcesso: acesso, composicaoEmVigor: null })),
    );

    expect(host.querySelector('.cfg-tags')?.textContent).toContain('Sem versão aprovada');
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
    const { host } = await abrir(ok(perfilComEncerrada(SituacaoDaVersao.RECUSADA, 3)));

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
