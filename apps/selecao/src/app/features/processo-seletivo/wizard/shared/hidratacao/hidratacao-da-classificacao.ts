import type {
  ConfiguracaoBonusRegionalDto,
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
import { bonusInicial, classificacaoInicial } from '../../rascunho-inicial';
import { edicoesDoEnemDe } from '../../passos/classificacao/edicoes-do-enem';
import { escalaDaNotaFinalComoTexto } from '../escala-da-nota-final';
import { comoInteiro, comoTexto } from './campos-lidos';

/**
 * Projeta a classificação já gravada (UNI-REQ-0482). Ausente é estado válido (a Eliminação ainda
 * não gravou) e volta com os campos vazios da criação; a bimodalidade da classificação não pede projeção
 * especial, porque o `regraArredondamento` nulo vira `''` e o mapeador para o comando decide o que
 * enviar.
 */
export function classificacaoDe(dto: ProcessoSeletivoDto): WizardDraft['classificacao'] {
  const classificacao = dto.classificacao;
  if (classificacao === null || classificacao === undefined) {
    return classificacaoInicial();
  }

  return {
    ...calculoDe(classificacao),
    ...enemDe(classificacao, dto),
    regraOrdemAlocacaoCodigo: classificacao.regraOrdemAlocacao.codigo,
    regraOrdemAlocacaoVersao: classificacao.regraOrdemAlocacao.versao,
    regrasEliminacao: classificacao.regrasEliminacao.map(regraEliminacaoDe),
  };
}

type CalculoDaClassificacao = Pick<
  WizardDraft['classificacao'],
  | 'regraCalculoCodigo'
  | 'regraCalculoVersao'
  | 'regraArredondamentoCodigo'
  | 'regraArredondamentoVersao'
  | 'casasArredondamento'
>;

function calculoDe(classificacao: ConfiguracaoClassificacaoDto): CalculoDaClassificacao {
  return {
    regraCalculoCodigo: classificacao.regraCalculo.codigo,
    regraCalculoVersao: classificacao.regraCalculo.versao,
    regraArredondamentoCodigo: classificacao.regraArredondamento?.codigo ?? '',
    regraArredondamentoVersao: classificacao.regraArredondamento?.versao ?? '',
    casasArredondamento: comoTexto(classificacao.casasArredondamento),
  };
}

type EnemDaClassificacao = Pick<
  WizardDraft['classificacao'],
  'baseadoEmEnem' | 'escalaNotaFinal' | 'resolucaoPesoAreaEnem' | 'edicoesEnem'
>;

function enemDe(
  classificacao: ConfiguracaoClassificacaoDto,
  dto: ProcessoSeletivoDto,
): EnemDaClassificacao {
  return {
    baseadoEmEnem: classificacao.baseadoEmEnem,
    escalaNotaFinal: escalaDaNotaFinalComoTexto(classificacao.escalaNotaFinal),
    resolucaoPesoAreaEnem: classificacao.resolucaoPesoAreaEnem ?? '',
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
    return { ...bonusInicial(), aplica };
  }

  return { aplica, ...bonusGravadoDe(bonus) };
}

function bonusGravadoDe(bonus: ConfiguracaoBonusRegionalDto): Omit<WizardDraft['bonus'], 'aplica'> {
  return {
    regraCodigo: bonus.regra.codigo,
    regraVersao: bonus.regra.versao,
    fator: comoTexto(bonus.fator),
    teto: comoTexto(bonus.teto),
    baseLegalBonusRegionalId: bonus.baseLegal.id,
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
      etapaRef: criterio.parametros.etapaRef ?? '',
      idadeMinima: comoTexto(criterio.parametros.idadeMinima),
      fato: criterio.parametros.fato ?? '',
      operador: criterio.parametros.operador ?? '',
      valor: criterio.parametros.valor ?? '',
      areas: [...(criterio.parametros.areas ?? [])],
    }));
}

/**
 * Projeta o atendimento especializado gravado com o id **de origem**, que é o que a gravação recebe,
 * junto do nome (e do código, nas condições) devolvido na leitura: a referência continua legível
 * mesmo se o item já saiu do cadastro ativo. `null` é "nenhum atendimento declarado", e as três
 * listas voltam vazias.
 */
export function atendimentoDe(dto: ProcessoSeletivoDto): WizardDraft['atendimento'] {
  const oferta = dto.atendimentoEspecializado;
  if (oferta === null || oferta === undefined) {
    return { condicoes: [], recursos: [], tiposDeficiencia: [] };
  }

  return {
    condicoes: oferta.condicoes.map(condicaoDe),
    recursos: oferta.recursos.map(recursoDe),
    tiposDeficiencia: oferta.tiposDeficiencia.map(tipoDeficienciaDe),
  };
}

type OfertaDeAtendimento = NonNullable<ProcessoSeletivoDto['atendimentoEspecializado']>;

function condicaoDe(
  condicao: OfertaDeAtendimento['condicoes'][number],
): AtendimentoCondicaoSelecionada {
  return {
    id: condicao.condicaoOrigemId,
    codigo: condicao.condicaoCodigo,
    nome: condicao.condicaoNome,
  };
}

function recursoDe(recurso: OfertaDeAtendimento['recursos'][number]): ReferenciaDeAtendimento {
  return { id: recurso.recursoOrigemId, nome: recurso.recursoNome };
}

function tipoDeficienciaDe(
  tipo: OfertaDeAtendimento['tiposDeficiencia'][number],
): ReferenciaDeAtendimento {
  return { id: tipo.tipoDeficienciaOrigemId, nome: tipo.tipoDeficienciaNome };
}
