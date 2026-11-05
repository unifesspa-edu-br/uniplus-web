import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  Injector,
  inject,
  input,
  linkedSignal,
  output,
  type OutputEmitterRef,
  untracked,
  viewChild,
} from '@angular/core';

import { AlertComponent } from '../alert/alert';
import { NomesDeMunicipios } from '../editor-de-condicoes/valor-de-municipio';
import {
  type DocumentoExigido,
  ListaDeDocumentosComponent,
} from '../lista-de-documentos/lista-de-documentos';
import { StepsResponsivoComponent } from '../steps-responsivo/steps-responsivo.component';
import { StepsComponent } from '../steps/steps.component';
import { anunciarCampos, type CamposDoPasso, camposDoPasso } from './anuncios-do-formulario';
import { CampoDoCandidatoComponent } from './campo-do-candidato';
import { avaliarConfirmacoes } from './confirmacao-do-campo';
import {
  ConferenciaDasSecoes,
  type PendenciaDaSecao,
  type AvisosDaTela,
} from './conferencia-das-secoes';
import { DocumentosDaInscricaoComponent } from './documentos-da-inscricao';
import { type EnvioDeDocumentos } from './envio-de-documentos';
import { FatorDeAtenuacaoDaInscricaoComponent } from './fator-de-atenuacao-da-inscricao';
import {
  BLOCO_COMPROVACAO_DOCUMENTAL,
  BLOCO_MODALIDADES_CALCULADAS,
  BLOCO_REVISAO_E_ACEITE,
  type ErroDoServidor,
  type FormularioDoCandidato,
  mensagemDosErros,
  type PassoPrefixado,
  type RespostaFixa,
} from './formulario-do-candidato.model';
import { GrupoDoCandidatoComponent } from './grupo-do-candidato';
import { lerEnvio } from './interpretador/interpretador';
import type {
  EnvioDasRespostas,
  SimulacaoDoFormulario,
  ValorJson,
} from './interpretador/regras-do-formulario';
import { type AvaliacaoNaTela } from './modalidades-avaliadas';
import { ModalidadesDaInscricaoComponent } from './modalidades-da-inscricao';
import { RecusasVigentes } from './recusas-vigentes';
import { InterpretacaoDasRespostas } from './interpretacao-das-respostas';
import { RevisaoDoFormulario } from './revisao-do-formulario';
import { DecisoesDaAvaliacao } from './decisoes-da-avaliacao';
import { IndicadorDosPassos } from './indicador-dos-passos';
import { NavegacaoDosPassos } from './navegacao-dos-passos';
import { type CampoNoPasso, type PassoDoFormulario } from './passos-do-formulario';
import { tituloDasRecusas } from './recusas-do-servidor';
import { fatoDaUf } from './regras-do-campo';
import { RespostasDoFormulario } from './respostas-do-formulario';
import {
  chaveDaResposta,
  type MunicipiosGravados,
  rotuloGravadoDa,
} from './valor-de-municipio-gravado';

export type { PendenciaDaSecao } from './conferencia-das-secoes';

/**
 * O formulário como o candidato o vê, seção a seção, interpretando as regras que a API publica: o que
 * aparece, o que é obrigatório, as opções e as mensagens de cada campo vêm do interpretador, a cada
 * resposta, sem ida à API. Nada é gravado aqui: quem hospeda recebe a simulação a cada mudança e decide
 * o que fazer com ela — conferir com o servidor, exportar, enviar.
 *
 * Avançar dá a seção como concluída, como na inscrição: os obrigatórios sem resposta passam a mostrar a
 * pendência e os opcionais em branco passam a valer como não informados. É o mesmo formulário da
 * simulação e da inscrição do candidato.
 */
@Component({
  selector: 'ui-formulario-do-candidato',
  standalone: true,
  imports: [
    AlertComponent,
    CampoDoCandidatoComponent,
    DocumentosDaInscricaoComponent,
    GrupoDoCandidatoComponent,
    ListaDeDocumentosComponent,
    ModalidadesDaInscricaoComponent,
    FatorDeAtenuacaoDaInscricaoComponent,
    StepsComponent,
    StepsResponsivoComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './formulario-do-candidato.html',
})
export class FormularioDoCandidatoComponent implements AvisosDaTela {
  private readonly injector = inject(Injector);
  private readonly municipios = inject(NomesDeMunicipios);
  private readonly elemento = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly titulo = viewChild<ElementRef<HTMLElement>>('titulo');

  readonly formulario = input.required<FormularioDoCandidato>();
  /** As respostas de partida, como as de um caso importado; recomeça quando muda. */
  readonly inicial = input<SimulacaoDoFormulario | null>(null);
  /** Os fatos que vêm de fora do formulário — respostas de outro formulário, valores calculados. */
  readonly pressupostos = input<Readonly<Record<string, ValorJson>>>({});
  /** O nome que ficou gravado de cada município da inscrição enviada; vale enquanto o código for o gravado. */
  readonly municipiosGravados = input<MunicipiosGravados>({});
  /**
   * A lista do bloco de comprovação documental, como o certame a publica; nula quando quem hospeda não a
   * tem. Com avaliação, o bloco mostra os documentos que ela calcula.
   */
  readonly documentos = input<readonly DocumentoExigido[] | null>(null);
  /** O que o bloco de comprovação documental diz quando a lista é vazia. */
  readonly semDocumentos = input('Nenhum documento é exigido nesta fase.');
  /**
   * Como o candidato envia os arquivos dos documentos exigidos; nulo, o bloco só lista, como na
   * simulação do administrador.
   */
  readonly envioDeDocumentos = input<EnvioDeDocumentos | null>(null);
  /** Enviar arquivo vale enquanto a inscrição não está sendo enviada, inclusive na correção. */
  readonly podeEnviarDocumentos = input(true);
  /** Remover arquivo só vale enquanto a inscrição é rascunho. */
  readonly podeRemoverDocumentos = input(true);
  /** As ocorrências de grupo que a inscrição gravada já tem; nulo, toda ocorrência vale. */
  readonly ocorrenciasGravadas = input<ReadonlySet<string> | null>(null);
  readonly idBase = input<string>('formulario-candidato');
  /** Os termos já aceitos, pelo código, como os de uma inscrição retomada; recomeçam com a partida. */
  readonly termosAceitosIniciais = input<readonly string[]>([]);
  /** As respostas que o candidato não altera, pelo fato. Entram na simulação e o campo só as mostra. */
  readonly respostasFixas = input<Readonly<Partial<Record<string, RespostaFixa>>>>({});
  /**
   * As recusas do servidor. Cada uma aparece ao lado do que recusou e some quando o candidato o muda;
   * uma lista nova leva à seção da primeira e põe o foco nela.
   */
  readonly errosDoServidor = input<readonly ErroDoServidor[]>([]);
  /**
   * A chave do passo prefixado em que quem hospeda já apontou a recusa que lhe cabe. Com ela, uma lista
   * nova de recusas não leva o candidato ao primeiro campo recusado: quem hospeda o levou ao passo.
   */
  readonly passoDaRecusa = input<string | null>(null);
  /**
   * Se a última seção tem o botão que a conclui. Quem hospeda uma ação final própria, como o envio da
   * inscrição, o desliga e chama `concluirTodas()` nela.
   */
  readonly concluirNaUltimaSecao = input(true);
  /**
   * Se avançar exige a seção atual sem pendência: com pendência, o candidato fica onde está, com o
   * foco na primeira. Voltar é sempre livre. A simulação do administrador deixa desligado.
   */
  readonly exigirSecaoValida = input(false);
  /**
   * O envio contra o qual contam os limites de data: o instante que quem hospeda considera e o fuso
   * que o formulário publica. Sem ele, o limite contado do envio fica indeterminado.
   */
  readonly envio = input<EnvioDasRespostas | null>(null);
  /**
   * O que a API calculou das respostas (ADR-0143). Nula, o bloco de modalidades só explica o cálculo —
   * como no simulador, que não consulta a API. Sem derivação, o bloco de modalidades não aparece.
   */
  readonly avaliacao = input<AvaliacaoNaTela | null>(null);
  /**
   * Passos que o formulário não conhece e quem hospeda preenche, antes das seções, como a escolha do
   * curso. O conteúdo de cada um é projetado quando ele é o atual (`passoPrefixadoAtual()` diz qual);
   * a conclusão, o erro e o resumo da Revisão vêm de quem hospeda.
   */
  readonly passosPrefixados = input<readonly PassoPrefixado[]>([]);
  /**
   * Como os passos se apresentam: `chips`, em linha, ou `lateral`, a coluna do assistente — que em
   * tela estreita vira a barra da seção atual e o diálogo com a lista.
   */
  readonly apresentacaoDosPassos = input<'chips' | 'lateral'>('chips');

  /** A simulação a cada mudança: as respostas, as ocorrências, as seções concluídas e os pressupostos. */
  readonly simulacaoChange = output<SimulacaoDoFormulario>();
  /** O avanço que o passo prefixado, ainda não concluído, barrou: quem hospeda o leva ao que falta. */
  readonly avancoBarrado = output<string>();
  /** As pendências por seção a cada mudança, para quem hospeda dizer por que o envio ainda não segue. */
  readonly pendenciasChange = output<readonly PendenciaDaSecao[]>();
  /** Os termos aceitos, pelo código, a cada mudança. */
  readonly termosAceitosChange = output<readonly string[]>();
  /** O candidato pediu para calcular de novo a avaliação depois de uma falha. */
  readonly tentarAvaliarDeNovo = output<void>();

  protected readonly BLOCO_MODALIDADES_CALCULADAS = BLOCO_MODALIDADES_CALCULADAS;
  protected readonly BLOCO_COMPROVACAO_DOCUMENTAL = BLOCO_COMPROVACAO_DOCUMENTAL;
  protected readonly BLOCO_REVISAO_E_ACEITE = BLOCO_REVISAO_E_ACEITE;
  protected readonly mensagemDosErros = mensagemDosErros;
  protected readonly tituloDasRecusas = tituloDasRecusas;

  protected readonly partida = computed(() => ({
    formulario: this.formulario(),
    inicial: this.inicial(),
    termosAceitos: this.termosAceitosIniciais(),
  }));
  protected readonly dados = new RespostasDoFormulario({
    partida: this.partida,
    inicial: this.inicial,
    termosAceitosIniciais: this.termosAceitosIniciais,
    errosDoServidor: this.errosDoServidor,
    respostasFixas: this.respostasFixas,
  });
  private readonly interpretacao = new InterpretacaoDasRespostas({
    formulario: this.formulario,
    simulacao: () => this.simulacao(),
    concluidas: () => this.navegacao.concluidas(),
    respostasFixas: this.respostasFixas,
    semDerivacao: () => this.avaliacao()?.modalidades?.derivada === false,
  });
  protected readonly recusa = this.interpretacao.recusa;
  protected readonly passos = this.interpretacao.passos;
  protected readonly navegacao: NavegacaoDosPassos = new NavegacaoDosPassos({
    partida: this.partida,
    inicial: this.inicial,
    passos: () => this.passos(),
    passosPrefixados: this.passosPrefixados,
    injector: this.injector,
    raiz: () => this.elemento.nativeElement,
    titulo: () => this.titulo()?.nativeElement ?? null,
  });
  protected readonly conferencia = new ConferenciaDasSecoes({
    navegacao: this.navegacao,
    respostas: this.dados,
    respostasFixas: this.respostasFixas,
    passos: () => this.passos(),
    passosPrefixados: this.passosPrefixados,
    exigirSecaoValida: this.exigirSecaoValida,
    aguardaVerificacaoDosDocumentos: () => this.aguardaVerificacaoDosDocumentos(),
    problemasDaConfirmacao: () => this.problemasDaConfirmacao(),
    passosComEtapasConcluidas: (etapas) => this.interpretacao.passosComEtapasConcluidas(etapas),
    avisos: this,
  });

  protected readonly lateral = computed(() => this.apresentacaoDosPassos() === 'lateral');
  protected readonly indicador = new IndicadorDosPassos({
    navegacao: this.navegacao,
    passos: () => this.passos(),
    passosPrefixados: this.passosPrefixados,
    comPendencia: () => this.conferencia.chavesComPendencia(),
    comRecusa: (passo) => this.comErro(passo),
  });

  protected readonly revisao = new RevisaoDoFormulario({
    formulario: this.formulario,
    avaliacao: this.avaliacao,
    passos: () => this.passos(),
    passosPrefixados: this.passosPrefixados,
    respostas: this.dados.respostasComAsFixas,
    grupos: this.dados.grupos,
    respostasFixas: this.respostasFixas,
    municipiosGravados: this.municipiosGravados,
    municipios: this.municipios,
    erros: () => this.erros(),
    aceitos: () => this.dados.aceitos(),
    mostraPendencia: (passo) => this.navegacao.mostraPendencia(passo),
  });

  /** Os termos aceitos agora, pelo código — o que se lê para gravar, sem esperar a próxima emissão. */
  readonly termosAceitos = computed<readonly string[]>(() => [...this.dados.aceitos()]);
  readonly pendenciasPorSecao = this.conferencia.pendenciasPorSecao;

  private readonly decisoes = new DecisoesDaAvaliacao({
    avaliacao: this.avaliacao,
    formulario: this.formulario,
    grupos: () => this.dados.grupos(),
  });
  protected readonly documentosDaAvaliacao = this.decisoes.documentosDaAvaliacao;
  protected readonly situacoesDosDocumentos = this.decisoes.situacoes;
  protected readonly arquivosDosDocumentos = this.decisoes.arquivos;
  protected readonly anuncioDaAvaliacao = this.decisoes.anuncio;
  /**
   * Há documento obrigatório com o arquivo em verificação: a inscrição só segue depois do resultado
   * (UNI-REQ-0028). Quem hospeda usa para barrar o envio.
   */
  readonly aguardaVerificacaoDosDocumentos = this.decisoes.aguardaVerificacao;
  /**
   * Algum arquivo da fase, obrigatório ou não, espera o resultado: quem hospeda segue consultando a
   * avaliação enquanto isso, sobre os mesmos documentos que barram o envio.
   */
  readonly haArquivoEmVerificacao = this.decisoes.haArquivoEmVerificacao;

  protected readonly recusas = new RecusasVigentes({
    doServidor: this.errosDoServidor,
    recebidas: this.dados.errosRecebidos,
    decisoes: this.decisoes,
    passoDaRecusa: this.passoDaRecusa,
    irAoCampo: (campo) => this.navegacao.irAoCampo(campo),
  });
  protected readonly erros = this.recusas.erros;

  readonly simulacao = computed<SimulacaoDoFormulario>(() => ({
    respostas: this.dados.respostasComAsFixas(),
    grupos: this.dados.grupos(),
    etapasConcluidas: [...this.navegacao.concluidas()],
    pressupostos: this.pressupostos(),
    envio: this.envio(),
  }));
  /** O dia do envio, que os campos de data usam para dizer os limites; nulo sem envio que valha. */
  protected readonly diaDoEnvio = computed(() => {
    const dia = lerEnvio(this.envio());
    return typeof dia === 'string' ? dia : null;
  });

  /** As confirmações que faltam ou não conferem, pelo código da tela. */
  protected readonly problemasDaConfirmacao = computed(() =>
    avaliarConfirmacoes(this.passos(), this.entradaDasConfirmacoes()),
  );

  /** A chave do passo prefixado em que o candidato está, ou `null` numa seção do formulário. */
  readonly passoPrefixadoAtual = computed(() => this.navegacao.prefixadoAtual()?.chave ?? null);

  protected readonly anuncio = linkedSignal<CamposDoPasso, string>({
    source: computed(() => camposDoPasso(this.navegacao.passoAtual())),
    computation: (atuais, anterior) => (anterior ? anunciarCampos(anterior.source, atuais) : ''),
  });

  constructor() {
    this.emitirAoMudar(this.pendenciasPorSecao, this.pendenciasChange);
    this.emitirAoMudar(this.simulacao, this.simulacaoChange);
    this.emitirAoMudar(this.termosAceitos, this.termosAceitosChange);
  }

  private emitirAoMudar<T>(fonte: () => T, saida: OutputEmitterRef<T>): void {
    effect(() => {
      const valor = fonte();
      untracked(() => saida.emit(valor));
    });
  }

  private entradaDasConfirmacoes(): Parameters<typeof avaliarConfirmacoes>[1] {
    return {
      respostas: this.dados.respostasComAsFixas(),
      grupos: this.dados.grupos(),
      confirmacoes: this.dados.confirmacoes(),
      fixas: this.respostasFixas(),
    };
  }

  protected comErro(passo: PassoDoFormulario): boolean {
    return this.recusas.daSecao(passo) > 0;
  }

  protected alternarAceite(codigo: string, evento: Event): void {
    this.dados.alternarAceite(codigo, (evento.target as HTMLInputElement).checked);
  }

  protected respostaDaUf(campo: CampoNoPasso): ValorJson | undefined {
    const fato = fatoDaUf(campo.regra);
    return fato === null ? undefined : this.dados.respostasComAsFixas()[fato];
  }

  protected rotuloGravado(fato: string): string | null {
    return rotuloGravadoDa(
      this.municipiosGravados(),
      chaveDaResposta(fato),
      this.dados.respostas()[fato],
    );
  }

  /**
   * Leva a um passo pela chave — de quem hospeda ou uma seção — e põe o foco no título dele, ou no
   * elemento que `foco` indicar depois de o passo aparecer.
   */
  irAoPasso(chave: string, foco?: () => HTMLElement | null, depoisDeRenderizar = false): void {
    this.navegacao.irAoPasso(chave, foco, depoisDeRenderizar);
  }

  dizer(texto: string): void {
    this.anuncio();
    this.anuncio.set(texto);
  }

  barrarAvanco(chavePrefixada: string): void {
    this.avancoBarrado.emit(chavePrefixada);
  }

  /**
   * Dá todas as seções como concluídas, como o envio faz, quando nenhuma tem pendência, e devolve
   * quantas pendências há. Com pendência nada é concluído: com `navegar`, leva à seção da primeira, põe
   * o foco no campo e anuncia quantas são; sem ele, só conta, e quem hospeda decide para onde levar.
   */
  concluirTodas(navegar = true): number {
    return this.conferencia.concluirTodas(navegar);
  }

  /** Leva à seção e põe o foco no primeiro campo pendente dela; ver `ConferenciaDasSecoes`. */
  irAPendenciaDe(chave: string): void {
    this.conferencia.irAPendenciaDe(chave);
  }
}
