import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  output,
} from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import {
  acompanharLeitura,
  AlertComponent,
  DrawerComponent,
  FalhaDeLeituraDoCampoComponent,
  IndicadorDaLeituraDirective,
  SpinnerComponent,
} from '@uniplus/shared-ui/components';
import { acompanharFocoDoEnvio } from '../../shared/foco';
import { mensagemDeErroDoControle } from '../../shared/formulario';
import {
  opcoesDoVocabulario,
  VOCABULARIO_DE_PAPEIS_DE_BANCA,
  VOCABULARIO_DE_TIPOS_DE_DECISAO,
  type PapelDaBanca,
  type TipoBancaDto,
  type TipoMotivoDeDecisaoCodigo,
} from '@uniplus/shared-data/configuracao';
import { BancaForm } from './tipo-banca-form';
@Component({
  selector: 'cfg-tipo-banca-formulario',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    DrawerComponent,
    FalhaDeLeituraDoCampoComponent,
    IndicadorDaLeituraDirective,
    SpinnerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tipo-banca-formulario.component.html',
  styleUrl: '../../shared/sobreposicao/sobreposicao.css',
  styles: [':host, :host > ui-drawer { display: contents; }'],
})
export class TipoBancaFormularioComponent {
  readonly aberto = model.required<boolean>();
  /** O papel e os tipos de decisão como o tipo de banca os trouxe: seguem à vista ainda que o vocabulário não os tenha. */
  readonly papelLido = input<PapelDaBanca | null>(null);
  readonly tiposLidos = input<TipoBancaDto['tiposDeDecisaoJulgados']>([]);
  protected readonly papeis = inject(VOCABULARIO_DE_PAPEIS_DE_BANCA);
  protected readonly tiposDeDecisao = inject(VOCABULARIO_DE_TIPOS_DE_DECISAO);
  protected readonly opcoesDePapel = computed(() => {
    const lido = this.papelLido();
    return opcoesDoVocabulario(this.papeis.itens(), lido ? [lido] : []);
  });
  protected readonly opcoesDeTipo = computed(() =>
    opcoesDoVocabulario(this.tiposDeDecisao.itens(), this.tiposLidos()),
  );
  protected readonly leituraDosPapeis = acompanharLeitura({
    falha: this.papeis.erro,
    pendente: this.papeis.carregando,
    recarregar: () => this.papeis.recarregar(),
    destino: () => document.getElementById('cfg-papel'),
    assunto: 'os papéis de banca',
  });
  protected readonly leituraDosTipos = acompanharLeitura({
    falha: this.tiposDeDecisao.erro,
    pendente: this.tiposDeDecisao.carregando,
    recarregar: () => this.tiposDeDecisao.recarregar(),
    destino: () => document.querySelector<HTMLElement>('#cfg-tipos-decisao input'),
    assunto: 'os tipos de decisão',
  });
  private readonly leituraNaAbertura = effect(() => {
    if (!this.aberto()) return;
    this.papeis.carregar();
    this.tiposDeDecisao.carregar();
  });
  readonly form = input.required<FormGroup<BancaForm>>();
  readonly erro = input.required<string | null>();
  readonly anuncio = input.required<string>();
  readonly salvando = input.required<boolean>();
  readonly sugestoesFaseTipica = input.required<readonly string[]>();
  readonly salvar = output<void>();
  readonly cancelar = output<void>();
  private readonly foco = acompanharFocoDoEnvio({ salvando: this.salvando, aberto: this.aberto });

  protected tipoMarcado(codigo: string): boolean {
    return this.form().controls.tiposDeDecisaoJulgados.value.some((item) => item === codigo);
  }

  protected alternarTipo(codigo: string, marcado: boolean): void {
    const controle = this.form().controls.tiposDeDecisaoJulgados;
    const restantes = controle.value.filter((item) => item !== codigo);
    const tipo = this.tipoConhecido(codigo);
    controle.setValue(marcado && tipo ? [...restantes, tipo] : restantes);
    controle.markAsDirty();
    controle.markAsTouched();
  }

  private tipoConhecido(codigo: string): TipoMotivoDeDecisaoCodigo | undefined {
    return [...this.tiposDeDecisao.itens(), ...this.tiposLidos()].find(
      (tipo) => tipo.codigo === codigo,
    )?.codigo;
  }

  protected aoClicarEmSalvar(evento: Event): void {
    if (this.salvando()) evento.preventDefault();
  }
  protected aoEnviar(): void {
    if (this.salvando()) return;
    this.salvar.emit();
    if (this.form().invalid) this.foco.focarPrimeiroInvalido();
  }
  protected erroDoCampo(nome: keyof BancaForm): string | null {
    return mensagemDeErroDoControle(this.form().controls[nome]);
  }
}
