import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  type OnInit,
  signal,
} from '@angular/core';
import { ModoDeDeliberacao } from '@uniplus/shared-data/selecao';

import type { RegraDeDeliberacaoDaBanca } from '../../modelos/deliberacao.models';
import { estadoDoControle, type EstadoDoControle } from './estado-do-controle';
import { RecusasDoCampoComponent } from '../recusas/recusas-do-campo.component';
import { recusasDoModo, type CampoDaBanca, type RecusasDaBancaPorCampo } from './recusas-da-regra';
import {
  alterarRegra,
  controlesAVista,
  ehColegiada,
  modoConhecido,
  regraNova,
  type CampoDaRegra,
} from './regra-de-deliberacao';
import { opcoesComValorAtual } from './opcoes-da-regra';
import { VocabulariosDaRegra } from './vocabularios-da-regra.service';
import { VotacaoDaBancaComponent } from './votacao-da-banca.component';

/** O valor do seletor de modo que declara a banca sem regra de deliberação. */
const SEM_REGRA = '';

/**
 * Como a banca delibera: o modo, o tamanho do colegiado e, quando há votação, o quórum e o critério.
 * Mostra só os campos que o modo e o critério pedem, e devolve sempre uma regra coerente.
 */
@Component({
  selector: 'sel-regra-de-deliberacao',
  templateUrl: './regra-de-deliberacao.component.html',
  imports: [RecusasDoCampoComponent, VotacaoDaBancaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: ':host { display: block; }',
})
export class RegraDeDeliberacaoComponent implements OnInit {
  readonly regra = input.required<RegraDeDeliberacaoDaBanca | null>();
  /** Prefixo dos `id` dos controles: único na tela, para ligar rótulo, ajuda e erro. */
  readonly idBase = input.required<string>();
  readonly desabilitada = input(false);
  /** A conferência feita na tela, por campo; `regra` é a regra inteira. */
  readonly erros = input<Partial<Record<CampoDaBanca, string>>>({});
  /** As recusas do servidor, por campo; `regra` é a regra inteira. */
  readonly recusas = input<RecusasDaBancaPorCampo>({});

  readonly regraChange = output<RegraDeDeliberacaoDaBanca | null>();

  protected readonly vocabularios = inject(VocabulariosDaRegra);
  protected readonly opcoesComValorAtual = opcoesComValorAtual;
  protected readonly colegiada = computed(() => {
    const regra = this.regra();
    return regra !== null && ehColegiada(regra);
  });
  protected readonly modoConhecido = modoConhecido;
  protected readonly modoIndividual = ModoDeDeliberacao.atoIndividual;
  protected readonly semRegra = SEM_REGRA;
  protected readonly anuncio = signal('');

  /** O modo mostra o que é dele, o da regra inteira e o dos controles que a tela não mostra. */
  protected readonly estadoDoModo = computed(() =>
    estadoDoControle(
      this.id('modo'),
      this.erros().modo ?? this.erros().regra,
      recusasDoModo(this.recusas(), controlesAVista(this.regra())),
    ),
  );

  ngOnInit(): void {
    this.vocabularios.recarregarIndisponiveis();
  }

  protected id(campo: CampoDaBanca): string {
    return `${this.idBase()}-${campo}`;
  }

  protected estado(campo: CampoDaBanca): EstadoDoControle {
    return estadoDoControle(this.id(campo), this.erros()[campo], this.recusas()[campo] ?? []);
  }

  protected escolherModo(valor: string): void {
    const modo = this.vocabularios.modos().opcoes.find((opcao) => opcao.codigo === valor)
      ?.codigo as ModoDeDeliberacao | undefined;
    if (modo === undefined) {
      this.regraChange.emit(null);
      return;
    }
    const regra = this.regraDoModo(modo);
    this.regraChange.emit({
      ...regra,
      rotulos: { ...regra.rotulos, modo: this.vocabularios.opcao('modo', modo) },
    });
  }

  protected alterar(campo: CampoDaRegra, valor: string): void {
    const regra = this.regra();
    if (regra !== null) this.regraChange.emit(alterarRegra(regra, campo, valor));
  }

  protected retirarVotacao(seletor: HTMLSelectElement): void {
    const regra = this.regra();
    if (regra === null) return;
    this.regraChange.emit({
      ...regra,
      quorum: '',
      criterio: '',
      encerramento: '',
      desempate: '',
      semUnanimidade: '',
    });
    this.anuncio.set('Votação do recurso retirada.');
    seletor.focus();
  }

  private regraDoModo(modo: ModoDeDeliberacao): RegraDeDeliberacaoDaBanca {
    const atual = this.regra();
    return atual === null ? regraNova(modo) : alterarRegra(atual, 'modo', modo);
  }
}
