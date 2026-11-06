import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AlertComponent, SpinnerComponent } from '@uniplus/shared-ui/components';
import { acompanharFocoDoEnvio } from '../../shared/foco';
import { mensagemDeErroDoControle } from '../../shared/formulario';
import type { AlteracaoDoLocal, BuscasPorDia } from './busca-de-municipios';
import { CalendarioForm, dataEstaDuplicada } from './calendario-form';
import { MUNICIPIO_BUSCA_VAZIA } from './calendario-dias-uteis.util';
import { DiaNaoUtilCamposComponent } from './dia-nao-util-campos.component';
import type { GrupoDoDia } from './dia-nao-util-form';

export interface AlteracaoDoLocalDoDia {
  readonly grupo: GrupoDoDia;
  readonly alteracao: AlteracaoDoLocal;
}

const ID_DO_ADICIONAR = 'cfg-calendario-adicionar-dia';
const SEMPRE_ABERTO = signal(true).asReadonly();

/** O formulário de novo calendário: a versão do dataset, os dias não úteis e o rodapé de envio. */
@Component({
  selector: 'cfg-calendario-formulario',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    AlertComponent,
    SpinnerComponent,
    DiaNaoUtilCamposComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './calendario-formulario.component.html',
  styleUrl: './calendario-formulario.component.css',
})
export class CalendarioFormularioComponent {
  readonly form = input.required<FormGroup<CalendarioForm>>();
  readonly erro = input.required<string | null>();
  readonly anuncio = input.required<string>();
  readonly salvando = input.required<boolean>();
  readonly buscas = input.required<BuscasPorDia>();
  readonly salvar = output<void>();
  readonly adicionarDia = output<void>();
  readonly removerDia = output<GrupoDoDia>();
  readonly alteracao = output<AlteracaoDoLocalDoDia>();

  private readonly raiz = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly injector = inject(Injector);
  private readonly foco = acompanharFocoDoEnvio({ salvando: this.salvando, aberto: SEMPRE_ABERTO });

  protected aoClicarEmSalvar(evento: Event): void {
    if (this.salvando()) evento.preventDefault();
  }

  protected aoEnviar(): void {
    if (this.salvando()) return;
    this.salvar.emit();
    if (this.form().invalid) this.foco.focarPrimeiroInvalido();
  }

  /** O botão que tinha o foco sai com a linha: o foco vai à linha que ocupa o lugar, ou ao adicionar. */
  protected remover(dia: GrupoDoDia, indice: number): void {
    this.removerDia.emit(dia);
    afterNextRender(() => this.focarAposRemocao(indice), { injector: this.injector });
  }

  protected buscaDo(dia: GrupoDoDia) {
    return this.buscas().get(dia) ?? MUNICIPIO_BUSCA_VAZIA;
  }

  protected dataDuplicada(dia: GrupoDoDia): boolean {
    return dataEstaDuplicada(this.form().controls.diasNaoUteis, dia);
  }

  protected erroDaVersao(): string | null {
    return mensagemDeErroDoControle(this.form().controls.versaoDataset);
  }

  private focarAposRemocao(indice: number): void {
    const remocoes = this.raiz.querySelectorAll<HTMLElement>('.cfg-dia-card__remover');
    const destino = remocoes[Math.min(indice, remocoes.length - 1)];
    (destino ?? this.raiz.querySelector<HTMLElement>(`#${ID_DO_ADICIONAR}`))?.focus();
  }
}
