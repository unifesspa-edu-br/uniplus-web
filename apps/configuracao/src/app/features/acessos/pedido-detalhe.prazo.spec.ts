import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ok, pedido } from './testes';
import {
  presente,
  GESTOR,
  PROTECAO_DE_DADOS,
  decidirNoResumo,
  confirmarNoDialogo,
  dublesDoPedido,
  abrirPedido,
} from './pedido-detalhe.page.testing';

describe('PedidoDetalhePage — fim de vigência', () => {
  const dubles = dublesDoPedido();
  const { api } = dubles;
  const abrir = abrirPedido(dubles);

  describe('fim de vigência', () => {
    const campo = (host: HTMLElement) => host.querySelector<HTMLInputElement>('input[type="date"]');
    const digitar = (host: HTMLElement, valor: string) => {
      const el = presente(campo(host));
      el.value = valor;
      el.dispatchEvent(new Event('input'));
    };

    it('o gestor vê o campo pré-preenchido com o prazo sugerido e o envia ao aprovar', async () => {
      const { fixture, host } = await abrir(
        [GESTOR],
        pedido({ validaAteSugerida: '2099-06-15T15:00:00Z' }),
      );
      api.aprovar.mockReturnValue(of(ok(pedido({ situacao: 'aguardando_protecao_de_dados' }))));

      expect(campo(host)?.value).toBe('2099-06-15');
      await decidirNoResumo(fixture, host, 'Aprovar');
      await confirmarNoDialogo(fixture, host);

      expect(api.aprovar).toHaveBeenCalledWith(
        'pedido-1',
        expect.anything(),
        expect.stringMatching(/^2099-06-15T23:59:59[+-]\d{2}:\d{2}$/),
      );
    });

    it('o gestor limpa o prazo sugerido e aprova sem validaAte', async () => {
      const { fixture, host } = await abrir(
        [GESTOR],
        pedido({ validaAteSugerida: '2099-06-15T15:00:00Z' }),
      );
      api.aprovar.mockReturnValue(of(ok(pedido())));

      digitar(host, '');
      await decidirNoResumo(fixture, host, 'Aprovar');
      await confirmarNoDialogo(fixture, host);

      expect(api.aprovar).toHaveBeenCalledWith('pedido-1', expect.anything(), null);
    });

    it('não pré-preenche uma sugestão que já venceu', async () => {
      const { host } = await abrir([GESTOR], pedido({ validaAteSugerida: '2020-01-01T15:00:00Z' }));

      expect(campo(host)?.value).toBe('');
    });

    it('o erro e o aria-invalid somem quando o gestor corrige a data', async () => {
      const { host, fixture } = await abrir([GESTOR]);
      digitar(host, '2020-01-01');
      await decidirNoResumo(fixture, host, 'Aprovar');
      expect(campo(host)?.getAttribute('aria-invalid')).toBe('true');

      digitar(host, '2099-01-01');
      fixture.detectChanges();

      expect(campo(host)?.getAttribute('aria-invalid')).toBeNull();
      expect(host.querySelector('#cfg-pedido-prazo-erro')).toBeNull();
    });

    it('recusa data passada, liga o erro ao campo e não abre a confirmação', async () => {
      const { host, fixture } = await abrir([GESTOR]);

      digitar(host, '2020-01-01');
      await decidirNoResumo(fixture, host, 'Aprovar');

      expect(api.aprovar).not.toHaveBeenCalled();
      expect(campo(host)?.getAttribute('aria-describedby')).toContain('cfg-pedido-prazo-erro');
      expect(host.querySelector('#cfg-pedido-prazo-erro')?.textContent).toContain('já passou');
    });

    it('ao aprovar com prazo inválido, o resumo encaminha o foco ao campo', async () => {
      const { host, fixture } = await abrir([GESTOR]);
      digitar(host, '2020-01-01');
      const focar = vi.spyOn(presente(campo(host)), 'focus');

      await decidirNoResumo(fixture, host, 'Aprovar');

      expect(focar).toHaveBeenCalled();
      expect(campo(host)?.getAttribute('aria-invalid')).toBe('true');
      expect(api.aprovar).not.toHaveBeenCalled();
    });

    it('perfil que não admite prazo não mostra o campo e aprova sem validaAte', async () => {
      const { fixture, host } = await abrir([GESTOR], pedido({ admitePrazo: false }));
      api.aprovar.mockReturnValue(of(ok(pedido())));

      expect(campo(host)).toBeNull();
      await decidirNoResumo(fixture, host, 'Aprovar');
      await confirmarNoDialogo(fixture, host);

      expect(api.aprovar).toHaveBeenCalledWith('pedido-1', expect.anything(), null);
    });

    it('na etapa do Representante do controlador não há campo, mas o prazo do gestor aparece', async () => {
      const { fixture, host } = await abrir(
        [PROTECAO_DE_DADOS],
        pedido({
          situacao: 'aguardando_protecao_de_dados',
          etapaAtual: 'protecao_de_dados',
          validaAte: '2099-06-15T23:59:59-03:00',
        }),
      );
      api.aprovar.mockReturnValue(of(ok(pedido())));

      expect(campo(host)).toBeNull();
      expect(host.textContent).toContain('Fim de vigência definido pela gestão de acessos');
      await decidirNoResumo(fixture, host, 'Aprovar');
      await confirmarNoDialogo(fixture, host);
      expect(api.aprovar).toHaveBeenCalledWith('pedido-1', expect.anything(), null);
    });
  });

  beforeEach(() => TestBed.resetTestingModule());
});
