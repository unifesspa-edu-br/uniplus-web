import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import type { UnidadeDto } from '@uniplus/shared-data/organizacao';
import { TAMANHO_MAXIMO_DA_BUSCA } from './busca-de-unidades';

/** O campo "unidade superior": busca no servidor e select com as unidades encontradas. */
@Component({
  selector: 'cfg-unidade-superior-campo',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './unidade-superior-campo.component.html',
})
export class UnidadeSuperiorCampoComponent {
  readonly controle = input.required<FormControl<string>>();
  readonly termo = model.required<string>();
  readonly opcoes = input.required<readonly UnidadeDto[]>();
  /** A unidade em edição: ela não pode ser superior de si mesma. */
  readonly emEdicaoId = input.required<string | null>();
  readonly comErro = input.required<boolean>();
  readonly carregando = input.required<boolean>();
  /** A recusa do servidor ou a regra violada, quando há. */
  readonly erro = input.required<string | null>();
  readonly recarregar = output<void>();

  protected readonly tamanhoMaximoDaBusca = TAMANHO_MAXIMO_DA_BUSCA;

  protected aoDigitar(evento: Event): void {
    this.termo.set((evento.target as HTMLInputElement).value);
  }

  protected aoTentarNovamente(evento: Event): void {
    if (this.carregando()) {
      evento.preventDefault();
      return;
    }
    this.recarregar.emit();
  }
}
