import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ProblemDetails, ProblemI18nService, STATUS_HTTP } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { ModalidadeDto, ModalidadesApi } from '@uniplus/shared-data/configuracao';
import { ModalidadesStore } from './modalidades.store';

const REMOCAO_BLOQUEADA_POR_REFERENCIA =
  'uniplus.configuracao.modalidade.remocao_bloqueada_por_referencia';
const TITULO_BLOQUEIO_POR_REFERENCIA = 'Modalidade referenciada por outra viva';
const TITULO_BLOQUEIO_GENERICO = 'Não é possível remover';

@Injectable()
export class EdicaoDasModalidades {
  private readonly api = inject(ModalidadesApi);
  private readonly store = inject(ModalidadesStore);
  private readonly destroyRef = inject(DestroyRef);
  private readonly notifications = inject(NotificationService);
  private readonly problemI18n = inject(ProblemI18nService);
  private aguardandoCarga = false;
  private cargaIniciada = false;
  readonly removendo = signal(false);
  readonly dialogAberto = signal(false);
  readonly modalidadeParaRemover = signal<ModalidadeDto | null>(null);
  readonly bloqueioServidor = signal(false);
  readonly mensagemBloqueioServidor = signal<string | null>(null);
  readonly anuncio = signal('');
  private readonly codigoDoBloqueio = signal<string | null>(null);
  /** O título de referência vale ao bloqueio por referência; qualquer outro 409 (código protegido, concorrência) leva o genérico. */
  readonly tituloDoBloqueio = computed(() =>
    this.bloqueioServidor() && this.codigoDoBloqueio() !== REMOCAO_BLOQUEADA_POR_REFERENCIA
      ? TITULO_BLOQUEIO_GENERICO
      : TITULO_BLOQUEIO_POR_REFERENCIA,
  );

  constructor() {
    effect(() => {
      const carregando = this.store.carregando();
      if (!this.aguardandoCarga) return;
      if (carregando) this.cargaIniciada = true;
      else if (this.cargaIniciada) {
        this.aguardandoCarga = false;
        this.removendo.set(false);
        if (this.store.mensagemDeErro())
          this.anuncio.set('Não foi possível recarregar as modalidades.');
      }
    });
  }

  remover(alvo: ModalidadeDto): void {
    if (this.removendo()) return;
    this.removendo.set(true);
    this.mensagemBloqueioServidor.set(null);
    this.anuncio.set(`Removendo a modalidade ${alvo.codigo}.`);
    this.api
      .remover(alvo.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((resultado) => {
        if (resultado.ok) {
          this.notifications.success('Modalidade removida', alvo.codigo);
          this.anuncio.set(`Modalidade ${alvo.codigo} removida.`);
          this.dialogAberto.set(false);
          this.recarregar();
        } else if (resultado.problem.status === STATUS_HTTP.CONFLITO) {
          this.codigoDoBloqueio.set(resultado.problem.code);
          this.bloqueioServidor.set(true);
          this.mensagemBloqueioServidor.set(this.problemI18n.resolve(resultado.problem).title);
          this.anuncio.set(this.mensagemBloqueioServidor() ?? 'A remoção foi recusada.');
          this.recarregar();
        } else {
          this.recusarRemocao(resultado.problem);
        }
      });
  }

  private recusarRemocao(problem: ProblemDetails): void {
    const { title } = this.problemI18n.resolve(problem);
    this.removendo.set(false);
    this.mensagemBloqueioServidor.set(title);
    this.anuncio.set(title ?? 'A remoção foi recusada.');
    if (problem.status >= 500) this.notifications.errorFromProblem(problem, { title });
  }

  private recarregar(): void {
    this.aguardandoCarga = true;
    this.cargaIniciada = false;
    this.store.recarregar();
  }
}
