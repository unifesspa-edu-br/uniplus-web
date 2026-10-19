import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ProblemI18nService, coletarPaginas, isApiOk } from '@uniplus/shared-core/http';
import { TiposAtoApi, type TipoAtoPublicadoDto } from '@uniplus/shared-data/publicacoes';
import {
  ProcessosSeletivosApi,
  type AtoDoProcessoDto,
  type ProcessoSeletivoDto,
} from '@uniplus/shared-data/selecao';

import { hojeNoFusoInstitucional } from '../steps/shared/fuso-institucional';
import { atosQueAdmitemCorrecao } from './cadeia-de-correcao';
import { codigosQueCongelam, tiposDeDocumentoAvulso } from './tipos-de-ato-avulso';

/** Onde uma leitura do servidor está: em curso, falhou (com o texto da recusa) ou trouxe os dados. */
export type Leitura<T> =
  | { readonly estado: 'lendo' }
  | { readonly estado: 'falha'; readonly mensagem: string }
  | { readonly estado: 'lido'; readonly dados: T };

const LENDO: Leitura<never> = { estado: 'lendo' };

/**
 * O que a página Publicações do processo sabe: o processo, os atos já publicados e o catálogo de
 * tipos de ato. Provido pela página, e não pela raiz, porque descreve um processo só.
 *
 * Fica num serviço, e não na página, porque as seções dela leem os mesmos atos — a lista, o
 * formulário de correção — e uma publicação nova recarrega todas de uma vez.
 */
@Injectable()
export class PublicacoesDoProcesso {
  private readonly api = inject(ProcessosSeletivosApi);
  private readonly tiposApi = inject(TiposAtoApi);
  private readonly problemI18n = inject(ProblemI18nService);

  /** Distingue a leitura mais recente da que ficou para trás quando o processo muda. */
  private leituraAtual = 0;

  readonly processoId = signal<string | null>(null);
  readonly processo = signal<Leitura<ProcessoSeletivoDto>>(LENDO);
  readonly atos = signal<Leitura<readonly AtoDoProcessoDto[]>>(LENDO);
  readonly tipos = signal<Leitura<readonly TipoAtoPublicadoDto[]>>(LENDO);

  /**
   * O dia em que o catálogo foi lido, no fuso institucional. Fica junto dos dados e não no relógio
   * de cada avaliação: uma aba aberta através da meia-noite ofereceria a vigência do dia anterior.
   */
  private readonly diaDeReferencia = signal(hojeNoFusoInstitucional());

  readonly listaDeAtos = computed(() => {
    const leitura = this.atos();
    return leitura.estado === 'lido' ? leitura.dados : [];
  });

  private readonly listaDeTipos = computed(() => {
    const leitura = this.tipos();
    return leitura.estado === 'lido' ? leitura.dados : [];
  });

  /** Os tipos que o catálogo declara publicáveis como documento avulso e que vigoram hoje. */
  readonly tiposDeDocumentoAvulso = computed(() =>
    tiposDeDocumentoAvulso(this.listaDeTipos(), this.diaDeReferencia()),
  );

  /**
   * Os atos que a tela oferece para corrigir. Sem o catálogo não há como saber quais congelam a
   * configuração, e oferecer o edital para o servidor recusar seria pior que não oferecer.
   */
  readonly atosCorrigiveis = computed(() =>
    this.tipos().estado === 'lido'
      ? atosQueAdmitemCorrecao(this.listaDeAtos(), codigosQueCongelam(this.listaDeTipos()))
      : [],
  );

  /** Lê tudo o que a página mostra, para o processo indicado. */
  async abrir(processoId: string): Promise<void> {
    const leitura = ++this.leituraAtual;
    this.processoId.set(processoId);
    this.processo.set(LENDO);
    this.atos.set(LENDO);
    this.tipos.set(LENDO);
    this.diaDeReferencia.set(hojeNoFusoInstitucional());

    await Promise.all([
      this.lerProcesso(processoId, leitura),
      this.lerAtos(processoId, leitura),
      this.lerTipos(leitura),
    ]);
  }

  /** Relê os atos do processo em tela, por exemplo depois de publicar um. */
  async recarregarAtos(): Promise<void> {
    const processoId = this.processoId();
    if (processoId === null) return;
    await this.lerAtos(processoId, this.leituraAtual);
  }

  async recarregarTipos(): Promise<void> {
    this.tipos.set(LENDO);
    this.diaDeReferencia.set(hojeNoFusoInstitucional());
    await this.lerTipos(this.leituraAtual);
  }

  async recarregarProcesso(): Promise<void> {
    const processoId = this.processoId();
    if (processoId === null) return;
    this.processo.set(LENDO);
    await this.lerProcesso(processoId, this.leituraAtual);
  }

  private async lerProcesso(processoId: string, leitura: number): Promise<void> {
    const resultado = await firstValueFrom(this.api.obter(processoId));
    if (leitura !== this.leituraAtual) return;

    this.processo.set(
      isApiOk(resultado)
        ? { estado: 'lido', dados: resultado.data }
        : { estado: 'falha', mensagem: this.problemI18n.resolve(resultado.problem).title },
    );
  }

  private async lerAtos(processoId: string, leitura: number): Promise<void> {
    const resultado = await firstValueFrom(this.api.listarAtosDoProcesso(processoId));
    if (leitura !== this.leituraAtual) return;

    this.atos.set(
      isApiOk(resultado)
        ? { estado: 'lido', dados: resultado.data }
        : { estado: 'falha', mensagem: this.problemI18n.resolve(resultado.problem).title },
    );
  }

  private async lerTipos(leitura: number): Promise<void> {
    // A série completa: o ato já publicado cujo tipo teve a vigência encerrada ainda precisa
    // dizer se o tipo congela. Quais tipos podem ser escolhidos é recorte de `tiposDeDocumentoAvulso`.
    const resultado = await firstValueFrom(
      coletarPaginas((cursor) => this.tiposApi.listar({ cursor, vigentes: false })),
    );
    if (leitura !== this.leituraAtual) return;

    this.tipos.set(
      isApiOk(resultado)
        ? { estado: 'lido', dados: resultado.data }
        : { estado: 'falha', mensagem: this.problemI18n.resolve(resultado.problem).title },
    );
  }
}
