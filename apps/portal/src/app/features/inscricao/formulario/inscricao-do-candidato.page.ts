import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  type OnInit,
  untracked,
  viewChild,
  viewChildren,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { UserContextService } from '@uniplus/shared-auth/bootstrap';
import {
  AGUARDE_A_VERIFICACAO,
  FormularioDoCandidatoComponent,
  localizarCampo,
  type PassoPrefixado,
  type ValorJson,
} from '@uniplus/shared-inscricao/formulario';
import {
  acompanharLeitura,
  AlertComponent,
  FalhaDeLeituraComponent,
  IndicadorDaLeituraDirective,
  PageHeaderComponent,
  SpinnerComponent,
  StepsComponent,
} from '@uniplus/shared-ui/components';

import { AcoesDaInscricaoComponent } from './acoes-da-inscricao.component';
import { AnuncioDaInscricao } from './anuncio-da-inscricao';
import { AvaliacaoDaInscricaoEstado } from './avaliacao-da-inscricao.estado';
import {
  derivadosDoFormulario,
  derivadosSemRepeticao,
  pressupostosDe,
} from './derivados-da-inscricao';
import { DiaDoEnvio } from './dia-do-envio';
import { EscolhaDoCurso, PASSO_DO_CURSO } from './escolha-do-curso';
import { EscolhaDoCursoComponent } from './escolha-do-curso.component';
import { formularioParaExibicao } from './formulario-para-exibicao';
import { GravacaoDaInscricao } from './gravacao-da-inscricao';
import { tituloDoFormulario } from './formularios-da-inscricao';
import { LeituraDaInscricao } from './leitura-da-inscricao';
import {
  PreenchimentoDosFormularios,
  type PendenciaDoFormulario,
  type RecusaDoResumo,
} from './preenchimento-dos-formularios';
import { ReavaliacaoDaInscricao } from './reavaliacao-da-inscricao';
import { respostasFixasDaConta } from './respostas-da-conta';

/**
 * A inscrição do candidato num processo: os formulários da versão em que está a inscrição, preenchidos
 * em passos, um por vez, salvos como rascunho ou enviados de uma vez. O rascunho fica só na memória da página e no servidor. A
 * página compõe: quem lê a inscrição é `LeituraDaInscricao`, quem escolhe o curso é `EscolhaDoCurso`
 * quem escreve é `GravacaoDaInscricao` e quem sabe o que já foi preenchido em cada formulário é
 * `PreenchimentoDosFormularios`.
 */
@Component({
  selector: 'ptl-inscricao-do-candidato-page',
  standalone: true,
  imports: [
    AcoesDaInscricaoComponent,
    AlertComponent,
    EscolhaDoCursoComponent,
    FalhaDeLeituraComponent,
    FormularioDoCandidatoComponent,
    IndicadorDaLeituraDirective,
    PageHeaderComponent,
    RouterLink,
    SpinnerComponent,
    StepsComponent,
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
    PreenchimentoDosFormularios,
  ],
  templateUrl: './inscricao-do-candidato.page.html',
  styleUrl: './inscricao-do-candidato.page.css',
})
export class InscricaoDoCandidatoPage implements OnInit {
  private readonly usuario = inject(UserContextService);
  private readonly reavaliacao = inject(ReavaliacaoDaInscricao);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly leitura = inject(LeituraDaInscricao);
  protected readonly escolha = inject(EscolhaDoCurso);
  protected readonly gravacao = inject(GravacaoDaInscricao);
  protected readonly avaliacao = inject(AvaliacaoDaInscricaoEstado);
  protected readonly anuncio = inject(AnuncioDaInscricao);
  protected readonly dia = inject(DiaDoEnvio);
  protected readonly preenchimento = inject(PreenchimentoDosFormularios);
  protected readonly acompanhamento = acompanharLeitura({
    falha: this.leitura.erroAoCarregar,
    pendente: computed(() => this.leitura.estado() === 'carregando'),
    recarregar: () => this.leitura.recarregar(),
    destino: () => this.host.nativeElement.querySelector('h1'),
  });

  readonly processoId = input.required<string>();

  protected readonly PASSO_DO_CURSO = PASSO_DO_CURSO;
  protected readonly SEM_PASSOS: readonly PassoPrefixado[] = [];
  /** O aviso do bloco de documentos quando as respostas não pedem nada nesta fase. */
  protected readonly semDocumentos =
    'Você não envia documentos nesta etapa. Os documentos que comprovam o que você declarou podem ser ' +
    'pedidos em outras etapas do processo seletivo, conforme o edital.';

  private readonly instancias = viewChildren(FormularioDoCandidatoComponent);
  private readonly cursoDaTela = viewChild(EscolhaDoCursoComponent);

  /** As ocorrências de grupo já gravadas: a API só aceita arquivo de uma ocorrência que a inscrição tem. */
  protected readonly ocorrenciasGravadas = computed(
    () =>
      new Set(
        Object.values(this.leitura.inscricao()?.formulario.grupos ?? {}).flatMap((ocorrencias) =>
          ocorrencias.map((ocorrencia) => ocorrencia.id),
        ),
      ),
  );

  /** Cada formulário como a tela o mostra; só muda quando a inscrição é lida de novo. */
  protected readonly formularios = computed(() =>
    this.leitura.formularios().map((carregado) => ({
      carregado,
      codigo: carregado.formulario.codigo,
      titulo: tituloDoFormulario(carregado.formulario),
      exibicao: formularioParaExibicao(carregado.formulario.formulario),
    })),
  );
  protected readonly respostasFixas = computed(
    () =>
      new Map(
        this.leitura
          .formularios()
          .map((f) => [
            f.formulario.codigo,
            respostasFixasDaConta(this.usuario.user(), f.formulario),
          ]),
      ),
  );

  /**
   * Os fatos que o sistema calcula das respostas e que cada formulário cita. Voltam ao formulário como
   * pressupostos, então só mudam quando o valor muda: senão cada simulação emitida geraria outra.
   */
  private readonly derivadosPorFormulario = computed(
    () => {
      const respostas = this.preenchimento.simulacao().respostas ?? {};
      return new Map(
        this.leitura
          .formularios()
          .map((f) => [f.formulario.codigo, derivadosDoFormulario(f.formulario, respostas)]),
      );
    },
    { equal: (a, b) => JSON.stringify([...a]) === JSON.stringify([...b]) },
  );
  protected readonly derivados = computed(() =>
    derivadosSemRepeticao(this.derivadosPorFormulario()),
  );
  protected readonly pressupostos = computed<
    ReadonlyMap<string, Readonly<Record<string, ValorJson>>>
  >(
    () =>
      new Map([...this.derivadosPorFormulario()].map(([codigo, d]) => [codigo, pressupostosDe(d)])),
  );

  protected readonly passoDaRecusa = computed(() =>
    this.escolha.erroDaOferta() || this.escolha.erroDaSegundaOferta() ? PASSO_DO_CURSO : null,
  );

  /**
   * Por que o envio ainda não segue, ou `null` quando os formulários estão válidos. Conta as perguntas e
   * os aceites das seções de todos eles, e o documento obrigatório ainda em verificação. Os demais
   * documentos obrigatórios ficam com a API, que recusa o envio: a situação de cada documento não basta,
   * porque a alternativa não escolhida de um grupo "um ou outro" atendido continua pendente.
   */
  protected readonly motivoDoEnvioBloqueado = computed<string | null>(() => {
    const partes: string[] = [];
    if (this.escolha.semCurso()) partes.push('Escolha o curso.');
    const total = this.preenchimento.pendencias().reduce((soma, s) => soma + s.quantidade, 0);
    if (total > 0)
      partes.push(total === 1 ? 'Falta corrigir 1 item.' : `Faltam corrigir ${total} itens.`);
    if (this.preenchimento.aguardaVerificacaoDosDocumentos()) partes.push(AGUARDE_A_VERIFICACAO);
    return partes.length > 0 ? partes.join(' ') : null;
  });

  protected readonly avaliacaoNaTela = computed(() =>
    this.escolha.comOpcoesDeCurso(this.avaliacao.naTela()),
  );

  constructor() {
    this.preenchimento.acompanhar(this.instancias);
    this.reavaliacao.acompanhar(
      computed(() => (this.preenchimento.pronto() ? this.preenchimento : undefined)),
    );
    effect(() => {
      if (!this.preenchimento.pronto()) return;
      const simulacao = this.preenchimento.simulacao();
      untracked(() => this.reavaliacao.respostasMudaram(simulacao));
    });
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
    this.irAoPassoDoCurso(() => this.cursoDaTela()?.campoDaPrimeira() ?? null);
  }

  /** O candidato vai à seção pendente, com o foco no primeiro campo que falta e nada concluído. */
  protected irAPendencia(pendencia: PendenciaDoFormulario): void {
    this.preenchimento.irAoFormulario(pendencia.formularioCodigo, (formulario) =>
      formulario.conferencia.irAPendenciaDe(pendencia.chave),
    );
  }

  /** O candidato vai ao campo que o servidor recusou, no formulário dele. */
  protected irARecusa(recusa: RecusaDoResumo): void {
    this.preenchimento.irAoFormulario(recusa.formularioCodigo, (formulario) =>
      formulario.navegacao.irAoCampo(recusa.campo),
    );
  }

  /** A avaliação pede um campo que o formulário aberto não tem: o candidato vai ao formulário dono dele. */
  protected irAoCampoDeOutroFormulario(campo: string): void {
    const dono = this.leitura
      .formularios()
      .find((f) => localizarCampo(f.formulario.formulario, campo) !== null);
    if (dono === undefined) return;
    this.preenchimento.irAoFormulario(dono.formulario.codigo, (formulario) =>
      formulario.navegacao.irAoCampo(campo),
    );
  }

  /** Troca de formulário: o foco vai ao título dele e a região viva anuncia a posição. */
  protected escolherFormulario(indice: number): void {
    const formularios = this.formularios();
    const destino = formularios[indice];
    if (destino === undefined) return;
    this.preenchimento.irAoFormulario(destino.codigo, () => this.focarOTitulo(destino.codigo));
    this.anuncio.repetir(`Formulário ${indice + 1} de ${formularios.length}: ${destino.titulo}.`);
  }

  private focarOTitulo(codigo: string): void {
    this.host.nativeElement.querySelector<HTMLElement>(`#inscricao-${codigo}-formulario`)?.focus();
  }

  protected salvar(): void {
    if (this.preenchimento.pronto()) this.gravacao.salvar(this.preenchimento);
  }

  protected enviar(): void {
    // O botão fica indisponível com pendência; a guarda cobre a chamada que não vem dele.
    if (this.preenchimento.pronto() && this.motivoDoEnvioBloqueado() === null)
      this.gravacao.enviar(this.preenchimento);
  }

  /** O campo só existe depois de o passo aparecer: a escolha do foco espera por ele. */
  private irAoCampoRecusado(primeiraRecusada: boolean): void {
    this.irAoPassoDoCurso(() => this.cursoDaTela()?.campoRecusado(primeiraRecusada) ?? null);
  }

  /** O passo do curso é do primeiro formulário. */
  private irAoPassoDoCurso(foco: () => HTMLElement | null): void {
    const primeiro = this.leitura.formularios()[0]?.formulario.codigo;
    if (primeiro === undefined) return;
    this.preenchimento.irAoFormulario(primeiro, (formulario) =>
      formulario.navegacao.irAoPasso(PASSO_DO_CURSO, foco),
    );
  }
}
