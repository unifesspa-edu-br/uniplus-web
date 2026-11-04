import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  AlertComponent,
  DadoDirective,
  ListaDeDadosComponent,
  PageHeaderComponent,
  SpinnerComponent,
  TagComponent,
} from '@uniplus/shared-ui/components';
import { DateBrPipe } from '@uniplus/shared-ui/pipes';

import { AberturaDeArquivo } from './abertura-de-arquivo';
import { ArquivosDaInscricaoComponent } from './arquivos-da-inscricao.component';
import { DetalheDaInscricao } from './detalhe-da-inscricao.service';
import { arquivosExibidos, identificacaoExibida } from './exibicao-da-inscricao';
import { OfertasEscolhidasComponent } from './ofertas-escolhidas.component';
import {
  RespostasDaInscricaoComponent,
  type PedidoDeRevelacao,
} from './respostas-da-inscricao.component';
import { SecoesDaInscricaoComponent } from './secoes-da-inscricao.component';
import { rotuloDaSituacao, varianteDaSituacao } from './situacao-da-inscricao';

/**
 * O detalhe de uma inscrição enviada, para quem opera o processo, com os arquivos que o candidato
 * enviou.
 *
 * Mostra só o que a API devolve: a visibilidade de cada item é decisão dela, e a tela não a deduz de
 * permissão. Item omitido não aparece e não deixa marca — nem o painel que ficaria sem conteúdo.
 */
@Component({
  selector: 'sel-detalhe-da-inscricao',
  standalone: true,
  imports: [
    RouterLink,
    AlertComponent,
    ArquivosDaInscricaoComponent,
    DadoDirective,
    DateBrPipe,
    ListaDeDadosComponent,
    OfertasEscolhidasComponent,
    PageHeaderComponent,
    RespostasDaInscricaoComponent,
    SecoesDaInscricaoComponent,
    SpinnerComponent,
    TagComponent,
  ],
  providers: [DetalheDaInscricao, AberturaDeArquivo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './detalhe-da-inscricao.page.html',
  styleUrl: './detalhe-da-inscricao.page.css',
  host: { class: 'cfg-page' },
})
export class DetalheDaInscricaoPage {
  private readonly rota = inject(ActivatedRoute);
  protected readonly detalhe = inject(DetalheDaInscricao);
  protected readonly arquivoAberto = inject(AberturaDeArquivo);

  protected readonly rotuloDaSituacao = rotuloDaSituacao;
  protected readonly varianteDaSituacao = varianteDaSituacao;

  protected readonly inscricao = this.detalhe.inscricao;

  /** O nome do processo vem na própria inscrição; sem ela, o cabeçalho não descreve nada. */
  protected readonly descricaoDoCabecalho = computed(() => {
    const processo = this.detalhe.nomeDoProcesso();
    return processo === null ? '' : `${processo} — inscrição enviada neste processo seletivo.`;
  });

  protected readonly titulo = computed(() => {
    const numero = this.inscricao()?.numeroInscricao;
    return numero ? `Inscrição ${numero}` : 'Inscrição';
  });

  protected readonly identificacao = computed(() => identificacaoExibida(this.inscricao()));
  protected readonly arquivos = computed(() => arquivosExibidos(this.inscricao()));

  protected readonly temRespostas = computed(() =>
    (this.inscricao()?.secoes ?? []).some((s) => s.itens.length > 0 || s.grupos.length > 0),
  );

  constructor() {
    this.rota.paramMap.pipe(takeUntilDestroyed()).subscribe((parametros) => {
      const processo = parametros.get('id');
      const inscricao = parametros.get('inscricaoId');
      if (processo === null || inscricao === null) return;
      this.detalhe.abrir(processo, inscricao);
    });
  }

  /** Repete a leitura que falhou, uma por vez: com uma em curso o clique não parte outra. */
  protected tentarNovamente(): void {
    if (!this.detalhe.carregando()) this.detalhe.tentarNovamente();
  }

  protected ocultar(pedido: PedidoDeRevelacao): void {
    this.detalhe.ocultar(pedido.fatoCodigo, pedido.ocorrenciaId);
  }

  protected revelar(pedido: PedidoDeRevelacao): void {
    void this.detalhe.revelar(pedido.fatoCodigo, pedido.ocorrenciaId);
  }
}
