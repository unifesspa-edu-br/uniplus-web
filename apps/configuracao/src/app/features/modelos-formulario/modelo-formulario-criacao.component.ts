import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ModeloFormularioView, TipoProcessoDto } from '@uniplus/shared-data/configuracao';
import {
  AlertComponent,
  DrawerComponent,
  FalhaDeLeituraDoCampoComponent,
  SpinnerComponent,
  type LeituraAcompanhada,
} from '@uniplus/shared-ui/components';
import { acompanharFocoDoEnvio } from '../../shared/foco';
import { CampoDaCriacao, CriacaoForm, mensagemDoCampo } from './modelo-formulario-form';
import { FINALIDADES_DO_FORMULARIO } from './finalidades-do-formulario';

@Component({
  selector: 'cfg-modelo-formulario-criacao',
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    DrawerComponent,
    FalhaDeLeituraDoCampoComponent,
    SpinnerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './modelo-formulario-criacao.component.html',
  styleUrl: '../../shared/sobreposicao/sobreposicao.css',
})
export class ModeloFormularioCriacaoComponent {
  readonly form = input.required<FormGroup<CriacaoForm>>();
  readonly aberto = input.required<boolean>();
  readonly salvando = input.required<boolean>();
  readonly erroDaCriacao = input.required<string | null>();
  readonly anuncio = input.required<string>();
  readonly tiposDeProcesso = input.required<readonly TipoProcessoDto[]>();
  /** A leitura dos tipos, que o aviso da página deixa inerte atrás do drawer modal. */
  readonly leituraDosTipos = input.required<LeituraAcompanhada>();
  readonly abertoChange = output<boolean>();
  readonly criar = output<void>();
  readonly modelos = input.required<readonly ModeloFormularioView[]>();
  protected finalidades() {
    return FINALIDADES_DO_FORMULARIO;
  }
  private readonly foco = acompanharFocoDoEnvio({ salvando: this.salvando, aberto: this.aberto });

  protected erro(campo: CampoDaCriacao): string | null {
    return mensagemDoCampo(this.form().controls[campo]);
  }

  protected aoEnviar(): void {
    if (this.salvando()) return;
    this.criar.emit();
    if (this.form().invalid) this.foco.focarPrimeiroInvalido();
  }
}
