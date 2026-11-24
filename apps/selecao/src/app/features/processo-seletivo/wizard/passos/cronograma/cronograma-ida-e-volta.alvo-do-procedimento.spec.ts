import { TipoMotivoDeDecisaoCodigo } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import {
  RECURSO_DA_FASE,
  etapaDoServidor,
  faseDoServidor,
  recursoDaEtapaDoServidor,
  tipoDeDecisaoDoServidor,
} from '../../shared/cronograma-do-servidor.testing';
import { hidratarDraft } from '../../shared/hidratacao';
import { DRAFT, dtoComCronograma } from '../../shared/hidratacao.testing';
import { comoComandoDeEtapa, comoComandoDeFase } from './cronograma-para-comando';

type AlvoDoServidor = { itemDeAvaliacaoId: string | null; areaDoEnem: string | null } | null;

const REGRA = { codigo: 'PROCEDIMENTO-RECURSO-COLEGIADO', versao: 'v1', hash: 'h1' };
const ITEM = { ordem: 1, chave: 'item-1', id: 'item-1', rotulo: 'Clareza', pontuacaoMaxima: 4 };

const ALVOS: readonly {
  readonly caso: string;
  readonly doServidor: AlvoDoServidor;
  readonly noComando: AlvoDoServidor;
}[] = [
  {
    caso: 'por item',
    doServidor: { itemDeAvaliacaoId: ITEM.id, areaDoEnem: null },
    noComando: { itemDeAvaliacaoId: ITEM.id, areaDoEnem: null },
  },
  {
    caso: 'por área do ENEM',
    doServidor: { itemDeAvaliacaoId: null, areaDoEnem: 'Matemática' },
    noComando: { itemDeAvaliacaoId: null, areaDoEnem: 'Matemática' },
  },
  { caso: 'nulo', doServidor: null, noComando: null },
  {
    caso: 'com os dois campos nulos',
    doServidor: { itemDeAvaliacaoId: null, areaDoEnem: null },
    noComando: null,
  },
];

function procedimentoDoServidor(alvo: AlvoDoServidor) {
  return [
    {
      tipoDeDecisao: tipoDeDecisaoDoServidor(TipoMotivoDeDecisaoCodigo.CLASSIFICACAO),
      alvo,
      regra: REGRA,
      sugestao: null,
    },
  ];
}

function procedimentoDoComando(alvo: AlvoDoServidor) {
  return [
    {
      tipoDeDecisao: TipoMotivoDeDecisaoCodigo.CLASSIFICACAO,
      alvo,
      regraCodigo: REGRA.codigo,
      regraVersao: REGRA.versao,
    },
  ];
}

function cronogramaCom(alvo: AlvoDoServidor) {
  const procedimentos = procedimentoDoServidor(alvo);
  const fase = faseDoServidor({
    publicacoes: {
      tiposDeDecisao: [tipoDeDecisaoDoServidor(TipoMotivoDeDecisaoCodigo.CLASSIFICACAO)],
      regraRecurso: { ...RECURSO_DA_FASE, procedimentos },
    },
  });
  const etapa = etapaDoServidor({
    avaliacao: { itensDeAvaliacao: [ITEM] },
    publicacoes: {
      tiposDeDecisao: [tipoDeDecisaoDoServidor(TipoMotivoDeDecisaoCodigo.CLASSIFICACAO)],
      recursos: [recursoDaEtapaDoServidor({ procedimentos })],
    },
  });
  return hidratarDraft(DRAFT, dtoComCronograma({ cronogramaFases: [fase], etapas: [etapa] }))
    .cronograma;
}

describe.each(ALVOS)('alvo do procedimento $caso: do servidor ao comando', (caso) => {
  it('a janela da fase devolve o alvo no comando', () => {
    const comando = comoComandoDeFase(cronogramaCom(caso.doServidor).fases[0]);

    expect(comando.regraRecurso?.procedimentos).toStrictEqual(
      procedimentoDoComando(caso.noComando),
    );
  });

  it('a janela da etapa devolve o alvo no comando', () => {
    const comando = comoComandoDeEtapa(cronogramaCom(caso.doServidor).etapas[0]);

    expect(comando.recursos?.[0]?.procedimentos).toStrictEqual(
      procedimentoDoComando(caso.noComando),
    );
  });
});
