import { Injectable, computed, inject, signal } from '@angular/core';
import { UserContextService } from '@uniplus/shared-auth/bootstrap';
import { STATUS_HTTP, useApiResource, type UseApiResourceRef } from '@uniplus/shared-core/http';
import {
  SELECAO_BASE_PATH,
  processoSeletivoRequest,
  type ProcessoSeletivoDto,
} from '@uniplus/shared-data/selecao';
import { ehIdentificadorDoProcesso } from '../../processo-seletivo/identificador-do-processo';

export type SituacaoDoAcompanhamento =
  | { readonly estado: 'lendo' }
  | { readonly estado: 'nao-encontrado' }
  | { readonly estado: 'acesso-negado' }
  | { readonly estado: 'falha' }
  | { readonly estado: 'lido'; readonly processo: ProcessoSeletivoDto };

function situacaoDaLeitura(
  id: string | null,
  recurso: UseApiResourceRef<ProcessoSeletivoDto>,
): SituacaoDoAcompanhamento {
  if (id === null) return { estado: 'nao-encontrado' };
  if (recurso.isLoading()) return { estado: 'lendo' };
  const processo = recurso.data();
  if (processo !== null) return { estado: 'lido', processo };
  const problema = recurso.problem();
  if (problema?.status === STATUS_HTTP.NAO_ENCONTRADO) return { estado: 'nao-encontrado' };
  if (problema?.status === STATUS_HTTP.SEM_PERMISSAO) return { estado: 'acesso-negado' };
  if (problema !== null || recurso.error() !== undefined) return { estado: 'falha' };
  return { estado: 'lendo' };
}

/** Leitura do processo da página, provida por ela: nenhuma situação herda dados da anterior. */
@Injectable()
export class ConsultaDoAcompanhamento {
  private readonly basePath = inject(SELECAO_BASE_PATH);
  private readonly usuario = inject(UserContextService);
  private readonly id = signal<string | null>(null);
  readonly processoId = this.id.asReadonly();
  private readonly idConsultavel = computed(() => {
    const id = this.id();
    return id !== null && ehIdentificadorDoProcesso(id) ? id : null;
  });
  private readonly idDoUsuario = computed(() =>
    this.usuario.isAuthenticated() ? (this.usuario.user()?.id ?? null) : null,
  );
  private readonly recurso = useApiResource<ProcessoSeletivoDto>(() => {
    // Lido só para refazer a leitura quando a sessão muda; sem sessão o pedido sai e a API recusa.
    this.idDoUsuario();
    const id = this.idConsultavel();
    return id === null ? undefined : processoSeletivoRequest(this.basePath, id);
  });
  readonly situacao = computed(() => situacaoDaLeitura(this.idConsultavel(), this.recurso));

  abrir(id: string): void {
    this.id.set(id);
  }

  tentarNovamente(): void {
    if (this.situacao().estado === 'falha') this.recurso.reload();
  }
}
