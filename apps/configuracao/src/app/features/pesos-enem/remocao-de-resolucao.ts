import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import { ApiResult, ProblemI18nService } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { PesosEnemApi } from '@uniplus/shared-data/configuracao';
import { EdicaoDosParametros } from './edicao-dos-parametros';
import { GravacaoDosPesosEnem } from './gravacao-dos-pesos-enem';
import { PesosEnemStore } from './pesos-enem.store';

/**
 * A remoção de uma resolução: uma exclusão lógica por grupo de curso. O diálogo de
 * confirmação fica aberto durante a operação e mostra a recusa; pede a trava de gravação ao
 * enviar.
 */
@Injectable()
export class RemocaoDeResolucao {
  private readonly api = inject(PesosEnemApi);
  private readonly store = inject(PesosEnemStore);
  private readonly gravacao = inject(GravacaoDosPesosEnem);
  private readonly edicao = inject(EdicaoDosParametros);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  readonly confirmando = signal(false);
  readonly erro = signal<string | null>(null);
  private readonly alvo = signal<string | null>(null);
  /** A resolução que o diálogo de confirmação nomeia, até ele fechar sem removê-la. */
  readonly resolucaoAlvo = this.alvo.asReadonly();
  private readonly alvoParcial = signal<string | null>(null);
  /** A resolução que perdeu só parte dos grupos: o painel continua na tela e o foco volta ao seu botão. */
  readonly resolucaoParcial = this.alvoParcial.asReadonly();

  consumirParcial(): void {
    this.alvoParcial.set(null);
  }

  readonly mensagem = computed(() => {
    const resolucao = this.alvo();
    return resolucao === null
      ? 'Deseja remover esta resolução?'
      : `Você está prestes a remover a resolução "${resolucao}" e os pesos de todos os seus grupos ` +
          'de curso. A remoção é lógica (soft-delete): o registro permanece para ' +
          'auditoria e o identificador pode ser reutilizado. Editais publicados congelam os ' +
          'pesos por valor no snapshot de classificação — a remoção não altera o que já foi ' +
          'congelado nem é bloqueada por processos que a referenciaram.';
  });
  /** O andamento e a recusa, que só fazem sentido com o diálogo aberto. */
  readonly anuncio = computed(() => {
    const resolucao = this.alvo();
    if (resolucao === null) {
      return '';
    }
    if (this.gravacao.removendo()) {
      return `Removendo a resolução ${resolucao}.`;
    }
    const motivo = this.erro();
    return motivo ? `Não foi possível remover a resolução ${resolucao}. ${motivo}` : '';
  });

  pedir(resolucao: string): void {
    if (this.gravacao.gravando()) {
      return;
    }
    this.gravacao.anunciar('');
    this.erro.set(null);
    this.alvo.set(resolucao);
    this.confirmando.set(true);
  }

  /** O diálogo fechou sem remover: nada mais é nomeado por ele. */
  descartar(): void {
    this.alvo.set(null);
    this.erro.set(null);
  }

  confirmar(): void {
    const resolucao = this.alvo();
    if (resolucao === null) {
      return;
    }
    const linhas = this.store.porResolucao().get(resolucao) ?? [];
    if (linhas.length === 0) {
      this.confirmando.set(false);
      return;
    }
    if (!this.gravacao.tentar('removendo')) {
      return;
    }
    this.erro.set(null);
    // O identificador pode ser reaproveitado após a remoção: sem fechar a edição aqui, um
    // novo cadastro com o mesmo texto reabriria o formulário antigo, ligado a ids que não existem.
    this.edicao.descartar(resolucao);
    forkJoin(linhas.map((linha) => this.api.remover(linha.id)))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((resultados) => {
        this.gravacao.liberar();
        this.concluir(resolucao, resultados);
        this.gravacao.recarregar();
      });
  }

  private concluir(resolucao: string, resultados: readonly ApiResult<void>[]): void {
    const falhas = resultados.filter((resultado) => !resultado.ok);
    if (falhas.length === 0) {
      this.encerrar();
      this.notifications.success('Resolução removida', resolucao);
      this.gravacao.anunciar(`Resolução ${resolucao} removida.`);
      return;
    }
    const titulos = falhas.map(({ problem }) => this.problemI18n.resolve(problem).title);
    const erroDeServidor = falhas.findIndex(({ problem }) => problem.status >= 500);
    if (erroDeServidor >= 0) {
      this.notifications.errorFromProblem(falhas[erroDeServidor].problem, {
        title: titulos[erroDeServidor],
      });
    }
    if (falhas.length === resultados.length) {
      this.erro.set(titulos[0]);
      return;
    }
    this.encerrar();
    this.alvoParcial.set(resolucao);
    this.notifications.warning(
      'Remoção parcial',
      `${resultados.length - falhas.length} de ${resultados.length} grupos foram removidos. ` +
        'Os demais não puderam ser removidos; confira a lista.',
    );
    this.gravacao.anunciar(`Remoção parcial da resolução ${resolucao}.`);
  }

  private encerrar(): void {
    this.alvo.set(null);
    this.confirmando.set(false);
  }
}
