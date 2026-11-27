import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  viewChild,
} from '@angular/core';
import { ValorDeMunicipioComponent } from '@uniplus/shared-ui/components';
import { type CampoDeMunicipios } from './municipios-da-base-legal';

/** Escolha dos municípios e lista dos já adicionados. */
@Component({
  selector: 'cfg-campo-de-municipios',
  standalone: true,
  imports: [ValorDeMunicipioComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './campo-de-municipios.component.html',
  styleUrl: './campo-de-municipios.component.css',
})
export class CampoDeMunicipiosComponent {
  readonly dados = input.required<CampoDeMunicipios>();
  readonly escolher = output<readonly string[]>();
  readonly remover = output<string>();
  protected readonly campo = viewChild(ValorDeMunicipioComponent);
  protected readonly codigos = computed(() => this.dados().selecionados.map((m) => m.codigoIbge));
  protected readonly rotulos = computed(() =>
    Object.fromEntries(this.dados().selecionados.map((m) => [m.codigoIbge, `${m.nome} (${m.uf})`])),
  );

  protected aoRemover(codigoIbge: string, evento: Event): void {
    const botao = evento.currentTarget as HTMLElement;
    const proximo = botao.closest('li')?.nextElementSibling?.querySelector('button');
    this.remover.emit(codigoIbge);
    (proximo ?? document.getElementById(this.campo()?.campoId() ?? ''))?.focus();
  }
}
