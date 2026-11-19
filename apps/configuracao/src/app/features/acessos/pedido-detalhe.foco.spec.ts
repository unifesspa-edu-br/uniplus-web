import { TestBed } from '@angular/core/testing';
import { Subject, of } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { ok, pedido, recusa } from './testes';
import {
  presente,
  MENSAGEM_DA_FALHA,
  servidorIndisponivel,
  GESTOR,
  esperar,
  botao,
  noResumo,
  decidirNoResumo,
  confirmarNoDialogo,
  recusarComMotivo,
  dialogoAberto,
  textoDoAlerta,
  dublesDoPedido,
  abrirPedido,
} from './pedido-detalhe.page.testing';

describe('PedidoDetalhePage — foco e falha da recarga', () => {
  const dubles = dublesDoPedido();
  const { api } = dubles;
  const abrir = abrirPedido(dubles);

  describe('foco depois de uma decisão aceita', () => {
    const seguinte = () =>
      pedido({ situacao: 'aguardando_protecao_de_dados', etapaAtual: 'protecao_de_dados' });

    async function decidirComRecargaPendente(acao: 'aprovar' | 'recusar') {
      const aberta = await abrir([GESTOR]);
      const { fixture, host } = aberta;
      document.body.append(host);
      const recarga = new Subject<ReturnType<typeof ok>>();
      api.obter.mockReturnValue(recarga);
      api[acao].mockReturnValue(of(ok(seguinte())));
      presente(botao(noResumo(host), acao === 'aprovar' ? 'Aprovar' : 'Recusar')).focus();
      if (acao === 'aprovar') {
        await decidirNoResumo(fixture, host, 'Aprovar');
        await confirmarNoDialogo(fixture, host);
      } else {
        await recusarComMotivo(fixture, host, 'Sem necessidade funcional.');
      }
      return { ...aberta, recarga };
    }

    const concluirRecarga = async (cena: Awaited<ReturnType<typeof decidirComRecargaPendente>>) => {
      cena.recarga.next(ok(seguinte()));
      cena.recarga.complete();
      await esperar(cena.fixture);
      await esperar(cena.fixture);
    };

    it.each(['aprovar', 'recusar'] as const)(
      'depois de %s, terminada a recarga, o foco livre vai ao título do pedido',
      async (acao) => {
        const cena = await decidirComRecargaPendente(acao);
        const titulo = presente(cena.host.querySelector('#cfg-pedido-titulo'));
        expect(document.activeElement).not.toBe(titulo);

        await concluirRecarga(cena);

        expect(document.activeElement).toBe(titulo);
        cena.host.remove();
      },
    );

    it('não tira o foco de quem o levou a outro lugar durante a recarga', async () => {
      const cena = await decidirComRecargaPendente('aprovar');
      const voltar = presente(cena.host.querySelector<HTMLAnchorElement>('.page-header a'));
      voltar.focus();

      await concluirRecarga(cena);

      expect(document.activeElement).toBe(voltar);
      cena.host.remove();
    });

    it('terminada a devolução, uma nova carga não repete o foco no título', async () => {
      const cena = await decidirComRecargaPendente('aprovar');
      await concluirRecarga(cena);
      presente(cena.host.querySelector<HTMLAnchorElement>('.page-header a')).focus();
      (document.activeElement as HTMLElement).blur();

      api.obter.mockReturnValue(of(ok(pedido({ id: 'outro' }))));
      cena.fixture.componentRef.setInput('id', 'outro');
      await esperar(cena.fixture);
      await esperar(cena.fixture);

      expect(document.activeElement).toBe(document.body);
      cena.host.remove();
    });

    it('se a recarga da decisão falha, a decisão não leva o foco ao título numa carga posterior', async () => {
      const cena = await decidirComRecargaPendente('aprovar');
      cena.recarga.next(servidorIndisponivel());
      cena.recarga.complete();
      await esperar(cena.fixture);
      await esperar(cena.fixture);
      presente(cena.host.querySelector<HTMLAnchorElement>('.page-header a')).focus();
      (document.activeElement as HTMLElement).blur();

      api.obter.mockReturnValue(of(ok(pedido({ id: 'outro' }))));
      cena.fixture.componentRef.setInput('id', 'outro');
      await esperar(cena.fixture);
      await esperar(cena.fixture);

      expect(document.activeElement).toBe(document.body);
      cena.host.remove();
    });

    it('a decisão recusada pela API não leva o foco ao título', async () => {
      const { fixture, host } = await abrir([GESTOR]);
      document.body.append(host);
      api.aprovar.mockReturnValue(of(recusa('uniplus.autorizacao.pedido.decisor_e_parte')));
      presente(botao(noResumo(host), 'Aprovar')).focus();

      await decidirNoResumo(fixture, host, 'Aprovar');
      await confirmarNoDialogo(fixture, host);
      await esperar(fixture);

      expect(document.activeElement).not.toBe(host.querySelector('#cfg-pedido-titulo'));
      host.remove();
    });
  });

  it.each(['aprovar', 'recusar'] as const)(
    'fecha o diálogo de %s quando a recarga falha e permite tentar novamente',
    async (acao) => {
      const { fixture, host } = await abrir([GESTOR]);
      document.body.append(host);
      const recarga = new Subject<ReturnType<typeof ok>>();
      api.obter.mockReturnValue(recarga);
      api[acao].mockReturnValue(of(recusa('uniplus.autorizacao.pedido.situacao_invalida')));
      if (acao === 'aprovar') {
        await decidirNoResumo(fixture, host, 'Aprovar');
        await confirmarNoDialogo(fixture, host);
      } else {
        await recusarComMotivo(fixture, host, 'Motivo');
      }
      const decisoes = [...host.querySelectorAll<HTMLButtonElement>('cfg-pedido-resumo .btn')];
      expect(decisoes.map((botao) => botao.getAttribute('aria-disabled'))).toEqual([
        'true',
        'true',
      ]);
      decisoes.forEach((botao) => botao.click());
      fixture.detectChanges();
      expect(api[acao]).toHaveBeenCalledTimes(1);

      recarga.next(servidorIndisponivel());
      recarga.complete();
      await esperar(fixture);
      await esperar(fixture);
      const tentar = host.querySelector<HTMLButtonElement>('#tentar-pedido');
      expect(dialogoAberto(host, 'ui-dialog')).toBe(false);
      expect(dialogoAberto(host, 'cfg-motivo-dialog')).toBe(false);
      expect(textoDoAlerta(host)).toContain(MENSAGEM_DA_FALHA);
      expect(document.activeElement).toBe(tentar);
      const nova = new Subject<ReturnType<typeof ok>>();
      api.obter.mockReturnValue(nova);
      tentar?.click();
      await esperar(fixture);
      expect(api.obter).toHaveBeenCalledTimes(3);
      expect(host.querySelector('#tentar-pedido')).toBe(tentar);
      expect(tentar?.getAttribute('aria-disabled')).toBe('true');
      expect(tentar?.getAttribute('aria-busy')).toBe('true');
      expect(document.activeElement).toBe(tentar);
      tentar?.click();
      expect(api.obter).toHaveBeenCalledTimes(3);

      nova.next(ok(pedido()));
      nova.complete();
      await esperar(fixture);
      await esperar(fixture);
      expect(host.querySelector('#tentar-pedido')).toBeNull();
      expect(textoDoAlerta(host) ?? '').not.toContain(MENSAGEM_DA_FALHA);
      expect(document.activeElement).toBe(host.querySelector('#cfg-pedido-titulo'));
      host.remove();
    },
  );

  beforeEach(() => TestBed.resetTestingModule());
});
