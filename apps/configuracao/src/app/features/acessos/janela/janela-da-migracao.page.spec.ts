import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { NEVER, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ok, recusa } from '../testes';
import { itemDaJanela, janelaDeMigracao } from './janela.testing';
import {
  abrirJanela,
  api,
  botao,
  escolher,
  linhaDe,
  montarJanela,
  notificacoes,
  presente,
} from './pagina-da-janela.testing';

const BETINA = itemDaJanela({ concessaoId: 'c1', beneficiarioNome: 'Betina Teste' });
const LEANDRO = itemDaJanela({ concessaoId: 'c2', beneficiarioNome: 'Leandro Teste' });
const REBECA = itemDaJanela({
  concessaoId: 'c3',
  beneficiarioNome: 'Rebeca Teste',
  ehDoLeitor: true,
});
const LOTE = janelaDeMigracao({ itens: [BETINA, LEANDRO, REBECA] });

describe('JanelaDaMigracaoPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    document.body.innerHTML = '';
    vi.useRealTimers();
  });

  describe('leitura e prazo', () => {
    it('mostra o prazo da janela, o que falta e a versão de destino', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-11-10T10:30:00Z'));

      const { host } = await abrirJanela(LOTE);

      expect(host.querySelector('h1')?.textContent).toContain('Janela de migração');
      const prazo = presente(host.querySelector('cfg-prazo-da-janela'));
      expect(prazo.textContent).toContain('12/11/2026');
      expect(prazo.textContent).toContain('49 h 30 min');
      expect(prazo.textContent).toContain('Aberta');
      expect(prazo.textContent).toContain('versão 2');
    });

    it('janela encerrada mostra quando e como terminou, e nenhuma ação', async () => {
      const encerrada = janelaDeMigracao({
        situacao: 'encerrada',
        encerradaEm: '2026-11-11T09:00:00Z',
        forma: 'prazo',
        loteEnviado: true,
        itens: [itemDaJanela({ concessaoId: 'c1', situacao: 'nao_migrada' })],
      });

      const { host } = await abrirJanela(encerrada);

      const prazo = presente(host.querySelector('cfg-prazo-da-janela')).textContent;
      expect(prazo).toContain('Encerrada em');
      expect(prazo).toContain('O prazo de 72 horas terminou.');
      expect(prazo).not.toContain('Tempo restante');
      expect(host.textContent).toContain('Não migrada no prazo');
      expect(host.querySelector('cfg-encerramento-da-janela')).toBeNull();
      expect(host.querySelector('input[type="radio"]')).toBeNull();
    });

    it('a falha de leitura oferece tentar novamente e lê de novo', async () => {
      const { host, falhar, responder } = montarJanela();
      await falhar(503);

      expect(host.textContent).toContain('Não foi possível carregar a janela');
      const tentar = presente(botao(host, 'Tentar novamente'));
      tentar.click();
      await responder(LOTE);

      expect(host.textContent).not.toContain('Não foi possível carregar a janela');
      expect(host.textContent).toContain('Betina Teste');
    });

    it('perfil sem janela mostra a recusa sem oferecer nova tentativa', async () => {
      const { host, falhar } = montarJanela();
      await falhar(404, 'uniplus.autorizacao.migracao.janela_nao_encontrada');

      expect(host.textContent).toContain('O perfil não tem janela de migração');
      expect(botao(host, 'Tentar novamente')).toBeUndefined();
    });
  });

  describe('lote da gestão de acessos', () => {
    it('lista cada concessão da versão anterior com migrar e recusar, e deixa a própria retida sem ação', async () => {
      const { host } = await abrirJanela(LOTE);

      expect(linhaDe(host, 'c1').querySelectorAll('input[type="radio"]')).toHaveLength(2);
      expect(linhaDe(host, 'c2').textContent).toContain('Leandro Teste');
      expect(linhaDe(host, 'c2').textContent).toContain('CEPS');
      const propria = linhaDe(host, 'c3');
      expect(propria.querySelector('input')).toBeNull();
      expect(propria.textContent).toContain('(você)');
      expect(host.textContent).toContain('Retidas: outra pessoa decide');
    });

    it('só habilita o envio com a lista completa e diz quantas faltam', async () => {
      const { host, fixture, assentar } = await abrirJanela(LOTE);
      const enviar = () => presente(botao(host, 'Enviar o lote'));

      expect(enviar().disabled).toBe(true);
      expect(host.textContent).toContain('Faltam 2 concessões para enviar o lote.');

      escolher(linhaDe(host, 'c1'), 'Migrar');
      await assentar();
      expect(host.textContent).toContain('Falta 1 concessão para enviar o lote.');
      expect(enviar().disabled).toBe(true);

      escolher(linhaDe(host, 'c2'), 'Migrar');
      await assentar();
      fixture.detectChanges();
      expect(enviar().disabled).toBe(false);
    });

    it('migrar todas e recusar todas preenchem a lista inteira', async () => {
      const { host, assentar } = await abrirJanela(LOTE);

      presente(botao(host, 'Migrar todas')).click();
      await assentar();
      expect(presente(botao(host, 'Enviar o lote')).disabled).toBe(false);

      presente(botao(host, 'Recusar todas')).click();
      await assentar();
      const marcados = [...host.querySelectorAll('tr[data-concessao-id="c1"] input:checked')];
      expect(marcados.map((m) => m.closest('label')?.textContent?.trim())).toEqual(['Recusar']);
    });

    it('sem recusa, envia o lote direto, sem pedir confirmação', async () => {
      api.enviarLote.mockReturnValue(of(ok(LOTE)));
      const { host, assentar, responder } = await abrirJanela(LOTE);

      presente(botao(host, 'Migrar todas')).click();
      await assentar();
      presente(botao(host, 'Enviar o lote')).click();
      await responder(janelaDeMigracao({ ...LOTE, loteEnviado: true }));

      expect(api.enviarLote).toHaveBeenCalledWith(
        LOTE.perfilId,
        {
          decisoes: [
            { concessaoId: 'c1', decisao: 'migrar' },
            { concessaoId: 'c2', decisao: 'migrar' },
          ],
          confirmacaoDeExclusao: false,
        },
        expect.anything(),
      );
      expect(notificacoes.success).toHaveBeenCalledWith('Lote enviado');
      expect(host.textContent).toContain('O lote da gestão de acessos já foi enviado');
    });

    it('com recusa, avisa que o acesso será revogado e só envia depois da confirmação', async () => {
      api.enviarLote.mockReturnValue(of(ok(LOTE)));
      const { host, assentar, responder } = await abrirJanela(LOTE);
      presente(botao(host, 'Migrar todas')).click();
      escolher(linhaDe(host, 'c2'), 'Recusar');
      await assentar();

      presente(botao(host, 'Enviar o lote')).click();
      await assentar();
      const dialogo = presente(host.querySelector('cfg-exclusao-dialog'));
      expect(dialogo.textContent).toContain('1 concessão recusada perde o acesso');
      expect(api.enviarLote).not.toHaveBeenCalled();

      presente(botao(dialogo, 'Recusar e enviar o lote')).click();
      await assentar();
      const caixa = presente(dialogo.querySelector<HTMLInputElement>('input[type="checkbox"]'));
      expect(api.enviarLote).not.toHaveBeenCalled();
      expect(caixa.getAttribute('aria-invalid')).toBe('true');
      expect(document.activeElement).toBe(caixa);

      caixa.click();
      await assentar();
      presente(botao(dialogo, 'Recusar e enviar o lote')).click();
      await responder(janelaDeMigracao({ ...LOTE, loteEnviado: true }));

      expect(api.enviarLote.mock.calls[0]?.[1]).toEqual({
        decisoes: [
          { concessaoId: 'c1', decisao: 'migrar' },
          { concessaoId: 'c2', decisao: 'recusar' },
        ],
        confirmacaoDeExclusao: true,
      });
    });

    it('mostra a recusa da API junto ao envio e leva o foco a ela', async () => {
      api.enviarLote.mockReturnValue(
        of(recusa('uniplus.autorizacao.migracao.lote_incompleto', 422)),
      );
      const { host, assentar } = await abrirJanela(LOTE);
      presente(botao(host, 'Migrar todas')).click();
      await assentar();

      presente(botao(host, 'Enviar o lote')).click();
      await assentar();

      const erro = presente(host.querySelector<HTMLElement>('#cfg-lote-erro'));
      expect(erro.textContent).toContain('O lote não decide todas as concessões da versão anterior.');
      expect(document.activeElement).toBe(erro);
      expect(presente(botao(host, 'Enviar o lote')).disabled).toBe(false);
    });

    it('lote já enviado por outra pessoa relê a janela e mantém a explicação à vista', async () => {
      api.enviarLote.mockReturnValue(of(recusa('uniplus.autorizacao.migracao.lote_ja_enviado', 409)));
      const { host, assentar, responder } = await abrirJanela(LOTE);
      presente(botao(host, 'Migrar todas')).click();
      await assentar();

      presente(botao(host, 'Enviar o lote')).click();
      await responder(janelaDeMigracao({ ...LOTE, loteEnviado: true }));

      expect(host.textContent).toContain('A janela mudou');
      expect(host.textContent).toContain('O lote da gestão de acessos já foi enviado.');
      expect(host.querySelector('#cfg-lote-erro')).toBeNull();
    });

    it('sem a permissão da gestão de acessos, consulta a lista sem decidir', async () => {
      const { host } = await abrirJanela(LOTE, []);

      expect(host.textContent).toContain('O lote cabe à gestão de acessos');
      expect(host.textContent).toContain('Betina Teste');
      expect(host.querySelector('input[type="radio"]')).toBeNull();
      expect(botao(host, 'Enviar o lote')).toBeUndefined();
    });

    it('bloqueia a decisão enquanto o lote é gravado', async () => {
      api.enviarLote.mockReturnValue(NEVER);
      const { host, assentar } = await abrirJanela(LOTE);
      presente(botao(host, 'Migrar todas')).click();
      await assentar();

      presente(botao(host, 'Enviar o lote')).click();
      await assentar();

      expect(presente(botao(host, 'Enviar o lote')).disabled).toBe(true);
      expect(presente(botao(host, 'Migrar todas')).disabled).toBe(true);
      expect(host.querySelector<HTMLInputElement>('input[type="radio"]')?.closest('fieldset')?.disabled).toBe(true);
    });
  });
});
