import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { AreaPesoAreaEnemDto } from '@uniplus/shared-data/configuracao';
import {
  AlertComponent,
  DrawerComponent,
  SpinnerComponent,
  TagComponent,
} from '@uniplus/shared-ui/components';
import { acompanharFocoDoEnvio } from '../../shared/foco';
import { mensagemDeErroDoControle } from '../../shared/formulario';
import type { EstadoOperacao } from './edicao-dos-parametros';
import { NumeroDigitadoValidoDirective } from './numero-digitado-valido.directive';
import { mensagemDoCampoNumerico } from './pesos-enem-campo-numerico';
import { AreaForm, PesoLoteForm } from './pesos-enem-form';
import { CORTE_MAXIMO, PESO_MAXIMO, type CampoDaArea } from './pesos-enem-limites';
import {
  descritoPor,
  idDrawer,
  rotuloDaArea,
  rotuloDoCampo,
  rotuloDoGrupo,
} from './pesos-enem-rotulos';

/** O drawer de cadastro de uma nova resolução: um bloco de pesos e base legal por grupo de curso. */
@Component({
  selector: 'cfg-pesos-enem-formulario',
  standalone: true,
  imports: [
    AlertComponent,
    DrawerComponent,
    NumeroDigitadoValidoDirective,
    ReactiveFormsModule,
    SpinnerComponent,
    TagComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pesos-enem-formulario.component.html',
  styleUrl: '../../shared/sobreposicao/sobreposicao.css',
})
export class PesosEnemFormularioComponent {
  readonly aberto = model.required<boolean>();
  readonly form = input.required<FormGroup<PesoLoteForm>>();
  readonly areas = input.required<readonly AreaPesoAreaEnemDto[]>();
  readonly estadoGrupos = input.required<ReadonlyMap<number, EstadoOperacao>>();
  readonly erro = input.required<string | null>();
  readonly anuncio = input.required<string>();
  readonly salvando = input.required<boolean>();
  readonly salvar = output<void>();
  readonly cancelar = output<void>();
  readonly fechado = output<void>();

  protected readonly PESO_MAXIMO = PESO_MAXIMO;
  protected readonly CORTE_MAXIMO = CORTE_MAXIMO;
  protected readonly idDrawer = idDrawer;
  protected readonly descritoPor = descritoPor;
  protected readonly rotuloDoGrupo = rotuloDoGrupo;
  protected readonly rotuloDoBotao = computed(() =>
    this.salvando() ? 'Salvando...' : 'Criar resolução',
  );
  private readonly foco = acompanharFocoDoEnvio({ salvando: this.salvando, aberto: this.aberto });

  protected erroDoCampo(nome: 'resolucao' | 'baseLegalGlobal'): string | null {
    return mensagemDeErroDoControle(this.form().controls[nome]);
  }

  protected erroDaBaseLegal(grupo: number): string | null {
    return mensagemDeErroDoControle(this.form().controls.grupos.at(grupo).controls.baseLegal);
  }

  protected erroDaArea(area: FormGroup<AreaForm>, campo: CampoDaArea): string | null {
    return mensagemDoCampoNumerico(area.controls[campo], campo);
  }

  protected rotuloDaArea(codigo: string): string {
    return rotuloDaArea(this.areas(), codigo);
  }

  protected rotuloDoCampo(campo: CampoDaArea, codigo: string, grupo: string): string {
    return rotuloDoCampo(campo, this.rotuloDaArea(codigo), grupo);
  }

  /** `aria-disabled` não impede o envio sozinho: o botão fica focável durante o envio, e o clique é barrado aqui. */
  protected aoClicarEmSalvar(evento: Event): void {
    if (this.salvando()) evento.preventDefault();
  }

  protected aoEnviar(): void {
    if (this.salvando()) return;
    this.salvar.emit();
    if (this.form().invalid) this.foco.focarPrimeiroInvalido();
  }
}
