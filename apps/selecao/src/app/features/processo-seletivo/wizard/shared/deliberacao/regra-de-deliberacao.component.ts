import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ModoDeDeliberacao } from '@uniplus/shared-data/selecao';

import type { RegraDeDeliberacaoDaBanca } from '../../modelos/deliberacao.models';
import {
  alterarRegra,
  CRITERIOS_DE_VOTACAO,
  DESEMPATES_DA_VOTACAO,
  ehColegiada,
  ENCERRAMENTOS_DA_VOTACAO,
  MODOS_DE_DELIBERACAO,
  pedeDesempate,
  pedeResultadoSemUnanimidade,
  quorumSegueOsIntegrantes,
  regraNova,
  RESULTADOS_SEM_UNANIMIDADE,
  type CampoDaRegra,
} from './regra-de-deliberacao';
import type { CampoDaBanca } from './recusas-da-regra';

/** O valor do seletor de modo que declara a banca sem regra de deliberação. */
const SEM_REGRA = '';

/**
 * Como a banca delibera: o modo, o tamanho do colegiado e, quando há votação, o quórum e o critério.
 * Mostra só os campos que o modo e o critério pedem, e devolve sempre uma regra coerente.
 */
@Component({
  selector: 'sel-regra-de-deliberacao',
  templateUrl: './regra-de-deliberacao.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: ':host { display: block; }',
})
export class RegraDeDeliberacaoComponent {
  readonly regra = input.required<RegraDeDeliberacaoDaBanca | null>();
  /** Prefixo dos `id` dos controles: único na tela, para ligar rótulo, ajuda e erro. */
  readonly idBase = input.required<string>();
  readonly desabilitada = input(false);
  /** Recusa por campo (conferência local ou resposta do servidor); `regra` é a regra inteira. */
  readonly erros = input<Partial<Record<CampoDaBanca, string>>>({});

  readonly regraChange = output<RegraDeDeliberacaoDaBanca | null>();

  protected readonly modos = MODOS_DE_DELIBERACAO;
  protected readonly criterios = CRITERIOS_DE_VOTACAO;
  protected readonly desempates = DESEMPATES_DA_VOTACAO;
  protected readonly encerramentos = ENCERRAMENTOS_DA_VOTACAO;
  protected readonly semUnanimidade = RESULTADOS_SEM_UNANIMIDADE;

  protected readonly colegiada = computed(() => {
    const regra = this.regra();
    return regra !== null && ehColegiada(regra);
  });
  protected readonly quorumFixo = computed(() => {
    const regra = this.regra();
    return regra !== null && quorumSegueOsIntegrantes(regra);
  });
  protected readonly comDesempate = computed(() => {
    const regra = this.regra();
    return regra !== null && pedeDesempate(regra);
  });
  protected readonly comSemUnanimidade = computed(() => {
    const regra = this.regra();
    return regra !== null && pedeResultadoSemUnanimidade(regra);
  });

  protected readonly semRegra = SEM_REGRA;

  /** O modo mostra a recusa dele e a da regra inteira, que não tem controle próprio. */
  protected readonly erroDoModo = computed(() => this.erros().modo ?? this.erros().regra);

  protected id(campo: CampoDaBanca): string {
    return `${this.idBase()}-${campo}`;
  }

  protected erro(campo: CampoDaBanca): string | undefined {
    return this.erros()[campo];
  }

  /** Os `id` que descrevem o controle: a dica do campo, e o erro quando há. */
  protected descritoPor(campo: CampoDaBanca, comDica = false): string | null {
    const ids = [
      ...(comDica ? [`${this.id(campo)}-dica`] : []),
      ...(this.erro(campo) === undefined ? [] : [`${this.id(campo)}-erro`]),
    ];
    return ids.length === 0 ? null : ids.join(' ');
  }

  protected escolherModo(valor: string): void {
    const modo = this.modos.find((opcao) => opcao.valor === valor)?.valor;
    this.regraChange.emit(modo === undefined ? null : this.regraDoModo(modo));
  }

  protected alterar(campo: CampoDaRegra, valor: string): void {
    const regra = this.regra();
    if (regra !== null) this.regraChange.emit(alterarRegra(regra, campo, valor));
  }

  private regraDoModo(modo: ModoDeDeliberacao): RegraDeDeliberacaoDaBanca {
    const atual = this.regra();
    return atual === null ? regraNova(modo) : alterarRegra(atual, 'modo', modo);
  }
}
