import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  input,
  viewChild,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { startWith, switchMap } from 'rxjs';
import type { LookupCompleto } from '@uniplus/shared-core/http';
import type { TipoConceitoDto } from '@uniplus/shared-data/configuracao';
import { FalhaDeLeituraComponent, acompanharCatalogo } from '@uniplus/shared-ui/components';
import { alternarConceito, opcoesDeConceito } from './conceitos-admitidos';

const FALHA_NA_CARGA = 'Sem os tipos de conceito não é possível escolher o que o tipo admite.';

/**
 * Os conceitos que o tipo de etapa admite, escolhidos entre os tipos de conceito ativos do
 * catálogo. O conceito já admitido que saiu do catálogo ativo continua na lista, marcado como
 * inativo, para a pessoa poder retirá-lo: a API recusa a gravação enquanto ele constar.
 */
@Component({
  selector: 'cfg-conceitos-admitidos',
  standalone: true,
  imports: [FalhaDeLeituraComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './conceitos-admitidos.component.html',
})
export class ConceitosAdmitidosComponent {
  readonly controle = input.required<FormControl<readonly string[]>>();
  readonly catalogo = input.required<LookupCompleto<TipoConceitoDto>>();
  /** A recusa do campo, já em mensagem pt-BR; `null` quando não há. */
  readonly erro = input<string | null>(null);

  private readonly grupo = viewChild<ElementRef<HTMLElement>>('grupo');

  protected readonly leitura = acompanharCatalogo({
    assunto: 'tipos de conceito',
    falha: computed(() => (this.catalogo().comErro() ? FALHA_NA_CARGA : null)),
    pendente: computed(() => this.catalogo().pendente()),
    recarregar: () => this.catalogo().recarregar(),
    destino: () => this.grupo()?.nativeElement,
  });

  private readonly admitidos = toSignal(
    toObservable(this.controle).pipe(
      switchMap((controle) => controle.valueChanges.pipe(startWith(controle.value))),
    ),
    { initialValue: [] as readonly string[] },
  );

  /** Só com o catálogo completo: antes disso, todo admitido pareceria fora do catálogo ativo. */
  protected readonly opcoes = computed(() => {
    const catalogo = this.catalogo();
    if (catalogo.pendente() || catalogo.comErro()) return [];
    return opcoesDeConceito(catalogo.opcoes(), this.admitidos());
  });
  protected readonly haInativo = computed(() => this.opcoes().some((opcao) => opcao.inativo));

  protected marcado(codigo: string): boolean {
    return this.admitidos().includes(codigo);
  }

  protected aoAlternar(codigo: string, evento: Event): void {
    const controle = this.controle();
    const marcado = (evento.target as HTMLInputElement).checked;
    controle.setValue(alternarConceito(this.admitidos(), codigo, marcado));
    controle.markAsDirty();
  }
}
