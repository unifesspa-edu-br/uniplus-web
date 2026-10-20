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
import { HttpHeaders } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { forkJoin, map, type Observable, of, switchMap, tap } from 'rxjs';
import { UserContextService } from '@uniplus/shared-auth/bootstrap';
import { type ApiFailure, apiOk, ProblemI18nService } from '@uniplus/shared-core/http';
import {
  type CertamePublicadoDto,
  type ComprovanteInscricaoDto,
  type FormularioRenderizavelDto,
  type MinhaInscricaoDto,
  SituacaoInscricao,
} from '@uniplus/shared-data/selecao';
import {
  AlertComponent,
  CodigoDeVerificacaoComponent,
  DadoDirective,
  DadoRevelavelComponent,
  DocumentoComponent,
  ListaDeDadosComponent,
  type NomesDosMunicipios,
  SecaoDeDocumentoComponent,
  SkeletonComponent,
  TagComponent,
} from '@uniplus/shared-ui/components';
import { cpfRevelavel, formatarDataBr, textoMascarado } from '@uniplus/shared-utils';

import { MinhasInscricoesService } from '../minhas-inscricoes.service';
import {
  derivadosDoComprovante,
  envioDoComprovante,
  modalidadesDoComprovante,
  opcoesDoComprovante,
  municipiosDoComprovante,
  numeroDoComprovante,
  secoesDoComprovante,
  termosAceitos,
  type Vizinhos,
  vizinhos,
} from './comprovante-da-inscricao';
import { nomesDoCandidato } from './resposta-exibida';

type Estado = 'carregando' | 'erro' | 'pronto';

const NAO_ENCONTRADO =
  'Não encontramos este comprovante. Confira o endereço ou volte às suas inscrições.';

interface Carregado {
  readonly numero: number;
  readonly comprovante: ComprovanteInscricaoDto;
  /** Nulo na cancelada: a API só entrega o formulário da inscrição ativa do processo. */
  readonly formulario: FormularioRenderizavelDto | null;
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

  readonly inscricaoId = input.required<string>();
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
    return this.estado() === 'pronto' && !this.cancelada() && envio && !envio.ehOQueVale
      ? envio
      : null;
  });
  protected readonly cancelada = computed(
    () => this.carregado()?.inscricao.situacao === SituacaoInscricao.cancelada,
  );
  protected readonly canceladaEm = computed(() => {
    const c = this.carregado();
    return c?.inscricao.canceladaEm
      ? noFuso(c.inscricao.canceladaEm, c.comprovante.fusoHorario)
      : '';
  });
  /**
   * Até quando corrigir, só no envio que vale: o substituído aponta para o mais recente e a cancelada
   * já não se corrige. Se ainda se corrige, a API diz em `acoes`.
   */
  protected readonly prazo = computed(() => {
    const c = this.carregado();
    if (!c?.processo || this.cancelada() || !this.envio()?.ehOQueVale) return null;
    const { fim } = c.processo.periodo;
    return {
      aberto: c.inscricao.acoes.podeCorrigir,
      fim: noFuso(fim, c.processo.localidade.fusoHorario),
      fimIso: fim,
    };
  });
  protected readonly secoes = computed(() => {
    const c = this.carregado();
    return c?.formulario ? secoesDoComprovante(c.formulario, c.comprovante, c.municipios) : [];
  });
  protected readonly derivados = computed(() => {
    const c = this.carregado();
    return c?.formulario ? derivadosDoComprovante(c.formulario, c.comprovante, c.municipios) : [];
  });
  protected readonly modalidades = computed(() => {
    const c = this.carregado();
    return c ? modalidadesDoComprovante(c.comprovante) : null;
  });
  protected readonly termos = computed(() => {
    const c = this.carregado();
    return c?.formulario ? termosAceitos(c.formulario, c.comprovante) : [];
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
  /** O curso de cada opção, pelo nome congelado na publicação. */
  protected readonly opcoes = computed(() => {
    const c = this.carregado();
    return c ? opcoesDoComprovante(c.comprovante, c.processo) : [];
  });
  /** O envio de um processo de 1 opção sem o curso no certame não tem o que mostrar na seção. */
  protected readonly mostrarOpcoes = computed(() => {
    const opcoes = this.opcoes();
    return opcoes.length > 1 || opcoes[0]?.curso != null;
  });
  protected readonly comDuasOpcoes = computed(() => this.opcoes().length > 1);

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

  private ler(inscricaoId: string, numeroPedido: string | undefined): Observable<Leitura> {
    // Sem parâmetro na rota, vale o comprovante mais recente. Com parâmetro que não é um inteiro
    // positivo, não há comprovante a abrir: `null` aqui seria lido como "sem número pedido".
    const pedido = numeroPedido === undefined ? null : Number(numeroPedido);
    if (pedido !== null && !(Number.isInteger(pedido) && pedido > 0)) {
      return of({ tipo: 'nao-encontrado' });
    }
    return this.servico.listar().pipe(
      switchMap((minhas): Observable<Leitura> => {
        if (!minhas.ok) return of({ tipo: 'falha', falha: minhas });
        const inscricao = minhas.data.find((i) => i.inscricaoId === inscricaoId);
        const numero = inscricao ? numeroDoComprovante(inscricao.comprovantes, pedido) : null;
        if (!inscricao || numero === null) return of({ tipo: 'nao-encontrado' });
        return this.lerDaInscricao(inscricao, numero);
      }),
    );
  }

  private lerDaInscricao(inscricao: MinhaInscricaoDto, numero: number): Observable<Leitura> {
    const processoId = inscricao.processoSeletivoId;
    // O formulário que a API entrega é o da inscrição ativa do processo. A cancelada pode ter outra
    // versão (ou nenhuma inscrição ativa), então nunca se lê o formulário dela por ali.
    const formulario =
      inscricao.situacao === SituacaoInscricao.cancelada
        ? of(apiOk<FormularioRenderizavelDto | null>(null, 200, new HttpHeaders()))
        : this.servico.formulario(processoId);
    return forkJoin({
      formulario,
      processo: this.servico.certame(processoId),
      comprovante: this.servico.comprovante(inscricao.inscricaoId, numero),
    }).pipe(
      switchMap(({ formulario, processo, comprovante }): Observable<Leitura> => {
        if (!formulario.ok) return of({ tipo: 'falha', falha: formulario });
        if (!processo.ok) return of({ tipo: 'falha', falha: processo });
        if (!comprovante.ok) return of({ tipo: 'falha', falha: comprovante });
        const campos = formulario.data;
        return (
          campos
            ? this.servico.nomesDosMunicipios(municipiosDoComprovante(campos, comprovante.data))
            : of(new Map<string, string>())
        ).pipe(
          map(
            (municipios): Leitura => ({
              tipo: 'pronto',
              carregado: {
                numero,
                comprovante: comprovante.data,
                formulario: campos,
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
