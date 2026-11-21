import { FormControl, FormGroup } from '@angular/forms';

import type {
  EfeitoSuspensivoCodigo,
  GuardaDaVagaCodigo,
  UnidadePrazoCodigo,
} from '@uniplus/shared-data/selecao';

import {
  LEITURA_EM_BRANCO,
  PARAMETROS_EM_BRANCO,
  type LeituraDoRecurso,
  type ParametrosDoRecurso,
} from '../../shared/configuracao-do-recurso/parametros-do-recurso';
import type {
  AtributosCongeladosDaFase,
  BancaRequeridaDaFase,
  FaseDoCronograma,
  ProcedimentoDeRecurso,
  ProdutoDaFase,
  RecursoDaFase,
} from '../../processo-seletivo.models';

/**
 * A regra de recurso como o formulário a guarda. Os números são texto porque é
 * o que o campo edita; a conversão acontece no envio, com gramática explícita.
 */
export interface RecursoForm {
  readonly regraCodigo: FormControl<string>;
  readonly regraVersao: FormControl<string>;
  readonly prazoValor: FormControl<string>;
  /** Unidade ainda não escolhida é `''` — o valor que o seletor mostra vazio. */
  readonly prazoUnidade: FormControl<UnidadePrazoCodigo | ''>;
  /** Código do tipo de ato da publicação preliminar de que corre o prazo. */
  readonly atoAncoraCodigo: FormControl<string>;
  /** `null` é a pergunta ainda sem resposta; a conferência recusa a gravação nesse estado. */
  readonly admiteInstanciaSuperior: FormControl<boolean | null>;
  readonly efeitoSuspensivo: FormControl<EfeitoSuspensivoCodigo | ''>;
  readonly guardaDaVaga: FormControl<GuardaDaVagaCodigo | ''>;
  readonly prazoSegundaInstanciaValor: FormControl<string>;
  readonly prazoSegundaInstanciaUnidade: FormControl<UnidadePrazoCodigo | ''>;
  /** Não é editado aqui: o que a leitura trouxe e o envio ignora. */
  readonly leitura: FormControl<LeituraDoRecurso>;
  /** Não é editado aqui: viaja para a gravação do cronograma não o apagar. */
  readonly procedimentos: FormControl<readonly ProcedimentoDeRecurso[]>;
}

/**
 * A configuração de uma fase como esta superfície a edita.
 *
 * A janela, a ordem e os atributos congelados viajam sem serem editados aqui:
 * quem os declara é o passo de cronograma, e a gravação substitui a coleção
 * inteira — deixá-los de fora apagaria a linha do tempo a cada mudança de
 * produto.
 *
 * `admiteRecurso` existe porque no contrato a **presença** da regra é o que faz
 * a fase admitir recurso, e um formulário não tem como representar ausência sem
 * um interruptor próprio. Desligá-lo projeta `regraRecurso: null`; os valores
 * digitados continuam no grupo enquanto a tela estiver aberta, e é isso que faz
 * um desligamento acidental não custar o que já foi preenchido.
 */
export interface FaseConfigForm {
  readonly faseCanonicaId: FormControl<string>;
  readonly codigo: FormControl<string>;
  readonly ordem: FormControl<number>;
  readonly inicio: FormControl<string | null>;
  readonly fim: FormControl<string | null>;
  /** Não é editado aqui; viaja para a gravação do cronograma não o apagar. */
  readonly noMesmoMomentoDaAnterior: FormControl<boolean>;
  /** Não é editada aqui; viaja para a gravação do cronograma não a apagar. */
  readonly unidadeResponsavelId: FormControl<string | null>;
  readonly produtos: FormControl<readonly ProdutoDaFase[]>;
  readonly emiteParecerIndividual: FormControl<boolean>;
  readonly bancasRequeridas: FormControl<readonly BancaRequeridaDaFase[]>;
  /** Os tipos de decisão que a fase toma, em ordem alfabética do código. */
  readonly tiposDeDecisao: FormControl<readonly string[]>;
  readonly admiteRecurso: FormControl<boolean>;
  readonly recurso: FormGroup<RecursoForm>;
  readonly congelados: FormControl<AtributosCongeladosDaFase | null>;
}

/** O recurso de uma fase que ainda não admite recurso: tudo por responder. */
const RECURSO_EM_BRANCO: RecursoDaFase = {
  regraCodigo: '',
  regraVersao: '',
  atoAncoraCodigo: '',
  ...PARAMETROS_EM_BRANCO,
  leitura: LEITURA_EM_BRANCO,
  procedimentos: [],
};

type IdentificacaoEJanelaDaFase = Pick<
  FaseConfigForm,
  | 'faseCanonicaId'
  | 'codigo'
  | 'ordem'
  | 'inicio'
  | 'fim'
  | 'noMesmoMomentoDaAnterior'
  | 'unidadeResponsavelId'
>;

export function grupoDaConfiguracaoDaFase(fase: FaseDoCronograma): FormGroup<FaseConfigForm> {
  return new FormGroup<FaseConfigForm>({
    ...controlesDeIdentificacaoEJanela(fase),
    ...controlesDoQueAFaseDeclara(fase),
  });
}

function controlesDeIdentificacaoEJanela(fase: FaseDoCronograma): IdentificacaoEJanelaDaFase {
  return {
    faseCanonicaId: controle(fase.faseCanonicaId),
    codigo: controle(fase.codigo),
    ordem: controle(fase.ordem),
    inicio: controle<string | null>(fase.inicio),
    fim: controle<string | null>(fase.fim),
    noMesmoMomentoDaAnterior: controle(fase.noMesmoMomentoDaAnterior),
    unidadeResponsavelId: controle<string | null>(fase.unidadeResponsavelId),
  };
}

function controlesDoQueAFaseDeclara(
  fase: FaseDoCronograma,
): Omit<FaseConfigForm, keyof IdentificacaoEJanelaDaFase> {
  return {
    produtos: controle<readonly ProdutoDaFase[]>(fase.produtos),
    emiteParecerIndividual: controle(fase.emiteParecerIndividual),
    bancasRequeridas: controle<readonly BancaRequeridaDaFase[]>(fase.bancasRequeridas),
    tiposDeDecisao: controle<readonly string[]>(fase.tiposDeDecisao ?? []),
    admiteRecurso: controle(fase.regraRecurso !== null),
    recurso: grupoDoRecurso(fase.regraRecurso ?? RECURSO_EM_BRANCO),
    congelados: controle<AtributosCongeladosDaFase | null>(fase.congelados),
  };
}

function grupoDoRecurso(recurso: RecursoDaFase): FormGroup<RecursoForm> {
  return new FormGroup<RecursoForm>({
    regraCodigo: controle(recurso.regraCodigo),
    regraVersao: controle(recurso.regraVersao),
    atoAncoraCodigo: controle(recurso.atoAncoraCodigo),
    ...controlesDosParametros(recurso),
    leitura: controle(recurso.leitura),
    procedimentos: controle<readonly ProcedimentoDeRecurso[]>(recurso.procedimentos),
  });
}

function controlesDosParametros(
  recurso: ParametrosDoRecurso,
): Pick<RecursoForm, keyof ParametrosDoRecurso> {
  return {
    prazoValor: controle(recurso.prazoValor),
    prazoUnidade: controle(recurso.prazoUnidade),
    admiteInstanciaSuperior: controle(recurso.admiteInstanciaSuperior),
    efeitoSuspensivo: controle(recurso.efeitoSuspensivo),
    guardaDaVaga: controle(recurso.guardaDaVaga),
    prazoSegundaInstanciaValor: controle(recurso.prazoSegundaInstanciaValor),
    prazoSegundaInstanciaUnidade: controle(recurso.prazoSegundaInstanciaUnidade),
  };
}

/** A fase como o rascunho a guarda, com o que esta superfície declarou. */
export function faseDaConfiguracao(grupo: FormGroup<FaseConfigForm>): FaseDoCronograma {
  const { admiteRecurso, recurso, ...inalterados } = grupo.getRawValue();

  return {
    ...inalterados,
    regraRecurso: admiteRecurso ? recurso : null,
  };
}

/**
 * Controle não-anulável com o tipo do valor inicial.
 *
 * `nonNullable` é o que faz `reset()` voltar ao valor declarado em vez de
 * `null`, e é o que mantém o tipo do controle livre de `| null` — sem isso, todo
 * leitor precisaria descartar um nulo que este formulário nunca produz.
 */
function controle<T>(valorInicial: T): FormControl<T> {
  return new FormControl<T>(valorInicial, { nonNullable: true });
}
