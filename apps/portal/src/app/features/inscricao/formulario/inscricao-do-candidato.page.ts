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
import { forkJoin, type Observable } from 'rxjs';
import { UserContextService } from '@uniplus/shared-auth/bootstrap';
import { type ApiFailure, type ApiResult, ProblemI18nService } from '@uniplus/shared-core/http';
import type {
  ComprovanteInscricaoDto,
  FormularioRenderizavelDto,
  InscricaoDto,
  InscricaoRequest,
} from '@uniplus/shared-data/selecao';
import { isValidCpf, maskCpf } from '@uniplus/shared-data/utils';
import {
  AlertComponent,
  derivadosDoSistema,
  type ErroDoServidor,
  FormularioDoCandidatoComponent,
  PageHeaderComponent,
  type RespostaFixa,
  type SimulacaoDoFormulario,
  SpinnerComponent,
  type ValorJson,
} from '@uniplus/shared-ui/components';

import {
  InscricaoDoCandidatoService,
  type OfertaDaInscricao,
} from './inscricao-do-candidato.service';
import { mensagemDaRecusa } from './recusas-da-inscricao';

type Estado = 'carregando' | 'erro' | 'pronto';

/** As recusas de quem gravou sobre uma revisão que outra janela já mudou. */
const CONFLITOS: ReadonlySet<string> = new Set([
  'uniplus.selecao.inscricao.precondicao_falhou',
  'uniplus.selecao.inscricao.conflito_de_concorrencia',
]);

/** O campo em que o servidor devolve a recusa da oferta de curso. */
const CAMPO_DA_OFERTA = 'ofertaCursoId';

/**
 * A inscrição do candidato num processo: o formulário que a inscrição fixou ao nascer, preenchido em
 * passos, salvo como rascunho ou enviado. O rascunho fica só na memória da página e no servidor.
 */
@Component({
  selector: 'ptl-inscricao-do-candidato-page',
  standalone: true,
  imports: [
    AlertComponent,
    FormularioDoCandidatoComponent,
    PageHeaderComponent,
    RouterLink,
    SpinnerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './inscricao-do-candidato.page.html',
  styleUrl: './inscricao-do-candidato.page.css',
})
export class InscricaoDoCandidatoPage implements OnInit {
  private readonly servico = inject(InscricaoDoCandidatoService);
  private readonly usuario = inject(UserContextService);
  private readonly problemas = inject(ProblemI18nService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  readonly processoId = input.required<string>();

  protected readonly estado = signal<Estado>('carregando');
  protected readonly erroAoCarregar = signal<string | null>(null);
  protected readonly formulario = signal<FormularioRenderizavelDto | null>(null);
  protected readonly ofertas = signal<readonly OfertaDaInscricao[]>([]);
  /** A inscrição como o servidor a tem: a última lida, salva ou enviada. */
  private readonly inscricao = signal<InscricaoDto | null>(null);
  /** A partida do formulário: as respostas e os aceites da inscrição como chegaram ao abrir a página. */
  protected readonly inicial = signal<SimulacaoDoFormulario | null>(null);
  protected readonly termosAceitosIniciais = signal<readonly string[]>([]);

  private readonly simulacao = signal<SimulacaoDoFormulario>({});
  /** A escolha do candidato: parte da gravada ao carregar e só ele a muda, nem a releitura do ETag. */
  protected readonly ofertaEscolhida = signal<string | null>(null);
  protected readonly erroDaOferta = signal<string | null>(null);
  private readonly selectDaOferta = viewChild<ElementRef<HTMLSelectElement>>('selectDaOferta');
  private readonly formularioDoCandidato = viewChild(FormularioDoCandidatoComponent);

  protected readonly ocupada = signal(false);
  protected readonly errosDoServidor = signal<readonly ErroDoServidor[]>([]);
  protected readonly recusaGeral = signal<string | null>(null);
  protected readonly conflito = signal<string | null>(null);
  protected readonly aviso = signal('');
  protected readonly comprovante = signal<ComprovanteInscricaoDto | null>(null);

  /** O CPF vem da conta e não se altera aqui: entra na resposta do formulário que o coleta e aparece mascarado. */
  protected readonly respostasFixas = computed<Readonly<Record<string, RespostaFixa>>>(() => {
    const cpf = this.usuario.user()?.cpf.replace(/\D/g, '') ?? '';
    const coletaCpf = this.formulario()?.fatosColetados.some((c) => c.fatoCodigo === 'CPF');
    const fixas: Record<string, RespostaFixa> = {};
    if (coletaCpf && isValidCpf(cpf)) fixas['CPF'] = { valor: cpf, exibicao: maskCpf(cpf) };
    return fixas;
  });

  /**
   * Os fatos que o sistema calcula das respostas e que o formulário cita, com o rótulo de lá. Voltam ao
   * formulário como pressupostos, então só mudam quando o valor muda: senão cada simulação emitida
   * geraria outra.
   */
  protected readonly derivados = computed(
    () => {
      const formulario = this.formulario();
      if (!formulario) return [];
      const citados = new Map(formulario.pressupostos.map((p) => [p.fatoCodigo, p]));
      return derivadosDoSistema(this.simulacao().respostas ?? {}, formulario.dataReferenciaFatos)
        .filter((d) => citados.has(d.fatoCodigo))
        .map((d) => ({ ...d, rotulo: citados.get(d.fatoCodigo)?.rotulo ?? d.fatoCodigo }));
    },
    { equal: (a, b) => JSON.stringify(a) === JSON.stringify(b) },
  );
  protected readonly pressupostos = computed<Readonly<Record<string, ValorJson>>>(() =>
    Object.fromEntries(this.derivados().map((d) => [d.fatoCodigo, d.valor])),
  );

  ngOnInit(): void {
    this.carregar();
  }

  /** Inicia a inscrição e, com ela, lê o formulário da versão fixada e as ofertas do processo. */
  protected carregar(): void {
    this.estado.set('carregando');
    const processoId = this.processoId();
    this.servico
      .iniciar(processoId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((inscricao) => {
        if (!inscricao.ok) {
          this.falharAoCarregar(inscricao);
          return;
        }
        forkJoin({
          formulario: this.servico.obterFormulario(processoId),
          ofertas: this.servico.obterOfertas(processoId),
        })
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe(({ formulario, ofertas }) => {
            if (!formulario.ok) return this.falharAoCarregar(formulario);
            if (!ofertas.ok) return this.falharAoCarregar(ofertas);
            this.inscricao.set(inscricao.data);
            // As respostas chegam em JSON: são os valores que o formulário lê.
            this.inicial.set({
              respostas: inscricao.data.respostas as Readonly<Record<string, ValorJson>>,
              grupos: inscricao.data.grupos as SimulacaoDoFormulario['grupos'],
            });
            this.termosAceitosIniciais.set(inscricao.data.aceites.map((a) => a.codigo));
            this.formulario.set(formulario.data);
            this.ofertas.set(ofertas.data);
            this.ofertaEscolhida.set(
              inscricao.data.ofertaCursoId ??
                (ofertas.data.length === 1 ? ofertas.data[0].id : null),
            );
            this.estado.set('pronto');
          });
      });
  }

  private falharAoCarregar(falha: ApiFailure): void {
    this.erroAoCarregar.set(this.problemas.resolve(falha.problem).title);
    this.estado.set('erro');
  }

  protected responder(simulacao: SimulacaoDoFormulario): void {
    this.simulacao.set(simulacao);
  }

  protected escolherOferta(evento: Event): void {
    const valor = (evento.target as HTMLSelectElement).value;
    this.ofertaEscolhida.set(valor === '' ? null : valor);
    this.erroDaOferta.set(null);
  }

  protected salvar(): void {
    this.gravar(
      (request, eTag) => this.servico.salvar(this.processoId(), request, eTag),
      (inscricao) => {
        this.inscricao.set(inscricao);
        this.aviso.set('Rascunho salvo.');
      },
    );
  }

  protected enviar(): void {
    this.gravar(
      (request, eTag) => this.servico.submeter(this.processoId(), request, eTag),
      (comprovante) => {
        this.comprovante.set(comprovante);
        this.aviso.set(`Inscrição enviada. Número ${comprovante.numeroInscricao}.`);
        this.relerAGravada();
      },
    );
  }

  /** O envio devolve o comprovante, não a inscrição: sem reler, a próxima correção sairia com o ETag velho. */
  private relerAGravada(): void {
    this.servico
      .obter(this.processoId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((resultado) => {
        if (resultado.ok) this.inscricao.set(resultado.data);
      });
  }

  private gravar<T>(
    chamada: (request: InscricaoRequest, eTag: string) => Observable<ApiResult<T>>,
    sucesso: (dado: T) => void,
  ): void {
    const inscricao = this.inscricao();
    const formulario = this.formularioDoCandidato();
    if (!inscricao || !formulario || this.ocupada()) return;
    this.ocupada.set(true);
    this.conflito.set(null);
    this.recusaGeral.set(null);
    this.errosDoServidor.set([]);
    this.erroDaOferta.set(null);
    this.aviso.set('');
    // Lido do formulário no clique: a emissão das mudanças só chega no ciclo seguinte.
    chamada(
      this.request(inscricao, formulario.simulacao(), formulario.termosAceitos()),
      inscricao.eTag,
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((resultado) => {
        this.ocupada.set(false);
        if (resultado.ok) {
          sucesso(resultado.data);
          return;
        }
        this.tratarRecusa(resultado);
      });
  }

  /**
   * O corpo do salvar e do envio. A resposta que o candidato apagou vai como `null`: ausente do corpo, o
   * servidor manteria a gravada.
   */
  private request(
    inscricao: InscricaoDto,
    simulacao: SimulacaoDoFormulario,
    termosAceitos: readonly string[],
  ): InscricaoRequest {
    const respostas: Record<string, unknown> = { ...(simulacao.respostas ?? {}) };
    for (const fato of Object.keys(inscricao.respostas)) {
      if (!(fato in respostas)) respostas[fato] = null;
    }
    const termos = new Map((this.formulario()?.termos ?? []).map((t) => [t.codigo, t]));
    return {
      ofertaCursoId: this.ofertaEscolhida(),
      respostas,
      grupos: Object.fromEntries(
        Object.entries(simulacao.grupos ?? {}).map(([codigo, ocorrencias]) => [
          codigo,
          (ocorrencias ?? []).map((o) => ({ id: o.id, respostas: o.respostas ?? {} })),
        ]),
      ),
      aceites: termosAceitos.flatMap((codigo) => {
        const termo = termos.get(codigo);
        return termo ? [{ codigo, versaoId: termo.versaoId, hashVersao: termo.hashVersao }] : [];
      }),
    };
  }

  private tratarRecusa(falha: ApiFailure): void {
    if (CONFLITOS.has(falha.problem.code)) {
      this.conflito.set(
        'Recarregamos a versão gravada mais recente para você não sobrescrever o que mudou. Revise e grave de novo.',
      );
      this.carregar();
      return;
    }
    if (falha.status === 0 || falha.status >= 500) {
      // A gravação pode ter acontecido sem a resposta chegar: o ETag relido é o que vale para tentar de novo.
      this.relerAGravada();
    }
    const recusas = falha.problem.errors ?? [];
    const daOferta = recusas.find((e) => e.field === CAMPO_DA_OFERTA);
    const porCampo = recusas
      .filter((e) => e.field !== CAMPO_DA_OFERTA)
      .map((e) => ({ campo: e.field, mensagem: mensagemDaRecusa(e.code) }));
    if (daOferta) this.recusarOferta(mensagemDaRecusa(daOferta.code));
    if (porCampo.length > 0) this.errosDoServidor.set(porCampo);
    const total = porCampo.length + (daOferta ? 1 : 0);
    if (total > 0) {
      this.aviso.set(
        total === 1
          ? 'Uma resposta foi recusada. Corrija e tente de novo.'
          : `${total} respostas foram recusadas. Corrija e tente de novo.`,
      );
      return;
    }
    const mensagem = this.problemas.resolve(falha.problem);
    this.recusaGeral.set(mensagem.detail ?? mensagem.title);
  }

  /** Sem seletor na tela, a recusa da oferta só pode aparecer como recusa geral. */
  private recusarOferta(mensagem: string): void {
    if (this.ofertas().length <= 1) {
      this.recusaGeral.set(mensagem);
      return;
    }
    this.erroDaOferta.set(mensagem);
    afterNextRender(() => this.selectDaOferta()?.nativeElement.focus(), {
      injector: this.injector,
    });
  }
}
