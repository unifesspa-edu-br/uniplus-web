import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import {
  FalhaDeLeituraDoCampoComponent,
  type LeituraAcompanhada,
} from '@uniplus/shared-ui/components';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import type { UnidadeDto } from '@uniplus/shared-data/organizacao';
import { TAMANHO_MAXIMO_DA_BUSCA } from './busca-de-unidades';

/** O campo "unidade superior": busca no servidor e select com as unidades encontradas. */
@Component({
  selector: 'cfg-unidade-superior-campo',
  imports: [ReactiveFormsModule, FalhaDeLeituraDoCampoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './unidade-superior-campo.component.html',
})
export class UnidadeSuperiorCampoComponent {
  readonly controle = input.required<FormControl<string>>();
  readonly termo = model.required<string>();
  readonly opcoes = input.required<readonly UnidadeDto[]>();
  /** A unidade em edição: ela não pode ser superior de si mesma. */
  readonly emEdicaoId = input.required<string | null>();
  /** A leitura das unidades que o select oferece, com o aviso de falha e a nova tentativa. */
  readonly leitura = input.required<LeituraAcompanhada>();
  /** A recusa do servidor ou a regra violada, quando há. */
  readonly erro = input.required<string | null>();

  protected readonly tamanhoMaximoDaBusca = TAMANHO_MAXIMO_DA_BUSCA;

  protected aoDigitar(evento: Event): void {
    this.termo.set((evento.target as HTMLInputElement).value);
  }
}
