import { computed, inject, type Signal } from '@angular/core';
import { useApiResource } from '@uniplus/shared-core/http';
import {
  SELECAO_BASE_PATH,
  certamePublicoRequest,
  type CertamePublicadoDto,
} from '@uniplus/shared-data/selecao';

import { nomesDasOfertas, type LeituraDoCertame } from './nome-da-oferta';

/**
 * O certame publicado do processo e o que dele deriva nas telas de inscrições: o nome do processo
 * e o nome de cada curso. Sem certame lido, a tela não afirma nada além do que a API devolveu.
 */
export interface CertameDoProcesso {
  readonly situacao: Signal<LeituraDoCertame>;
  /** A leitura está em curso, inclusive a releitura pedida por `recarregar`. */
  readonly carregando: Signal<boolean>;
  readonly nomeDoProcesso: Signal<string | null>;
  readonly nomesDasOfertas: Signal<ReadonlyMap<string, string>>;
  /** O certame diz se o processo admite a 2ª opção de curso; sem ele, não se afirma que admite. */
  readonly admiteSegundaOpcao: Signal<boolean>;
  recarregar(): void;
}

/**
 * Lê o certame do processo indicado. Chamado no contexto de injeção do serviço da tela; sem
 * processo, nada é lido.
 */
export function useCertameDoProcesso(processoId: () => string | null): CertameDoProcesso {
  const basePath = inject(SELECAO_BASE_PATH);
  const certame = useApiResource<CertamePublicadoDto>(() => {
    const id = processoId();
    return id === null ? undefined : certamePublicoRequest(basePath, id);
  });

  return {
    situacao: computed<LeituraDoCertame>(() => {
      if (certame.problem() !== null || certame.error() !== undefined) return 'falha';
      return certame.data() === null ? 'lendo' : 'lido';
    }),
    carregando: certame.isLoading,
    nomeDoProcesso: computed(() => certame.data()?.nome ?? null),
    nomesDasOfertas: computed(() => {
      const lido = certame.data();
      return lido === null ? new Map<string, string>() : nomesDasOfertas(lido);
    }),
    admiteSegundaOpcao: computed(() => Number(certame.data()?.opcoesDeCurso.numero ?? 1) >= 2),
    recarregar: () => {
      certame.reload();
    },
  };
}
