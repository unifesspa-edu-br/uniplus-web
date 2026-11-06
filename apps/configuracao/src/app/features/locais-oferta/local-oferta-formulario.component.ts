import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
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
  SpinnerComponent,
} from '@uniplus/shared-ui/components';
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
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './local-oferta-formulario.component.html',
  styleUrl: '../../shared/sobreposicao/sobreposicao.css',
})
export class LocalOfertaFormularioComponent {
  private readonly raiz = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
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
  protected readonly rotuloDoBotao = computed(() => {
    if (this.salvando()) return 'Salvando...';
    return this.modo() === 'criar' ? 'Criar local' : 'Salvar local';
  });
  protected readonly tipoOptions = TIPOS_LOCAL_OFERTA;
  private readonly endereco = viewChild(EnderecoGeoComponent);
  constructor() {
    this.acompanharFocoDoEnvio();
  }

  focarEndereco(): void {
    this.endereco()?.focarErro();
  }
  protected erroDoCampo(nome: keyof LocalOfertaForm): string | null {
    return mensagemDeErroDoControle(this.form().controls[nome]);
  }
  protected aoEnviar(): void {
    if (!this.salvando()) this.salvar.emit();
  }

  /**
   * Ao começar o envio com o foco num campo (Enter, por exemplo), o fieldset desabilita o campo e
   * o foco iria ao `body`: leva-o ao botão de salvar.
   */
  private acompanharFocoDoEnvio(): void {
    let estavaSalvando = false;
    effect(() => {
      const salvando = this.salvando();
      const comecou = !estavaSalvando && salvando;
      estavaSalvando = salvando;
      if (comecou && this.focoEstaNosCampos()) {
        afterNextRender(() => this.focarBotaoDeSalvar(), { injector: this.injector });
      }
    });
  }

  private focoEstaNosCampos(): boolean {
    const campos = this.raiz.nativeElement.querySelector('fieldset');
    return campos?.contains(document.activeElement) ?? false;
  }

  private focarBotaoDeSalvar(): void {
    this.raiz.nativeElement.querySelector<HTMLElement>('button[type="submit"]')?.focus();
  }
}
