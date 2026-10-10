import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  linkedSignal,
  type OnInit,
  signal,
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
  private readonly termosAceitos = signal<readonly string[]>([]);
  protected readonly ofertaEscolhida = linkedSignal(
    () =>
      this.inscricao()?.ofertaCursoId ??
      (this.ofertas().length === 1 ? this.ofertas()[0].id : null),
  );

  protected readonly ocupada = signal(false);
  protected readonly errosDoServidor = signal<readonly ErroDoServidor[]>([]);
  protected readonly recusaGeral = signal<string | null>(null);
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

  protected aceitar(termos: readonly string[]): void {
    this.termosAceitos.set(termos);
  }

  protected escolherOferta(evento: Event): void {
    const valor = (evento.target as HTMLSelectElement).value;
    this.ofertaEscolhida.set(valor === '' ? null : valor);
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
    if (!inscricao || this.ocupada()) return;
    this.ocupada.set(true);
    this.recusaGeral.set(null);
    this.errosDoServidor.set([]);
    this.aviso.set('');
    chamada(this.request(inscricao), inscricao.eTag)
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
  private request(inscricao: InscricaoDto): InscricaoRequest {
    const respostas: Record<string, unknown> = { ...(this.simulacao().respostas ?? {}) };
    for (const fato of Object.keys(inscricao.respostas)) {
      if (!(fato in respostas)) respostas[fato] = null;
    }
    const termos = new Map((this.formulario()?.termos ?? []).map((t) => [t.codigo, t]));
    return {
      ofertaCursoId: this.ofertaEscolhida(),
      respostas,
      grupos: Object.fromEntries(
        Object.entries(this.simulacao().grupos ?? {}).map(([codigo, ocorrencias]) => [
          codigo,
          (ocorrencias ?? []).map((o) => ({ id: o.id, respostas: o.respostas ?? {} })),
        ]),
      ),
      aceites: this.termosAceitos().flatMap((codigo) => {
        const termo = termos.get(codigo);
        return termo ? [{ codigo, versaoId: termo.versaoId, hashVersao: termo.hashVersao }] : [];
      }),
    };
  }

  private tratarRecusa(falha: ApiFailure): void {
    const porCampo = (falha.problem.errors ?? []).map((e) => ({
      campo: e.field,
      mensagem: mensagemDaRecusa(e.code),
    }));
    if (porCampo.length > 0) {
      this.errosDoServidor.set(porCampo);
      this.aviso.set(
        porCampo.length === 1
          ? 'Uma resposta foi recusada. Corrija e tente de novo.'
          : `${porCampo.length} respostas foram recusadas. Corrija e tente de novo.`,
      );
      return;
    }
    const mensagem = this.problemas.resolve(falha.problem);
    this.recusaGeral.set(mensagem.detail ?? mensagem.title);
  }
}
