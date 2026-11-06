import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  effect,
  inject,
  input,
  model,
  output,
} from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { AlertComponent, DrawerComponent, SpinnerComponent } from '@uniplus/shared-ui/components';
import { mensagemDeErroDoControle } from '../../shared/formulario';
import { BancaForm } from './tipo-banca-form';
@Component({
  selector: 'cfg-tipo-banca-formulario',
  standalone: true,
  imports: [ReactiveFormsModule, AlertComponent, DrawerComponent, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tipo-banca-formulario.component.html',
  styleUrl: '../../shared/sobreposicao/sobreposicao.css',
  styles: [':host, :host > ui-drawer { display: contents; }'],
})
export class TipoBancaFormularioComponent {
  private readonly raiz = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  readonly aberto = model.required<boolean>();
  readonly form = input.required<FormGroup<BancaForm>>();
  readonly erro = input.required<string | null>();
  readonly anuncio = input.required<string>();
  readonly salvando = input.required<boolean>();
  readonly sugestoesFaseTipica = input.required<readonly string[]>();
  readonly salvar = output<void>();
  readonly cancelar = output<void>();
  constructor() {
    let estavaSalvando = false;
    effect(() => {
      const comecou = !estavaSalvando && this.salvando();
      const terminou = estavaSalvando && !this.salvando();
      estavaSalvando = this.salvando();
      if (comecou && this.focoEstaNosCampos()) this.levarFocoAoSalvar();
      if (terminou) afterNextRender(() => this.focarInvalido(), { injector: this.injector });
    });
  }
  private focoEstaNosCampos(): boolean {
    return (
      this.raiz.nativeElement.querySelector('fieldset')?.contains(document.activeElement) ?? false
    );
  }

  private levarFocoAoSalvar(): void {
    afterNextRender(
      () => this.raiz.nativeElement.querySelector<HTMLElement>('button[type="submit"]')?.focus(),
      { injector: this.injector },
    );
  }

  private focarInvalido(): void {
    if (this.aberto())
      this.raiz.nativeElement
        .querySelector<HTMLElement>('.field.is-error :is(input, textarea, select)')
        ?.focus();
  }
  protected aoClicarEmSalvar(evento: Event): void {
    if (this.salvando()) evento.preventDefault();
  }
  protected aoEnviar(): void {
    if (!this.salvando()) this.salvar.emit();
  }
  protected erroDoCampo(nome: keyof BancaForm): string | null {
    return mensagemDeErroDoControle(this.form().controls[nome]);
  }
}
