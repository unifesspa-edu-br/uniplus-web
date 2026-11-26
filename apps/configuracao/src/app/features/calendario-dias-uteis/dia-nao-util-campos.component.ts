import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  inject,
  signal,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule } from '@angular/forms';
import { switchMap } from 'rxjs';
import {
  acompanharLeitura,
  FalhaDeLeituraDoCampoComponent,
  ValorDeMunicipioComponent,
  NomesDeMunicipios,
  nomeComUf,
} from '@uniplus/shared-ui/components';
import { AbrangenciaCodigo, UNIDADES_FEDERATIVAS } from '@uniplus/shared-data/configuracao';
import { carregarVocabulario } from '../../shared/vocabulario-de-configuracao';
import {
  aplicarAbrangencia,
  errosDoDia,
  gravarMunicipioEscolhido,
  type GrupoDoDia,
  municipioSelecionadoDe,
  reiniciarBuscaDoMunicipio,
  ufDaBuscaDe,
} from './dia-nao-util-form';

/**
 * Os campos de um dia não útil: abrangência, região, data e descrição. Quem hospeda decide a grade
 * (o host é o contêiner dos campos).
 */
@Component({
  selector: 'cfg-dia-nao-util-campos',
  standalone: true,
  imports: [ReactiveFormsModule, FalhaDeLeituraDoCampoComponent, ValorDeMunicipioComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dia-nao-util-campos.component.html',
  styleUrl: './dia-nao-util-campos.component.css',
  host: { '(focusout)': 'aoSairDeUmCampo()' },
})
export class DiaNaoUtilCamposComponent {
  readonly grupo = input.required<GrupoDoDia>();
  /** Distingue os ids dos campos quando a tela tem mais de um dia. */
  readonly sufixoDeId = input.required<string>();
  /** Outro dia da tela repete a data, a abrangência e a região deste. */
  readonly dataDuplicada = input(false);

  protected readonly abrangencias = carregarVocabulario('abrangencias-dia-nao-util');
  private readonly validarAbrangencia = effect((onCleanup) => {
    const controle = this.grupo().controls.abrangencia;
    const opcoes = this.abrangencias.opcoes();
    const disponivel = !this.abrangencias.carregando();
    const validar = () =>
      disponivel && opcoes.some((opcao) => opcao.codigo === controle.value)
        ? null
        : { vocabularioIndisponivel: true };
    controle.addValidators(validar);
    controle.updateValueAndValidity();
    onCleanup(() => {
      controle.removeValidators(validar);
      controle.updateValueAndValidity();
    });
  });
  protected readonly leituraDasAbrangencias = acompanharLeitura({
    assunto: 'abrangências',
    falha: computed(() =>
      this.abrangencias.falhou() ? 'Não foi possível carregar as abrangências.' : null,
    ),
    pendente: this.abrangencias.carregando,
    recarregar: this.abrangencias.recarregar,
    destino: () => document.getElementById(`abrangencia-${this.sufixoDeId()}`),
  });
  protected readonly abrangenciaCodigo = AbrangenciaCodigo;
  protected readonly unidadesFederativas = UNIDADES_FEDERATIVAS;

  /**
   * O estado do formulário muda fora dos inputs (campo tocado, recusa do servidor, valor escolhido):
   * cada evento do grupo refaz o que a tela mostra dele.
   */
  private readonly eventos = toSignal(toObservable(this.grupo).pipe(switchMap((g) => g.events)));

  /**
   * Depois do primeiro campo tocado o grupo já está tocado, e marcar os demais não emite evento:
   * a saída de cada campo refaz os erros que a tela mostra.
   */
  private readonly saidasDeCampo = signal(0);

  protected readonly erros = computed(() => {
    this.eventos();
    this.saidasDeCampo();
    return errosDoDia(this.grupo(), this.dataDuplicada());
  });

  protected readonly abrangenciaAtual = computed(() => {
    this.eventos();
    return this.grupo().controls.abrangencia.value;
  });

  protected readonly municipioSelecionado = computed(() => {
    this.eventos();
    return municipioSelecionadoDe(this.grupo());
  });

  private readonly nomes = inject(NomesDeMunicipios);
  protected readonly aplicarAbrangencia = aplicarAbrangencia;
  protected readonly reiniciarBuscaDoMunicipio = reiniciarBuscaDoMunicipio;
  protected readonly ufDaBuscaDe = ufDaBuscaDe;

  protected readonly valores = computed(() => {
    const municipio = this.municipioSelecionado();
    return municipio ? [municipio.codigoIbge] : [];
  });

  protected readonly rotulos = computed(() => {
    const municipio = this.municipioSelecionado();
    return municipio ? { [municipio.codigoIbge]: nomeComUf(municipio.nome, municipio.uf) } : {};
  });

  protected escolherMunicipio(codigos: readonly string[]): void {
    const municipio = this.nomes.municipio(codigos[0] ?? '');
    if (municipio) gravarMunicipioEscolhido(this.grupo(), municipio);
    else reiniciarBuscaDoMunicipio(this.grupo());
  }

  protected aoSairDeUmCampo(): void {
    this.saidasDeCampo.update((saidas) => saidas + 1);
  }
}
