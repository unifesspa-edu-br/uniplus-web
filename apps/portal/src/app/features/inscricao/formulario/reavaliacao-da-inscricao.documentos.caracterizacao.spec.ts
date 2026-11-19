import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { passarOTempo } from '@uniplus/shared-testing';

import { CenarioDaReavaliacao, corpoDaConsulta } from './reavaliacao-da-inscricao.testing';

describe('ReavaliacaoDaInscricao: mudança dos documentos', () => {
  let cenario: CenarioDaReavaliacao;

  beforeEach(async () => {
    cenario = CenarioDaReavaliacao.preparar();
    await cenario.acompanhar();
  });
  afterEach(() => cenario.encerrar());

  it('o envio que nasce sem mudança não relê a revisão nem reavalia', async () => {
    await passarOTempo(60_000);

    expect(cenario.relerARevisao).not.toHaveBeenCalled();
    expect(cenario.servico.consultas).toHaveLength(0);
  });

  it('enviar ou remover um arquivo relê a revisão e só depois reavalia', async () => {
    cenario.mudancasDoEnvio.set(1);
    await cenario.esperarAConsulta(0);
    expect(cenario.relerARevisao).toHaveBeenCalledTimes(1);
    expect(cenario.servico.consultas).toHaveLength(0);

    cenario.releitura.next();
    await cenario.esperarAConsulta(0);

    expect(cenario.servico.consultas).toHaveLength(1);
  });

  it('reavalia com as respostas que estão na tela e as ofertas escolhidas agora', async () => {
    cenario.simulacao.set({ respostas: { CONCORRER_EP: false } });
    cenario.escolhidas.set({ ofertaCursoId: 'oferta-2', ofertaCursoSegundaOpcaoId: 'oferta-3' });

    await cenario.mudarOsDocumentos();
    await cenario.concluirAReleitura();

    expect(cenario.servico.corpos()).toEqual([
      corpoDaConsulta({ CONCORRER_EP: false }, 'oferta-2', 'oferta-3'),
    ]);
  });

  it('cada mudança dos documentos relê a revisão', async () => {
    cenario.mudancasDoEnvio.set(1);
    await passarOTempo(0);
    cenario.mudancasDoEnvio.set(2);
    await passarOTempo(0);

    expect(cenario.relerARevisao).toHaveBeenCalledTimes(2);
  });

  it('sem o envio de documentos do processo, nada muda para reavaliar', async () => {
    cenario.envio.set(null);
    cenario.mudancasDoEnvio.set(3);

    await passarOTempo(60_000);

    expect(cenario.relerARevisao).not.toHaveBeenCalled();
  });

  it('sem formulário na tela relê a revisão mas não reavalia', async () => {
    cenario.formulario.set(undefined);
    await cenario.mudarOsDocumentos();

    await cenario.concluirAReleitura();

    expect(cenario.servico.consultas).toHaveLength(0);
  });

  it('sem inscrição lida relê a revisão mas não reavalia', async () => {
    cenario.inscricao.set(null);
    await cenario.mudarOsDocumentos();

    await cenario.concluirAReleitura();

    expect(cenario.servico.consultas).toHaveLength(0);
  });

  it('o arquivo novo em verificação recomeça pela espera curta', async () => {
    cenario.emVerificacao.set(true);
    await cenario.esperarAConsulta(1000);
    await cenario.responderAUltima();
    await cenario.esperarAConsulta(2000);
    await cenario.mudarOsDocumentos();
    await cenario.concluirAReleitura();

    await cenario.responderAUltima();
    await cenario.esperarAConsulta(1000);

    expect(cenario.servico.consultas).toHaveLength(4);
  });
});

describe('ReavaliacaoDaInscricao: respostas e oferta da tela', () => {
  let cenario: CenarioDaReavaliacao;

  beforeEach(async () => {
    cenario = CenarioDaReavaliacao.preparar();
    await cenario.acompanhar();
  });
  afterEach(() => cenario.encerrar());

  it('a resposta que mudou consulta com as respostas da tela, o nulo das apagadas e as ofertas', async () => {
    cenario.inscricao.update((i) =>
      i ? { ...i, formulario: { ...i.formulario, respostas: { RENDA: 900 } } } : i,
    );

    cenario.reavaliacao.respostasMudaram({ respostas: { CONCORRER_EP: true } });
    await cenario.esperarAConsulta(0);

    expect(cenario.servico.corpos()).toEqual([
      corpoDaConsulta({ CONCORRER_EP: true, RENDA: null }),
    ]);
  });

  it('sem inscrição lida a resposta que mudou não consulta', async () => {
    cenario.inscricao.set(null);

    cenario.reavaliacao.respostasMudaram({ respostas: { CONCORRER_EP: true } });
    await cenario.esperarAConsulta(0);

    expect(cenario.servico.consultas).toHaveLength(0);
  });

  it('a oferta que mudou consulta com as ofertas escolhidas e a simulação do formulário', async () => {
    cenario.escolhidas.set({ ofertaCursoId: 'oferta-2', ofertaCursoSegundaOpcaoId: null });

    cenario.reavaliacao.ofertaMudou();
    await cenario.esperarAConsulta(0);

    expect(cenario.servico.corpos()).toEqual([corpoDaConsulta({ CONCORRER_EP: true }, 'oferta-2')]);
  });

  it('a oferta que mudou, sem formulário ou sem inscrição na tela, não consulta', async () => {
    cenario.escolhidas.set({ ofertaCursoId: 'oferta-2', ofertaCursoSegundaOpcaoId: null });
    cenario.formulario.set(undefined);
    cenario.reavaliacao.ofertaMudou();
    cenario.formulario.set({
      simulacao: cenario.simulacao,
      haArquivoEmVerificacao: cenario.emVerificacao,
    });
    cenario.inscricao.set(null);

    cenario.reavaliacao.ofertaMudou();
    await cenario.esperarAConsulta(0);

    expect(cenario.servico.consultas).toHaveLength(0);
  });
});
