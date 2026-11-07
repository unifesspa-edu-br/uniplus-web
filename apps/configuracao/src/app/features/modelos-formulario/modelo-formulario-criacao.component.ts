import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { TipoProcessoDto } from '@uniplus/shared-data/configuracao';
import {
  AlertComponent,
  DrawerComponent,
  FalhaDeLeituraDoCampoComponent,
  FINALIDADES,
  SpinnerComponent,
  type LeituraAcompanhada,
} from '@uniplus/shared-ui/components';
import { acompanharFocoDoEnvio } from '../../shared/foco';
import { CampoDaCriacao, CriacaoForm, mensagemDoCampo } from './modelo-formulario-form';

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
  protected readonly finalidades = FINALIDADES;
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
