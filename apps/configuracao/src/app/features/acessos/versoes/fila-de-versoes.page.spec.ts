import { Subject, of } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { PERMISSAO } from '@uniplus/shared-auth/bootstrap';
import type { ItemDaFilaDeVersoesDto } from '@uniplus/shared-data/autorizacao';
import { ok, recusa } from '../testes';
import { versaoPendente } from './perfis.testing';
import {
  ITEM,
  OUTRO,
  abrir,
  abrirODialogoDeRecusa,
  assentar,
  botao,
  clicar,
  documento,
  leitura,
  notificacoes,
  presente,
  recusarNoDialogo,
  reiniciarDuplas,
  secao,
  versoes,
} from './fila-de-versoes.testing';

type Aberta = Awaited<ReturnType<typeof abrir>>;

const TEXTUAL: ItemDaFilaDeVersoesDto = {
  perfilId: 'p5',
  perfilNome: 'Operador',
  versao: versaoPendente({
    versaoId: 'v9',
    nome: 'Operador de processos',
    descricao: 'Opera os processos seletivos.',
    acrescimo: [],
    remocao: [],
  }),
  propostaPorQuemLe: false,
};
const OPERADOR = 'Operador de inscrições';
const SEM_AUTORIA = 'Quem criou a versão não pode aprová-la nem recusá-la.';

async function recusarComMotivo({ fixture, host }: Aberta): Promise<HTMLDialogElement> {
  const dialogo = await abrirODialogoDeRecusa(fixture, host, OPERADOR);
  await recusarNoDialogo(fixture, dialogo, ' Sem base legal. ');
  return dialogo;
}

async function recusarExpirada(aberta: Aberta): Promise<HTMLDialogElement> {
  versoes.recusar.mockReturnValue(of(recusa('uniplus.autorizacao.perfil.versao_expirada', 422)));
  leitura.mockReturnValue(of(ok([OUTRO])));
  return recusarComMotivo(aberta);
}

function botoesDeDecisao(host: HTMLElement): HTMLButtonElement[] {
  const botoes = host.querySelectorAll<HTMLButtonElement>('section button');
  return [...botoes].filter((b) => ['Aprovar', 'Recusar'].includes(b.textContent?.trim() ?? ''));
}

describe('FilaDeVersoesPage', () => {
  beforeEach(reiniciarDuplas);

  it.each([
    ['gestao_de_acessos', 'Versões de perfil na gestão de acessos'],
    ['protecao_de_dados', 'Versões de perfil na proteção de dados'],
  ] as const)('a etapa %s lê a própria fila e tem o próprio título', async (etapa, titulo) => {
    const { host } = await abrir(etapa);

    expect(leitura).toHaveBeenCalledWith(etapa);
    expect(host.querySelector('h1')?.textContent).toContain(titulo);
  });

  it('lista cada versão com o perfil, o que muda e a etapa em que está', async () => {
    const { host } = await abrir('gestao_de_acessos');

    expect(host.querySelectorAll('section.panel')).toHaveLength(2);
    const primeira = secao(host, OPERADOR);
    expect(primeira.querySelector('a')?.getAttribute('href')).toBe('/acessos/perfis/p1');
    expect(primeira.textContent).toContain('versão 2');
    expect(primeira.textContent).toContain('Acrescentadas (1)');
    expect(primeira.textContent).toContain('Aprovar processos');
  });

  it('mostra o nome e a descrição propostos junto com o nome em vigor', async () => {
    const { host } = await abrir('gestao_de_acessos', ok([TEXTUAL]));

    const area = secao(host, 'Operador');
    expect(area.textContent).toContain('Operador de processos');
    expect(area.textContent).toContain('(em vigor: Operador)');
    expect(area.textContent).toContain('Opera os processos seletivos.');
  });

  it('aprova a mudança só de texto', async () => {
    const { fixture, host } = await abrir('gestao_de_acessos', ok([TEXTUAL]));
    versoes.aprovar.mockReturnValue(of(ok({})));

    await clicar(fixture, host, 'Operador', 'Aprovar');

    const chamada = ['p5', 'v9', 'gestao_de_acessos', expect.anything()];
    expect(versoes.aprovar).toHaveBeenCalledWith(...chamada);
  });

  it('quem só aprova também abre o perfil pelo nome na fila', async () => {
    const { host } = await abrir('gestao_de_acessos', ok([ITEM]), [
      PERMISSAO.autorizacao.perfisAprovarFuncional,
    ]);

    const area = secao(host, OPERADOR);
    expect(area.querySelector('h2 a')?.getAttribute('href')).toBe('/acessos/perfis/p1');
  });

  it('sem permissão de perfis mostra o nome sem link', async () => {
    const { host } = await abrir('gestao_de_acessos', ok([ITEM]), []);

    const area = secao(host, OPERADOR);
    expect(area.querySelector('h2 a')).toBeNull();
    expect(area.querySelector('h2')?.textContent).toContain(OPERADOR);
  });

  it('diz que a fila está vazia', async () => {
    const { host } = await abrir('protecao_de_dados', ok([]));

    expect(host.textContent).toContain('Nenhuma versão aguarda a sua aprovação.');
  });

  it('aprova a etapa da fila, avisa e relê a fila', async () => {
    const { fixture, host } = await abrir('protecao_de_dados');
    versoes.aprovar.mockReturnValue(of(ok({})));

    await clicar(fixture, host, OPERADOR, 'Aprovar');

    const chamada = ['p1', 'v2', 'protecao_de_dados', expect.anything()];
    expect(versoes.aprovar).toHaveBeenCalledWith(...chamada);
    expect(notificacoes.success).toHaveBeenCalledWith('Versão aprovada', OPERADOR);
    expect(leitura).toHaveBeenCalledTimes(2);
  });

  it('não oferece aprovar nem recusar a versão que a própria pessoa propôs, e explica', async () => {
    const propria = { ...ITEM, propostaPorQuemLe: true };
    const { host } = await abrir('gestao_de_acessos', ok([propria, OUTRO]));

    const secaoPropria = secao(host, OPERADOR);
    expect(botao(secaoPropria, 'Aprovar')).toBeUndefined();
    expect(botao(secaoPropria, 'Recusar')).toBeUndefined();
    expect(secaoPropria.textContent).toContain(
      'Você propôs esta versão. Outra pessoa precisa aprová-la.',
    );
  });

  it('mantém as decisões das outras versões quando uma é a da própria pessoa', async () => {
    const propria = { ...ITEM, propostaPorQuemLe: true };
    const { host } = await abrir('gestao_de_acessos', ok([propria, OUTRO]));

    expect(botao(secao(host, 'Auditoria'), 'Aprovar')).toBeDefined();
    expect(botao(secao(host, 'Auditoria'), 'Recusar')).toBeDefined();
  });

  it('segura a aprovação enquanto o documento não foi verificado e diz por quê', async () => {
    const { host } = await abrir('gestao_de_acessos');

    const area = secao(host, 'Auditoria');
    const aprovar = presente(botao(area, 'Aprovar'));
    expect(aprovar.disabled).toBe(true);
    expect(area.textContent).toContain(
      'A aprovação espera a verificação do documento instituidor.',
    );
    expect(aprovar.getAttribute('aria-describedby')).toBe('cfg-versao-ajuda-v7');
  });

  it('não segura a aprovação da versão com o documento verificado', async () => {
    const { host } = await abrir('gestao_de_acessos');

    expect(presente(botao(secao(host, OPERADOR), 'Aprovar')).disabled).toBe(false);
  });

  it('mostra a recusa da API junto à versão', async () => {
    const { fixture, host } = await abrir('gestao_de_acessos');
    versoes.aprovar.mockReturnValue(of(recusa('uniplus.autorizacao.perfil.decisor_e_autor', 422)));

    await clicar(fixture, host, OPERADOR, 'Aprovar');

    expect(secao(host, OPERADOR).textContent).toContain(SEM_AUTORIA);
    expect(notificacoes.success).not.toHaveBeenCalled();
  });

  it('mostra a recusa da API sem afetar as outras versões', async () => {
    const { fixture, host } = await abrir('gestao_de_acessos');
    versoes.aprovar.mockReturnValue(of(recusa('uniplus.autorizacao.perfil.decisor_e_autor', 422)));

    await clicar(fixture, host, OPERADOR, 'Aprovar');

    expect(secao(host, 'Auditoria').textContent).not.toContain(SEM_AUTORIA);
  });

  describe('recusar', () => {
    it('exige o motivo antes de chamar a API', async () => {
      const { fixture, host } = await abrir('gestao_de_acessos');
      const dialogo = await abrirODialogoDeRecusa(fixture, host, OPERADOR);

      await recusarNoDialogo(fixture, dialogo);

      expect(versoes.recusar).not.toHaveBeenCalled();
      expect(dialogo.textContent).toContain('Informe o motivo');
      expect(dialogo.open).toBe(true);
    });

    it('recusa a etapa da fila com o motivo aparado', async () => {
      const aberta = await abrir('protecao_de_dados');
      versoes.recusar.mockReturnValue(of(ok({})));

      await recusarComMotivo(aberta);

      const motivo = { etapa: 'protecao_de_dados', motivo: 'Sem base legal.' };
      expect(versoes.recusar).toHaveBeenCalledWith('p1', 'v2', motivo, expect.anything());
    });

    it('depois de recusar, fecha o diálogo e avisa', async () => {
      const aberta = await abrir('protecao_de_dados');
      versoes.recusar.mockReturnValue(of(ok({})));

      const dialogo = await recusarComMotivo(aberta);

      expect(dialogo.open).toBe(false);
      expect(notificacoes.success).toHaveBeenCalledWith('Versão recusada', OPERADOR);
    });

    it('mostra a recusa da API no diálogo e o mantém aberto', async () => {
      const aberta = await abrir('gestao_de_acessos');
      const erro = recusa('uniplus.autorizacao.perfil.etapa_ja_decidida', 409);
      versoes.recusar.mockReturnValue(of(erro));

      const dialogo = await recusarComMotivo(aberta);

      expect(dialogo.textContent).toContain('A etapa já tem decisão para esta versão');
      expect(dialogo.open).toBe(true);
    });
  });

  it('relê a fila e mantém a explicação depois da aprovação recusada com aprovações descartadas', async () => {
    const { fixture, host } = await abrir('gestao_de_acessos');
    const erro = recusa('uniplus.autorizacao.perfil.aprovacoes_descartadas', 409);
    versoes.aprovar.mockReturnValue(of(erro));
    const leiturasAntes = leitura.mock.calls.length;

    await clicar(fixture, host, OPERADOR, 'Aprovar');

    expect(leitura.mock.calls.length).toBeGreaterThan(leiturasAntes);
    expect(host.textContent).toContain('as aprovações já dadas foram descartadas');
    expect(notificacoes.success).not.toHaveBeenCalled();
  });

  it('relê a fila quando a versão expirou', async () => {
    const aberta = await abrir('gestao_de_acessos');
    const leiturasAntes = leitura.mock.calls.length;

    const dialogo = await recusarExpirada(aberta);

    expect(leitura.mock.calls.length).toBeGreaterThan(leiturasAntes);
    expect(dialogo.open).toBe(false);
  });

  it('explica que a versão expirou e a tira da fila', async () => {
    const aberta = await abrir('gestao_de_acessos');

    await recusarExpirada(aberta);

    expect(aberta.host.textContent).not.toContain('versão 2');
    expect(aberta.host.textContent).toContain('Operador de inscrições: ');
    expect(aberta.host.textContent).toContain('expirou sem entrar em vigor');
  });

  it('fica indisponível durante a decisão', async () => {
    const { fixture, host } = await abrir('gestao_de_acessos');
    versoes.aprovar.mockReturnValue(new Subject());

    presente(botao(secao(host, OPERADOR), 'Aprovar')).click();
    fixture.detectChanges();

    expect(botoesDeDecisao(host)).toHaveLength(4);
    expect(botoesDeDecisao(host).every((b) => b.disabled)).toBe(true);
  });

  it('abre o documento da versão e avisa quando o navegador bloqueia', async () => {
    const { fixture, host } = await abrir('gestao_de_acessos');
    documento.abrir.mockResolvedValue('bloqueada');

    await clicar(fixture, host, OPERADOR, 'Abrir documento');

    expect(documento.abrir).toHaveBeenCalledWith('p1', 'v2', expect.any(Function));
    expect(secao(host, OPERADOR).textContent).toContain(
      'O navegador bloqueou a abertura do documento.',
    );
  });

  it('com a leitura falha, oferece tentar novamente', async () => {
    const falha = recusa('uniplus.internal.unexpected', 500, 'Erro interno');
    const { fixture, host } = await abrir('gestao_de_acessos', falha);
    leitura.mockReturnValue(of(ok([ITEM])));

    presente(botao(host, 'Tentar novamente')).click();
    await assentar(fixture);

    expect(host.querySelectorAll('section.panel')).toHaveLength(1);
  });

  it('sem permissão para a fila, mostra a recusa sem oferecer nova tentativa', async () => {
    const { host } = await abrir('gestao_de_acessos', recusa('uniplus.forbidden', 403));

    expect(botao(host, 'Tentar novamente')).toBeUndefined();
  });
});
