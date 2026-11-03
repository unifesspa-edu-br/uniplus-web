import type {
  ConfiguracaoClassificacaoDto,
  ProcessoSeletivoDto,
} from '@uniplus/shared-data/selecao';

import type {
  AtendimentoCondicaoSelecionada,
  CriterioDesempateConfigurado,
  ReferenciaDeAtendimento,
  RegraEliminacaoConfigurada,
  WizardDraft,
} from '../../processo-seletivo.models';
import { edicoesDoEnemDe } from '../../steps/classificacao/edicoes-do-enem';
import { escalaDaNotaFinalComoTexto } from '../../steps/classificacao/escala-da-nota-final';
import { comoInteiro, comoTexto } from './campos-lidos';

/**
 * Projeta a classificação já gravada (UNI-REQ-0482). Ausente é estado válido (a Eliminação ainda
 * não gravou) e volta com os campos vazios da criação; a bimodalidade de INV-B8 não pede projeção
 * especial, porque o `regraArredondamento` nulo vira `''` e o mapeador para o comando decide o que
 * enviar.
 */
export function classificacaoDe(dto: ProcessoSeletivoDto): WizardDraft['classificacao'] {
  const classificacao = dto.classificacao;
  if (classificacao === null || classificacao === undefined) {
    return {
      regraCalculoCodigo: '',
      regraCalculoVersao: '',
      regraArredondamentoCodigo: '',
      regraArredondamentoVersao: '',
      casasArredondamento: '',
      regraOrdemAlocacaoCodigo: '',
      regraOrdemAlocacaoVersao: '',
      baseadoEmEnem: false,
      escalaNotaFinal: '',
      resolucaoPesoAreaEnem: '',
      regrasEliminacao: [],
      edicoesEnem: [],
    };
  }

  return {
    regraCalculoCodigo: classificacao.regraCalculo.codigo,
    regraCalculoVersao: classificacao.regraCalculo.versao,
    regraArredondamentoCodigo: classificacao.regraArredondamento?.codigo ?? '',
    regraArredondamentoVersao: classificacao.regraArredondamento?.versao ?? '',
    casasArredondamento: comoTexto(classificacao.casasArredondamento),
    regraOrdemAlocacaoCodigo: classificacao.regraOrdemAlocacao.codigo,
    regraOrdemAlocacaoVersao: classificacao.regraOrdemAlocacao.versao,
    baseadoEmEnem: classificacao.baseadoEmEnem,
    escalaNotaFinal: escalaDaNotaFinalComoTexto(classificacao.escalaNotaFinal),
    resolucaoPesoAreaEnem: classificacao.resolucaoPesoAreaEnem ?? '',
    regrasEliminacao: classificacao.regrasEliminacao.map(regraEliminacaoDe),
    edicoesEnem: edicoesDoEnemDe(dto),
  };
}

function regraEliminacaoDe(
  regra: ConfiguracaoClassificacaoDto['regrasEliminacao'][number],
): RegraEliminacaoConfigurada {
  return {
    regraCodigo: regra.regra.codigo,
    regraVersao: regra.regra.versao,
    etapaRef: regra.etapaRef ?? '',
    notaMinima: comoTexto(regra.notaMinima),
    minimo: comoTexto(regra.minimo),
    areaCodigo: regra.areaCodigo ?? '',
  };
}

/**
 * Projeta o bônus regional gravado. `aplicaBonusRegional` `null` é "ainda por declarar": a ausência
 * da configuração só significa "sem bônus" quando a declaração é falsa.
 */
export function bonusDe(dto: ProcessoSeletivoDto): WizardDraft['bonus'] {
  const aplica = dto.aplicaBonusRegional ?? null;
  const bonus = dto.bonusRegional;
  if (bonus === null || bonus === undefined) {
    return {
      aplica,
      regraCodigo: '',
      regraVersao: '',
      fator: '',
      teto: '',
      baseLegalBonusRegionalId: '',
      fatoElegibilidadeCodigo: '',
    };
  }

  return {
    aplica,
    regraCodigo: bonus.regra.codigo,
    regraVersao: bonus.regra.versao,
    fator: comoTexto(bonus.fator),
    teto: comoTexto(bonus.teto),
    baseLegalBonusRegionalId: bonus.baseLegalBonusRegionalId,
    fatoElegibilidadeCodigo: bonus.fatoElegibilidadeCodigo ?? '',
  };
}

/**
 * Projeta os critérios de desempate na ordem em que o servidor os avalia: a posição no array é a
 * ordem, então a lista chega ordenada por `ordem` antes de perder o número.
 */
export function desempateDe(dto: ProcessoSeletivoDto): readonly CriterioDesempateConfigurado[] {
  return [...(dto.criteriosDesempate ?? [])]
    .sort((a, b) => comoInteiro(a.ordem) - comoInteiro(b.ordem))
    .map((criterio) => ({
      regraCodigo: criterio.regra.codigo,
      regraVersao: criterio.regra.versao,
      etapaRef: criterio.etapaRef ?? '',
      idadeMinima: comoTexto(criterio.idadeMinima),
      fato: criterio.fato ?? '',
      operador: criterio.operador ?? '',
      valor: criterio.valor ?? '',
      areas: [...(criterio.areas ?? [])],
    }));
}

/**
 * Projeta a oferta de atendimento gravada com o id **de origem**, que é o que a gravação recebe,
 * junto do nome (e do código, nas condições) devolvido na leitura: a referência continua legível
 * mesmo se o item já saiu do cadastro ativo (CA-05). `null` é "nenhuma oferta declarada", e as três
 * listas voltam vazias.
 */
export function atendimentoDe(dto: ProcessoSeletivoDto): WizardDraft['atendimento'] {
  const oferta = dto.ofertaAtendimento;
  if (oferta === null || oferta === undefined) {
    return { condicoes: [], recursos: [], tiposDeficiencia: [] };
  }

  const condicoes: AtendimentoCondicaoSelecionada[] = oferta.condicoes.map((condicao) => ({
    id: condicao.condicaoOrigemId,
    codigo: condicao.condicaoCodigo,
    nome: condicao.condicaoNome,
  }));
  const recursos: ReferenciaDeAtendimento[] = oferta.recursos.map((recurso) => ({
    id: recurso.recursoOrigemId,
    nome: recurso.recursoNome,
  }));
  const tiposDeficiencia: ReferenciaDeAtendimento[] = oferta.tiposDeficiencia.map((tipo) => ({
    id: tipo.tipoDeficienciaOrigemId,
    nome: tipo.tipoDeficienciaNome,
  }));

  return { condicoes, recursos, tiposDeficiencia };
}
