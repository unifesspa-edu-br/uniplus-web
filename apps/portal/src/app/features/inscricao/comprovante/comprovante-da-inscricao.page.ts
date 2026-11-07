import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
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
import { map, type Observable, of, switchMap, tap } from 'rxjs';
import { UserContextService } from '@uniplus/shared-auth/bootstrap';
import { ProblemI18nService } from '@uniplus/shared-core/http';
import type { ComprovanteDaInscricaoDto } from '@uniplus/shared-data/selecao';
import {
  acompanharLeitura,
  AlertComponent,
  CodigoDeVerificacaoComponent,
  DadoDirective,
  DadoRevelavelComponent,
  DocumentoComponent,
  FalhaDeLeituraComponent,
  IndicadorDaLeituraDirective,
  ListaDeDadosComponent,
  SecaoDeDocumentoComponent,
  SkeletonComponent,
  TagComponent,
} from '@uniplus/shared-ui/components';
import { cpfRevelavel, formatarDataBr, textoMascarado } from '@uniplus/shared-utils';

import { MinhasInscricoesService } from '../minhas-inscricoes.service';
import { documentosExibidos } from './documentos-do-comprovante';
import { ItensDoComprovanteComponent } from './itens-do-comprovante.component';
import { opcoesDeCursoExibidas } from './opcoes-de-curso-do-comprovante';
import {
  COMPROVANTE_NAO_ENCONTRADO,
  recusaDoComprovante,
  type RecusaDoComprovante,
} from './recusas-do-comprovante';

type Leitura =
  | { readonly tipo: 'pronto'; readonly comprovante: ComprovanteDaInscricaoDto }
  | { readonly tipo: 'recusa'; readonly recusa: RecusaDoComprovante }
  | { readonly tipo: 'falha'; readonly mensagem: string };

type Estado = 'carregando' | 'erro' | 'recusado' | 'pronto';

/** Um instante em pt-BR, no fuso que a API projeta, com o nome dele: "10/10/2026, 19:36, horário de Belém (PA)". */
function noFuso(instante: string, fuso: ComprovanteDaInscricaoDto['envio']['fusoHorario']): string {
  return `${formatarDataBr(instante, 'datetime', fuso.id)}, horário de ${fuso.nome}`;
}

/**
 * O comprovante de um envio da inscrição, como a API o emitiu: sem número de documento, com o CPF
 * mascarado e o código que prova que não mudou. A página só exibe; texto, seções e prazo vêm prontos.
 */
@Component({
  selector: 'ptl-comprovante-da-inscricao-page',
  standalone: true,
  imports: [
    AlertComponent,
    CodigoDeVerificacaoComponent,
    DadoDirective,
    DadoRevelavelComponent,
    DocumentoComponent,
    FalhaDeLeituraComponent,
    IndicadorDaLeituraDirective,
    ItensDoComprovanteComponent,
    ListaDeDadosComponent,
    RouterLink,
    SecaoDeDocumentoComponent,
    SkeletonComponent,
    TagComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './comprovante-da-inscricao.page.html',
})
export class ComprovanteDaInscricaoPage {
  private readonly servico = inject(MinhasInscricoesService);
  private readonly problemas = inject(ProblemI18nService);
  private readonly usuario = inject(UserContextService);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly tentativa = signal(0);
  private readonly documento = viewChild.required(DocumentoComponent);

  readonly inscricaoId = input.required<string>();
  /** A ordem da submissão, a contar de 1. */
  readonly numero = input.required<string>();

  protected readonly estado = signal<Estado>('carregando');
  protected readonly erro = signal<string | null>(null);
  protected readonly recusa = signal<RecusaDoComprovante | null>(null);
  protected readonly comprovante = signal<ComprovanteDaInscricaoDto | null>(null);
  protected readonly leitura = acompanharLeitura({
    falha: computed(() => (this.estado() === 'erro' ? this.erro() : null)),
    pendente: computed(() => this.estado() === 'carregando'),
    recarregar: () => this.carregar(),
    destino: () => this.host.nativeElement.querySelector('h1'),
    recusada: computed(() => this.estado() === 'recusado'),
  });

  protected readonly enviadoEm = computed(() => {
    const envio = this.comprovante()?.envio;
    return envio ? noFuso(envio.enviadoEm, envio.fusoHorario) : '';
  });
  protected readonly aceitosEm = computed(() => {
    const envio = this.comprovante()?.envio;
    return envio ? formatarDataBr(envio.enviadoEm, 'short', envio.fusoHorario.id) : '';
  });
  protected readonly fimDoPrazo = computed(() => {
    const prazo = this.comprovante()?.prazoDaCorrecao;
    return prazo ? noFuso(prazo.fim, prazo.fusoHorario) : '';
  });
  protected readonly opcoes = computed(() => {
    const c = this.comprovante();
    return c ? opcoesDeCursoExibidas(c) : [];
  });
  /** O envio de um processo de 1 opção sem o nome do curso não tem o que mostrar na seção. */
  protected readonly mostrarOpcoes = computed(() => {
    const opcoes = this.opcoes();
    return opcoes.length > 1 || opcoes[0]?.curso != null;
  });
  protected readonly comDuasOpcoes = computed(() => this.opcoes().length > 1);
  protected readonly modalidadesDefinidas = computed(() =>
    this.opcoes().some((o) => o.modalidades !== null),
  );
  protected readonly documentos = computed(() =>
    documentosExibidos(this.comprovante()?.documentos ?? []),
  );
  /**
   * O CPF que o titular revela vem do login, sem consulta; só quando confere com o do comprovante,
   * que chega mascarado.
   */
  protected readonly cpf = computed(() => {
    const doLogin = cpfRevelavel(this.usuario.user()?.cpf);
    const mascarado = this.comprovante()?.candidato.cpfMascarado;
    return doLogin.revelado && textoMascarado(doLogin) === mascarado ? doLogin : null;
  });

  constructor() {
    // A rota reaproveita a página quando só o número muda: a leitura segue os parâmetros.
    toObservable(
      computed(() => ({
        inscricaoId: this.inscricaoId(),
        numero: this.numero(),
        tentativa: this.tentativa(),
      })),
    )
      .pipe(
        tap(() => this.estado.set('carregando')),
        switchMap(({ inscricaoId, numero }) => this.ler(inscricaoId, numero)),
        takeUntilDestroyed(),
      )
      .subscribe((leitura) => this.mostrar(leitura));
  }

  protected imprimir(): void {
    this.documento().imprimir();
  }

  protected carregar(): void {
    this.tentativa.update((n) => n + 1);
  }

  private ler(inscricaoId: string, numeroPedido: string): Observable<Leitura> {
    // O endereço que não traz um inteiro positivo não leva a comprovante algum: nem se pergunta à API.
    const numero = Number(numeroPedido);
    if (!Number.isInteger(numero) || numero < 1) {
      return of({ tipo: 'recusa', recusa: COMPROVANTE_NAO_ENCONTRADO });
    }
    return this.servico.comprovante(inscricaoId, numero).pipe(
      map((resultado): Leitura => {
        if (resultado.ok) return { tipo: 'pronto', comprovante: resultado.data };
        const recusa = recusaDoComprovante(resultado.problem);
        return recusa
          ? { tipo: 'recusa', recusa }
          : { tipo: 'falha', mensagem: this.problemas.resolve(resultado.problem).title };
      }),
    );
  }

  private mostrar(leitura: Leitura): void {
    if (leitura.tipo === 'pronto') {
      this.comprovante.set(leitura.comprovante);
      this.estado.set('pronto');
      // Numa nova tentativa pedida pela pessoa, quem leva o foco ao título (ou anuncia a conclusão,
      // se ela o tirou do botão) é o acompanhamento da leitura; focar aqui também somaria os dois.
      if (this.leitura.fase() !== 'tentando') {
        afterNextRender(() => this.documento().focar(), { injector: this.injector });
      }
      return;
    }
    if (leitura.tipo === 'recusa') {
      this.recusa.set(leitura.recusa);
      this.estado.set('recusado');
      return;
    }
    this.erro.set(leitura.mensagem);
    this.estado.set('erro');
  }
}
