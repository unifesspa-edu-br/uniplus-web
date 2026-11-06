import { HttpParams } from '@angular/common/http';
import { Signal, computed, effect, inject, untracked } from '@angular/core';
import { ProblemI18nService, useApiResource, withVendorMime } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  CONFIGURACAO_BASE_PATH,
  FaseCanonicaDto,
  FatoCandidatoView,
} from '@uniplus/shared-data/configuracao';

/**
 * Uma leitura de apoio ao formulário (as fases, o catálogo de fatos): só é pedida enquanto o
 * formulário que a usa está aberto, e a falha é avisada ali e, se for do servidor, por toast.
 */
export interface LeituraDeApoio<T> {
  readonly itens: Signal<readonly T[]>;
  readonly pendente: Signal<boolean>;
  readonly falhou: Signal<boolean>;
  readonly mensagemDeFalha: Signal<string | null>;
  recarregar(): void;
}

interface Pedido {
  readonly caminho: string;
  readonly recurso: 'fase-canonica' | 'fato-candidato';
  readonly params?: HttpParams;
}

function lerApoio<T>(pedido: Pedido, ativo: () => boolean): LeituraDeApoio<T> {
  const basePath = inject(CONFIGURACAO_BASE_PATH);
  const problemI18n = inject(ProblemI18nService);
  const notifications = inject(NotificationService);
  const leitura = useApiResource<readonly T[]>(() =>
    ativo()
      ? {
          url: `${basePath}${pedido.caminho}`,
          params: pedido.params,
          context: withVendorMime(pedido.recurso, 1),
        }
      : undefined,
  );
  effect(() => {
    const problem = leitura.problem();
    if (problem && problem.status >= 500) untracked(() => notifications.errorFromProblem(problem));
  });
  const problem = leitura.problem;
  const falhou = computed(() => problem() !== null || leitura.error() !== undefined);
  return {
    itens: computed(() => leitura.data() ?? []),
    pendente: leitura.isLoading,
    falhou,
    mensagemDeFalha: computed(() => {
      const atual = problem();
      return atual === null ? null : problemI18n.resolve(atual).title;
    }),
    recarregar: () => void leitura.reload(),
  };
}

/** As fases canônicas, de onde sai o ponto em que o fato passa a ser conhecido. */
export function lerFasesCanonicas(ativo: () => boolean): LeituraDeApoio<FaseCanonicaDto> {
  return lerApoio(
    {
      caminho: '/api/configuracao/fases-canonicas',
      recurso: 'fase-canonica',
      params: new HttpParams().set('limit', '100'),
    },
    ativo,
  );
}

/** O catálogo de fatos: dele saem o fato de membro do agregado e os fatos que as regras citam. */
export function lerCatalogoDeFatos(ativo: () => boolean): LeituraDeApoio<FatoCandidatoView> {
  return lerApoio(
    { caminho: '/api/configuracao/fatos-candidato', recurso: 'fato-candidato' },
    ativo,
  );
}
