import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import {
  AlertComponent,
  DrawerComponent,
  FalhaDeLeituraComponent,
  SelectComponent,
  SpinnerComponent,
} from '@uniplus/shared-ui/components';
import { acompanharFocoDoEnvio } from '../../shared/foco';
import { mensagemDeErroDoCampoComFormato } from '../../shared/formulario';
import { BaseLegalForm } from './base-legal-form';
import { CampoDeMunicipiosComponent } from './campo-de-municipios.component';
import type { CampoDeMunicipios } from './municipios-da-base-legal';
import type { TiposDoFormulario } from './tipos-de-instrumento';

/** Nenhum campo da base legal tem validador de formato: a mensagem de formato nunca é a escolhida. */
const MENSAGEM_DE_FORMATO = 'Valor inválido.';

const ID_DO_AVISO_DE_ESPERA = 'cfg-blbr-salvar-aguarda-tipos';

/** O drawer do cadastro e da edição de base legal de bônus regional. */
@Component({
  selector: 'cfg-base-legal-bonus-regional-formulario',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    CampoDeMunicipiosComponent,
    DrawerComponent,
    FalhaDeLeituraComponent,
    SelectComponent,
    SpinnerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './base-legal-bonus-regional-formulario.component.html',
  styleUrl: '../../shared/sobreposicao/sobreposicao.css',
})
export class BaseLegalBonusRegionalFormularioComponent {
  readonly aberto = model.required<boolean>();
  readonly form = input.required<FormGroup<BaseLegalForm>>();
  readonly modo = input.required<'criar' | 'editar'>();
  readonly titulo = input.required<string>();
  readonly erro = input.required<string | null>();
  readonly anuncio = input.required<string>();
  readonly salvando = input.required<boolean>();
  /** Tipos de instrumento vindos da API: o select oferece os rótulos e grava o código. */
  readonly tipos = input.required<TiposDoFormulario>();
  readonly municipios = input.required<CampoDeMunicipios>();

  readonly salvar = output<void>();
  readonly cancelar = output<void>();
  readonly escolherMunicipios = output<readonly string[]>();
  readonly removerMunicipio = output<string>();

  private readonly foco = acompanharFocoDoEnvio({ salvando: this.salvando, aberto: this.aberto });

  /** O envio espera o envio em curso e o vocabulário de tipos: sem ele, o tipo gravado não aparece. */
  protected readonly envioIndisponivel = computed(
    () => this.salvando() || !this.tipos().disponivel,
  );

  /** Com o botão indisponível, o clique (e Enter ou Espaço, que o geram) não envia. */
  protected aoClicarEmSalvar(evento: Event): void {
    if (this.envioIndisponivel()) {
      evento.preventDefault();
    }
  }

  /** O envio do formulário (Enter num campo, por exemplo) também espera o botão ficar disponível. */
  protected aoEnviar(): void {
    if (this.envioIndisponivel()) {
      return;
    }
    this.salvar.emit();
    if (this.form().invalid || this.municipios().selecionados.length === 0) {
      this.foco.focarPrimeiroInvalido();
    }
  }

  protected erroDoCampo(nome: keyof BaseLegalForm): string | null {
    return mensagemDeErroDoCampoComFormato(this.form().controls[nome], MENSAGEM_DE_FORMATO);
  }

  /** O que explica o botão indisponível; durante o envio, "Salvando..." e `aria-busy` já explicam. */
  protected motivoDoEnvioIndisponivel(): string | null {
    if (this.salvando()) {
      return null;
    }
    if (this.tipos().leitura.visivel()) {
      return 'cfg-blbr-tipos-falha';
    }
    return this.tipos().disponivel ? null : ID_DO_AVISO_DE_ESPERA;
  }

  protected aguardaOsTipos(): boolean {
    return this.motivoDoEnvioIndisponivel() === ID_DO_AVISO_DE_ESPERA;
  }

  /** O select é descrito pela falha do vocabulário, quando ela está à vista; o erro do campo é dele. */
  protected descricaoDoTipo(): string | null {
    return this.aberto() && this.tipos().leitura.visivel() ? 'cfg-blbr-tipos-falha' : null;
  }
}
