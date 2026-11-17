import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  input,
  linkedSignal,
  output,
  viewChildren,
} from '@angular/core';
import type { RegraCatalogoDto } from '@uniplus/shared-data/selecao';
import { RecusaDoCampoComponent, type RecusaDoCampo } from '@uniplus/shared-ui/components';

import type { ModoDaSecao } from '../../../shared/modo-da-secao';
import {
  modoVigenteDoTipo,
  type IdentidadeDoProcedimento,
} from '../../../documento/edicoes/procedimentos-de-recurso.edicao';
import type { RegraEscolhida } from '../../../documento/regra-escolhida';
import { focarAposRenderizarSeSemFoco } from '../../../shared/foco-apos-renderizar';
import type { ModoDoTipo } from '../../../shared/procedimentos-do-recurso/procedimentos-da-janela';
import { EscolhaDoProcedimentoComponent } from './escolha-do-procedimento.component';
import type { EscolhaDaRegra, TrocaDeModo } from './eventos-do-procedimento';
import {
  linhasDoTipo,
  type AlvoOferecido,
  type LinhaDoProcedimento,
  type TipoDeDecisaoNaTela,
} from './procedimentos-na-tela';
import {
  recusasDoProcedimento,
  recusasSemLinha,
  type RecusaDoProcedimento,
} from './recusas-do-procedimento';

const MODOS: readonly { readonly valor: ModoDoTipo; readonly rotulo: string }[] = [
  { valor: 'tipoInteiro', rotulo: 'A decisão inteira' },
  { valor: 'porAlvo', rotulo: 'Um para cada item contestado' },
];

/**
 * O procedimento de recurso de um tipo de decisão: a decisão inteira ou um por item contestado,
 * cada um com o seletor da regra. Só apresenta e avisa por eventos; o modo vigente vem dos
 * procedimentos declarados, e a escolha de modo de quem ainda não declarou nada fica aqui.
 */
@Component({
  selector: 'sel-procedimento-do-tipo',
  imports: [EscolhaDoProcedimentoComponent, RecusaDoCampoComponent],
  templateUrl: './procedimento-do-tipo.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
    }
    .linhas {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }
  `,
})
export class ProcedimentoDoTipoComponent {
  private readonly injector = inject(Injector);
  private readonly radiosDoModo = viewChildren<ElementRef<HTMLInputElement>>('radioDoModo');

  readonly tipo = input.required<TipoDeDecisaoNaTela>();
  readonly idBase = input.required<string>();
  readonly regrasDoCatalogo = input.required<readonly RegraCatalogoDto[]>();
  readonly alvosOferecidos = input.required<readonly AlvoOferecido[]>();
  readonly modo = input.required<ModoDaSecao>();
  readonly temJanela = input(true);
  readonly semProcedimento = input.required<boolean>();
  readonly idDaRecusaDaJanela = input<string | null>(null);
  readonly sugestao = input<RegraEscolhida | null>(null);
  readonly recusas = input<readonly RecusaDoProcedimento[]>([]);

  readonly declarar = output<EscolhaDaRegra>();
  readonly trocarRegra = output<EscolhaDaRegra>();
  readonly remover = output<IdentidadeDoProcedimento>();
  readonly trocarModo = output<TrocaDeModo>();

  protected readonly modos = MODOS;
  private readonly modoVigente = computed(() =>
    modoVigenteDoTipo(this.tipo().procedimentos, this.tipo().tipoDeDecisao),
  );
  /** Acompanha o modo vigente; quando os procedimentos acabam, fica no último modo da tela. */
  private readonly modoEscolhido = linkedSignal<ModoDoTipo | null, ModoDoTipo>({
    source: this.modoVigente,
    computation: (vigente, anterior) => vigente ?? anterior?.value ?? 'tipoInteiro',
  });
  protected readonly oferecePorAlvo = computed(
    () =>
      this.tipo().declarado &&
      (this.alvosOferecidos().length > 0 || this.modoVigente() === 'porAlvo'),
  );
  /** Lê a escolha antes do vigente, para que ela acompanhe o vigente mesmo enquanto ele manda. */
  protected readonly modoDoTipo = computed(() => {
    const escolhido = this.modoEscolhido();
    return this.modoVigente() ?? (this.oferecePorAlvo() ? escolhido : 'tipoInteiro');
  });
  protected readonly linhas = computed(() =>
    linhasDoTipo(this.tipo(), this.modoDoTipo(), this.alvosOferecidos()).filter(
      (linha) => linha.declarado !== null || (this.temJanela() && this.modo() !== 'consulta'),
    ),
  );
  /** O aviso do tipo que também descreve o seletor: a falta de procedimento ou o tipo que o lugar deixou de declarar. */
  protected readonly idDoAvisoDoTipo = computed(() => {
    if (!this.tipo().declarado) return `${this.idDoTipo()}-nao-declarado`;
    return this.semProcedimento() ? `${this.idDoTipo()}-falta` : null;
  });
  protected readonly contextoDaLinha = computed(
    () => [this.idDoAvisoDoTipo(), this.descricaoDoTipo()].filter(Boolean).join(' ') || null,
  );
  protected readonly descricaoDoTipo = computed(
    () =>
      [
        this.recusasDoTipo().length > 0 ? `${this.idDoTipo()}-recusa` : null,
        this.idDaRecusaDaJanela(),
      ]
        .filter(Boolean)
        .join(' ') || null,
  );
  protected readonly bloqueado = computed(() => this.modo() !== 'edicao' || !this.temJanela());
  protected readonly idDoTipo = computed(() => `${this.idBase()}-${this.tipo().tipoDeDecisao}`);
  protected readonly recusasDoTipo = computed(() =>
    recusasSemLinha(this.recusas(), this.tipo().tipoDeDecisao, this.linhas()),
  );

  protected idDaLinha(posicao: number): string {
    return `${this.idDoTipo()}-${posicao}`;
  }

  protected recusasDaLinha(linha: LinhaDoProcedimento): readonly RecusaDoCampo[] {
    return recusasDoProcedimento(this.recusas(), this.identidadeDaLinha(linha));
  }

  protected aoEscolher(linha: LinhaDoProcedimento, regra: RegraEscolhida): void {
    if (this.bloqueado() || linha.soRemove) return;
    const escolha = { identidade: this.identidadeDaLinha(linha), regra };
    if (linha.declarado === null) this.declarar.emit(escolha);
    else this.trocarRegra.emit(escolha);
  }

  protected aoRemover(linha: LinhaDoProcedimento): void {
    if (this.modo() !== 'edicao') return;
    this.remover.emit(this.identidadeDaLinha(linha));
    focarAposRenderizarSeSemFoco(this.injector, this.idDoTipo());
  }

  /** Os botões voltam ao modo do documento, mesmo que quem usa não tenha atendido o pedido. */
  protected escolherModo(modo: ModoDoTipo): void {
    if (this.bloqueado()) return;
    this.modoEscolhido.set(modo);
    this.trocarModo.emit({ tipoDeDecisao: this.tipo().tipoDeDecisao, modo });
    afterNextRender(() => this.marcarModoVigente(), { injector: this.injector });
  }

  private marcarModoVigente(): void {
    for (const radio of this.radiosDoModo()) {
      radio.nativeElement.checked = radio.nativeElement.value === this.modoDoTipo();
    }
  }

  private identidadeDaLinha({ alvo, ocorrencia }: LinhaDoProcedimento): IdentidadeDoProcedimento {
    return {
      tipoDeDecisao: this.tipo().tipoDeDecisao,
      alvo,
      ...(ocorrencia > 0 && { ocorrencia }),
    };
  }
}
