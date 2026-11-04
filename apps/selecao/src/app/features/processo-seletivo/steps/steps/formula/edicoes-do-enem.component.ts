import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';

import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { focarAposRenderizar } from '../../shared/foco-apos-renderizar';
import { anoDaEdicao, comEdicao, rotuloDaEdicao } from '../classificacao/edicoes-do-enem';

/**
 * As edições do ENEM que o processo aceita: o candidato escolhe uma delas na inscrição, e a nota
 * dela é a que conta. A lista é do rascunho da classificação; quem a grava é a Eliminação.
 */
@Component({
  selector: 'sel-edicoes-do-enem',
  templateUrl: './edicoes-do-enem.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: ':host { display: block; }',
})
export class EdicoesDoEnemComponent {
  protected readonly store = inject(ProcessoSeletivoStore);
  private readonly injector = inject(Injector);

  /** O passo recusou a lista vazia: o campo do ano é marcado como inválido. */
  readonly invalido = input(false);

  protected readonly idDoCampo = 'f-edicao-enem';
  protected readonly rotuloDaEdicao = rotuloDaEdicao;
  protected readonly edicoes = computed(() => this.store.draft().classificacao.edicoesEnem);
  protected readonly anoDaNovaEdicao = signal('');
  protected readonly recusaDoAno = signal<string | null>(null);

  protected readonly campoInvalido = computed(() => this.recusaDoAno() !== null || this.invalido());

  protected acrescentar(): void {
    const lido = anoDaEdicao(this.anoDaNovaEdicao(), this.edicoes(), new Date().getFullYear());
    if ('recusa' in lido) {
      this.recusaDoAno.set(lido.recusa);
      return;
    }
    this.store.patchObjectSection('classificacao', {
      edicoesEnem: comEdicao(this.edicoes(), lido.ano),
    });
    this.anoDaNovaEdicao.set('');
    this.recusaDoAno.set(null);
    this.store.classificacao.recusaDasEdicoesDoEnem.set(null);
  }

  protected remover(ano: string): void {
    this.store.patchObjectSection('classificacao', {
      edicoesEnem: this.edicoes().filter((e) => e !== ano),
    });
    this.store.classificacao.recusaDasEdicoesDoEnem.set(null);
    focarAposRenderizar(this.injector, this.idDoCampo);
  }
}
