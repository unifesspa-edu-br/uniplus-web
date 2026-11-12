import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PERMISSAO } from '@uniplus/shared-auth/bootstrap';
import { ok, recusaPeloInterceptor } from '../testes';
import {
  CONDUZIR,
  CONSULTAR,
  ID,
  REVER,
  abrirRevisao,
  api,
  assentar,
  botao,
  botoes,
  item,
  itemDecidido,
  linha,
  notificacoes,
  revisao,
} from './revisao.testing';

const DECISOR_MUDOU = 'uniplus.autorizacao.revisao.decisor_nao_decide_o_item';

/** Abre o diálogo do item, escreve o motivo e envia a revogação. */
async function revogarComMotivo(host: HTMLElement, id: string): Promise<void> {
  botao(linha(host, id), 'Revogar').click();
  await assentar();
  const campo = document.body.querySelector<HTMLTextAreaElement>('cfg-motivo-dialog textarea');
  if (campo === null) throw new Error('campo do motivo ausente');
  campo.value = 'Mudou de setor.';
  campo.dispatchEvent(new Event('input'));
  botao(document.body, 'Revogar acesso').click();
  await assentar();
}

const dialogoAberto = () =>
  document.body.querySelector<HTMLDialogElement>('cfg-motivo-dialog dialog')?.open === true;

describe('RevisaoDetalhePage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('leitura', () => {
    it('agrupa os itens por beneficiário, com o resumo da revisão', async () => {
      const { host } = await abrirRevisao();

      const titulos = [...host.querySelectorAll('cfg-itens-do-beneficiario h2')].map((h) =>
        h.textContent?.trim(),
      );
      expect(titulos).toEqual(['Betina Neves', 'Diogo Souza', 'Fernanda Drumond']);
      expect(host.textContent).toContain('4 itens, 3 pendentes');
      expect(host.textContent).toContain('Aberta');
    });

    it('mostra quem decide o item pendente pelo campo decide', async () => {
      const { host } = await abrirRevisao();

      expect(linha(host, 'i1').textContent).toContain('Representante do controlador');
      expect(linha(host, 'i3').textContent).toContain('Gestão de acessos');
      expect(linha(host, 'i1').textContent).toContain('Ainda não decidido');
    });

    it('no item decidido mostra a decisão, quem decidiu, quando e a governança gravada', async () => {
      const { host } = await abrirRevisao();

      const decidido = linha(host, 'i2').textContent ?? '';
      expect(decidido).toContain('Acesso mantido');
      expect(decidido).toContain('Betina Neves');
      expect(decidido).toContain('10/11/2026');
      expect(decidido).toContain('Representante do controlador');
      expect(decidido).toContain('Governança gravada na decisão.');
      expect(botoes(linha(host, 'i2'))).toEqual([]);
    });
  });

  describe('ações por papel', () => {
    it('o Representante do controlador decide o item comum e não o de quem é Representante', async () => {
      const { host } = await abrirRevisao([ok(revisao())], [CONDUZIR]);

      expect(botoes(linha(host, 'i1'))).toEqual(['Confirmar', 'Revogar']);
      expect(botoes(linha(host, 'i3'))).toEqual([]);
    });

    it('a gestão de acessos decide só o item de quem é Representante', async () => {
      const { host } = await abrirRevisao([ok(revisao())], [REVER]);

      expect(botoes(linha(host, 'i3'))).toEqual(['Confirmar', 'Revogar']);
      expect(botoes(linha(host, 'i1'))).toEqual([]);
    });

    it('ninguém vê ação no próprio item, mesmo com as duas permissões', async () => {
      const { host } = await abrirRevisao([ok(revisao())], [CONDUZIR, REVER]);

      expect(botoes(linha(host, 'i4'))).toEqual([]);
    });

    it('quem só consulta vê revisão, itens e resultados sem nenhum botão de ação', async () => {
      const { host } = await abrirRevisao([ok(revisao())], [CONSULTAR]);

      const linhas = [...host.querySelectorAll<HTMLElement>('tr[data-item-id]')];
      expect(linhas).toHaveLength(4);
      expect(host.textContent).toContain('Acesso mantido');
      expect(linhas.flatMap((l) => botoes(l))).toEqual([]);
    });

    it('revisão encerrada é somente leitura e diz isso', async () => {
      const encerrada = revisao({ situacao: 'concluida', pendentes: 0, itens: [itemDecidido()] });
      const { host } = await abrirRevisao([ok(encerrada)], [CONDUZIR, REVER]);

      expect(host.textContent).toContain('Revisão encerrada');
      expect(botoes(host).filter((b) => ['Confirmar', 'Revogar'].includes(b))).toEqual([]);
    });

    it('o botão diz a quem e a que perfil a decisão se aplica', async () => {
      const { host } = await abrirRevisao();

      expect(botao(linha(host, 'i1'), 'Confirmar').getAttribute('aria-label')).toBe(
        'Confirmar o acesso de Fernanda Drumond ao perfil Operador de inscrições',
      );
    });
  });

  describe('motivo da revogação, que fica na concessão', () => {
    const CONSULTAR_CONCESSOES = PERMISSAO.autorizacao.concessoesConsultar;
    const ADMINISTRAR_CONCESSOES = PERMISSAO.autorizacao.concessoesAdministrar;
    const link = (raiz: HTMLElement) =>
      raiz.querySelector<HTMLAnchorElement>('a[href*="concessoes"]');

    it.each([
      ['quem consulta concessões', [CONSULTAR, CONSULTAR_CONCESSOES]],
      ['quem administra concessões', [CONDUZIR, ADMINISTRAR_CONCESSOES]],
    ] as const)('o item decidido leva %s à concessão', async (_, concedidas) => {
      const revogado = itemDecidido({ situacao: 'revogada', concessaoId: 'c9' });
      const { host } = await abrirRevisao([ok(revisao({ itens: [revogado] }))], concedidas);

      expect(link(linha(host, 'i1'))?.getAttribute('href')).toBe('/acessos/concessoes/c9');
      expect(link(linha(host, 'i1'))?.getAttribute('aria-label')).toBe(
        'Ver a concessão de Fernanda Drumond ao perfil Operador de inscrições',
      );
    });

    it('o item pendente não leva à concessão', async () => {
      const { host } = await abrirRevisao([ok(revisao())], [CONDUZIR, ADMINISTRAR_CONCESSOES]);

      expect(link(linha(host, 'i1'))).toBeNull();
    });

    it('sem permissão de ler concessões, o item decidido não mostra o link', async () => {
      const { host } = await abrirRevisao([ok(revisao())], [CONSULTAR]);

      expect(link(linha(host, 'i2'))).toBeNull();
    });
  });

  describe('confirmação', () => {
    it('confirma o item, avisa e relê a revisão', async () => {
      api.confirmar.mockReturnValue(of(ok(undefined)));
      const decidida = revisao({ itens: [itemDecidido()] });
      const { host } = await abrirRevisao([ok(revisao()), ok(decidida)]);

      botao(linha(host, 'i1'), 'Confirmar').click();
      await assentar();

      expect(api.confirmar).toHaveBeenCalledWith(ID, 'i1', expect.anything());
      expect(notificacoes.success).toHaveBeenCalledWith('Acesso mantido');
      expect(botoes(linha(host, 'i1'))).toEqual([]);
    });

    it('com o decisor mudado (422), mostra o título da recusa e recarrega o item com quem decide agora', async () => {
      api.confirmar.mockReturnValue(
        of(recusaPeloInterceptor(DECISOR_MUDOU, 422, 'O item cabe à outra governança')),
      );
      const relida = revisao({ itens: [item({ decide: 'gestor-de-acessos' })] });
      const { host } = await abrirRevisao([ok(revisao()), ok(relida)]);

      botao(linha(host, 'i1'), 'Confirmar').click();
      await assentar();

      expect(host.textContent).toContain('Quem decide o item mudou');
      expect(host.textContent).toContain('O item cabe à outra governança');
      expect(linha(host, 'i1').textContent).toContain('Gestão de acessos');
      expect(botoes(linha(host, 'i1'))).toEqual([]);
    });

    it('com decisão concorrente (409), avisa e mostra a decisão já gravada', async () => {
      api.confirmar.mockReturnValue(
        of(recusaPeloInterceptor('uniplus.autorizacao.revisao.item_ja_decidido', 409, 'x')),
      );
      const relida = revisao({ itens: [itemDecidido({ id: 'i1', situacao: 'revogada' })] });
      const { host } = await abrirRevisao([ok(revisao()), ok(relida)]);

      botao(linha(host, 'i1'), 'Confirmar').click();
      await assentar();

      expect(host.textContent).toContain('Decisão concorrente');
      expect(host.textContent).toContain('O item da revisão já foi decidido.');
      expect(linha(host, 'i1').textContent).toContain('Acesso revogado');
    });

    it('a recusa que não muda a revisão fica no aviso, sem reler', async () => {
      api.confirmar.mockReturnValue(
        of(recusaPeloInterceptor('uniplus.autorizacao.revisao.decisor_e_beneficiario', 422, 'x')),
      );
      const { host } = await abrirRevisao();

      botao(linha(host, 'i1'), 'Confirmar').click();
      await assentar();

      expect(host.textContent).toContain('Não foi possível decidir o item');
      expect(host.textContent).toContain('Ninguém decide o item da própria concessão.');
      expect(botoes(linha(host, 'i1'))).toEqual(['Confirmar', 'Revogar']);
    });
  });

  describe('revogação', () => {
    it('pede o motivo antes de enviar', async () => {
      const { host } = await abrirRevisao();

      botao(linha(host, 'i1'), 'Revogar').click();
      await assentar();
      botao(document.body, 'Revogar acesso').click();
      await assentar();

      expect(api.revogar).not.toHaveBeenCalled();
      expect(document.body.textContent).toContain('Informe o motivo');
    });

    it('revoga com o motivo, fecha o diálogo e relê', async () => {
      api.revogar.mockReturnValue(of(ok(undefined)));
      const { host } = await abrirRevisao();

      await revogarComMotivo(host, 'i1');

      expect(api.revogar).toHaveBeenCalledWith(
        ID,
        'i1',
        { motivo: 'Mudou de setor.' },
        expect.anything(),
      );
      expect(notificacoes.success).toHaveBeenCalledWith('Acesso revogado');
      expect(dialogoAberto()).toBe(false);
    });

    it('com o decisor mudado (422), fecha o diálogo, avisa e relê o item', async () => {
      api.revogar.mockReturnValue(
        of(recusaPeloInterceptor(DECISOR_MUDOU, 422, 'O item cabe à outra governança')),
      );
      const relida = revisao({ itens: [item({ decide: 'gestor-de-acessos' })] });
      const { host } = await abrirRevisao([ok(revisao()), ok(relida)]);

      await revogarComMotivo(host, 'i1');

      expect(dialogoAberto()).toBe(false);
      expect(host.textContent).toContain('Quem decide o item mudou');
      expect(linha(host, 'i1').textContent).toContain('Gestão de acessos');
      expect(botoes(linha(host, 'i1'))).toEqual([]);
    });

    it('com decisão concorrente (409), fecha o diálogo e mostra a decisão já gravada', async () => {
      api.revogar.mockReturnValue(
        of(recusaPeloInterceptor('uniplus.autorizacao.revisao.item_ja_decidido', 409, 'x')),
      );
      const relida = revisao({ itens: [itemDecidido({ id: 'i1' })] });
      const { host } = await abrirRevisao([ok(revisao()), ok(relida)]);

      await revogarComMotivo(host, 'i1');

      expect(dialogoAberto()).toBe(false);
      expect(host.textContent).toContain('Decisão concorrente');
      expect(linha(host, 'i1').textContent).toContain('Acesso mantido');
    });

    it('a recusa que não muda a revisão fica no diálogo, que segue aberto, sem reler', async () => {
      api.revogar.mockReturnValue(
        of(recusaPeloInterceptor('uniplus.autorizacao.revisao.decisor_e_beneficiario', 422, 'x')),
      );
      const { host } = await abrirRevisao();

      await revogarComMotivo(host, 'i1');

      expect(dialogoAberto()).toBe(true);
      expect(document.body.textContent).toContain('Ninguém decide o item da própria concessão.');
      expect(botoes(linha(host, 'i1'))).toEqual(['Confirmar', 'Revogar']);
    });
  });
});
