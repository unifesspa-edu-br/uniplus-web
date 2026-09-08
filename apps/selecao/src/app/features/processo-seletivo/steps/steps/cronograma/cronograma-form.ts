import { FormArray, FormControl, FormGroup } from '@angular/forms';

import type { CaraterEtapa } from '@uniplus/shared-data/selecao';

import type {
  AtributosCongeladosDaFase,
  BancaRequeridaDaFase,
  EtapaPontuada,
  FaseDoCronograma,
  ProdutoDaFase,
  RecursoDaFase,
} from '../../processo-seletivo.models';
import { campoDoInstante, instanteDoCampo } from '../../shared/fuso-institucional';

/** Caráter ainda não escolhido é `''` — o valor que o seletor mostra vazio. */
export type CaraterEscolhido = CaraterEtapa | '';

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
  /**
   * O que a fase publica. Como a regra de recurso, não é editado neste passo e
   * viaja no formulário por isso: a gravação substitui o cronograma inteiro, e
   * deixá-lo fora daqui apagaria os produtos a cada mudança de data — junto com
   * o que a fase produz e com a âncora do recurso, que deles derivam.
   */
  readonly produtos: FormControl<readonly ProdutoDaFase[]>;
  /** Também não editado aqui, e carregado pela mesma razão de `produtos`. */
  readonly faseConcluinteCodigo: FormControl<string | null>;
  /** Também não editado aqui, e carregado pela mesma razão de `produtos`. */
  readonly emiteParecerIndividual: FormControl<boolean>;
  /**
   * Também não editado aqui, e carregado pela mesma razão de `produtos`: quem
   * declara a banca e o recorte que ela julga é a superfície da fase.
   */
  readonly bancasRequeridas: FormControl<readonly BancaRequeridaDaFase[]>;
  /**
   * Não é editado neste passo, e viaja no formulário justamente por isso: a
   * gravação substitui o cronograma inteiro, e deixar a regra de recurso fora
   * daqui a apagaria a cada mudança de data.
   */
  readonly regraRecurso: FormControl<RecursoDaFase | null>;
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
  readonly ordem: FormControl<number>;
}

export interface CronogramaForm {
  readonly faseAAcrescentar: FormControl<string>;
  readonly fases: FormArray<FormGroup<FaseForm>>;
  readonly etapas: FormArray<FormGroup<EtapaForm>>;
  /**
   * Convenção de contagem de prazo do processo, por código e versão do
   * catálogo — declaração do processo inteiro, não de uma fase. Vazio é
   * estado válido enquanto rascunho (CA-05): nenhuma convenção vem
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

export function grupoDaFase(fase: FaseDoCronograma): FormGroup<FaseForm> {
  return new FormGroup<FaseForm>({
    faseCanonicaId: controle(fase.faseCanonicaId),
    codigo: controle(fase.codigo),
    ordem: controle(fase.ordem),
    inicio: controle(fase.inicio === null ? '' : campoDoInstante(fase.inicio)),
    fim: controle(fase.fim === null ? '' : campoDoInstante(fase.fim)),
    produtos: controle<readonly ProdutoDaFase[]>(fase.produtos),
    faseConcluinteCodigo: controle<string | null>(fase.faseConcluinteCodigo),
    emiteParecerIndividual: controle(fase.emiteParecerIndividual),
    bancasRequeridas: controle<readonly BancaRequeridaDaFase[]>(fase.bancasRequeridas),
    regraRecurso: controle<RecursoDaFase | null>(fase.regraRecurso),
    congelados: controle<AtributosCongeladosDaFase | null>(fase.congelados),
  });
}

export function grupoDaEtapa(etapa: EtapaPontuada): FormGroup<EtapaForm> {
  return new FormGroup<EtapaForm>({
    id: controle<string | null>(etapa.id),
    nome: controle(etapa.nome),
    carater: controle<CaraterEscolhido>(etapa.carater),
    tipoEtapaOrigemId: controle(etapa.tipoEtapaOrigemId),
    peso: controle(etapa.peso),
    notaMinima: controle(etapa.notaMinima),
    ordem: controle(etapa.ordem),
  });
}

/** A fase como o rascunho a guarda: a hora de parede vira o instante do certame. */
export function faseDoFormulario(grupo: FormGroup<FaseForm>): FaseDoCronograma {
  const valor = grupo.getRawValue();
  return {
    faseCanonicaId: valor.faseCanonicaId,
    codigo: valor.codigo,
    ordem: valor.ordem,
    inicio: valor.inicio === '' ? null : instanteDoCampo(valor.inicio),
    fim: valor.fim === '' ? null : instanteDoCampo(valor.fim),
    produtos: valor.produtos,
    faseConcluinteCodigo: valor.faseConcluinteCodigo,
    emiteParecerIndividual: valor.emiteParecerIndividual,
    bancasRequeridas: valor.bancasRequeridas,
    regraRecurso: valor.regraRecurso,
    congelados: valor.congelados,
  };
}

export function etapaDoFormulario(grupo: FormGroup<EtapaForm>): EtapaPontuada {
  return grupo.getRawValue();
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
