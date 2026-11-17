import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProblemI18nService } from '@uniplus/shared-core/http';
import { ligarRelogioControlado, passarOTempo } from '@uniplus/shared-testing';

import {
  type AvaliacaoDaInscricaoEstado,
  ESPERA_DA_CONSULTA_MS,
} from './avaliacao-da-inscricao.estado';
import {
  type ServicoDublê,
  avaliacao,
  comSegundaOpcao,
  criarEstado,
  falha,
  inicioPadrao,
  modalidadesDe,
  mudar,
  ok,
} from './avaliacao-da-inscricao.estado.testing';

const FORA_DO_PERIODO = 'uniplus.selecao.inscricao.fora_do_periodo';
const FALHA_GENERICA = 'Não foi possível atualizar agora.';
const FALHAS_GENERICAS: [number, string][] = [
  [400, 'uniplus.validacao.invalida'],
  [403, 'uniplus.autorizacao.negada'],
  [409, 'uniplus.selecao.inscricao.conflito'],
  [503, 'uniplus.internal.unexpected'],
  [0, 'uniplus.rede.sem_resposta'],
];

describe('AvaliacaoDaInscricaoEstado: resposta da consulta', () => {
  let estado: AvaliacaoDaInscricaoEstado;
  let servico: ServicoDublê;

  const nomes = (): string[] => estado.naTela()?.modalidades?.itens.map((m) => m.nome) ?? [];
  const consultar = async (): Promise<void> => {
    mudar(estado, { respostas: { CONCORRER_EP: true } });
    await passarOTempo(ESPERA_DA_CONSULTA_MS);
  };

  beforeEach(() => {
    ligarRelogioControlado();
    ({ estado, servico } = criarEstado());
  });
  afterEach(() => vi.useRealTimers());

  it('a resposta válida adota as modalidades, a 2ª opção e os documentos, e encerra o cálculo', async () => {
    await consultar();
    expect(estado.naTela()?.calculando).toBe(true);

    servico.responder(
      0,
      ok({ ...avaliacao('Escola pública'), modalidadesSegundaOpcao: modalidadesDe('Cotas') }),
    );

    expect(nomes()).toEqual(['Escola pública']);
    expect(estado.naTela()?.modalidadesSegundaOpcao?.itens.map((m) => m.nome)).toEqual(['Cotas']);
    expect(estado.naTela()?.documentos?.fases[0].pendencias[0].rotulo).toBe(
      'Renda de Escola pública',
    );
    expect(estado.naTela()).toMatchObject({ calculando: false, erro: null });
    expect(estado.respondidas()).toBe(1);
  });

  it('a resposta sem 2ª opção limpa a 2ª opção que estava à vista', async () => {
    estado.aplicarDaGravacao(comSegundaOpcao('Cotas'), estado.revisao());
    await consultar();

    servico.responder(0, ok(avaliacao('Escola pública')));

    expect(nomes()).toEqual(['Escola pública']);
    expect(estado.naTela()?.modalidadesSegundaOpcao).toBeNull();
  });

  it('a falha fora do período mostra o título do problema', async () => {
    await consultar();

    servico.responder(0, falha(422, FORA_DO_PERIODO, 'Inscrições encerradas'));

    expect(estado.naTela()?.erro).toBe('Inscrições encerradas');
  });

  it('a falha fora do período mostra o título que a tradução do problema define', async () => {
    TestBed.inject(ProblemI18nService).register(FORA_DO_PERIODO, { title: 'O período terminou' });
    await consultar();

    servico.responder(0, falha(422, FORA_DO_PERIODO, 'Inscrições encerradas'));

    expect(estado.naTela()?.erro).toBe('O período terminou');
  });

  it.each(FALHAS_GENERICAS)(
    'a falha %i (%s) mostra a mensagem genérica, sem o título do problema',
    async (status, codigo) => {
      await consultar();

      servico.responder(0, falha(status, codigo, 'Título que não aparece'));

      expect(estado.naTela()?.erro).toBe(FALHA_GENERICA);
    },
  );

  it('a falha encerra o cálculo, mantém o que estava à vista e conta como consulta respondida', async () => {
    await consultar();

    servico.responder(0, falha(503, 'uniplus.internal.unexpected'));

    expect(estado.naTela()).toMatchObject({ calculando: false, erro: FALHA_GENERICA });
    expect(estado.naTela()?.documentos?.fases).toHaveLength(1);
    expect(nomes()).toEqual(['Ampla concorrência']);
    expect(estado.respondidas()).toBe(1);
  });

  it('a falha de uma consulta já superada não mostra erro nem conta como respondida', async () => {
    await consultar();
    mudar(estado, { respostas: { CONCORRER_EP: false } });

    servico.responder(0, falha(503, 'uniplus.internal.unexpected'));

    expect(estado.naTela()).toMatchObject({ calculando: true, erro: null });
    expect(estado.respondidas()).toBe(0);
  });

  it('tentar de novo e receber a avaliação limpa o erro e adota o resultado', async () => {
    await consultar();
    servico.responder(0, falha(503, 'uniplus.internal.unexpected'));

    estado.tentarDeNovo();
    await passarOTempo(ESPERA_DA_CONSULTA_MS);
    servico.responder(1, ok(avaliacao('Escola pública')));

    expect(nomes()).toEqual(['Escola pública']);
    expect(estado.naTela()?.erro).toBeNull();
    expect(estado.respondidas()).toBe(2);
  });

  it('tentar de novo sem consulta anterior não consulta', async () => {
    estado.tentarDeNovo();
    await passarOTempo(ESPERA_DA_CONSULTA_MS);

    expect(servico.consultas).toHaveLength(0);
    expect(estado.naTela()?.calculando).toBe(false);
  });

  it('tentar de novo repete o corpo da última consulta, também a da reavaliação', async () => {
    estado.reavaliar(() => ({ respostas: { RENDA: 900 }, grupos: null }));
    await passarOTempo(ESPERA_DA_CONSULTA_MS);

    estado.tentarDeNovo();
    await passarOTempo(ESPERA_DA_CONSULTA_MS);

    expect(servico.corpos().map((c) => c.respostas)).toEqual([{ RENDA: 900 }, { RENDA: 900 }]);
  });

  it('iniciar de novo esquece a última consulta: tentar de novo não a repete', async () => {
    await consultar();
    estado.iniciar(inicioPadrao());

    estado.tentarDeNovo();
    await passarOTempo(ESPERA_DA_CONSULTA_MS);

    expect(servico.consultas).toHaveLength(1);
  });

  it('reavaliar consulta mesmo sem mudança de resposta e descarta o que o salvar anterior trouxe', async () => {
    const revisaoDoSalvar = estado.revisao();

    estado.reavaliar(() => ({ respostas: {}, grupos: null }));
    estado.aplicarDaGravacao(avaliacao('Escola pública'), revisaoDoSalvar);
    await passarOTempo(ESPERA_DA_CONSULTA_MS);

    expect(servico.consultas).toHaveLength(1);
    expect(nomes()).toEqual(['Ampla concorrência']);
  });

  it('a mudança de resposta avança a revisão e só consulta depois da espera', async () => {
    const revisao = estado.revisao();
    mudar(estado, { respostas: { CONCORRER_EP: true } });
    await passarOTempo(ESPERA_DA_CONSULTA_MS - 1);
    expect(servico.consultas).toHaveLength(0);

    await passarOTempo(1);
    expect(servico.consultas).toHaveLength(1);
    expect(estado.revisao()).toBe(revisao + 1);
  });
});
