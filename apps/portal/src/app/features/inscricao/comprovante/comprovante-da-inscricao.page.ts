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
import { forkJoin } from 'rxjs';
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
  numeroDoComprovante,
  secoesDoComprovante,
  termosAceitos,
  type Vizinhos,
  vizinhos,
} from './comprovante-da-inscricao';
import { nomePreferido } from './resposta-exibida';

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
    return c ? secoesDoComprovante(c.formulario, c.comprovante) : [];
  });
  protected readonly derivados = computed(() => {
    const c = this.carregado();
    return c ? derivadosDoComprovante(c.formulario, c.comprovante) : [];
  });
  protected readonly termos = computed(() => {
    const c = this.carregado();
    return c ? termosAceitos(c.formulario, c.comprovante) : [];
  });
  /** O curso só aparece quando o processo oferece mais de um, pelo nome congelado na publicação. */
  protected readonly oferta = computed(() => {
    const c = this.carregado();
    const ofertas = c?.processo?.ofertas ?? [];
    if (!c || ofertas.length <= 1) return null;
    const escolhida = ofertas.find((o) => o.ofertaCursoOrigemId === c.comprovante.ofertaCursoId);
    return escolhida ? nomeDaOferta(escolhida) : null;
  });

  ngOnInit(): void {
    this.carregar();
  }

  protected carregar(): void {
    this.estado.set('carregando');
    const processoId = this.processoId();
    const pedido = Number(this.numero());
    forkJoin({
      minhas: this.servico.listar(),
      formulario: this.servico.formulario(processoId),
      processo: this.servico.certame(processoId),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ minhas, formulario, processo }) => {
        if (!minhas.ok) return this.falhar(minhas);
        if (!formulario.ok) return this.falhar(formulario);
        const inscricao = minhas.data.find((i) => i.processoSeletivoId === processoId);
        const numero = inscricao
          ? numeroDoComprovante(
              inscricao.comprovantes,
              Number.isInteger(pedido) && pedido > 0 ? pedido : null,
            )
          : null;
        if (!inscricao || numero === null) return this.naoEncontrado();
        this.servico
          .comprovante(processoId, numero)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe((comprovante) => {
            if (!comprovante.ok) return this.falhar(comprovante);
            this.carregado.set({
              numero,
              comprovante: comprovante.data,
              formulario: formulario.data,
              inscricao,
              processo,
              vizinhos: vizinhos(inscricao.comprovantes, numero),
            });
            this.estado.set('pronto');
            afterNextRender(() => this.conteudo()?.nativeElement.focus(), {
              injector: this.injector,
            });
          });
      });
  }

  private naoEncontrado(): void {
    this.erro.set(NAO_ENCONTRADO);
    this.estado.set('erro');
  }

  private falhar(falha: ApiFailure): void {
    if (falha.status === 404) return this.naoEncontrado();
    this.erro.set(this.problemas.resolve(falha.problem).title);
    this.estado.set('erro');
  }
}
