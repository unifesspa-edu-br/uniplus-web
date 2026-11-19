import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { AlertComponent, DrawerComponent, SpinnerComponent } from '@uniplus/shared-ui/components';
import { FundamentoOferecido } from './fundamentos-oferecidos';
import { acompanharFocoDoEnvio } from '../../shared/foco';
import { ModoDoMotivo, MotivoForm, mensagemDoCampo } from './motivo-de-decisao-form';
import { SENTIDOS_DE_MOTIVO } from './tipos-de-motivo';

@Component({
  selector: 'cfg-motivo-de-decisao-formulario',
  imports: [ReactiveFormsModule, AlertComponent, DrawerComponent, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './motivo-de-decisao-formulario.component.html',
  styleUrl: '../../shared/sobreposicao/sobreposicao.css',
  styles: [':host, :host > ui-drawer { display: contents; }'],
})
export class MotivoDeDecisaoFormularioComponent {
  readonly aberto = input.required<boolean>();
  readonly form = input.required<FormGroup<MotivoForm>>();
  readonly titulo = input.required<string>();
  readonly tipo = input.required<string>();
  readonly erro = input.required<string | null>();
  readonly anuncio = input.required<string>();
  readonly modo = input.required<ModoDoMotivo>();
  readonly salvando = input.required<boolean>();
  readonly aguardandoReenvio = input.required<boolean>();
  readonly pedeSubclassificacao = input.required<boolean>();
  readonly fundamentos = input.required<readonly FundamentoOferecido[]>();
  readonly falhaNosFundamentos = input.required<string | null>();
  readonly salvar = output<void>();
  readonly cancelar = output<void>();

  protected readonly sentidos = SENTIDOS_DE_MOTIVO;
  protected readonly criando = computed(() => this.modo() === 'criar');
  protected readonly rotuloDoBotao = computed(() => {
    if (this.salvando()) return 'Salvando...';
    return this.criando() ? 'Criar motivo' : 'Salvar motivo';
  });
  private readonly foco = acompanharFocoDoEnvio({ salvando: this.salvando, aberto: this.aberto });

  /** O X e o Esc da gaveta cancelam como o botão Cancelar: quem decide fechar é a edição. */
  protected aoMudarVisibilidade(visivel: boolean): void {
    if (!visivel) this.cancelar.emit();
  }

  protected aoClicarEmSalvar(evento: Event): void {
    if (this.salvando()) evento.preventDefault();
  }

  protected erroDoCampo(nome: keyof MotivoForm): string | null {
    return mensagemDoCampo(this.form().controls[nome]);
  }

  protected aoEnviar(): void {
    if (this.salvando()) return;
    this.salvar.emit();
    if (this.form().invalid) this.foco.focarPrimeiroInvalido();
  }
}
