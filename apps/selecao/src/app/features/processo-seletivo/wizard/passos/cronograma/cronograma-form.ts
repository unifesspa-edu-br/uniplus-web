import { FormArray, FormControl, FormGroup } from '@angular/forms';

import type { CaraterEtapaCodigo } from '@uniplus/shared-data/selecao';

import type {
  AtributosCongeladosDaFase,
  BancaDaEtapa,
  BancaRequeridaDaFase,
  EtapaPontuada,
  FaseDoCronograma,
  ItemDeAvaliacaoDaEtapa,
  NivelDeAtendimentoDaEtapa,
  ProdutoDaFase,
  RecursoDaEtapa,
  RecursoDaFase,
  TipoCongeladoDaEtapa,
} from '../../processo-seletivo.models';
import {
  campoDoInstante,
  inicioDeHojeNoFusoInstitucional,
  instanteDoCampo,
  pisoDoCampoDeData,
} from '../../shared/fuso-institucional';

/** Caráter ainda não escolhido é `''` — o valor que o seletor mostra vazio. */
export type CaraterEscolhido = CaraterEtapaCodigo | '';

/**
 * Uma fase do cronograma como o formulário a guarda.
 *
 * A janela vive aqui como **hora de parede** (`AAAA-MM-DDTHH:mm`), que é o que o
 * campo de data e hora entrega e devolve; virar instante é passo da saída para o
 * rascunho, não do controle.
 */
export interface FaseForm {
  readonly faseCanonicaId: FormControl<string>;
  readonly codigo: FormControl<string>;
  readonly ordem: FormControl<number>;
  readonly inicio: FormControl<string>;
  readonly fim: FormControl<string>;
  /** Unidade que responde pela fase; vazio enquanto não escolhida. */
  readonly unidadeResponsavelId: FormControl<string>;
  readonly noMesmoMomentoDaAnterior: FormControl<boolean>;
  /**
   * O que a fase publica. Como a regra de recurso, não é editado neste passo e
   * viaja no formulário por isso: a gravação substitui o cronograma inteiro, e
   * deixá-lo fora daqui apagaria os produtos a cada mudança de data — junto com
   * o que a fase produz e com a âncora do recurso, que deles derivam.
   */
  readonly produtos: FormControl<readonly ProdutoDaFase[]>;
  /** Também não editado aqui, e carregado pela mesma razão de `produtos`. */
  readonly emiteParecerIndividual: FormControl<boolean>;
  /**
   * Também não editado aqui, e carregado pela mesma razão de `produtos`: quem
   * declara a banca e a competência que ela julga é a superfície da fase.
   */
  readonly bancasRequeridas: FormControl<readonly BancaRequeridaDaFase[]>;
  /**
   * Não é editado neste passo, e viaja no formulário justamente por isso: a
   * gravação substitui o cronograma inteiro, e deixar a regra de recurso fora
   * daqui a apagaria a cada mudança de data.
   */
  readonly regraRecurso: FormControl<RecursoDaFase | null>;
  /** Também não editado aqui, e carregado pela mesma razão de `produtos`. */
  readonly tiposDeDecisao: FormControl<readonly string[]>;
  /**
   * O que a fase congelou do catálogo. Também não é editado — viaja para que a
   * tela continue sabendo o que a fase exige quando o catálogo já não a tem.
   */
  readonly congelados: FormControl<AtributosCongeladosDaFase | null>;
}

/** Uma etapa pontuada como o formulário a guarda. */
export interface EtapaForm {
  readonly id: FormControl<string | null>;
  readonly nome: FormControl<string>;
  readonly carater: FormControl<CaraterEscolhido>;
  readonly tipoEtapaOrigemId: FormControl<string>;
  /** Texto até a conversão: a gramática numérica do editor é do domínio, não do input. */
  readonly peso: FormControl<string>;
  readonly notaMinima: FormControl<string>;
  readonly notaMaxima: FormControl<string>;
  readonly passoDoLancamento: FormControl<string>;
  readonly formaDeAvaliacao: FormControl<string>;
  readonly regraConsolidacaoCodigo: FormControl<string>;
  readonly regraConsolidacaoVersao: FormControl<string>;
  /** Viajam como valor, e não como controles por linha: a gravação substitui a lista inteira. */
  readonly itensDeAvaliacao: FormControl<readonly ItemDeAvaliacaoDaEtapa[]>;
  readonly escalaDeAtendimento: FormControl<readonly NivelDeAtendimentoDaEtapa[]>;
  readonly ordem: FormControl<number>;
  /** Código canônico da fase a que a etapa pertence; vazio enquanto não declarada. */
  readonly faseCodigo: FormControl<string>;
  /**
   * Os produtos viajam no formulário sem serem editados campo a campo: a gravação
   * substitui a coleção inteira, e deixá-los de fora apagaria, a cada mudança de nome ou
   * peso, o que a etapa declara publicar.
   */
  readonly produtos: FormControl<readonly ProdutoDaFase[]>;
  readonly inicio: FormControl<string>;
  readonly fim: FormControl<string>;
  readonly emiteParecerIndividual: FormControl<boolean>;
  readonly bancas: FormControl<readonly BancaDaEtapa[]>;
  readonly recursos: FormControl<readonly RecursoDaEtapa[]>;
  /** Os tipos de decisão que a etapa toma, em ordem alfabética do código. */
  readonly tiposDeDecisao: FormControl<readonly string[]>;
  /** Não é editado: viaja para a tela saber o que o processo congelou do tipo. */
  readonly tipoCongelado: FormControl<TipoCongeladoDaEtapa | null>;
}

export interface CronogramaForm {
  readonly faseAAcrescentar: FormControl<string>;
  readonly fases: FormArray<FormGroup<FaseForm>>;
  readonly etapas: FormArray<FormGroup<EtapaForm>>;
  /**
   * Convenção de contagem de prazo do processo, por código e versão do
   * catálogo — declaração do processo inteiro, não de uma fase. Vazio é
   * estado válido enquanto rascunho: nenhuma convenção vem
   * pré-selecionada.
   */
  readonly algoritmoContagemCodigo: FormControl<string>;
  readonly algoritmoContagemVersao: FormControl<string>;
}

export function novoFormularioDoCronograma(): FormGroup<CronogramaForm> {
  return new FormGroup<CronogramaForm>({
    faseAAcrescentar: controle(''),
    fases: new FormArray<FormGroup<FaseForm>>([]),
    etapas: new FormArray<FormGroup<EtapaForm>>([]),
    algoritmoContagemCodigo: controle(''),
    algoritmoContagemVersao: controle(''),
  });
}

type ControlesEditadosDaFase = Pick<
  FaseForm,
  | 'faseCanonicaId'
  | 'codigo'
  | 'ordem'
  | 'inicio'
  | 'fim'
  | 'unidadeResponsavelId'
  | 'noMesmoMomentoDaAnterior'
>;
type ControlesCarregadosDaFase = Omit<FaseForm, keyof ControlesEditadosDaFase>;

export function grupoDaFase(fase: FaseDoCronograma): FormGroup<FaseForm> {
  return new FormGroup<FaseForm>({
    ...controlesEditadosDaFase(fase),
    ...controlesCarregadosDaFase(fase),
  });
}

function controlesEditadosDaFase(fase: FaseDoCronograma): ControlesEditadosDaFase {
  return {
    faseCanonicaId: controle(fase.faseCanonicaId),
    codigo: controle(fase.codigo),
    ordem: controle(fase.ordem),
    inicio: controle(fase.inicio === null ? '' : campoDoInstante(fase.inicio)),
    fim: controle(fase.fim === null ? '' : campoDoInstante(fase.fim)),
    unidadeResponsavelId: controle(fase.unidadeResponsavelId ?? ''),
    noMesmoMomentoDaAnterior: controle(fase.noMesmoMomentoDaAnterior),
  };
}

/** O que a fase só carrega: o passo não edita, e a gravação substitui o cronograma inteiro. */
function controlesCarregadosDaFase(fase: FaseDoCronograma): ControlesCarregadosDaFase {
  return {
    produtos: controle<readonly ProdutoDaFase[]>(fase.produtos),
    emiteParecerIndividual: controle(fase.emiteParecerIndividual),
    bancasRequeridas: controle<readonly BancaRequeridaDaFase[]>(fase.bancasRequeridas),
    regraRecurso: controle<RecursoDaFase | null>(fase.regraRecurso),
    tiposDeDecisao: controle<readonly string[]>(fase.tiposDeDecisao ?? []),
    congelados: controle<AtributosCongeladosDaFase | null>(fase.congelados),
  };
}

type IdentificacaoDaFase = Pick<
  FaseDoCronograma,
  'faseCanonicaId' | 'codigo' | 'ordem' | 'unidadeResponsavelId'
>;

/** A fase que o operador acabou de acrescentar: só a identificação, o resto ele ainda declara. */
export function faseRecemAcrescentada(identificacao: IdentificacaoDaFase): FaseDoCronograma {
  return { ...identificacao, ...DECLARACOES_AINDA_NAO_FEITAS_DA_FASE };
}

const DECLARACOES_AINDA_NAO_FEITAS_DA_FASE: Omit<FaseDoCronograma, keyof IdentificacaoDaFase> = {
  inicio: null,
  fim: null,
  produtos: [],
  noMesmoMomentoDaAnterior: false,
  emiteParecerIndividual: false,
  bancasRequeridas: [],
  regraRecurso: null,
  tiposDeDecisao: [],
  congelados: null,
};

type PosicaoDaEtapa = Pick<EtapaPontuada, 'ordem' | 'faseCodigo'>;

/** A etapa que o operador acabou de acrescentar: só a posição, o resto ele ainda declara. */
export function etapaRecemAcrescentada(posicao: PosicaoDaEtapa): EtapaPontuada {
  return { ...posicao, ...ETAPA_AINDA_NAO_DECLARADA };
}

const ETAPA_AINDA_NAO_DECLARADA: Omit<EtapaPontuada, keyof PosicaoDaEtapa> = {
  id: null,
  nome: '',
  carater: '',
  tipoEtapaOrigemId: '',
  peso: '',
  notaMinima: '',
  notaMaxima: '',
  passoDoLancamento: '',
  produtos: [],
  inicio: '',
  fim: '',
  emiteParecerIndividual: false,
  bancas: [],
  recursos: [],
  tiposDeDecisao: [],
};

export function grupoDaEtapa(etapa: EtapaPontuada): FormGroup<EtapaForm> {
  return new FormGroup<EtapaForm>({
    ...controlesDaIdentidadeDaEtapa(etapa),
    ...controlesDaAvaliacaoDaEtapa(etapa),
    ...controlesDoQueAEtapaDeclara(etapa),
  });
}

function controlesDaIdentidadeDaEtapa(
  etapa: EtapaPontuada,
): Pick<EtapaForm, 'id' | 'nome' | 'tipoEtapaOrigemId' | 'tipoCongelado' | 'ordem' | 'faseCodigo'> {
  return {
    id: controle<string | null>(etapa.id),
    nome: controle(etapa.nome),
    tipoEtapaOrigemId: controle(etapa.tipoEtapaOrigemId),
    tipoCongelado: controle<TipoCongeladoDaEtapa | null>(etapa.tipoCongelado ?? null),
    ordem: controle(etapa.ordem),
    // Etapa vinda de rascunho anterior ao vínculo não traz o campo: '' é o estado
    // "não declara fase", e undefined num FormControl quebraria a comparação.
    faseCodigo: controle(etapa.faseCodigo ?? ''),
  };
}

type ControlesDaAvaliacao = Pick<
  EtapaForm,
  | 'carater'
  | 'peso'
  | 'notaMinima'
  | 'notaMaxima'
  | 'passoDoLancamento'
  | 'formaDeAvaliacao'
  | 'regraConsolidacaoCodigo'
  | 'regraConsolidacaoVersao'
  | 'itensDeAvaliacao'
  | 'escalaDeAtendimento'
>;

function controlesDaAvaliacaoDaEtapa(etapa: EtapaPontuada): ControlesDaAvaliacao {
  return {
    ...controlesDaPontuacaoDaEtapa(etapa),
    ...controlesDaFormaDeAvaliacao(etapa),
  };
}

function controlesDaPontuacaoDaEtapa(
  etapa: EtapaPontuada,
): Pick<ControlesDaAvaliacao, 'carater' | 'peso' | 'notaMinima' | 'notaMaxima'> {
  return {
    carater: controle<CaraterEscolhido>(etapa.carater),
    peso: controle(etapa.peso),
    notaMinima: controle(etapa.notaMinima),
    notaMaxima: controle(etapa.notaMaxima ?? ''),
  };
}

function controlesDaFormaDeAvaliacao(
  etapa: EtapaPontuada,
): Omit<ControlesDaAvaliacao, 'carater' | 'peso' | 'notaMinima' | 'notaMaxima'> {
  return {
    passoDoLancamento: controle(etapa.passoDoLancamento ?? ''),
    formaDeAvaliacao: controle(etapa.formaDeAvaliacao ?? ''),
    regraConsolidacaoCodigo: controle(etapa.regraConsolidacaoCodigo ?? ''),
    regraConsolidacaoVersao: controle(etapa.regraConsolidacaoVersao ?? ''),
    itensDeAvaliacao: controle<readonly ItemDeAvaliacaoDaEtapa[]>(etapa.itensDeAvaliacao ?? []),
    escalaDeAtendimento: controle<readonly NivelDeAtendimentoDaEtapa[]>(
      etapa.escalaDeAtendimento ?? [],
    ),
  };
}

type ControlesDoQueAEtapaDeclara = Pick<
  EtapaForm,
  | 'produtos'
  | 'inicio'
  | 'fim'
  | 'emiteParecerIndividual'
  | 'bancas'
  | 'recursos'
  | 'tiposDeDecisao'
>;

/** O que a etapa publica, quando acontece, quem a julga e como se recorre dela. */
function controlesDoQueAEtapaDeclara(etapa: EtapaPontuada): ControlesDoQueAEtapaDeclara {
  return {
    produtos: controle<readonly ProdutoDaFase[]>(etapa.produtos ?? []),
    inicio: controle(etapa.inicio ?? ''),
    fim: controle(etapa.fim ?? ''),
    emiteParecerIndividual: controle(etapa.emiteParecerIndividual ?? false),
    bancas: controle<readonly BancaDaEtapa[]>(etapa.bancas ?? []),
    recursos: controle<readonly RecursoDaEtapa[]>(etapa.recursos ?? []),
    tiposDeDecisao: controle<readonly string[]>(etapa.tiposDeDecisao ?? []),
  };
}

/** A fase como o rascunho a guarda: a hora de parede vira o instante do certame. */
export function faseDoFormulario(grupo: FormGroup<FaseForm>): FaseDoCronograma {
  const { inicio, fim, unidadeResponsavelId, ...inalterados } = grupo.getRawValue();
  return {
    ...inalterados,
    inicio: inicio === '' ? null : instanteDoCampo(inicio),
    fim: fim === '' ? null : instanteDoCampo(fim),
    unidadeResponsavelId: unidadeResponsavelId === '' ? null : unidadeResponsavelId,
  };
}

export function etapaDoFormulario(grupo: FormGroup<EtapaForm>): EtapaPontuada {
  return grupo.getRawValue();
}

/**
 * A fase como o formulário a devolve ao rascunho: com a janela no instante do certame. O rascunho
 * pode trazê-la de outra forma, e é com esta que o conteúdo dos dois lados se compara.
 */
export function faseComoNoFormulario(fase: FaseDoCronograma): FaseDoCronograma {
  return faseDoFormulario(grupoDaFase(fase));
}

/**
 * A etapa como o formulário a devolve ao rascunho: com cada campo opcional no seu valor vazio. O
 * modelo admite etapa sem esses campos, e o formulário nunca os deixa ausentes.
 */
export function etapaComoNoFormulario(etapa: EtapaPontuada): EtapaPontuada {
  return etapaDoFormulario(grupoDaEtapa(etapa));
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

/**
 * O piso do campo de data e hora: nunca antes de hoje, e nunca depois do que o campo já
 * carrega.
 *
 * Recebe os limites que valem para aquele campo — o início da fase, para uma etapa que precisa
 * caber nela; o início da própria janela, para um fim. Passar o valor atual é o que impede o
 * piso de invalidar cronograma já em curso, que é o caso da retificação.
 */
export function pisoDeData(
  valorAtual: string,
  ...limites: readonly (string | null | undefined)[]
): string | null {
  return pisoDoCampoDeData(valorAtual, inicioDeHojeNoFusoInstitucional(), ...limites);
}
