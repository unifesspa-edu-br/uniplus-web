import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule } from '@angular/forms';
import { switchMap } from 'rxjs';
import {
  acompanharNovaTentativa,
  NovaTentativaDoCampoComponent,
} from '@uniplus/shared-ui/components';
import { ABRANGENCIAS, UNIDADES_FEDERATIVAS } from '@uniplus/shared-data/configuracao';
import type { AlteracaoDoLocal } from './busca-de-municipios';
import {
  MUNICIPIO_BUSCA_VAZIA,
  type MunicipioBuscaState,
  TAMANHO_MINIMO_DA_BUSCA_DE_MUNICIPIO,
} from './calendario-dias-uteis.util';
import { errosDoDia, type GrupoDoDia, municipioSelecionadoDe } from './dia-nao-util-form';

/**
 * Os campos de um dia não útil: abrangência, região, data e descrição. Quem hospeda decide a grade
 * (o host é o contêiner dos campos) e o que fazer com cada alteração do local.
 */
@Component({
  selector: 'cfg-dia-nao-util-campos',
  standalone: true,
  imports: [ReactiveFormsModule, NovaTentativaDoCampoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dia-nao-util-campos.component.html',
  styleUrl: './dia-nao-util-campos.component.css',
  host: { '(focusout)': 'aoSairDeUmCampo()' },
})
export class DiaNaoUtilCamposComponent {
  readonly grupo = input.required<GrupoDoDia>();
  /** Distingue os ids dos campos quando a tela tem mais de um dia. */
  readonly sufixoDeId = input.required<string>();
  readonly busca = input<MunicipioBuscaState>(MUNICIPIO_BUSCA_VAZIA);
  /** Outro dia da tela repete a data, a abrangência e a região deste. */
  readonly dataDuplicada = input(false);
  readonly alteracao = output<AlteracaoDoLocal>();

  protected readonly abrangencias = ABRANGENCIAS;
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

  protected readonly buscaSemResultado = computed(() => {
    this.eventos();
    const estado = this.busca();
    return (
      this.grupo().controls.buscaMunicipio.value.trim().length >=
        TAMANHO_MINIMO_DA_BUSCA_DE_MUNICIPIO &&
      !estado.carregando &&
      !estado.erro &&
      estado.opcoes.length === 0
    );
  });

  protected aoSairDeUmCampo(): void {
    this.saidasDeCampo.update((saidas) => saidas + 1);
  }

  protected readonly novaTentativa = acompanharNovaTentativa({
    assunto: 'municípios',
    pendente: computed(() => this.busca().carregando),
    falhou: computed(() => this.busca().erro),
    destino: () => document.getElementById(`busca-municipio-${this.sufixoDeId()}`),
  });

  /** O aviso fica na tela durante a nova tentativa, com o botão que a pediu e o andamento. */
  protected readonly falhaVisivel = computed(
    () => this.busca().erro || this.novaTentativa.fase() === 'tentando',
  );

  protected tentarNovamente(): void {
    this.novaTentativa.executar(() => this.alteracao.emit({ tipo: 'novaTentativa' }));
  }

  protected aoDigitarABusca(evento: Event): void {
    if (evento.target instanceof HTMLInputElement) {
      this.alteracao.emit({ tipo: 'busca', termo: evento.target.value });
    }
  }
}
