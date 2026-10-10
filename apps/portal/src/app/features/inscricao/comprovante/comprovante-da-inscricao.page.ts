import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  type ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  type OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { forkJoin, map, type Observable, of } from 'rxjs';
import { type ApiFailure, type ApiResult, ProblemI18nService } from '@uniplus/shared-core/http';
import type { CertamePublicadoDto, FormularioRenderizavelDto } from '@uniplus/shared-data/selecao';
import {
  AlertComponent,
  PageHeaderComponent,
  SpinnerComponent,
} from '@uniplus/shared-ui/components';

import { type ComprovanteNumerado, MinhasInscricoesService } from '../minhas-inscricoes.service';
import {
  derivadosDoComprovante,
  secoesDoComprovante,
  termosAceitos,
} from './comprovante-da-inscricao';
import { nomePreferido } from './resposta-exibida';

type Estado = 'carregando' | 'erro' | 'pronto';

const ENVIADO_EM = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

interface Carregado {
  readonly numerado: ComprovanteNumerado;
  readonly formulario: FormularioRenderizavelDto;
  readonly processo: CertamePublicadoDto | null;
  readonly temSeguinte: boolean;
}

/**
 * O comprovante de uma submissão da inscrição, como foi emitido: sem número de documento, com o CPF
 * mascarado e o hash que prova que não mudou. Sem o número na rota, mostra o da última submissão.
 */
@Component({
  selector: 'ptl-comprovante-da-inscricao-page',
  standalone: true,
  imports: [AlertComponent, PageHeaderComponent, RouterLink, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './comprovante-da-inscricao.page.html',
  styleUrl: './comprovante-da-inscricao.page.css',
})
export class ComprovanteDaInscricaoPage implements OnInit {
  private readonly servico = inject(MinhasInscricoesService);
  private readonly problemas = inject(ProblemI18nService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly conteudo = viewChild<ElementRef<HTMLElement>>('conteudo');

  readonly processoId = input.required<string>();
  /** A ordem da submissão, a contar de 1; ausente, a última. */
  readonly numero = input<string>();

  protected readonly estado = signal<Estado>('carregando');
  protected readonly erro = signal<string | null>(null);
  protected readonly carregado = signal<Carregado | null>(null);

  protected readonly comprovante = computed(() => this.carregado()?.numerado.comprovante ?? null);
  protected readonly nome = computed(() => {
    const comprovante = this.comprovante();
    return comprovante ? nomePreferido(comprovante.respostas) : '';
  });
  protected readonly secoes = computed(() => {
    const c = this.carregado();
    return c ? secoesDoComprovante(c.formulario, c.numerado.comprovante) : [];
  });
  protected readonly derivados = computed(() => {
    const c = this.carregado();
    return c ? derivadosDoComprovante(c.formulario, c.numerado.comprovante) : [];
  });
  protected readonly termos = computed(() => {
    const c = this.carregado();
    return c ? termosAceitos(c.formulario, c.numerado.comprovante) : [];
  });
  protected readonly enviadoEm = computed(() => {
    const comprovante = this.comprovante();
    return comprovante ? ENVIADO_EM.format(new Date(comprovante.instante)) : '';
  });
  /** O curso só aparece quando o processo oferece mais de um. */
  protected readonly oferta = computed(() => {
    const c = this.carregado();
    return c && (c.processo?.ofertas.length ?? 0) > 1 ? c.numerado.comprovante.ofertaCursoId : null;
  });

  ngOnInit(): void {
    this.carregar();
  }

  protected carregar(): void {
    this.estado.set('carregando');
    const processoId = this.processoId();
    const numero = Number(this.numero());
    const pedido =
      Number.isInteger(numero) && numero > 0
        ? this.servico.comprovante(processoId, numero)
        : this.servico.comprovanteMaisRecente(processoId);
    forkJoin({
      numerado: pedido,
      formulario: this.servico.formulario(processoId),
      processo: this.servico.certame(processoId),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ numerado, formulario, processo }) => {
        if (!numerado.ok) return this.falhar(numerado);
        if (!formulario.ok) return this.falhar(formulario);
        this.temSeguinte(processoId, numerado.data.numero, !this.numero())
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe((temSeguinte) => {
            this.carregado.set({
              numerado: numerado.data,
              formulario: formulario.data,
              processo,
              temSeguinte,
            });
            this.estado.set('pronto');
            afterNextRender(() => this.conteudo()?.nativeElement.focus(), {
              injector: this.injector,
            });
          });
      });
  }

  /** O da última submissão não tem seguinte; os anteriores têm. */
  private temSeguinte(processoId: string, numero: number, eOUltimo: boolean): Observable<boolean> {
    if (eOUltimo) return of(false);
    return this.servico
      .comprovante(processoId, numero + 1)
      .pipe(map((resultado: ApiResult<ComprovanteNumerado>) => resultado.ok));
  }

  private falhar(falha: ApiFailure): void {
    this.erro.set(
      falha.status === 404
        ? 'Não encontramos este comprovante. Confira o endereço ou volte às suas inscrições.'
        : this.problemas.resolve(falha.problem).title,
    );
    this.estado.set('erro');
  }
}
