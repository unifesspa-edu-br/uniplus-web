import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AnuncioDaConclusao } from '@uniplus/shared-ui/components';

import {
  botaoDeTentar,
  CenarioDoComprovante,
  falha,
  hrefDe,
  macrotarefa,
} from './comprovante-da-inscricao.page.testing';

describe('ComprovanteDaInscricaoPage', () => {
  let cenario: CenarioDoComprovante;

  beforeEach(() => {
    cenario = CenarioDoComprovante.preparar();
  });

  afterEach(() => {
    cenario.encerrar();
  });

  describe('aviso de validade', () => {
    const AVISO = 'Documento sem validade: inscrição cancelada em 07/11/2026 às 22:32:05';
    const cancelamento = { canceladaEm: '2026-11-08T01:32:05Z', motivo: null, aviso: AVISO };
    const avisoNaTela = (tela: HTMLElement): string | null =>
      tela.querySelector('.documento__aviso')?.textContent?.trim() ?? null;

    it('aparece quando o comprovante traz o cancelamento', async () => {
      cenario.alteracoes = { cancelamento };

      const tela = await cenario.abrir();

      expect(avisoNaTela(tela)).toBe(AVISO);
      expect(tela.querySelector('.documento__aviso-marca')?.textContent?.trim()).toBe(AVISO);
    });

    it('some ao trocar para um envio sem cancelamento', async () => {
      cenario.alteracoes = { cancelamento };
      const tela = await cenario.abrir('2');
      expect(avisoNaTela(tela)).toBe(AVISO);

      cenario.alteracoes = { cancelamento: null };
      await cenario.trocarPara('1');

      expect(avisoNaTela(tela)).toBeNull();
      expect(tela.querySelector('.documento__aviso-marca')).toBeNull();
    });

    it('não sobrevive a uma recusa', async () => {
      cenario.alteracoes = { cancelamento };
      const tela = await cenario.abrir('2');
      expect(avisoNaTela(tela)).toBe(AVISO);

      vi.spyOn(cenario.servico, 'comprovante').mockReturnValue(
        of(falha(404, 'uniplus.nao_encontrado')),
      );
      await cenario.trocarPara('1');

      expect(tela.textContent).toContain('Comprovante não encontrado');
      expect(avisoNaTela(tela)).toBeNull();
      expect(tela.querySelector('.documento__aviso-marca')).toBeNull();
    });
  });

  describe('recusas que a página explica', () => {
    const voltaParaALista = (tela: HTMLElement): string | null | undefined =>
      hrefDe(tela, 'Voltar às minhas inscrições');

    it('a inscrição cancelada (422) explica que não há comprovante, sem nova tentativa nem impressão', async () => {
      vi.spyOn(cenario.servico, 'comprovante').mockReturnValue(
        of(falha(422, 'uniplus.selecao.inscricao.comprovante_de_inscricao_cancelada')),
      );

      const tela = await cenario.abrir();

      expect(tela.textContent).toContain('Esta inscrição foi cancelada');
      expect(tela.textContent).toContain('não tem comprovante');
      expect(botaoDeTentar(tela)).toBeUndefined();
      expect(tela.textContent).not.toContain('Imprimir comprovante');
      expect(voltaParaALista(tela)).toBe('/inscricao');
    });

    it('a versão fixada ausente (422) diz que o comprovante não pôde ser montado, sem nova tentativa', async () => {
      vi.spyOn(cenario.servico, 'comprovante').mockReturnValue(
        of(falha(422, 'uniplus.selecao.snapshot.vigente_ausente')),
      );

      const tela = await cenario.abrir();

      expect(tela.textContent).toContain('Não foi possível montar o comprovante');
      expect(tela.textContent).toContain('Sua inscrição continua registrada');
      expect(botaoDeTentar(tela)).toBeUndefined();
      expect(voltaParaALista(tela)).toBe('/inscricao');
    });

    it('os textos das recusas não trazem código nem rótulo interno', async () => {
      for (const code of [
        'uniplus.selecao.inscricao.comprovante_de_inscricao_cancelada',
        'uniplus.selecao.snapshot.vigente_ausente',
      ]) {
        cenario.reiniciar();
        vi.spyOn(cenario.servico, 'comprovante').mockReturnValue(of(falha(422, code)));

        const tela = await cenario.abrir();

        expect(tela.textContent).not.toMatch(/uniplus\.|snapshot|vigente|422/i);
      }
    });

    it('o 404 mostra o não encontrado, sem nova tentativa e com o caminho de volta', async () => {
      vi.spyOn(cenario.servico, 'comprovante').mockReturnValue(of(falha(404, 'nao_encontrado')));

      const tela = await cenario.abrir();

      expect(tela.textContent).toContain('Não encontramos este comprovante');
      expect(botaoDeTentar(tela)).toBeUndefined();
      expect(voltaParaALista(tela)).toBe('/inscricao');
    });

    it.each(['foo', '0', '-1', '1.5'])(
      'o número %s, que não é de comprovante, não chega à API',
      async (numero) => {
        const ler = vi.spyOn(cenario.servico, 'comprovante');

        const tela = await cenario.abrir(numero);

        expect(tela.textContent).toContain('Não encontramos este comprovante');
        expect(ler).not.toHaveBeenCalled();
      },
    );
  });

  describe('nova tentativa depois da falha', () => {
    const indisponivel = () => falha(503, 'indisponivel', 'Serviço indisponível');

    it('o 422 que a página não conhece segue como falha, com nova tentativa', async () => {
      vi.spyOn(cenario.servico, 'comprovante').mockReturnValue(
        of(falha(422, 'uniplus.outra', 'Recusado')),
      );

      const tela = await cenario.abrir();

      expect(botaoDeTentar(tela)).toBeDefined();
      expect(tela.textContent).not.toContain('Imprimir comprovante');
    });

    it('a leitura que dá certo tira o alerta e deixa o foco no título, sem somar o aviso de conclusão', async () => {
      vi.spyOn(cenario.servico, 'comprovante').mockReturnValueOnce(of(indisponivel()));
      const tela = await cenario.abrir();
      const anunciar = vi.spyOn(TestBed.inject(AnuncioDaConclusao), 'anunciar');
      const tentar = botaoDeTentar(tela) as HTMLButtonElement;
      tentar.focus();

      tentar.click();
      await cenario.atualizar();
      await macrotarefa();
      await cenario.atualizar();

      expect(tela.querySelector('.alert__title')).toBeNull();
      expect(tela.textContent).toContain('Imprimir comprovante');
      expect(document.activeElement).toBe(tela.querySelector('h1'));
      expect(anunciar).not.toHaveBeenCalled();
    });

    it('503 seguido de recusa termina na explicação, sem botão e sem aviso de conclusão', async () => {
      vi.spyOn(cenario.servico, 'comprovante')
        .mockReturnValueOnce(of(indisponivel()))
        .mockReturnValueOnce(
          of(falha(422, 'uniplus.selecao.inscricao.comprovante_de_inscricao_cancelada')),
        );
      const tela = await cenario.abrir();
      const anunciar = vi.spyOn(TestBed.inject(AnuncioDaConclusao), 'anunciar');
      expect(botaoDeTentar(tela)).toBeDefined();

      botaoDeTentar(tela)?.click();
      await cenario.atualizar();
      await macrotarefa();
      await cenario.atualizar();

      expect(tela.textContent).toContain('Esta inscrição foi cancelada');
      expect(botaoDeTentar(tela)).toBeUndefined();
      expect(anunciar).not.toHaveBeenCalled();
    });
  });
});
