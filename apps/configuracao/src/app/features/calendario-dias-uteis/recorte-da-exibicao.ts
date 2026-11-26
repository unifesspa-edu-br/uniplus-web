import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup } from '@angular/forms';
import { AbrangenciaCodigo } from '@uniplus/shared-data/configuracao';
import { map } from 'rxjs';
import { agruparPorMes, anosDoCalendario } from './calendario-mensal.util';
import { CalendarioStore } from './calendario.store';
import {
  AVISO_DO_RECORTE,
  LEGENDA_DO_DIA_OCULTO,
  avisoDoMunicipio,
  campoDaLocalidade,
  contagemDoRecorte,
  escolhaForaDasOpcoes,
  type EscolhaDoRecorte,
  opcoesDeAbrangencia,
  opcoesDeLocalidade,
  visibilidadeDoRecorte,
} from './recorte-da-exibicao.util';

/**
 * O recorte da exibição do detalhe: quais dias não úteis do dataset ficam à vista na grade. Filtra
 * o que a leitura já trouxe, sem pedir nada à API, e só esconde: o dia oculto segue cadastrado.
 */
@Injectable()
export class RecorteDaExibicao {
  private readonly store = inject(CalendarioStore);

  readonly form = new FormGroup({
    abrangencia: new FormControl('', { nonNullable: true }),
    localidade: new FormControl('', { nonNullable: true }),
  });

  private readonly escolha = toSignal(
    this.form.valueChanges.pipe(map((): EscolhaDoRecorte => this.form.getRawValue())),
    { initialValue: this.form.getRawValue() },
  );
  private readonly dias = computed(() => this.store.calendario()?.diasNaoUteis ?? []);
  private readonly visivel = computed(() => visibilidadeDoRecorte(this.escolha()));

  readonly abrangencias = computed(() => opcoesDeAbrangencia(this.dias()));
  readonly campoDaLocalidade = computed(() => campoDaLocalidade(this.escolha().abrangencia));
  readonly localidades = computed(() =>
    opcoesDeLocalidade(this.dias(), this.escolha().abrangencia),
  );
  private readonly filtroRemovidoPorSumirAOpcao = signal(false);
  /** Diz que a releitura desfez o filtro; some ao escolher outro filtro ou ao ser dispensado. */
  readonly filtroRemovido = this.filtroRemovidoPorSumirAOpcao.asReadonly();
  readonly ativo = computed(() => this.escolha().abrangencia !== '');

  readonly meses = computed(() => {
    const dias = this.dias();
    return anosDoCalendario(dias).flatMap((ano) => agruparPorMes(dias, ano, this.visivel()));
  });

  /** Vazia sem filtro: a região de status só fala quando o recorte muda o que está à vista. */
  readonly contagem = computed(() => {
    const dias = this.dias();
    return this.ativo() ? contagemDoRecorte(dias.filter(this.visivel()).length, dias.length) : '';
  });

  readonly aviso = computed(() => {
    const { abrangencia, localidade } = this.escolha();
    const doMunicipio =
      abrangencia === AbrangenciaCodigo.MUNICIPAL && localidade !== ''
        ? avisoDoMunicipio(this.dias(), localidade)
        : '';
    return [AVISO_DO_RECORTE, LEGENDA_DO_DIA_OCULTO, doMunicipio].filter(Boolean).join(' ');
  });

  constructor() {
    // A localidade de uma abrangência não vale na outra: trocar a abrangência volta a "todas".
    this.form.controls.abrangencia.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.form.controls.localidade.setValue(''));
    this.form.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.filtroRemovidoPorSumirAOpcao.set(false));
    this.limparEscolhaSemOpcao();
  }

  /** Uma leitura nova pode tirar a opção escolhida: sem isso a grade ficaria filtrada por um valor que o campo não oferece mais. */
  private limparEscolhaSemOpcao(): void {
    effect(() => {
      if (escolhaForaDasOpcoes(this.dias(), this.escolha())) {
        untracked(() => {
          this.limpar();
          this.filtroRemovidoPorSumirAOpcao.set(true);
        });
      }
    });
  }

  dispensarAvisoDoFiltroRemovido(): void {
    this.filtroRemovidoPorSumirAOpcao.set(false);
  }

  limpar(): void {
    this.form.reset();
  }
}
