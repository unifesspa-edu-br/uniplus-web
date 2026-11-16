import { describe, expect, it } from 'vitest';

import {
  RECURSO_DA_FASE,
  etapaDoServidor,
  faseDoServidor,
  recursoDaEtapaDoServidor,
} from '../../shared/cronograma-do-servidor.testing';
import { hidratarDraft } from '../../shared/hidratacao';
import { DRAFT, dtoComCronograma } from '../../shared/hidratacao.testing';
import { faseDaConfiguracao, grupoDaConfiguracaoDaFase } from '../fase/fase-form';
import { etapaDoFormulario, faseDoFormulario, grupoDaEtapa, grupoDaFase } from './cronograma-form';
import { comoComandoDeEtapa, comoComandoDeFase } from './cronograma-para-comando';

const UNIDADE = { origemId: 'unidade-cga', sigla: 'CGA', nome: 'Centro de Gestão Acadêmica' };
const ITEM = { id: 'item-1', rotulo: 'Clareza', pontuacaoMaxima: 4 };

const PROCEDIMENTOS_DO_SERVIDOR = [
  {
    tipoDeDecisao: 'RESULTADO_PRELIMINAR',
    alvo: { itemDeAvaliacaoId: ITEM.id, areaDoEnem: null },
    regra: { codigo: 'PROCEDIMENTO-RECURSO-COLEGIADO', versao: 'v1', hash: 'h1' },
    sugestao: 'PROCEDIMENTO-RECURSO-MONOCRATICO',
  },
  {
    tipoDeDecisao: 'RESULTADO_FINAL',
    alvo: null,
    regra: { codigo: 'PROCEDIMENTO-RECURSO-MONOCRATICO', versao: 'v2', hash: 'h2' },
    sugestao: null,
  },
];

/** O que o comando leva dos procedimentos: a sugestão é só dica de leitura e nunca volta. */
const PROCEDIMENTOS_DO_COMANDO = [
  {
    tipoDeDecisao: 'RESULTADO_PRELIMINAR',
    alvo: { itemDeAvaliacaoId: ITEM.id, areaDoEnem: null },
    regraCodigo: 'PROCEDIMENTO-RECURSO-COLEGIADO',
    regraVersao: 'v1',
  },
  {
    tipoDeDecisao: 'RESULTADO_FINAL',
    alvo: null,
    regraCodigo: 'PROCEDIMENTO-RECURSO-MONOCRATICO',
    regraVersao: 'v2',
  },
];

const TIPOS_DE_DECISAO = ['RESULTADO_PRELIMINAR', 'RESULTADO_FINAL'];

const FASE_PREENCHIDA = faseDoServidor({
  cronograma: { unidadeResponsavel: UNIDADE },
  publicacoes: {
    tiposDeDecisao: TIPOS_DE_DECISAO,
    regraRecurso: { ...RECURSO_DA_FASE, procedimentos: PROCEDIMENTOS_DO_SERVIDOR },
  },
});

const ETAPA_PREENCHIDA = etapaDoServidor({
  avaliacao: { itensDeAvaliacao: [ITEM] },
  publicacoes: {
    tiposDeDecisao: TIPOS_DE_DECISAO,
    recursos: [recursoDaEtapaDoServidor({ procedimentos: PROCEDIMENTOS_DO_SERVIDOR })],
  },
});

function rascunhoDe(
  fase: ReturnType<typeof faseDoServidor>,
  etapa: ReturnType<typeof etapaDoServidor>,
) {
  return hidratarDraft(DRAFT, dtoComCronograma({ cronogramaFases: [fase], etapas: [etapa] }))
    .cronograma;
}

describe('cronograma: o que o servidor devolve volta inteiro no PUT', () => {
  const preenchido = rascunhoDe(FASE_PREENCHIDA, ETAPA_PREENCHIDA);
  const vazio = rascunhoDe(
    faseDoServidor({ publicacoes: { regraRecurso: null } }),
    etapaDoServidor(),
  );

  it('a fase devolve a unidade, os tipos de decisão e os procedimentos do recurso', () => {
    const comando = comoComandoDeFase(preenchido.fases[0]);

    expect(comando.unidadeResponsavelId).toBe('unidade-cga');
    expect(comando.tiposDeDecisao).toStrictEqual(TIPOS_DE_DECISAO);
    expect(comando.regraRecurso?.procedimentos).toStrictEqual(PROCEDIMENTOS_DO_COMANDO);
  });

  it('a etapa devolve os tipos de decisão e os procedimentos do recurso', () => {
    const comando = comoComandoDeEtapa(preenchido.etapas[0]);

    expect(comando.tiposDeDecisao).toStrictEqual(TIPOS_DE_DECISAO);
    expect(comando.recursos?.[0]?.procedimentos).toStrictEqual(PROCEDIMENTOS_DO_COMANDO);
  });

  it('a fase atravessa o formulário do cronograma sem perder o que ele não edita', () => {
    const volta = faseDoFormulario(grupoDaFase(preenchido.fases[0]));

    expect(comoComandoDeFase(volta)).toStrictEqual(comoComandoDeFase(preenchido.fases[0]));
  });

  it('a fase atravessa o formulário da fase sem perder o que ele não edita', () => {
    const volta = faseDaConfiguracao(grupoDaConfiguracaoDaFase(preenchido.fases[0]));

    expect(comoComandoDeFase(volta)).toStrictEqual(comoComandoDeFase(preenchido.fases[0]));
  });

  it('a etapa atravessa o formulário do cronograma sem perder o que ele não edita', () => {
    const volta = etapaDoFormulario(grupoDaEtapa(preenchido.etapas[0]));

    expect(comoComandoDeEtapa(volta)).toStrictEqual(comoComandoDeEtapa(preenchido.etapas[0]));
  });

  it('o que veio vazio continua vazio, e a unidade ausente continua nula', () => {
    const fase = comoComandoDeFase(vazio.fases[0]);
    const etapa = comoComandoDeEtapa(vazio.etapas[0]);

    expect(fase.unidadeResponsavelId).toBeNull();
    expect(fase.tiposDeDecisao).toStrictEqual([]);
    expect(fase.regraRecurso).toBeNull();
    expect(etapa.tiposDeDecisao).toStrictEqual([]);
    expect(etapa.recursos).toStrictEqual([]);
  });

  it('o recurso sem procedimento declarado vai com a lista vazia, não ausente', () => {
    const comRecursoSemProcedimento = rascunhoDe(
      faseDoServidor(),
      etapaDoServidor({ publicacoes: { recursos: [recursoDaEtapaDoServidor()] } }),
    );

    expect(
      comoComandoDeFase(comRecursoSemProcedimento.fases[0]).regraRecurso?.procedimentos,
    ).toStrictEqual([]);
    expect(
      comoComandoDeEtapa(comRecursoSemProcedimento.etapas[0]).recursos?.[0]?.procedimentos,
    ).toStrictEqual([]);
  });

  it('o rascunho guarda a sugestão para a dica, e o comando não a leva', () => {
    const [recurso] = preenchido.etapas[0].recursos;

    expect(recurso.procedimentos[0].sugestao).toBe('PROCEDIMENTO-RECURSO-MONOCRATICO');
    expect(JSON.stringify(comoComandoDeEtapa(preenchido.etapas[0]))).not.toContain('sugestao');
    expect(JSON.stringify(comoComandoDeFase(preenchido.fases[0]))).not.toContain('sugestao');
  });
});
