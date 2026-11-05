import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  effect,
  inject,
  input,
  output,
} from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { AlertComponent, DrawerComponent, SpinnerComponent } from '@uniplus/shared-ui/components';
import { mensagemDeErroDoControle } from '../../shared/formulario';
import { EtapaForm } from './edicao-dos-tipos-etapa';

@Component({
  selector: 'cfg-tipo-etapa-formulario',
  standalone: true,
  imports: [ReactiveFormsModule, AlertComponent, DrawerComponent, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tipo-etapa-formulario.component.html',
  styleUrl: '../../shared/sobreposicao/sobreposicao.css',
})
export class TipoEtapaFormularioComponent {
  private readonly raiz = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  readonly aberto = input.required<boolean>();
  readonly form = input.required<FormGroup<EtapaForm>>();
  readonly modo = input.required<'criar' | 'editar'>();
  readonly titulo = input.required<string>();
  readonly erro = input.required<string | null>();
  readonly salvando = input.required<boolean>();
  readonly fechar = output<void>();
  readonly salvar = output<void>();
  readonly cancelar = output<void>();
  constructor() {
    let estavaSalvando = false;
    effect(() => {
      const salvando = this.salvando();
      const terminou = estavaSalvando && !salvando;
      estavaSalvando = salvando;
      if (terminou) afterNextRender(() => this.focarErro(), { injector: this.injector });
    });
  }
  protected aoAlterarVisibilidade(visivel: boolean): void {
    if (!visivel) this.fechar.emit();
  }
  protected aoEnviar(): void {
    if (!this.salvando()) {
      this.salvar.emit();
      if (this.form().invalid) afterNextRender(() => this.focarErro(), { injector: this.injector });
    }
  }
  protected aoClicarEmSalvar(evento: Event): void {
    if (this.salvando()) evento.preventDefault();
  }
  protected erroDoCampo(nome: keyof EtapaForm): string | null {
    return mensagemDeErroDoControle(this.form().controls[nome]);
  }
  private focarErro(): void {
    if (!this.aberto()) return;
    const campos = this.raiz.nativeElement.querySelectorAll<HTMLElement>(
      '.field.is-error :is(input, select, textarea)',
    );
    [...campos].find((campo) => !campo.hasAttribute('readonly'))?.focus();
  }
}
