import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  type OnInit,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { UserContextService } from '@uniplus/shared-auth/bootstrap';
import {
  AGUARDE_A_VERIFICACAO,
  AlertComponent,
  derivadosDoSistema,
  FormularioDoCandidatoComponent,
  PageHeaderComponent,
  type PendenciaDaSecao,
  type SimulacaoDoFormulario,
  SpinnerComponent,
  type ValorJson,
} from '@uniplus/shared-ui/components';

import { AcoesDaInscricaoComponent } from './acoes-da-inscricao.component';
import { AnuncioDaInscricao } from './anuncio-da-inscricao';
import { AvaliacaoDaInscricaoEstado } from './avaliacao-da-inscricao.estado';
import { DiaDoEnvio } from './dia-do-envio';
import { EscolhaDoCurso, PASSO_DO_CURSO } from './escolha-do-curso';
import { EscolhaDoCursoComponent } from './escolha-do-curso.component';
import { GravacaoDaInscricao } from './gravacao-da-inscricao';
import { LeituraDaInscricao } from './leitura-da-inscricao';
import { ReavaliacaoDaInscricao } from './reavaliacao-da-inscricao';
import { respostasFixasDaConta } from './respostas-da-conta';

/**
 * A inscrição do candidato num processo: o formulário da versão em que está a inscrição, preenchido em
 * passos, salvo como rascunho ou enviado. O rascunho fica só na memória da página e no servidor. A
 * página compõe: quem lê a inscrição é `LeituraDaInscricao`, quem escolhe o curso é `EscolhaDoCurso`
 * e quem escreve é `GravacaoDaInscricao`.
 */
@Component({
  selector: 'ptl-inscricao-do-candidato-page',
  standalone: true,
  imports: [
    AcoesDaInscricaoComponent,
    AlertComponent,
    EscolhaDoCursoComponent,
    FormularioDoCandidatoComponent,
    PageHeaderComponent,
    RouterLink,
    SpinnerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    AnuncioDaInscricao,
    AvaliacaoDaInscricaoEstado,
    LeituraDaInscricao,
    EscolhaDoCurso,
    GravacaoDaInscricao,
    ReavaliacaoDaInscricao,
    DiaDoEnvio,
  ],
  templateUrl: './inscricao-do-candidato.page.html',
  styleUrl: './inscricao-do-candidato.page.css',
})
export class InscricaoDoCandidatoPage implements OnInit {
  private readonly usuario = inject(UserContextService);
  private readonly reavaliacao = inject(ReavaliacaoDaInscricao);
  protected readonly leitura = inject(LeituraDaInscricao);
  protected readonly escolha = inject(EscolhaDoCurso);
  protected readonly gravacao = inject(GravacaoDaInscricao);
  protected readonly avaliacao = inject(AvaliacaoDaInscricaoEstado);
  protected readonly anuncio = inject(AnuncioDaInscricao);
  protected readonly dia = inject(DiaDoEnvio);

  readonly processoId = input.required<string>();

  protected readonly PASSO_DO_CURSO = PASSO_DO_CURSO;
  /** O aviso do bloco de documentos quando as respostas não pedem nada nesta fase. */
  protected readonly semDocumentos =
    'Você não envia documentos nesta etapa. Os documentos que comprovam o que você declarou podem ser ' +
    'pedidos em outras etapas do processo seletivo, conforme o edital.';

  private readonly formularioDoCandidato = viewChild(FormularioDoCandidatoComponent);
  private readonly cursoDaTela = viewChild(EscolhaDoCursoComponent);
  private readonly simulacao = signal<SimulacaoDoFormulario>({});
  protected readonly pendenciasDasSecoes = signal<readonly PendenciaDaSecao[]>([]);

  /** As ocorrências de grupo já gravadas: a API só aceita arquivo de uma ocorrência que a inscrição tem. */
  protected readonly ocorrenciasGravadas = computed(
    () =>
      new Set(
        Object.values(this.leitura.inscricao()?.grupos ?? {}).flatMap((ocorrencias) =>
          ocorrencias.map((ocorrencia) => ocorrencia.id),
        ),
      ),
  );

  protected readonly respostasFixas = computed(() =>
    respostasFixasDaConta(this.usuario.user(), this.leitura.formulario()),
  );

  /**
   * Os fatos que o sistema calcula das respostas e que o formulário cita, com o rótulo de lá. Voltam ao
   * formulário como pressupostos, então só mudam quando o valor muda: senão cada simulação emitida
   * geraria outra.
   */
  protected readonly derivados = computed(
    () => {
      const formulario = this.leitura.formulario();
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

  protected readonly passoDaRecusa = computed(() =>
    this.escolha.erroDaOferta() || this.escolha.erroDaSegundaOferta() ? PASSO_DO_CURSO : null,
  );

  /**
   * Por que o envio ainda não segue, ou `null` quando o formulário está válido. Conta as perguntas e os
   * aceites das seções, e o documento obrigatório ainda em verificação. Os demais documentos obrigatórios
   * ficam com a API, que recusa o envio: a situação de cada documento não basta, porque a alternativa
   * não escolhida de um grupo "um ou outro" atendido continua pendente.
   */
  protected readonly motivoDoEnvioBloqueado = computed<string | null>(() => {
    const partes: string[] = [];
    if (this.escolha.semCurso()) partes.push('Escolha o curso.');
    const total = this.pendenciasDasSecoes().reduce((soma, s) => soma + s.quantidade, 0);
    if (total > 0)
      partes.push(total === 1 ? 'Falta corrigir 1 item.' : `Faltam corrigir ${total} itens.`);
    if (this.formularioDoCandidato()?.aguardaVerificacaoDosDocumentos())
      partes.push(AGUARDE_A_VERIFICACAO);
    return partes.length > 0 ? partes.join(' ') : null;
  });

  protected readonly avaliacaoNaTela = computed(() =>
    this.escolha.comOpcoesDeCurso(this.avaliacao.naTela()),
  );

  constructor() {
    this.reavaliacao.acompanhar(this.formularioDoCandidato);
    effect(() => {
      const pedido = this.escolha.pedidoDeFoco();
      if (pedido !== null) untracked(() => this.irAoCampoRecusado(pedido.primeira));
    });
  }

  ngOnInit(): void {
    this.carregar();
  }

  protected carregar(): void {
    this.leitura.carregar(this.processoId());
  }

  protected responder(simulacao: SimulacaoDoFormulario): void {
    this.simulacao.set(simulacao);
    this.reavaliacao.respostasMudaram(simulacao);
  }

  protected escolherOferta(valor: string | null): void {
    this.escolha.escolherOferta(valor);
    this.reavaliacao.ofertaMudou();
  }

  protected escolherSegundaOferta(valor: string | null): void {
    this.escolha.escolherSegundaOferta(valor);
    this.reavaliacao.ofertaMudou();
  }

  /** O curso é obrigatório: mostra a recusa no passo Curso, com o foco no campo. */
  protected recusarCursoAusente(): void {
    this.escolha.recusarCursoAusente();
  }

  /** O candidato vai ao curso que falta escolher, com o foco no campo e sem mostrar recusa. */
  protected irAoCurso(): void {
    this.formularioDoCandidato()?.irAoPasso(
      PASSO_DO_CURSO,
      () => this.cursoDaTela()?.campoDaPrimeira() ?? null,
    );
  }

  /** O candidato vai à seção pendente, com o foco no primeiro campo que falta e nada concluído. */
  protected irAPendencia(chave: string): void {
    this.formularioDoCandidato()?.irAPendenciaDe(chave);
  }

  protected salvar(): void {
    const formulario = this.formularioDoCandidato();
    if (formulario) this.gravacao.salvar(formulario);
  }

  protected enviar(): void {
    const formulario = this.formularioDoCandidato();
    // O botão fica indisponível com pendência; a guarda cobre a chamada que não vem dele.
    if (formulario && this.motivoDoEnvioBloqueado() === null) this.gravacao.enviar(formulario);
  }

  /** O campo só existe depois de o passo aparecer: a escolha do foco espera por ele. */
  private irAoCampoRecusado(primeiraRecusada: boolean): void {
    this.formularioDoCandidato()?.irAoPasso(
      PASSO_DO_CURSO,
      () => this.cursoDaTela()?.campoRecusado(primeiraRecusada) ?? null,
    );
  }
}
