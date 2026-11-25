import { textoDoFormatoDoCodigo } from '@uniplus/shared-utils';
import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import type { LookupCompleto } from '@uniplus/shared-core/http';
import type { TipoConceitoDto } from '@uniplus/shared-data/configuracao';
import {
  AlertComponent,
  DrawerComponent,
  RecusaDoCampoComponent,
  SpinnerComponent,
  type RecusaDoCampo,
} from '@uniplus/shared-ui/components';
import { acompanharFocoDoEnvio } from '../../shared/foco';
import { mensagemDeErroDoCampoComFormato, recusasDoControle } from '../../shared/formulario';
import { ConceitosAdmitidosComponent } from './conceitos-admitidos.component';
import { EtapaForm } from './tipo-etapa-form';

@Component({
  selector: 'cfg-tipo-etapa-formulario',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    ConceitosAdmitidosComponent,
    DrawerComponent,
    RecusaDoCampoComponent,
    SpinnerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tipo-etapa-formulario.component.html',
  styleUrl: '../../shared/sobreposicao/sobreposicao.css',
})
export class TipoEtapaFormularioComponent {
  protected readonly ajudaDoCodigo = textoDoFormatoDoCodigo(80);
  readonly aberto = model.required<boolean>();
  readonly form = input.required<FormGroup<EtapaForm>>();
  readonly modo = input.required<'criar' | 'editar'>();
  readonly titulo = input.required<string>();
  readonly conceitos = input.required<LookupCompleto<TipoConceitoDto>>();
  readonly erro = input.required<string | null>();
  readonly anuncio = input.required<string>();
  readonly salvando = input.required<boolean>();
  readonly salvar = output<void>();
  readonly cancelar = output<void>();
  private readonly foco = acompanharFocoDoEnvio({ salvando: this.salvando, aberto: this.aberto });

  protected aoClicarEmSalvar(evento: Event): void {
    if (this.salvando()) evento.preventDefault();
  }

  protected aoEnviar(): void {
    if (this.salvando()) return;
    this.salvar.emit();
    if (this.form().invalid) this.foco.focarPrimeiroInvalido();
  }

  protected erroDoCampo(nome: keyof EtapaForm): string | null {
    return mensagemDeErroDoCampoComFormato(this.form().controls[nome], textoDoFormatoDoCodigo(80));
  }

  protected recusasDoCampo(nome: keyof EtapaForm): readonly RecusaDoCampo[] {
    return recusasDoControle(this.form().controls[nome]);
  }
}
