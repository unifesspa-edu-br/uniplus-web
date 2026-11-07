import { HttpParams } from '@angular/common/http';
import { Signal, computed, effect, inject, untracked } from '@angular/core';
import {
  ProblemI18nService,
  type UseApiResourceRef,
  useApiResource,
  withVendorMime,
} from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  CONFIGURACAO_BASE_PATH,
  FaseCanonicaDto,
  FatoCandidatoView,
} from '@uniplus/shared-data/configuracao';
import { acompanharLeitura, type LeituraAcompanhada } from '@uniplus/shared-ui/components';

/**
 * Uma leitura de apoio ao formulário (as fases, o catálogo de fatos): só é pedida enquanto o
 * formulário que a usa está aberto, e a falha é avisada ali e, se for do servidor, por toast.
 * `leitura` é o aviso de falha com a nova tentativa, uma só por fonte.
 */
export interface LeituraDeApoio<T> {
  readonly itens: Signal<readonly T[]>;
  readonly pendente: Signal<boolean>;
  readonly falhou: Signal<boolean>;
  readonly leitura: LeituraAcompanhada;
}

/** O que a tela diz de uma leitura de apoio e para onde leva o foco quando a nova tentativa dá certo. */
export interface AvisoDaLeitura {
  /** O que é lido, para o botão e para o anúncio da conclusão. */
  readonly assunto: string;
  /** O que a tela deixa de poder fazer enquanto a leitura falha. */
  readonly consequencia: string;
  readonly destino: () => HTMLElement | null | undefined;
}

const MOTIVO_SEM_RESPOSTA = 'Erro inesperado.';

function comConsequencia(motivo: string, consequencia: string): string {
  return /[.!?]$/.test(motivo) ? `${motivo} ${consequencia}` : `${motivo}. ${consequencia}`;
}

interface Pedido {
  readonly caminho: string;
  readonly recurso: 'fase-canonica' | 'fato-candidato';
  readonly params?: HttpParams;
}

/** A falha do servidor (5xx) é avisada também por toast, como toda falha de leitura. */
function avisarFalhaDoServidor(recurso: UseApiResourceRef<unknown>): void {
  const notifications = inject(NotificationService);
  effect(() => {
    const problem = recurso.problem();
    if (problem && problem.status >= 500) untracked(() => notifications.errorFromProblem(problem));
  });
}

/** O motivo da recusa e, depois dele, o que a tela deixa de poder fazer. */
function falhaDoApoio(
  recurso: UseApiResourceRef<unknown>,
  falhou: Signal<boolean>,
  consequencia: string,
): Signal<string | null> {
  const problemI18n = inject(ProblemI18nService);
  return computed(() => {
    if (!falhou()) return null;
    const problem = recurso.problem();
    const motivo = problem === null ? MOTIVO_SEM_RESPOSTA : problemI18n.resolve(problem).title;
    return comConsequencia(motivo, consequencia);
  });
}

function lerApoio<T>(
  pedido: Pedido,
  ativo: () => boolean,
  aviso: AvisoDaLeitura,
): LeituraDeApoio<T> {
  const basePath = inject(CONFIGURACAO_BASE_PATH);
  const recurso = useApiResource<readonly T[]>(() =>
    ativo()
      ? {
          url: `${basePath}${pedido.caminho}`,
          params: pedido.params,
          context: withVendorMime(pedido.recurso, 1),
        }
      : undefined,
  );
  avisarFalhaDoServidor(recurso);
  const falhou = computed(() => recurso.problem() !== null || recurso.error() !== undefined);
  return {
    itens: computed(() => recurso.data() ?? []),
    pendente: recurso.isLoading,
    falhou,
    leitura: acompanharLeitura({
      falha: falhaDoApoio(recurso, falhou, aviso.consequencia),
      pendente: recurso.isLoading,
      recarregar: () => recurso.reload(),
      destino: aviso.destino,
      assunto: aviso.assunto,
    }),
  };
}

const CONSEQUENCIA_DAS_FASES =
  'Sem a lista de fases não é possível dizer a partir de quando o fato é conhecido.';

/**
 * As fases canônicas, de onde sai o ponto em que o fato passa a ser conhecido. O foco vai a
 * `destino` quando a nova tentativa dá certo.
 */
export function lerFasesCanonicas(
  ativo: () => boolean,
  destino: AvisoDaLeitura['destino'],
): LeituraDeApoio<FaseCanonicaDto> {
  return lerApoio(
    {
      caminho: '/api/configuracao/fases-canonicas',
      recurso: 'fase-canonica',
      params: new HttpParams().set('limit', '100'),
    },
    ativo,
    { assunto: 'fases', consequencia: CONSEQUENCIA_DAS_FASES, destino },
  );
}

/** O catálogo de fatos: dele saem o fato de membro do agregado e os fatos que as regras citam. */
export function lerCatalogoDeFatos(
  ativo: () => boolean,
  aviso: AvisoDaLeitura,
): LeituraDeApoio<FatoCandidatoView> {
  return lerApoio(
    { caminho: '/api/configuracao/fatos-candidato', recurso: 'fato-candidato' },
    ativo,
    aviso,
  );
}
