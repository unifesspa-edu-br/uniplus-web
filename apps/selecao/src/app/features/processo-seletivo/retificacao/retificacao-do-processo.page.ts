import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  AlertComponent,
  FalhaDeLeituraComponent,
  IndicadorDaLeituraDirective,
  PageHeaderComponent,
  SpinnerComponent,
  acompanharLeitura,
} from '@uniplus/shared-ui/components';

import { LeituraDaVersaoVigente } from './leitura-da-versao-vigente.service';
import { RetificacaoEmEdicao } from './retificacao-em-edicao';

const TITULO_DA_FALHA: Record<string, string> = {
  idInvalido: 'Endereço inválido',
  naoEncontrado: 'Processo seletivo não encontrado',
  semPermissao: 'Sem permissão para retificar este processo',
};

/**
 * Retificação do processo publicado: lê a versão vigente e guarda o documento em memória para
 * edição. Só orquestra; quem lê é `LeituraDaVersaoVigente` e quem guarda é `RetificacaoEmEdicao`,
 * ambos desta página, e por isso a edição some quando ela fecha.
 */
@Component({
  selector: 'sel-retificacao-do-processo',
  standalone: true,
  imports: [
    RouterLink,
    AlertComponent,
    FalhaDeLeituraComponent,
    IndicadorDaLeituraDirective,
    PageHeaderComponent,
    SpinnerComponent,
  ],
  providers: [RetificacaoEmEdicao, LeituraDaVersaoVigente],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './retificacao-do-processo.page.html',
  styleUrl: './retificacao-do-processo.page.css',
})
export class RetificacaoDoProcessoPage {
  private readonly rota = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly leitura = inject(LeituraDaVersaoVigente);
  protected readonly edicao = inject(RetificacaoEmEdicao);

  private readonly id = signal<string | null>(null);

  protected readonly enderecoDaConsulta = computed(() => {
    const id = this.id();
    return id === null ? ['/processo-seletivo'] : ['/processo-seletivo', id];
  });

  private readonly falha = computed(() => {
    const estado = this.leitura.estado();
    return estado.estado === 'falha' ? estado : null;
  });

  /** A recusa que a tela mostra no lugar da edição: repetir a leitura daria o mesmo resultado. */
  protected readonly recusa = computed(() => {
    const falha = this.falha();
    const titulo = falha === null ? undefined : TITULO_DA_FALHA[falha.motivo];
    return falha === null || titulo === undefined ? null : { titulo, mensagem: falha.mensagem };
  });

  protected readonly acompanhamento = acompanharLeitura({
    falha: computed(() => {
      const falha = this.falha();
      return falha?.motivo === 'falhaTemporaria' ? falha.mensagem : null;
    }),
    pendente: computed(() => this.leitura.estado().estado === 'lendo'),
    recarregar: () => void this.leitura.recarregar(),
    destino: () => this.host.nativeElement.querySelector('h1'),
    recusada: computed(() => this.recusa() !== null),
  });

  protected readonly processo = computed(() => {
    const estado = this.leitura.estado();
    return estado.estado === 'aberta' ? estado.processo : null;
  });

  protected readonly versao = computed(() => this.edicao.base()?.versao ?? null);

  constructor() {
    this.rota.paramMap.pipe(takeUntilDestroyed()).subscribe((parametros) => {
      const id = parametros.get('id');
      if (id === null) return;
      this.id.set(id);
      void this.leitura.ler(id);
    });
    effect(() => {
      if (this.leitura.estado().estado === 'voltarAConsulta') {
        untracked(() => void this.router.navigate(this.enderecoDaConsulta(), { replaceUrl: true }));
      }
    });
  }
}
