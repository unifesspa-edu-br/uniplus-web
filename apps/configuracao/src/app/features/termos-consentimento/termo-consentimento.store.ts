import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ProblemI18nService, useApiResource, withVendorMime } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { CONFIGURACAO_BASE_PATH, TermoConsentimentoDto } from '@uniplus/shared-data/configuracao';

@Injectable()
export class TermoConsentimentoStore {
  private readonly basePath = inject(CONFIGURACAO_BASE_PATH);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  readonly id = signal<string | null>(inject(ActivatedRoute).snapshot.paramMap.get('id'));
  private readonly suspenso = signal(false);
  private readonly consulta = useApiResource<TermoConsentimentoDto>(() => {
    const id = this.id();
    return id === null || this.suspenso()
      ? undefined
      : {
          url: `${this.basePath}/api/configuracao/termos-consentimento/${encodeURIComponent(id)}`,
          context: withVendorMime('termo-consentimento', 1),
        };
  });
  readonly termo = signal<TermoConsentimentoDto | null>(null);
  readonly carregando = computed(() => !this.silencioso() && this.consulta.isLoading());
  readonly erro = computed(() => {
    if (this.silencioso()) return null;
    const problem = this.consulta.problem();
    return problem
      ? this.problemI18n.resolve(problem).title
      : this.consulta.error()
        ? 'Erro inesperado ao carregar o termo.'
        : null;
  });
  readonly silencioso = signal(false);
  readonly atualizando = signal(false);
  private iniciouAtualizacao = false;
  readonly leituraParaFormulario = signal<TermoConsentimentoDto | null>(null);

  constructor() {
    effect(() => {
      const problem = this.consulta.problem();
      if (problem && problem.status >= 500) {
        const titulo = this.problemI18n.resolve(problem).title;
        untracked(() => this.notifications.errorFromProblem(problem, { title: titulo }));
      }
    });
    effect(() => {
      if (!this.atualizando()) return;
      if (this.consulta.isLoading()) {
        this.iniciouAtualizacao = true;
      } else if (this.iniciouAtualizacao) {
        this.iniciouAtualizacao = false;
        this.atualizando.set(false);
        if (this.consulta.error() || this.consulta.problem()) this.silencioso.set(false);
      }
    });
    effect(() => {
      const dados = this.consulta.data();
      if (!dados) return;
      this.termo.set(dados);
      if (!this.silencioso()) this.leituraParaFormulario.set(dados);
    });
  }

  invalidar(): void {
    this.suspenso.set(true);
  }
  atualizar(): void {
    this.atualizando.set(true);
    this.silencioso.set(true);
    this.suspenso.set(false);
  }
  recarregar(): void {
    this.silencioso.set(false);
    if (this.suspenso()) this.suspenso.set(false);
    else this.consulta.reload();
  }
}
