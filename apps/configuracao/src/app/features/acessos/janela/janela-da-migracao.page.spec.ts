import {
  FormaDoEncerramento,
  ResultadoDaMigracao,
  SituacaoDaMigracao,
} from '@uniplus/shared-data/autorizacao';
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
const CONJUNTO_DE_CONCESSOES = janelaDeMigracao({ itens: [BETINA, LEANDRO, REBECA] });
const ENCERRADA = janelaDeMigracao({
  situacao: 'encerrada',
  encerradaEm: '2026-11-11T09:00:00Z',
  forma: FormaDoEncerramento.PRAZO,
  decisoesEnviadas: true,
  itens: [itemDaJanela({ concessaoId: 'c1', situacao: SituacaoDaMigracao.NAO_MIGRADA })],
});
const CONJUNTO_ENVIADO = janelaDeMigracao({ ...CONJUNTO_DE_CONCESSOES, decisoesEnviadas: true });
const TODAS_APROVADAS = {
  decisoes: [
    { concessaoId: 'c1', decisao: ResultadoDaMigracao.MIGRAR },
    { concessaoId: 'c2', decisao: ResultadoDaMigracao.MIGRAR },
  ],
  confirmacaoDeExclusao: false,
};
const UMA_RECUSADA = {
  decisoes: [
    { concessaoId: 'c1', decisao: ResultadoDaMigracao.MIGRAR },
    { concessaoId: 'c2', decisao: ResultadoDaMigracao.RECUSAR },
  ],
  confirmacaoDeExclusao: true,
};

type Revisao = Awaited<ReturnType<typeof abrirJanela>>;

async function aprovarTodasEEnviar({ host, assentar }: Revisao): Promise<void> {
  presente(botao(host, 'Aprovar todas')).click();
  await assentar();
  presente(botao(host, 'Enviar as decisões')).click();
}

async function pedirConfirmacaoDaExclusao({ host, assentar }: Revisao): Promise<HTMLElement> {
  presente(botao(host, 'Aprovar todas')).click();
  escolher(linhaDe(host, 'c2'), 'Recusar');
  await assentar();
  presente(botao(host, 'Enviar as decisões')).click();
  await assentar();
  return presente(host.querySelector<HTMLElement>('cfg-exclusao-dialog'));
}

describe('página de revisão das concessões', () => {
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
    it('mostra o prazo da revisão, o que falta e a versão de destino', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-11-10T10:30:00Z'));

      const { host } = await abrirJanela(CONJUNTO_DE_CONCESSOES);

      expect(host.querySelector('h1')?.textContent).toContain('Revisão das concessões do perfil');
      const prazo = presente(host.querySelector('cfg-prazo-da-janela'));
      expect(prazo.textContent).toContain('12/11/2026');
      expect(prazo.textContent).toContain('49 h 30 min');
      expect(prazo.textContent).toContain('Aberta');
      expect(prazo.textContent).toContain('versão 2');
    });

    it('revisão encerrada mostra quando e como terminou', async () => {
      const { host } = await abrirJanela(ENCERRADA);

      const prazo = presente(host.querySelector('cfg-prazo-da-janela')).textContent;
      expect(prazo).toContain('Encerrada em');
      expect(prazo).toContain('O prazo de 72 horas terminou.');
      expect(prazo).not.toContain('Tempo restante');
    });

    it('revisão encerrada mostra a concessão sem aprovação e nenhuma ação', async () => {
      const { host } = await abrirJanela(ENCERRADA);

      expect(host.textContent).toContain('Não aprovada no prazo');
      expect(host.querySelector('cfg-encerramento-da-janela')).toBeNull();
      expect(host.querySelector('input[type="radio"]')).toBeNull();
    });

    it('a falha de leitura oferece tentar novamente e lê de novo', async () => {
      const { host, falhar, responder } = montarJanela();
      await falhar(503);

      expect(host.textContent).toContain('Não foi possível carregar a revisão das concessões');
      const tentar = presente(botao(host, 'Tentar novamente'));
      tentar.click();
      await responder(CONJUNTO_DE_CONCESSOES);

      expect(host.textContent).not.toContain('Não foi possível carregar a revisão das concessões');
      expect(host.textContent).toContain('Betina Teste');
    });

    it('perfil sem revisão mostra a recusa sem oferecer nova tentativa', async () => {
      const { host, falhar } = montarJanela();
      await falhar(404, 'uniplus.autorizacao.revisao_das_concessoes.revisao_nao_encontrada');

      expect(host.textContent).toContain('Revisão das concessões não encontrada');
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
      it('volta, de um perfil sem revisão, à primeira tela que abre', async () => {
        const { host, falhar } = montarJanela(concedidas);
        await falhar(404, 'uniplus.autorizacao.revisao_das_concessoes.revisao_nao_encontrada');

        const link = [...host.querySelectorAll('a')].find((a) => a.textContent?.trim() === rotulo);
        expect(link?.getAttribute('href')).toBe(destino);
      });
    });
  });

  it('diz que a versão com permissão pessoal ou sensível passa pelo Representante do controlador', async () => {
    const { host } = await abrirJanela(CONJUNTO_DE_CONCESSOES);

    expect(host.querySelector('.page-header__desc')?.textContent?.replace(/\s+/g, ' ')).toContain(
      'pessoal ou sensível, do Representante do controlador.',
    );
  });

  describe('envio da gestão de acessos', () => {
    it('lista cada concessão da versão anterior com opções de aprovação e recusa, e deixa a própria retida sem ação', async () => {
      const { host } = await abrirJanela(CONJUNTO_DE_CONCESSOES);

      expect(linhaDe(host, 'c1').querySelectorAll('input[type="radio"]')).toHaveLength(2);
      expect(linhaDe(host, 'c2').textContent).toContain('Leandro Teste');
      expect(linhaDe(host, 'c2').textContent).toContain('CEPS');
      const propria = linhaDe(host, 'c3');
      expect(propria.querySelector('input')).toBeNull();
      expect(propria.textContent).toContain('(você)');
      expect(host.textContent).toContain('Retidas: outra pessoa decide');
    });

    it('segura o envio com a lista incompleta e diz quantas faltam', async () => {
      const { host, assentar } = await abrirJanela(CONJUNTO_DE_CONCESSOES);
      expect(presente(botao(host, 'Enviar as decisões')).disabled).toBe(true);
      expect(host.textContent).toContain('Faltam 2 concessões para enviar as decisões.');

      escolher(linhaDe(host, 'c1'), 'Aprovar');
      await assentar();

      expect(host.textContent).toContain('Falta 1 concessão para enviar as decisões.');
      expect(presente(botao(host, 'Enviar as decisões')).disabled).toBe(true);
    });

    it('habilita o envio quando a lista está completa', async () => {
      const { host, fixture, assentar } = await abrirJanela(CONJUNTO_DE_CONCESSOES);

      escolher(linhaDe(host, 'c1'), 'Aprovar');
      escolher(linhaDe(host, 'c2'), 'Aprovar');
      await assentar();
      fixture.detectChanges();

      expect(presente(botao(host, 'Enviar as decisões')).disabled).toBe(false);
    });

    it('aprovar todas e recusar todas preenchem a lista inteira', async () => {
      const { host, assentar } = await abrirJanela(CONJUNTO_DE_CONCESSOES);

      presente(botao(host, 'Aprovar todas')).click();
      await assentar();
      expect(presente(botao(host, 'Enviar as decisões')).disabled).toBe(false);

      presente(botao(host, 'Recusar todas')).click();
      await assentar();
      const marcados = [...host.querySelectorAll('tr[data-concessao-id="c1"] input:checked')];
      expect(marcados.map((m) => m.closest('label')?.textContent?.trim())).toEqual(['Recusar']);
    });

    describe('sem recusa', () => {
      beforeEach(() => api.enviarLote.mockReturnValue(of(ok(CONJUNTO_DE_CONCESSOES))));

      it('envia as decisões diretamente, sem pedir confirmação', async () => {
        const revisao = await abrirJanela(CONJUNTO_DE_CONCESSOES);

        await aprovarTodasEEnviar(revisao);
        await revisao.responder(CONJUNTO_ENVIADO);

        const chamada = [CONJUNTO_DE_CONCESSOES.perfilId, TODAS_APROVADAS, expect.anything()];
        expect(api.enviarLote).toHaveBeenCalledWith(...chamada);
      });

      it('avisa que as decisões foram enviadas', async () => {
        const revisao = await abrirJanela(CONJUNTO_DE_CONCESSOES);

        await aprovarTodasEEnviar(revisao);
        await revisao.responder(CONJUNTO_ENVIADO);

        expect(notificacoes.success).toHaveBeenCalledWith('Decisões enviadas');
        expect(revisao.host.textContent).toContain(
          'As decisões da gestão de acessos já foram enviadas',
        );
      });
    });

    describe('com recusa', () => {
      beforeEach(() => api.enviarLote.mockReturnValue(of(ok(CONJUNTO_DE_CONCESSOES))));

      it('avisa que o acesso será revogado e só envia depois da confirmação', async () => {
        const dialogo = await pedirConfirmacaoDaExclusao(await abrirJanela(CONJUNTO_DE_CONCESSOES));

        expect(dialogo.textContent).toContain('1 concessão recusada perde o acesso');
        expect(api.enviarLote).not.toHaveBeenCalled();
      });

      it('exige marcar a confirmação e leva o foco a ela', async () => {
        const revisao = await abrirJanela(CONJUNTO_DE_CONCESSOES);
        const dialogo = await pedirConfirmacaoDaExclusao(revisao);

        presente(botao(dialogo, 'Recusar e enviar as decisões')).click();
        await revisao.assentar();

        const caixa = presente(dialogo.querySelector<HTMLInputElement>('input[type="checkbox"]'));
        expect(api.enviarLote).not.toHaveBeenCalled();
        expect(caixa.getAttribute('aria-invalid')).toBe('true');
        expect(document.activeElement).toBe(caixa);
      });

      it('envia as decisões com a confirmação da exclusão', async () => {
        const revisao = await abrirJanela(CONJUNTO_DE_CONCESSOES);
        const dialogo = await pedirConfirmacaoDaExclusao(revisao);

        presente(dialogo.querySelector<HTMLInputElement>('input[type="checkbox"]')).click();
        await revisao.assentar();
        presente(botao(dialogo, 'Recusar e enviar as decisões')).click();
        await revisao.responder(CONJUNTO_ENVIADO);

        expect(api.enviarLote.mock.calls[0]?.[1]).toEqual(UMA_RECUSADA);
      });
    });

    describe('com o envio incompleto na API', () => {
      beforeEach(() => {
        const erro = recusa('uniplus.autorizacao.revisao_das_concessoes.decisoes_incompletas', 422);
        api.enviarLote.mockReturnValue(of(erro));
      });

      it('mostra a recusa junto ao envio e leva o foco a ela', async () => {
        const revisao = await abrirJanela(CONJUNTO_DE_CONCESSOES);

        await aprovarTodasEEnviar(revisao);
        await revisao.assentar();

        const erro = presente(revisao.host.querySelector<HTMLElement>('#cfg-lote-erro'));
        expect(erro.textContent).toContain('O envio não decide todas as concessões');
        expect(document.activeElement).toBe(erro);
      });

      it('mantém o envio habilitado para a pessoa tentar de novo', async () => {
        const revisao = await abrirJanela(CONJUNTO_DE_CONCESSOES);

        await aprovarTodasEEnviar(revisao);
        await revisao.assentar();

        expect(presente(botao(revisao.host, 'Enviar as decisões')).disabled).toBe(false);
      });
    });

    it('decisões já enviadas por outra pessoa relê a revisão e mantém a explicação à vista', async () => {
      api.enviarLote.mockReturnValue(
        of(recusa('uniplus.autorizacao.revisao_das_concessoes.decisoes_ja_enviadas', 409)),
      );
      const { host, assentar, responder } = await abrirJanela(CONJUNTO_DE_CONCESSOES);
      presente(botao(host, 'Aprovar todas')).click();
      await assentar();

      presente(botao(host, 'Enviar as decisões')).click();
      await responder(janelaDeMigracao({ ...CONJUNTO_DE_CONCESSOES, decisoesEnviadas: true }));

      expect(host.textContent).toContain('A revisão das concessões mudou');
      expect(host.textContent).toContain('As decisões já foram enviadas para esta revisão.');
      expect(host.querySelector('#cfg-lote-erro')).toBeNull();
    });

    it('falha que não veio da API libera o envio e explica junto ao botão', async () => {
      api.enviarLote.mockReturnValue(throwError(() => new Error('rede')));
      const { host, assentar } = await abrirJanela(CONJUNTO_DE_CONCESSOES);
      presente(botao(host, 'Aprovar todas')).click();
      await assentar();

      presente(botao(host, 'Enviar as decisões')).click();
      await assentar();

      expect(host.querySelector('#cfg-lote-erro')?.textContent).toContain(
        'Não foi possível concluir a operação.',
      );
      expect(presente(botao(host, 'Enviar as decisões')).disabled).toBe(false);
    });

    it('sem a permissão da gestão de acessos, consulta a lista sem decidir', async () => {
      const { host } = await abrirJanela(CONJUNTO_DE_CONCESSOES, []);

      expect(host.textContent).toContain('O envio das decisões cabe à gestão de acessos');
      expect(host.textContent).toContain('Betina Teste');
      expect(host.querySelector('input[type="radio"]')).toBeNull();
      expect(botao(host, 'Enviar as decisões')).toBeUndefined();
    });

    it('bloqueia a decisão enquanto o envio é gravado', async () => {
      api.enviarLote.mockReturnValue(NEVER);
      const { host, assentar } = await abrirJanela(CONJUNTO_DE_CONCESSOES);
      presente(botao(host, 'Aprovar todas')).click();
      await assentar();

      presente(botao(host, 'Enviar as decisões')).click();
      await assentar();

      expect(presente(botao(host, 'Enviar as decisões')).disabled).toBe(true);
      expect(presente(botao(host, 'Aprovar todas')).disabled).toBe(true);
      expect(
        host.querySelector<HTMLInputElement>('input[type="radio"]')?.closest('fieldset')?.disabled,
      ).toBe(true);
    });
  });

  it('a permissão de gestão de acessos libera o envio e o encerramento', async () => {
    const { host } = await abrirJanela(CONJUNTO_DE_CONCESSOES, [GESTAO_DE_ACESSOS]);

    expect(botao(host, 'Enviar as decisões')).toBeDefined();
    expect(host.querySelector('cfg-encerramento-da-janela')).not.toBeNull();
  });
});
