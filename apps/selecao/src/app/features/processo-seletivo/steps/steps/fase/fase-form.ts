import { FormControl, FormGroup } from '@angular/forms';

import type { UnidadePrazo } from '@uniplus/shared-data/selecao';

import type {
  AtributosCongeladosDaFase,
  BancaRequeridaDaFase,
  FaseDoCronograma,
  ProdutoDaFase,
  RecursoDaFase,
} from '../../processo-seletivo.models';

/** Unidade ainda não escolhida é `''` — o valor que o seletor mostra vazio. */
export type UnidadeEscolhida = UnidadePrazo | '';

/**
 * A regra de recurso como o formulário a guarda. Os números são texto porque é
 * o que o campo edita; a conversão acontece no envio, com gramática explícita.
 */
export interface RecursoForm {
  readonly regraCodigo: FormControl<string>;
  readonly regraVersao: FormControl<string>;
  readonly prazoValor: FormControl<string>;
  readonly prazoUnidade: FormControl<UnidadeEscolhida>;
  /** Código do tipo de ato da publicação preliminar de que corre o prazo. */
  readonly atoAncoraCodigo: FormControl<string>;
  readonly suspensividadePrimeiraInstanciaValor: FormControl<string>;
  readonly suspensividadePrimeiraInstanciaUnidade: FormControl<UnidadeEscolhida>;
  readonly suspensividadeSegundaInstanciaValor: FormControl<string>;
  readonly suspensividadeSegundaInstanciaUnidade: FormControl<UnidadeEscolhida>;
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
  readonly produtos: FormControl<readonly ProdutoDaFase[]>;
  /** `''` representa "nenhuma fase declarada como concluinte". */
  readonly faseConcluinteCodigo: FormControl<string>;
  readonly emiteParecerIndividual: FormControl<boolean>;
  readonly bancasRequeridas: FormControl<readonly BancaRequeridaDaFase[]>;
  readonly admiteRecurso: FormControl<boolean>;
  readonly recurso: FormGroup<RecursoForm>;
  readonly congelados: FormControl<AtributosCongeladosDaFase | null>;
}

export function grupoDaConfiguracaoDaFase(fase: FaseDoCronograma): FormGroup<FaseConfigForm> {
  const recurso = fase.regraRecurso;

  return new FormGroup<FaseConfigForm>({
    faseCanonicaId: controle(fase.faseCanonicaId),
    codigo: controle(fase.codigo),
    ordem: controle(fase.ordem),
    inicio: controle<string | null>(fase.inicio),
    fim: controle<string | null>(fase.fim),
    produtos: controle<readonly ProdutoDaFase[]>(fase.produtos),
    faseConcluinteCodigo: controle(fase.faseConcluinteCodigo ?? ''),
    emiteParecerIndividual: controle(fase.emiteParecerIndividual),
    bancasRequeridas: controle<readonly BancaRequeridaDaFase[]>(fase.bancasRequeridas),
    admiteRecurso: controle(recurso !== null),
    recurso: new FormGroup<RecursoForm>({
      regraCodigo: controle(recurso?.regraCodigo ?? ''),
      regraVersao: controle(recurso?.regraVersao ?? ''),
      prazoValor: controle(recurso?.prazoValor ?? ''),
      prazoUnidade: controle<UnidadeEscolhida>(recurso?.prazoUnidade ?? ''),
      atoAncoraCodigo: controle(recurso?.atoAncoraCodigo ?? ''),
      suspensividadePrimeiraInstanciaValor: controle(
        recurso?.suspensividadePrimeiraInstanciaValor ?? '',
      ),
      suspensividadePrimeiraInstanciaUnidade: controle<UnidadeEscolhida>(
        recurso?.suspensividadePrimeiraInstanciaUnidade ?? '',
      ),
      suspensividadeSegundaInstanciaValor: controle(
        recurso?.suspensividadeSegundaInstanciaValor ?? '',
      ),
      suspensividadeSegundaInstanciaUnidade: controle<UnidadeEscolhida>(
        recurso?.suspensividadeSegundaInstanciaUnidade ?? '',
      ),
    }),
    congelados: controle<AtributosCongeladosDaFase | null>(fase.congelados),
  });
}

/** A fase como o rascunho a guarda, com o que esta superfície declarou. */
export function faseDaConfiguracao(grupo: FormGroup<FaseConfigForm>): FaseDoCronograma {
  const valor = grupo.getRawValue();

  return {
    faseCanonicaId: valor.faseCanonicaId,
    codigo: valor.codigo,
    ordem: valor.ordem,
    inicio: valor.inicio,
    fim: valor.fim,
    produtos: valor.produtos,
    faseConcluinteCodigo: valor.faseConcluinteCodigo === '' ? null : valor.faseConcluinteCodigo,
    emiteParecerIndividual: valor.emiteParecerIndividual,
    bancasRequeridas: valor.bancasRequeridas,
    regraRecurso: valor.admiteRecurso ? recursoDaConfiguracao(valor.recurso) : null,
    congelados: valor.congelados,
  };
}

function recursoDaConfiguracao(
  valor: ReturnType<FormGroup<RecursoForm>['getRawValue']>,
): RecursoDaFase {
  return {
    regraCodigo: valor.regraCodigo,
    regraVersao: valor.regraVersao,
    prazoValor: valor.prazoValor,
    prazoUnidade: valor.prazoUnidade,
    atoAncoraCodigo: valor.atoAncoraCodigo,
    suspensividadePrimeiraInstanciaValor: valor.suspensividadePrimeiraInstanciaValor,
    suspensividadePrimeiraInstanciaUnidade: valor.suspensividadePrimeiraInstanciaUnidade,
    suspensividadeSegundaInstanciaValor: valor.suspensividadeSegundaInstanciaValor,
    suspensividadeSegundaInstanciaUnidade: valor.suspensividadeSegundaInstanciaUnidade,
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
