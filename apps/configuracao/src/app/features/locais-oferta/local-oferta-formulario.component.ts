import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  viewChild,
} from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CampusDto, TIPOS_LOCAL_OFERTA } from '@uniplus/shared-data/configuracao';
import {
  AlertComponent,
  DrawerComponent,
  EnderecoGeoComponent,
  type FaseDaNovaTentativa,
  NovaTentativaDoCampoComponent,
  SpinnerComponent,
} from '@uniplus/shared-ui/components';
import { acompanharFocoDoEnvio } from '../../shared/foco';
import { mensagemDeErroDoControle } from '../../shared/formulario';
import { LocalOfertaForm } from './local-oferta-form';

@Component({
  selector: 'cfg-local-oferta-formulario',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    DrawerComponent,
    EnderecoGeoComponent,
    SpinnerComponent,
    NovaTentativaDoCampoComponent,
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
  /** Os campi estão sendo lidos: o "Tentar novamente" fica indisponível, sem perder o foco. */
  readonly carregandoCampi = input.required<boolean>();
  readonly faseDosCampi = input.required<FaseDaNovaTentativa>();
  readonly salvar = output<void>();
  readonly cancelar = output<void>();
  readonly recarregarCampi = output<void>();
  protected readonly rotuloDoBotao = computed(() => {
    if (this.salvando()) return 'Salvando...';
    return this.modo() === 'criar' ? 'Criar local' : 'Salvar local';
  });
  protected readonly tipoOptions = TIPOS_LOCAL_OFERTA;
  private readonly endereco = viewChild(EnderecoGeoComponent);
  private readonly foco = acompanharFocoDoEnvio({
    salvando: this.salvando,
    aberto: this.aberto,
    focarEndereco: () => this.endereco()?.focarErro(),
  });

  protected erroDoCampo(nome: keyof LocalOfertaForm): string | null {
    return mensagemDeErroDoControle(this.form().controls[nome]);
  }

  protected aoEnviar(): void {
    if (this.salvando()) return;
    this.salvar.emit();
    if (this.form().invalid) this.foco.focarPrimeiroInvalido();
  }
}
