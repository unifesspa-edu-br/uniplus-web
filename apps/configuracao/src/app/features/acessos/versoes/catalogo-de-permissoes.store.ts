import { Injectable, computed, inject, signal } from '@angular/core';
import { ProblemI18nService, useApiResource, withVendorMime } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  AUTORIZACAO_BASE_PATH,
  type ModuloDoCatalogoDto,
  type PermissaoDoPerfilDto,
} from '@uniplus/shared-data/autorizacao';
import { desfechoDaLeitura } from '../desfecho-da-leitura';
import { notificarFalhasDeLeitura } from '../falha-de-servidor';

/** O catálogo de permissões que compõem um perfil, lido só quando um formulário o pede. */
@Injectable()
export class CatalogoDePermissoesStore {
  private readonly basePath = inject(AUTORIZACAO_BASE_PATH);
  private readonly problemas = inject(ProblemI18nService);
  private readonly ativo = signal(false);
  private readonly consulta = useApiResource<readonly ModuloDoCatalogoDto[]>(() =>
    this.ativo()
      ? {
          url: `${this.basePath}/api/autorizacao/permissoes`,
          context: withVendorMime('permissao-catalogo', 1),
        }
      : undefined,
  );
  private readonly desfecho = desfechoDaLeitura([this.consulta], this.problemas);
  readonly modulos = computed(() => this.consulta.data() ?? []);
  readonly carregando = this.consulta.isLoading;
  readonly falha = this.desfecho.falha;
  readonly recusa = this.desfecho.recusa;
  /** Cada permissão do catálogo, pelo código, na forma que o perfil a exibe. */
  readonly porCodigo = computed<ReadonlyMap<string, PermissaoDoPerfilDto>>(
    () =>
      new Map(
        this.modulos().flatMap((modulo) =>
          modulo.resources.flatMap((resource) =>
            resource.permissoes.map(
              ({ codigo, nome, sensibilidade }) =>
                [codigo, { codigo, nome, sensibilidade }] as const,
            ),
          ),
        ),
      ),
  );

  constructor() {
    notificarFalhasDeLeitura(this.problemas, inject(NotificationService), [this.consulta.problem]);
  }

  /** Pede a primeira leitura do catálogo; não relê quando ele já foi pedido. */
  garantir(): void {
    this.ativo.set(true);
  }

  carregar(): void {
    if (this.ativo()) this.consulta.reload();
    else this.ativo.set(true);
  }

  tentarNovamente(): boolean {
    return this.consulta.reload();
  }
}
