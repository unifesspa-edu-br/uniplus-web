import {
  ChangeDetectionStrategy,
  Component,
  type ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { forkJoin, map, type Observable, of, switchMap, tap } from 'rxjs';
import { type ApiFailure, ProblemI18nService } from '@uniplus/shared-core/http';
import type {
  CertamePublicadoDto,
  ComprovanteInscricaoDto,
  FormularioRenderizavelDto,
  MinhaInscricaoDto,
} from '@uniplus/shared-data/selecao';
import {
  AlertComponent,
  PageHeaderComponent,
  SpinnerComponent,
} from '@uniplus/shared-ui/components';

import { MinhasInscricoesService } from '../minhas-inscricoes.service';
import { nomeDaOferta } from '../oferta-da-inscricao';
import {
  derivadosDoComprovante,
  municipiosDoComprovante,
  numeroDoComprovante,
  secoesDoComprovante,
  termosAceitos,
  type Vizinhos,
  vizinhos,
} from './comprovante-da-inscricao';
import { type NomesDosMunicipios, nomePreferido } from './resposta-exibida';

type Estado = 'carregando' | 'erro' | 'pronto';

const ENVIADO_EM = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

const NAO_ENCONTRADO =
  'Não encontramos este comprovante. Confira o endereço ou volte às suas inscrições.';

interface Carregado {
  readonly numero: number;
  readonly comprovante: ComprovanteInscricaoDto;
  readonly formulario: FormularioRenderizavelDto;
  readonly inscricao: MinhaInscricaoDto;
  readonly processo: CertamePublicadoDto | null;
  readonly vizinhos: Vizinhos;
  readonly municipios: NomesDosMunicipios;
}

type Leitura =
  | { readonly tipo: 'pronto'; readonly carregado: Carregado }
  | { readonly tipo: 'falha'; readonly falha: ApiFailure }
  | { readonly tipo: 'nao-encontrado' };

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
export class ComprovanteDaInscricaoPage {
  private readonly servico = inject(MinhasInscricoesService);
  private readonly problemas = inject(ProblemI18nService);
  private readonly injector = inject(Injector);
  private readonly tentativa = signal(0);
  private readonly conteudo = viewChild<ElementRef<HTMLElement>>('conteudo');

  readonly processoId = input.required<string>();
  /** A ordem da submissão, a contar de 1; ausente, a última. */
  readonly numero = input<string>();

  protected readonly estado = signal<Estado>('carregando');
  protected readonly erro = signal<string | null>(null);
  protected readonly carregado = signal<Carregado | null>(null);

  protected readonly nomeDoProcesso = computed(
    () => this.carregado()?.inscricao.nomeDoProcesso ?? 'Processo seletivo',
  );
  protected readonly nome = computed(() => {
    const c = this.carregado();
    return c ? nomePreferido(c.comprovante.respostas) : '';
  });
  protected readonly enviadoEm = computed(() => {
    const c = this.carregado();
    return c ? ENVIADO_EM.format(new Date(c.comprovante.instante)) : '';
  });
  protected readonly secoes = computed(() => {
    const c = this.carregado();
    return c ? secoesDoComprovante(c.formulario, c.comprovante, c.municipios) : [];
  });
  protected readonly derivados = computed(() => {
    const c = this.carregado();
    return c ? derivadosDoComprovante(c.formulario, c.comprovante, c.municipios) : [];
  });
  protected readonly termos = computed(() => {
    const c = this.carregado();
    return c ? termosAceitos(c.formulario, c.comprovante) : [];
  });
  /** O curso escolhido, pelo nome congelado na publicação. */
  protected readonly oferta = computed(() => {
    const c = this.carregado();
    const escolhida = c?.processo?.ofertas.find(
      (o) => o.ofertaCursoOrigemId === c.comprovante.ofertaCursoId,
    );
    return escolhida ? nomeDaOferta(escolhida) : null;
  });

  constructor() {
    // A rota reaproveita a página quando só o número muda: a leitura segue os parâmetros.
    toObservable(
      computed(() => ({
        processoId: this.processoId(),
        numero: this.numero(),
        tentativa: this.tentativa(),
      })),
    )
      .pipe(
        tap(() => this.estado.set('carregando')),
        switchMap(({ processoId, numero }) => this.ler(processoId, numero)),
        takeUntilDestroyed(),
      )
      .subscribe((leitura) => this.mostrar(leitura));
  }

  protected carregar(): void {
    this.tentativa.update((n) => n + 1);
  }

  private ler(processoId: string, numeroPedido: string | undefined): Observable<Leitura> {
    const pedido = Number(numeroPedido);
    return forkJoin({
      minhas: this.servico.listar(),
      formulario: this.servico.formulario(processoId),
      processo: this.servico.certame(processoId),
    }).pipe(
      switchMap(({ minhas, formulario, processo }): Observable<Leitura> => {
        if (!minhas.ok) return of({ tipo: 'falha', falha: minhas });
        if (!formulario.ok) return of({ tipo: 'falha', falha: formulario });
        const inscricao = minhas.data.find((i) => i.processoSeletivoId === processoId);
        const numero = inscricao
          ? numeroDoComprovante(
              inscricao.comprovantes,
              Number.isInteger(pedido) && pedido > 0 ? pedido : null,
            )
          : null;
        if (!inscricao || numero === null) return of({ tipo: 'nao-encontrado' });
        return this.servico.comprovante(processoId, numero).pipe(
          switchMap((comprovante): Observable<Leitura> => {
            if (!comprovante.ok) return of({ tipo: 'falha', falha: comprovante });
            return this.servico
              .nomesDosMunicipios(municipiosDoComprovante(formulario.data, comprovante.data))
              .pipe(
                map(
                  (municipios): Leitura => ({
                    tipo: 'pronto',
                    carregado: {
                      numero,
                      comprovante: comprovante.data,
                      formulario: formulario.data,
                      inscricao,
                      processo,
                      vizinhos: vizinhos(inscricao.comprovantes, numero),
                      municipios,
                    },
                  }),
                ),
              );
          }),
        );
      }),
    );
  }

  private mostrar(leitura: Leitura): void {
    if (leitura.tipo === 'pronto') {
      this.carregado.set(leitura.carregado);
      this.estado.set('pronto');
      afterNextRender(() => this.conteudo()?.nativeElement.focus(), { injector: this.injector });
      return;
    }
    if (leitura.tipo === 'nao-encontrado' || leitura.falha.status === 404) {
      this.erro.set(NAO_ENCONTRADO);
    } else {
      this.erro.set(this.problemas.resolve(leitura.falha.problem).title);
    }
    this.estado.set('erro');
  }
}
