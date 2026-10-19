import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ProblemI18nService } from '@uniplus/shared-core/http';
import {
  ProcessosSeletivosApi,
  StatusProcesso,
  type AtoDoProcessoDto,
} from '@uniplus/shared-data/selecao';
import {
  AlertComponent,
  PageHeaderComponent,
  SpinnerComponent,
} from '@uniplus/shared-ui/components';

import { abrirAcessoEmNovaAba } from '../steps/shared/envio-pre-assinado';
import { AtosDoProcessoComponent } from './atos-do-processo.component';
import { PublicacoesDoProcesso } from './publicacoes-do-processo.service';
import { PublicarDocumentoComponent, type ModoDaPublicacao } from './publicar-documento.component';

/**
 * Publicações do processo seletivo: o que ele já publicou, com a situação do registro de cada
 * documento, e a publicação de documento avulso e a correção de um documento já publicado.
 *
 * Só orquestra. O que vale para cada publicação (tipo, vigência, cadeia de correção, documentos) é
 * decidido pelo servidor; a página lê o que ele devolve e mostra as recusas dele.
 */
@Component({
  selector: 'sel-publicacoes-do-processo',
  standalone: true,
  imports: [
    RouterLink,
    AlertComponent,
    AtosDoProcessoComponent,
    PageHeaderComponent,
    PublicarDocumentoComponent,
    SpinnerComponent,
  ],
  providers: [PublicacoesDoProcesso],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './publicacoes-do-processo.page.html',
  styleUrl: './publicacoes-do-processo.page.css',
  host: { class: 'cfg-page' },
})
export class PublicacoesDoProcessoPage {
  private readonly rota = inject(ActivatedRoute);
  private readonly api = inject(ProcessosSeletivosApi);
  private readonly problemI18n = inject(ProblemI18nService);
  protected readonly publicacoes = inject(PublicacoesDoProcesso);

  private readonly cabecalho = viewChild.required(PageHeaderComponent);

  protected readonly modo = signal<ModoDaPublicacao | null>(null);
  protected readonly formularioAberto = signal(false);
  /** O documento cujo acesso está sendo pedido, para o botão anunciar a espera. */
  protected readonly abrindo = signal<string | null>(null);
  protected readonly erroDeAbertura = signal<string | null>(null);

  protected readonly nomeDoProcesso = computed(() => {
    const processo = this.publicacoes.processo();
    return processo.estado === 'lido' ? processo.dados.nome : null;
  });

  /** O processo ainda não foi publicado: não há página pública para receber documentos. */
  protected readonly emRascunho = computed(() => {
    const processo = this.publicacoes.processo();
    return processo.estado === 'lido' && processo.dados.status === StatusProcesso.rascunho;
  });

  protected readonly existePendenciaAntiga = computed(() =>
    this.publicacoes.listaDeAtos().some((ato) => ato.pendenciaAcimaDoLimiar),
  );

  protected readonly podePublicar = computed(
    () =>
      this.publicacoes.processo().estado === 'lido' &&
      !this.emRascunho() &&
      this.publicacoes.tipos().estado === 'lido',
  );

  constructor() {
    this.rota.paramMap.pipe(takeUntilDestroyed()).subscribe((parametros) => {
      const id = parametros.get('id');
      if (id === null) return;
      this.formularioAberto.set(false);
      this.erroDeAbertura.set(null);
      void this.publicacoes.abrir(id);
    });
  }

  protected publicarDocumento(): void {
    this.modo.set({ tipo: 'avulso' });
    this.formularioAberto.set(true);
  }

  protected corrigir(ato: AtoDoProcessoDto): void {
    this.modo.set({ tipo: 'correcao', ato });
    this.formularioAberto.set(true);
  }

  /** O documento foi aceito: relê a lista e leva o foco ao título, que o formulário fechado deixou. */
  protected async aoPublicar(): Promise<void> {
    await this.publicacoes.recarregarAtos();
    this.cabecalho().focar();
  }

  /** Abre o documento numa aba nova, pedindo o acesso à API no clique. */
  protected async abrir(documentoAPublicarId: string): Promise<void> {
    const processoId = this.publicacoes.processoId();
    if (processoId === null || this.abrindo() !== null) return;

    this.abrindo.set(documentoAPublicarId);
    this.erroDeAbertura.set(null);
    try {
      const desfecho = await abrirAcessoEmNovaAba(
        () => firstValueFrom(this.api.obterAcessoDocumentoAPublicar(processoId, documentoAPublicarId)),
        () => processoId === this.publicacoes.processoId(),
      );
      if (desfecho.situacao === 'bloqueada') {
        this.erroDeAbertura.set(
          'O navegador bloqueou a abertura do documento. Permita pop-ups para este endereço e tente de novo.',
        );
      } else if (desfecho.situacao === 'recusada') {
        this.erroDeAbertura.set(this.problemI18n.resolve(desfecho.problem).title);
      }
    } finally {
      this.abrindo.set(null);
    }
  }
}
