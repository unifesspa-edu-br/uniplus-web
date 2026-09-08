import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { isApiOk } from '@uniplus/shared-core/http';
import {
  ConformidadeLegalProcessoSeletivoDto,
  ItemConformidadeDto,
  ProcessosSeletivosApi,
} from '@uniplus/shared-data/selecao';
import { TipoAtoPublicadoDto, TiposAtoApi } from '@uniplus/shared-data/publicacoes';

/**
 * Carrega os TRÊS insumos do preflight de publicação (`#486`, plano §7) — o
 * checklist estrutural, a conformidade legal e o catálogo de tipos de ato
 * vigentes — nenhum dos quais o `GET /conformidade` sozinho cobre.
 * `ProcessoSeletivo.cs:1690-1697` documenta por quê: "estrutural" não é
 * "publicável".
 *
 * O quarto insumo — o documento do edital confirmado — não mora aqui: já vive
 * em `ProcessoSeletivoStore.documentosParaEscolha` e no rascunho de
 * `identificacao`, lidos pelo passo Identificação (Story #478).
 *
 * Vive na página do wizard, não no componente do passo: sobrevive a uma
 * navegação para outro passo e de volta, e evita recarregar o preflight a
 * cada vez que o operador só espia a Revisão.
 */
@Injectable()
export class PreflightDaPublicacaoService {
  private readonly api = inject(ProcessosSeletivosApi);
  private readonly tiposAtoApi = inject(TiposAtoApi);

  readonly estrutural = signal<readonly ItemConformidadeDto[] | null>(null);
  readonly legal = signal<ConformidadeLegalProcessoSeletivoDto | null>(null);
  readonly tiposAto = signal<readonly TipoAtoPublicadoDto[]>([]);

  readonly carregando = signal(false);
  readonly erro = signal<string | null>(null);

  private processoCarregado: string | null = null;

  /**
   * Busca os três insumos para `processoSeletivoId`. Idempotente por
   * processo: chamado de novo com o mesmo id e a mesma `dataReferenciaLegal`
   * não repete a rodada — quem quer forçar usa `recarregar()`.
   */
  async carregar(processoSeletivoId: string, dataReferenciaLegal: string | null): Promise<void> {
    if (this.processoCarregado === processoSeletivoId && !this.erro()) return;
    await this.recarregar(processoSeletivoId, dataReferenciaLegal);
  }

  /** Repete a busca mesmo já tendo carregado — usada após 422 (CA-06) e pelo botão "Atualizar". */
  async recarregar(processoSeletivoId: string, dataReferenciaLegal: string | null): Promise<void> {
    this.processoCarregado = processoSeletivoId;
    this.carregando.set(true);
    this.erro.set(null);

    try {
      const [estrutural, legal, tiposAto] = await Promise.all([
        firstValueFrom(this.api.obterConformidade(processoSeletivoId)),
        firstValueFrom(
          this.api.obterConformidadeLegal(processoSeletivoId, dataReferenciaLegal ?? undefined),
        ),
        firstValueFrom(this.tiposAtoApi.listar()),
      ]);

      if (this.processoCarregado !== processoSeletivoId) return;

      // Um dos três faltando deixa a tela decidindo publicar sem saber de uma
      // das dimensões — ou vêm os três, ou nenhum.
      if (!isApiOk(estrutural) || !isApiOk(legal) || !isApiOk(tiposAto)) {
        this.anunciarErro();
        return;
      }

      this.estrutural.set(estrutural.data.itens);
      this.legal.set(legal.data);
      this.tiposAto.set(tiposAto.data);
      this.carregando.set(false);
    } catch {
      if (this.processoCarregado === processoSeletivoId) this.anunciarErro();
    }
  }

  private anunciarErro(): void {
    this.processoCarregado = null;
    this.estrutural.set(null);
    this.legal.set(null);
    this.tiposAto.set([]);
    this.carregando.set(false);
    this.erro.set(
      'Não foi possível carregar o checklist de conformidade e o catálogo de tipos de ato. Tente novamente.',
    );
  }
}
