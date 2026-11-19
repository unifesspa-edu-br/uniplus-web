import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { NEVER, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ok, recusa } from '../testes';
import { itemDaJanela, janelaDeMigracao } from './janela.testing';
import {
  GESTAO_DE_ACESSOS,
  PROTECAO_DE_DADOS,
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
const ENCERRADA = janelaDeMigracao({
  situacao: 'encerrada',
  encerradaEm: '2026-11-11T09:00:00Z',
  forma: 'prazo',
  loteEnviado: true,
  itens: [itemDaJanela({ concessaoId: 'c1', situacao: 'nao_migrada' })],
});
const LOTE_ENVIADO = janelaDeMigracao({ ...LOTE, loteEnviado: true });
const TODAS_MIGRADAS = {
  decisoes: [
    { concessaoId: 'c1', decisao: 'migrar' },
    { concessaoId: 'c2', decisao: 'migrar' },
  ],
  confirmacaoDeExclusao: false,
};
const UMA_RECUSADA = {
  decisoes: [
    { concessaoId: 'c1', decisao: 'migrar' },
    { concessaoId: 'c2', decisao: 'recusar' },
  ],
  confirmacaoDeExclusao: true,
};

type Janela = Awaited<ReturnType<typeof abrirJanela>>;

async function migrarTodasEEnviar({ host, assentar }: Janela): Promise<void> {
  presente(botao(host, 'Migrar todas')).click();
  await assentar();
  presente(botao(host, 'Enviar o lote')).click();
}

async function pedirConfirmacaoDaExclusao({ host, assentar }: Janela): Promise<HTMLElement> {
  presente(botao(host, 'Migrar todas')).click();
  escolher(linhaDe(host, 'c2'), 'Recusar');
  await assentar();
  presente(botao(host, 'Enviar o lote')).click();
  await assentar();
  return presente(host.querySelector<HTMLElement>('cfg-exclusao-dialog'));
}

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

    it('janela encerrada mostra quando e como terminou', async () => {
      const { host } = await abrirJanela(ENCERRADA);

      const prazo = presente(host.querySelector('cfg-prazo-da-janela')).textContent;
      expect(prazo).toContain('Encerrada em');
      expect(prazo).toContain('O prazo de 72 horas terminou.');
      expect(prazo).not.toContain('Tempo restante');
    });

    it('janela encerrada mostra a concessão não migrada e nenhuma ação', async () => {
      const { host } = await abrirJanela(ENCERRADA);

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

    describe.each([
      [
        'mantém perfis',
        ['autorizacao:perfis:manter', GESTAO_DE_ACESSOS],
        'Ir para os perfis',
        '/acessos/perfis',
      ],
      [
        'só aprova a proteção de dados',
        [PROTECAO_DE_DADOS],
        'Ir para os perfis',
        '/acessos/perfis',
      ],
      [
        'só aprova nas duas etapas',
        [GESTAO_DE_ACESSOS, PROTECAO_DE_DADOS],
        'Ir para os perfis',
        '/acessos/perfis',
      ],
    ])('quem %s', (_quem, concedidas, rotulo, destino) => {
      it('volta, de um perfil sem janela, à primeira tela que abre', async () => {
        const { host, falhar } = montarJanela(concedidas);
        await falhar(404, 'uniplus.autorizacao.migracao.janela_nao_encontrada');

        const link = [...host.querySelectorAll('a')].find((a) => a.textContent?.trim() === rotulo);
        expect(link?.getAttribute('href')).toBe(destino);
      });
    });
  });

    it('diz que a versão com permissão pessoal ou sensível passa pelo Representante do controlador', async () => {
      const { host } = await abrirJanela(LOTE);

      expect(host.querySelector('.page-header__desc')?.textContent?.replace(/\s+/g, ' ')).toContain(
        'pessoal ou sensível, do Representante do controlador.',
      );
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

    it('segura o envio com a lista incompleta e diz quantas faltam', async () => {
      const { host, assentar } = await abrirJanela(LOTE);
      expect(presente(botao(host, 'Enviar o lote')).disabled).toBe(true);
      expect(host.textContent).toContain('Faltam 2 concessões para enviar o lote.');

      escolher(linhaDe(host, 'c1'), 'Migrar');
      await assentar();

      expect(host.textContent).toContain('Falta 1 concessão para enviar o lote.');
      expect(presente(botao(host, 'Enviar o lote')).disabled).toBe(true);
    });

    it('habilita o envio quando a lista está completa', async () => {
      const { host, fixture, assentar } = await abrirJanela(LOTE);

      escolher(linhaDe(host, 'c1'), 'Migrar');
      escolher(linhaDe(host, 'c2'), 'Migrar');
      await assentar();
      fixture.detectChanges();

      expect(presente(botao(host, 'Enviar o lote')).disabled).toBe(false);
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

    describe('sem recusa', () => {
      beforeEach(() => api.enviarLote.mockReturnValue(of(ok(LOTE))));

      it('envia o lote direto, sem pedir confirmação', async () => {
        const janela = await abrirJanela(LOTE);

        await migrarTodasEEnviar(janela);
        await janela.responder(LOTE_ENVIADO);

        const chamada = [LOTE.perfilId, TODAS_MIGRADAS, expect.anything()];
        expect(api.enviarLote).toHaveBeenCalledWith(...chamada);
      });

      it('avisa que o lote foi enviado', async () => {
        const janela = await abrirJanela(LOTE);

        await migrarTodasEEnviar(janela);
        await janela.responder(LOTE_ENVIADO);

        expect(notificacoes.success).toHaveBeenCalledWith('Lote enviado');
        expect(janela.host.textContent).toContain('O lote da gestão de acessos já foi enviado');
      });
    });

    describe('com recusa', () => {
      beforeEach(() => api.enviarLote.mockReturnValue(of(ok(LOTE))));

      it('avisa que o acesso será revogado e só envia depois da confirmação', async () => {
        const dialogo = await pedirConfirmacaoDaExclusao(await abrirJanela(LOTE));

        expect(dialogo.textContent).toContain('1 concessão recusada perde o acesso');
        expect(api.enviarLote).not.toHaveBeenCalled();
      });

      it('exige marcar a confirmação e leva o foco a ela', async () => {
        const janela = await abrirJanela(LOTE);
        const dialogo = await pedirConfirmacaoDaExclusao(janela);

        presente(botao(dialogo, 'Recusar e enviar o lote')).click();
        await janela.assentar();

        const caixa = presente(dialogo.querySelector<HTMLInputElement>('input[type="checkbox"]'));
        expect(api.enviarLote).not.toHaveBeenCalled();
        expect(caixa.getAttribute('aria-invalid')).toBe('true');
        expect(document.activeElement).toBe(caixa);
      });

      it('envia o lote com a confirmação da exclusão', async () => {
        const janela = await abrirJanela(LOTE);
        const dialogo = await pedirConfirmacaoDaExclusao(janela);

        presente(dialogo.querySelector<HTMLInputElement>('input[type="checkbox"]')).click();
        await janela.assentar();
        presente(botao(dialogo, 'Recusar e enviar o lote')).click();
        await janela.responder(LOTE_ENVIADO);

        expect(api.enviarLote.mock.calls[0]?.[1]).toEqual(UMA_RECUSADA);
      });
    });

    describe('com o lote incompleto na API', () => {
      beforeEach(() => {
        const erro = recusa('uniplus.autorizacao.migracao.lote_incompleto', 422);
        api.enviarLote.mockReturnValue(of(erro));
      });

      it('mostra a recusa junto ao envio e leva o foco a ela', async () => {
        const janela = await abrirJanela(LOTE);

        await migrarTodasEEnviar(janela);
        await janela.assentar();

        const erro = presente(janela.host.querySelector<HTMLElement>('#cfg-lote-erro'));
        expect(erro.textContent).toContain('O lote não decide todas as concessões');
        expect(document.activeElement).toBe(erro);
      });

      it('mantém o envio habilitado para a pessoa tentar de novo', async () => {
        const janela = await abrirJanela(LOTE);

        await migrarTodasEEnviar(janela);
        await janela.assentar();

        expect(presente(botao(janela.host, 'Enviar o lote')).disabled).toBe(false);
      });
    });

    it('lote já enviado por outra pessoa relê a janela e mantém a explicação à vista', async () => {
      api.enviarLote.mockReturnValue(
        of(recusa('uniplus.autorizacao.migracao.lote_ja_enviado', 409)),
      );
      const { host, assentar, responder } = await abrirJanela(LOTE);
      presente(botao(host, 'Migrar todas')).click();
      await assentar();

      presente(botao(host, 'Enviar o lote')).click();
      await responder(janelaDeMigracao({ ...LOTE, loteEnviado: true }));

      expect(host.textContent).toContain('A janela mudou');
      expect(host.textContent).toContain('O lote da gestão de acessos já foi enviado.');
      expect(host.querySelector('#cfg-lote-erro')).toBeNull();
    });

    it('falha que não veio da API libera o envio e explica junto ao botão', async () => {
      api.enviarLote.mockReturnValue(throwError(() => new Error('rede')));
      const { host, assentar } = await abrirJanela(LOTE);
      presente(botao(host, 'Migrar todas')).click();
      await assentar();

      presente(botao(host, 'Enviar o lote')).click();
      await assentar();

      expect(host.querySelector('#cfg-lote-erro')?.textContent).toContain(
        'Não foi possível concluir a operação.',
      );
      expect(presente(botao(host, 'Enviar o lote')).disabled).toBe(false);
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
      expect(
        host.querySelector<HTMLInputElement>('input[type="radio"]')?.closest('fieldset')?.disabled,
      ).toBe(true);
    });
  });

  it('a permissão de gestão de acessos libera o lote e o encerramento', async () => {
    const { host } = await abrirJanela(LOTE, [GESTAO_DE_ACESSOS]);

    expect(botao(host, 'Enviar o lote')).toBeDefined();
    expect(host.querySelector('cfg-encerramento-da-janela')).not.toBeNull();
  });
});
