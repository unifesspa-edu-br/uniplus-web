import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ProblemI18nService, coletarPaginas, isApiOk } from '@uniplus/shared-core/http';
import { FasesCanonicasApi } from '@uniplus/shared-data/configuracao';
import { TiposAtoApi, type TipoAtoPublicadoDto } from '@uniplus/shared-data/publicacoes';
import {
  ProcessosSeletivosApi,
  StatusProcesso,
  type AtoDoProcessoDto,
  type CampoDivulgacaoDto,
  type ProcessoSeletivoDto,
  type ProdutosPrevistosDoProcessoDto,
} from '@uniplus/shared-data/selecao';

import { LENDO, type Leitura } from '../leitura';
import { hojeNoFusoInstitucional } from '../steps/shared/fuso-institucional';
import { atosQueAdmitemCorrecao } from './cadeia-de-correcao';
import { codigosQueCongelam, tiposDeDocumentoAvulso } from './tipos-de-ato-avulso';

/** O que a seção "Previstos no edital" precisa para mostrar os itens e a política a confirmar. */
export interface PrevistosLidos {
  readonly consulta: ProdutosPrevistosDoProcessoDto;
  readonly camposDeDivulgacao: readonly CampoDivulgacaoDto[];
  /** O nome de cada fase pelo código; a fase que o catálogo não nomeia aparece pelo código. */
  readonly nomeDaFase: (codigo: string) => string;
}

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
  private readonly fasesApi = inject(FasesCanonicasApi);
  private readonly problemI18n = inject(ProblemI18nService);

  /** Distingue a leitura mais recente da que ficou para trás quando o processo muda. */
  private leituraAtual = 0;

  readonly processoId = signal<string | null>(null);
  readonly processo = signal<Leitura<ProcessoSeletivoDto>>(LENDO);
  readonly atos = signal<Leitura<readonly AtoDoProcessoDto[]>>(LENDO);
  readonly tipos = signal<Leitura<readonly TipoAtoPublicadoDto[]>>(LENDO);
  readonly previstos = signal<Leitura<PrevistosLidos>>(LENDO);

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

  /** Os atos que pertencem a um item do edital: o publicado e as correções dele. */
  private readonly atosDosItens = computed(() => {
    const leitura = this.previstos();
    if (leitura.estado !== 'lido') return new Set<string>();
    const { fases, etapasSemFase } = leitura.dados.consulta;
    const etapas = [...fases.flatMap((fase) => fase.etapas), ...etapasSemFase];
    const itens = [...fases.flatMap((fase) => fase.produtos), ...etapas.flatMap((etapa) => etapa.produtos)];
    return new Set(itens.flatMap((item) => [item.ato, ...item.correcoes]).flatMap((ato) => (ato ? [ato.id] : [])));
  });

  /** Os tipos que o catálogo declara publicáveis como documento avulso e que vigoram hoje. */
  readonly tiposDeDocumentoAvulso = computed(() =>
    tiposDeDocumentoAvulso(this.listaDeTipos(), this.diaDeReferencia()),
  );

  /**
   * Os atos que a tela oferece para corrigir como documento avulso. Sem o catálogo não há como
   * saber quais congelam a configuração, e sem os itens previstos não há como saber quais atos são
   * de item: oferecer o edital para o servidor recusar seria pior que não oferecer. O ato de um item do edital fica de fora: ele se corrige pelo item, que pede a
   * confirmação da política de divulgação quando o item é resultado.
   */
  readonly atosCorrigiveis = computed(() =>
    this.tipos().estado === 'lido' && this.previstos().estado === 'lido'
      ? atosQueAdmitemCorrecao(this.listaDeAtos(), codigosQueCongelam(this.listaDeTipos())).filter(
          (ato) => !this.atosDosItens().has(ato.id),
        )
      : [],
  );

  /** Lê tudo o que a página mostra, para o processo indicado. */
  async abrir(processoId: string): Promise<void> {
    const leitura = ++this.leituraAtual;
    this.processoId.set(processoId);
    this.processo.set(LENDO);
    this.atos.set(LENDO);
    this.tipos.set(LENDO);
    this.previstos.set(LENDO);
    this.diaDeReferencia.set(hojeNoFusoInstitucional());

    await Promise.all([
      this.lerProcesso(processoId, leitura).then(() => this.lerPrevistosDoProcessoPublicado(processoId, leitura)),
      this.lerAtos(processoId, leitura),
      this.lerTipos(leitura),
    ]);
  }

  /** Relê os itens que o edital declara, por exemplo depois de publicar um. */
  async recarregarPrevistos(): Promise<void> {
    const processoId = this.processoId();
    if (processoId === null) return;
    if (this.previstos().estado === 'falha') this.previstos.set(LENDO);
    await this.lerPrevistos(processoId, this.leituraAtual);
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
    await this.lerPrevistosDoProcessoPublicado(processoId, this.leituraAtual);
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

  /** O processo em rascunho ainda não tem edital vigente, e portanto nenhum item a publicar. */
  private async lerPrevistosDoProcessoPublicado(processoId: string, leitura: number): Promise<void> {
    const processo = this.processo();
    if (processo.estado !== 'lido' || processo.dados.status === StatusProcesso.rascunho) return;
    await this.lerPrevistos(processoId, leitura);
  }

  private async lerPrevistos(processoId: string, leitura: number): Promise<void> {
    const [consulta, campos, fases] = await Promise.all([
      firstValueFrom(this.api.obterProdutosPrevistos(processoId)),
      firstValueFrom(this.api.listarCamposDivulgacao()),
      firstValueFrom(coletarPaginas((cursor) => this.fasesApi.listar({ cursor }))),
    ]);
    if (leitura !== this.leituraAtual) return;

    // Sem a consulta não há o que publicar. Os nomes das fases e dos campos da política só
    // traduzem códigos: faltando um deles, a seção continua útil, com o código no lugar.
    if (!isApiOk(consulta)) {
      this.previstos.set({ estado: 'falha', mensagem: this.problemI18n.resolve(consulta.problem).title });
    } else {
      const nomes = new Map(isApiOk(fases) ? fases.data.map((fase) => [fase.codigo, fase.nome]) : []);
      this.previstos.set({
        estado: 'lido',
        dados: {
          consulta: consulta.data,
          camposDeDivulgacao: isApiOk(campos) ? campos.data : [],
          nomeDaFase: (codigo) => nomes.get(codigo) ?? codigo,
        },
      });
    }
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
