import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  input,
  output,
  viewChild,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import type { PedidoDeConcessaoDto } from '@uniplus/shared-data/autorizacao';
import { TagComponent } from '@uniplus/shared-ui/components';
import { DateBrPipe } from '@uniplus/shared-ui/pipes';
import type { Acao } from './confirmacoes-do-pedido';
import { nomesDeEscopo } from './nomes-de-escopo';
import { PRAZO_NO_PASSADO, hojeNoFuso } from './prazo-de-vigencia';
import { etapa, situacaoDoPedido } from './rotulos-de-acesso';

@Component({
  selector: 'cfg-pedido-resumo',
  standalone: true,
  imports: [ReactiveFormsModule, TagComponent, DateBrPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pedido-resumo.component.html',
})
export class PedidoResumoComponent {
  readonly pedido = input.required<PedidoDeConcessaoDto>();
  readonly prazo = input.required<FormControl<string>>();
  readonly informaPrazo = input.required<boolean>();
  readonly podeAceitar = input.required<boolean>();
  readonly podeDecidir = input.required<boolean>();
  readonly decisaoIndisponivel = input.required<boolean>();
  readonly podeCancelar = input.required<boolean>();
  readonly podeAnexar = input.required<boolean>();
  readonly aguardandoDocumento = input.required<boolean>();
  readonly confirmacao = output<{ acao: Acao; campo?: HTMLInputElement }>();
  readonly recusar = output<void>();
  readonly irParaAnexo = output<void>();
  private readonly campoPrazo = viewChild<ElementRef<HTMLInputElement>>('campoPrazo');
  protected readonly escopo = nomesDeEscopo();
  protected readonly hoje = hojeNoFuso;
  protected readonly mensagemDoPrazo = PRAZO_NO_PASSADO;
  protected readonly rotuloDaSituacao = computed(() => situacaoDoPedido(this.pedido().situacao));
  protected readonly etapaAtual = computed(() => etapa(this.pedido().etapaAtual));

  protected prazoInvalido(): boolean {
    const prazo = this.prazo();
    return prazo.invalid && (prazo.touched || prazo.dirty);
  }

  protected confirmar(acao: Acao): void {
    if (this.decisaoIndisponivel()) return;
    this.confirmacao.emit({ acao, campo: this.campoPrazo()?.nativeElement });
  }

  protected pedirRecusa(): void {
    if (!this.decisaoIndisponivel()) this.recusar.emit();
  }
}
