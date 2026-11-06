import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TagComponent } from '@uniplus/shared-ui/components';
import { idDoBotaoDeEdicao, idDoBotaoDeRemocao } from './pesos-enem-rotulos';
import { slug } from './pesos-enem-agrupamento';

/** O cabeçalho do painel de uma resolução: o título, a situação e as ações sobre ela. */
@Component({
  selector: 'cfg-pesos-enem-cabecalho',
  standalone: true,
  imports: [TagComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pesos-enem-cabecalho.component.html',
  styleUrl: './pesos-enem-cabecalho.component.css',
  host: { class: 'panel-head' },
})
export class PesosEnemCabecalhoComponent {
  readonly resolucao = input.required<string>();
  /** A resolução mais recente: a única que oferece cadastrar a próxima. */
  readonly vigente = input.required<boolean>();
  readonly editando = input.required<boolean>();
  readonly gravando = input.required<boolean>();
  readonly podeCadastrar = input.required<boolean>();
  readonly cadastrar = output<void>();
  readonly editar = output<void>();
  readonly remover = output<void>();

  protected readonly idDoTitulo = computed(() => `cfg-pesos-enem-title-${slug(this.resolucao())}`);
  protected readonly idDaEdicao = computed(() => idDoBotaoDeEdicao(this.resolucao()));
  protected readonly idDaRemocao = computed(() => idDoBotaoDeRemocao(this.resolucao()));
  protected readonly cadastroIndisponivel = computed(
    () => this.gravando() || !this.podeCadastrar(),
  );

  /** `aria-disabled` não impede o clique sozinho: o botão fica focável durante a gravação, e a ação é barrada aqui. */
  protected aoCadastrar(): void {
    if (!this.cadastroIndisponivel()) this.cadastrar.emit();
  }

  protected aoEditar(): void {
    this.editar.emit();
  }

  protected aoRemover(): void {
    this.remover.emit();
  }
}
