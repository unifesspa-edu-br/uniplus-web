import { ChangeDetectionStrategy, Component, input, output, viewChild } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CampusDto, TIPOS_LOCAL_OFERTA } from '@uniplus/shared-data/configuracao';
import {
  AlertComponent,
  DrawerComponent,
  EnderecoGeoComponent,
  SpinnerComponent,
} from '@uniplus/shared-ui/components';
import { mensagemDeErroDoControle } from '../../shared/formulario';
import { LocalOfertaForm } from './edicao-dos-locais-oferta';

@Component({
  selector: 'cfg-local-oferta-formulario',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    DrawerComponent,
    EnderecoGeoComponent,
    SpinnerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './local-oferta-formulario.component.html',
  styleUrl: '../../shared/sobreposicao/sobreposicao.css',
})
export class LocalOfertaFormularioComponent {
  readonly aberto = input.required<boolean>();
  readonly form = input.required<FormGroup<LocalOfertaForm>>();
  readonly modo = input.required<'criar' | 'editar'>();
  readonly titulo = input.required<string>();
  readonly erro = input.required<string | null>();
  readonly erroDoEndereco = input.required<string | null>();
  readonly salvando = input.required<boolean>();
  readonly gravando = input.required<boolean>();
  readonly campi = input.required<readonly CampusDto[]>();
  readonly campiComErro = input.required<boolean>();
  readonly salvar = output<void>();
  readonly cancelar = output<void>();
  readonly recarregarCampi = output<void>();
  protected readonly tipoOptions = TIPOS_LOCAL_OFERTA;
  private readonly endereco = viewChild(EnderecoGeoComponent);
  focarEndereco(): void {
    this.endereco()?.focarErro();
  }
  protected erroDoCampo(nome: keyof LocalOfertaForm): string | null {
    return mensagemDeErroDoControle(this.form().controls[nome]);
  }
  protected aoEnviar(): void {
    if (!this.salvando()) this.salvar.emit();
  }
}
