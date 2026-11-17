import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { passarOTempo } from '@uniplus/shared-testing';

import { falha } from './avaliacao-da-inscricao.estado.testing';
import { CenarioDaReavaliacao, corpoDaConsulta } from './reavaliacao-da-inscricao.testing';

describe('ReavaliacaoDaInscricao: verificação dos arquivos', () => {
  let cenario: CenarioDaReavaliacao;

  beforeEach(async () => {
    cenario = CenarioDaReavaliacao.preparar();
    await cenario.acompanhar();
  });
  afterEach(() => cenario.encerrar());

  it('sem arquivo em verificação nunca reavalia', async () => {
    await passarOTempo(60_000);

    expect(cenario.servico.consultas).toHaveLength(0);
  });

  it('com arquivo em verificação reavalia a avaliação da tela depois da primeira espera', async () => {
    cenario.emVerificacao.set(true);
    await passarOTempo(999);
    expect(cenario.servico.consultas).toHaveLength(0);

    await cenario.esperarAConsulta(1);

    expect(cenario.servico.corpos()).toEqual([corpoDaConsulta({ CONCORRER_EP: true })]);
  });

  it('repete enquanto há verificação, com a espera crescente entre uma consulta e a seguinte', async () => {
    cenario.emVerificacao.set(true);
    await cenario.esperarAConsulta(1000);
    await cenario.responderAUltima();

    await passarOTempo(1999);
    expect(cenario.servico.consultas).toHaveLength(1);

    await cenario.esperarAConsulta(1);
    expect(cenario.servico.consultas).toHaveLength(2);
  });

  it('a consulta que falha também agenda a seguinte', async () => {
    cenario.emVerificacao.set(true);
    await cenario.esperarAConsulta(1000);

    await cenario.responderAUltima(falha(503, 'uniplus.internal.unexpected'));
    await cenario.esperarAConsulta(2000);

    expect(cenario.servico.consultas).toHaveLength(2);
  });

  it('para quando o resultado chega: sem arquivo em verificação não consulta mais', async () => {
    cenario.emVerificacao.set(true);
    await cenario.esperarAConsulta(1000);

    cenario.emVerificacao.set(false);
    await cenario.responderAUltima();
    await passarOTempo(60_000);

    expect(cenario.servico.consultas).toHaveLength(1);
  });

  it('a espera volta ao começo quando termina a verificação e outro arquivo entra em verificação', async () => {
    cenario.emVerificacao.set(true);
    await cenario.esperarAConsulta(1000);
    cenario.emVerificacao.set(false);
    await cenario.responderAUltima();

    cenario.emVerificacao.set(true);
    await passarOTempo(0);
    await cenario.esperarAConsulta(1000);

    expect(cenario.servico.consultas).toHaveLength(2);
  });

  it('sem formulário na tela não há o que verificar', async () => {
    cenario.emVerificacao.set(true);
    cenario.formulario.set(undefined);

    await passarOTempo(60_000);

    expect(cenario.servico.consultas).toHaveLength(0);
  });

  it('sair da tela cancela a consulta pendente', async () => {
    cenario.emVerificacao.set(true);
    await passarOTempo(500);

    TestBed.resetTestingModule();
    await vi.advanceTimersByTimeAsync(60_000);

    expect(cenario.servico.consultas).toHaveLength(0);
  });

  it('com gravação em andamento a consulta da verificação é adiada para a próxima espera', async () => {
    cenario.bloqueada.set(true);
    cenario.emVerificacao.set(true);
    await cenario.esperarAConsulta(1000);
    expect(cenario.servico.consultas).toHaveLength(0);

    cenario.bloqueada.set(false);
    await cenario.esperarAConsulta(2000);

    expect(cenario.servico.consultas).toHaveLength(1);
  });
});

describe('ReavaliacaoDaInscricao: visibilidade da aba', () => {
  let cenario: CenarioDaReavaliacao;

  beforeEach(() => {
    cenario = CenarioDaReavaliacao.preparar();
  });
  afterEach(() => cenario.encerrar());

  it('com a aba oculta ninguém vê o resultado: a espera é cancelada e nada é consultado', async () => {
    await cenario.acompanhar();
    cenario.emVerificacao.set(true);
    await passarOTempo(500);

    await cenario.mudarAAba('hidden');
    await passarOTempo(60_000);

    expect(cenario.servico.consultas).toHaveLength(0);
  });

  it('voltar à aba retoma a verificação pela espera curta', async () => {
    await cenario.acompanhar();
    cenario.emVerificacao.set(true);
    await cenario.mudarAAba('hidden');
    await passarOTempo(60_000);

    await cenario.mudarAAba('visible');
    await passarOTempo(999);
    expect(cenario.servico.consultas).toHaveLength(0);

    await cenario.esperarAConsulta(1);
    expect(cenario.servico.consultas).toHaveLength(1);
  });

  it('ocultar a aba sem arquivo em verificação não consulta nem ao voltar', async () => {
    await cenario.acompanhar();

    await cenario.mudarAAba('hidden');
    await cenario.mudarAAba('visible');
    await passarOTempo(60_000);

    expect(cenario.servico.consultas).toHaveLength(0);
  });

  it('a aba já oculta quando a página nasce conta como visível até o navegador avisar', async () => {
    cenario.definirAVisibilidade('hidden');
    await cenario.acompanhar();

    cenario.emVerificacao.set(true);
    await cenario.esperarAConsulta(1000);

    expect(cenario.servico.consultas).toHaveLength(1);
  });
});
