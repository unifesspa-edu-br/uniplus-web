import {
  ChangeDetectionStrategy,
  Component,
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
import { UserContextService } from '@uniplus/shared-auth/bootstrap';
import { type ApiFailure, ProblemI18nService } from '@uniplus/shared-core/http';
import type {
  CertamePublicadoDto,
  ComprovanteInscricaoDto,
  FormularioRenderizavelDto,
  MinhaInscricaoDto,
} from '@uniplus/shared-data/selecao';
import {
  AlertComponent,
  CodigoDeVerificacaoComponent,
  DadoDirective,
  DadoRevelavelComponent,
  DocumentoComponent,
  ListaDeDadosComponent,
  SecaoDeDocumentoComponent,
  SkeletonComponent,
  TagComponent,
} from '@uniplus/shared-ui/components';
import { cpfRevelavel, formatarDataBr, textoMascarado } from '@uniplus/shared-utils';

import { MinhasInscricoesService } from '../minhas-inscricoes.service';
import { nomeDaOferta } from '../oferta-da-inscricao';
import {
  derivadosDoComprovante,
  envioDoComprovante,
  modalidadesDoComprovante,
  municipiosDoComprovante,
  numeroDoComprovante,
  periodoDeInscricaoAberto,
  secoesDoComprovante,
  termosAceitos,
  type Vizinhos,
  vizinhos,
} from './comprovante-da-inscricao';
import { type NomesDosMunicipios, nomesDoCandidato } from './resposta-exibida';

type Estado = 'carregando' | 'erro' | 'pronto';

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

/** Um instante em pt-BR, no fuso que a API projeta, com o nome dele: "10/10/2026, 19:36, horário de Belém (PA)". */
function noFuso(instante: string, fuso: ComprovanteInscricaoDto['fusoHorario']): string {
  return `${formatarDataBr(instante, 'datetime', fuso.id)}, horário de ${fuso.nome}`;
}

/**
 * O comprovante de um envio da inscrição, como foi emitido: sem número de documento, com o CPF
 * mascarado e o código que prova que não mudou. Sem o número na rota, mostra o do último envio, que é
 * o que vale.
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
  private readonly tentativa = signal(0);
  private readonly documento = viewChild.required(DocumentoComponent);

  readonly processoId = input.required<string>();
  /** A ordem da submissão, a contar de 1; ausente, a última. */
  readonly numero = input<string>();

  protected readonly estado = signal<Estado>('carregando');
  protected readonly erro = signal<string | null>(null);
  protected readonly carregado = signal<Carregado | null>(null);

  protected readonly nomeDoProcesso = computed(
    () => this.carregado()?.inscricao.nomeDoProcesso ?? 'Processo seletivo',
  );
  protected readonly nomes = computed(() => {
    const c = this.carregado();
    return c ? nomesDoCandidato(c.comprovante.respostas) : null;
  });
  protected readonly enviadoEm = computed(() => {
    const c = this.carregado();
    return c ? noFuso(c.comprovante.instante, c.comprovante.fusoHorario) : '';
  });
  protected readonly aceitosEm = computed(() => {
    const c = this.carregado();
    return c ? formatarDataBr(c.comprovante.instante, 'short', c.comprovante.fusoHorario.id) : '';
  });
  protected readonly envio = computed(() => {
    const c = this.carregado();
    return c ? envioDoComprovante(c.inscricao.comprovantes, c.numero) : null;
  });
  /** O envio substituído, enquanto ele está na tela: o que vale é o mais recente. */
  protected readonly substituido = computed(() => {
    const envio = this.envio();
    return this.estado() === 'pronto' && envio && !envio.ehOQueVale ? envio : null;
  });
  /** Até quando corrigir, só no envio que vale: o substituído aponta para o mais recente. */
  protected readonly prazo = computed(() => {
    const c = this.carregado();
    if (!c?.processo || !this.envio()?.ehOQueVale) return null;
    const { fim } = c.processo.periodo;
    return {
      aberto: periodoDeInscricaoAberto(fim, new Date()),
      fim: noFuso(fim, c.processo.localidade.fusoHorario),
      fimIso: fim,
    };
  });
  protected readonly secoes = computed(() => {
    const c = this.carregado();
    return c ? secoesDoComprovante(c.formulario, c.comprovante, c.municipios) : [];
  });
  protected readonly derivados = computed(() => {
    const c = this.carregado();
    return c ? derivadosDoComprovante(c.formulario, c.comprovante, c.municipios) : [];
  });
  protected readonly modalidades = computed(() => {
    const c = this.carregado();
    return c ? modalidadesDoComprovante(c.comprovante) : null;
  });
  protected readonly termos = computed(() => {
    const c = this.carregado();
    return c ? termosAceitos(c.formulario, c.comprovante) : [];
  });
  /**
   * O CPF que o titular revela vem do login, sem consulta; só quando confere com o do comprovante,
   * que chega mascarado.
   */
  protected readonly cpf = computed(() => {
    const c = this.carregado();
    const doLogin = cpfRevelavel(this.usuario.user()?.cpf);
    return c && doLogin.revelado && textoMascarado(doLogin) === c.comprovante.cpfMascarado
      ? doLogin
      : null;
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

  protected imprimir(): void {
    this.documento().imprimir();
  }

  protected carregar(): void {
    this.tentativa.update((n) => n + 1);
  }

  private ler(processoId: string, numeroPedido: string | undefined): Observable<Leitura> {
    // Sem parâmetro na rota, vale o comprovante mais recente. Com parâmetro que não é um inteiro
    // positivo, não há comprovante a abrir: `null` aqui seria lido como "sem número pedido".
    const pedido = numeroPedido === undefined ? null : Number(numeroPedido);
    if (pedido !== null && !(Number.isInteger(pedido) && pedido > 0)) {
      return of({ tipo: 'nao-encontrado' });
    }
    return forkJoin({
      minhas: this.servico.listar(),
      formulario: this.servico.formulario(processoId),
      processo: this.servico.certame(processoId),
    }).pipe(
      switchMap(({ minhas, formulario, processo }): Observable<Leitura> => {
        if (!minhas.ok) return of({ tipo: 'falha', falha: minhas });
        if (!formulario.ok) return of({ tipo: 'falha', falha: formulario });
        if (!processo.ok) return of({ tipo: 'falha', falha: processo });
        const inscricao = minhas.data.find((i) => i.processoSeletivoId === processoId);
        const numero = inscricao ? numeroDoComprovante(inscricao.comprovantes, pedido) : null;
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
                      processo: processo.data,
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
      afterNextRender(() => this.documento().focar(), { injector: this.injector });
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
