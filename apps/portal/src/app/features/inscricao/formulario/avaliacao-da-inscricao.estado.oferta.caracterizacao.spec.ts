import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ligarRelogioControlado, passarOTempo } from '@uniplus/shared-testing';

import { AvaliacaoDaInscricaoEstado, ESPERA_DA_CONSULTA_MS } from './avaliacao-da-inscricao.estado';
import {
  type ServicoDublê,
  avaliacao,
  comSegundaOpcao,
  criarEstado,
  ok,
  trocarOfertas,
} from './avaliacao-da-inscricao.estado.testing';

describe('AvaliacaoDaInscricaoEstado: troca de oferta de uma opção', () => {
  let estado: AvaliacaoDaInscricaoEstado;
  let servico: ServicoDublê;

  const nomes = (): string[] => estado.naTela()?.modalidades?.itens.map((m) => m.nome) ?? [];

  beforeEach(() => {
    ligarRelogioControlado();
    ({ estado, servico } = criarEstado());
  });
  afterEach(() => vi.useRealTimers());

  it('trocar a 1ª opção, sem 2ª opção antes nem depois, mantém as modalidades à vista', () => {
    trocarOfertas(estado, 'oferta-2', null);

    expect(nomes()).toEqual(['Ampla concorrência']);
    expect(estado.naTela()?.calculando).toBe(true);
  });

  it('trocar a 1ª opção ao escolher uma 2ª descarta as modalidades da 1ª e mantém os documentos', () => {
    trocarOfertas(estado, 'oferta-2', 'oferta-3');

    expect(estado.naTela()?.modalidades).toBeNull();
    expect(estado.naTela()?.documentos?.fases[0].pendencias).toHaveLength(1);
  });

  it('o corpo só é montado quando uma oferta de fato mudou', () => {
    const corpo = vi.fn(() => ({ respostas: {}, grupos: null }));

    estado.ofertaMudou(null, null, corpo);
    expect(corpo).not.toHaveBeenCalled();

    estado.ofertaMudou('oferta-2', null, corpo);
    expect(corpo).toHaveBeenCalledTimes(1);
  });

  it('voltar à oferta anterior consulta de novo: vale a última oferta adotada', async () => {
    trocarOfertas(estado, 'oferta-2', null);
    await passarOTempo(ESPERA_DA_CONSULTA_MS);
    trocarOfertas(estado, null, null);
    await passarOTempo(ESPERA_DA_CONSULTA_MS);

    expect(servico.corpos().map((c) => c.ofertaCursoId)).toEqual(['oferta-2', null]);
  });

  it('cada troca avança a revisão, e a avaliação do salvar anterior a ela é descartada', () => {
    const revisaoDoSalvar = estado.revisao();

    trocarOfertas(estado, 'oferta-2', null);
    estado.aplicarDaGravacao(avaliacao('Escola pública'), revisaoDoSalvar);

    expect(estado.revisao()).toBe(revisaoDoSalvar + 1);
    expect(nomes()).toEqual(['Ampla concorrência']);
  });

  it('a consulta só sai depois da espera, com o corpo da última troca', async () => {
    trocarOfertas(estado, 'oferta-2', null);
    await passarOTempo(ESPERA_DA_CONSULTA_MS - 1);
    trocarOfertas(estado, 'oferta-3', null);
    await passarOTempo(ESPERA_DA_CONSULTA_MS - 1);
    expect(servico.consultas).toHaveLength(0);

    await passarOTempo(1);
    expect(servico.corpos().map((c) => c.ofertaCursoId)).toEqual(['oferta-3']);
  });
});

describe('AvaliacaoDaInscricaoEstado: troca de oferta com duas opções', () => {
  let estado: AvaliacaoDaInscricaoEstado;
  let servico: ServicoDublê;

  const nomes = (): string[] => estado.naTela()?.modalidades?.itens.map((m) => m.nome) ?? [];
  const nomesDaSegunda = (): string[] =>
    estado.naTela()?.modalidadesSegundaOpcao?.itens.map((m) => m.nome) ?? [];

  beforeEach(() => {
    ligarRelogioControlado();
    ({ estado, servico } = criarEstado({ oferta: 'oferta-1', segundaOferta: 'oferta-3' }));
    estado.aplicarDaGravacao(comSegundaOpcao('Cotas'), estado.revisao());
  });
  afterEach(() => vi.useRealTimers());

  it('trocar a 1ª opção que já tinha 2ª descarta as da 1ª e mantém as da 2ª', () => {
    trocarOfertas(estado, 'oferta-2', 'oferta-3');

    expect(estado.naTela()?.modalidades).toBeNull();
    expect(nomesDaSegunda()).toEqual(['Cotas']);
  });

  it('trocar a 1ª opção ao retirar a 2ª descarta as modalidades das duas', () => {
    trocarOfertas(estado, 'oferta-2', null);

    expect(estado.naTela()?.modalidades).toBeNull();
    expect(estado.naTela()?.modalidadesSegundaOpcao).toBeNull();
  });

  it('trocar só a 2ª opção descarta as modalidades dela e mantém as da 1ª', () => {
    trocarOfertas(estado, 'oferta-1', 'oferta-4');

    expect(nomes()).toEqual(['Ampla concorrência']);
    expect(estado.naTela()?.modalidadesSegundaOpcao).toBeNull();
  });

  it('a avaliação que chega depois da troca substitui o que foi descartado', async () => {
    trocarOfertas(estado, 'oferta-2', 'oferta-3');
    await passarOTempo(ESPERA_DA_CONSULTA_MS);

    servico.responder(0, ok(comSegundaOpcao('Escola pública')));

    expect(nomes()).toEqual(['Ampla concorrência']);
    expect(nomesDaSegunda()).toEqual(['Escola pública']);
    expect(estado.naTela()?.calculando).toBe(false);
  });

  it('repetir as ofertas da inscrição não consulta, não descarta e não avança a revisão', async () => {
    const revisao = estado.revisao();

    trocarOfertas(estado, 'oferta-1', 'oferta-3');
    await passarOTempo(ESPERA_DA_CONSULTA_MS);

    expect(servico.consultas).toHaveLength(0);
    expect(nomesDaSegunda()).toEqual(['Cotas']);
    expect(estado.revisao()).toBe(revisao);
  });
});
