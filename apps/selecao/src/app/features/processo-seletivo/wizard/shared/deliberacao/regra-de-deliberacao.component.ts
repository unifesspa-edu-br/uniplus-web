import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ModoDeDeliberacao } from '@uniplus/shared-data/selecao';

import type { RegraDeDeliberacaoDaBanca } from '../../modelos/deliberacao.models';
import { RecusasDoCampoComponent } from '../recusas/recusas-do-campo.component';
import { emOrdem, haRecusaAtiva, type RecusaOrdenada } from '../recusas/ordem-das-recusas';
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
import {
  CAMPOS_DA_BANCA,
  type CampoDaBanca,
  type RecusasDaBancaPorCampo,
} from './recusas-da-regra';

/** O valor do seletor de modo que declara a banca sem regra de deliberação. */
const SEM_REGRA = '';

const SEM_RECUSAS: readonly RecusaOrdenada[] = [];

/**
 * Como a banca delibera: o modo, o tamanho do colegiado e, quando há votação, o quórum e o critério.
 * Mostra só os campos que o modo e o critério pedem, e devolve sempre uma regra coerente.
 */
@Component({
  selector: 'sel-regra-de-deliberacao',
  imports: [RecusasDoCampoComponent],
  templateUrl: './regra-de-deliberacao.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: ':host { display: block; }',
})
export class RegraDeDeliberacaoComponent {
  readonly regra = input.required<RegraDeDeliberacaoDaBanca | null>();
  /** Prefixo dos `id` dos controles: único na tela, para ligar rótulo, ajuda e erro. */
  readonly idBase = input.required<string>();
  readonly desabilitada = input(false);
  /** O que a conferência local recusa em cada campo; `regra` é a regra inteira. */
  readonly erros = input<Partial<Record<CampoDaBanca, string>>>({});
  /** O que o servidor recusou em cada campo; `regra` é a regra inteira. */
  readonly recusas = input<RecusasDaBancaPorCampo>({});

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

  /** Os campos que a tela mostra num controle próprio, fora o modo, nas condições de agora. */
  private readonly comControleProprio = computed(() => {
    const colegiada = this.colegiada();
    return new Set<CampoDaBanca>([
      ...(this.regra() === null ? [] : (['integrantes', 'suplentes'] as const)),
      ...(colegiada ? (['encerramento', 'quorum', 'criterio'] as const) : []),
      ...(colegiada && this.comDesempate() ? (['desempate'] as const) : []),
      ...(colegiada && this.comSemUnanimidade() ? (['semUnanimidade'] as const) : []),
    ]);
  });

  /** O modo mostra as recusas dele, as da regra inteira e as dos campos que a tela não mostra. */
  private readonly recusasDoModo = computed(() => {
    const comControle = this.comControleProprio();
    const recusas = this.recusas();
    return emOrdem(
      CAMPOS_DA_BANCA.filter((campo) => !comControle.has(campo)).flatMap(
        (campo) => recusas[campo] ?? SEM_RECUSAS,
      ),
    );
  });

  protected id(campo: CampoDaBanca): string {
    return `${this.idBase()}-${campo}`;
  }

  /** A recusa da conferência local; o modo mostra também a da regra inteira. */
  protected erro(campo: CampoDaBanca): string | undefined {
    const erros = this.erros();
    return campo === 'modo' ? (erros.modo ?? erros.regra) : erros[campo];
  }

  protected recusasDe(campo: CampoDaBanca): readonly RecusaOrdenada[] {
    return campo === 'modo' ? this.recusasDoModo() : (this.recusas()[campo] ?? SEM_RECUSAS);
  }

  /** O campo está inválido: a conferência local o recusa ou há recusa do servidor que ainda vale. */
  protected invalido(campo: CampoDaBanca): boolean {
    return !!this.erro(campo) || haRecusaAtiva(this.recusasDe(campo));
  }

  /** Os `id` que descrevem o controle: a dica do campo, o erro local e as recusas, quando há. */
  protected descritoPor(campo: CampoDaBanca, comDica = false): string | null {
    const ids = [
      ...(comDica ? [`${this.id(campo)}-dica`] : []),
      ...(this.erro(campo) === undefined ? [] : [`${this.id(campo)}-erro`]),
      ...(this.recusasDe(campo).length === 0 ? [] : [`${this.id(campo)}-recusas`]),
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
