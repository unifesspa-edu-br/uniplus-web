import { computed, Injectable, signal } from '@angular/core';
import { StatusProcesso } from '@uniplus/shared-data/selecao';
import type { DocumentoAPublicarDto, ProcessoSeletivoDto } from '@uniplus/shared-data/selecao';
import type { StepStatus } from '@uniplus/shared-ui/components';
import { ROTULOS_DOS_PASSOS } from './processo-seletivo.data';
import type { RegraDaModalidadeOfertada } from './shared/regras-das-modalidades';
import type { AplicacaoEmAberto } from './passos/formulario/modelo-de-formulario';
import { FalhaDeLeitura, WizardDraft } from './processo-seletivo.models';
import { ClassificacaoNoServidor } from './classificacao-no-servidor';
import {
  hidratarProcesso,
  registrarGravadoLido,
  registrarRegrasDasModalidades,
  registrarVagasGravadas,
} from './leituras-do-servidor';
import { concorrenciaDuplaAplicavel, modalidadesDasOfertas } from './modalidades-do-processo';
import { rascunhoInicial } from './rascunho-inicial';
import { motivoDeSomenteLeitura } from './somente-leitura';

const INDICE_DO_CRONOGRAMA = ROTULOS_DOS_PASSOS.indexOf('Cronograma');

@Injectable()
export class ProcessoSeletivoStore {
  readonly totalDePassos = ROTULOS_DOS_PASSOS.length;
  readonly labels = ROTULOS_DOS_PASSOS;
  readonly passoAtual = signal(0);
  readonly passosVisitados = signal<ReadonlySet<number>>(new Set([0]));
  readonly passosConcluidos = signal<ReadonlySet<number>>(new Set());
  readonly draft = signal<WizardDraft>(rascunhoInicial());
  /** Mensagens de validação do step ativo. `null` indica sem erro. */
  readonly erroDoPasso = signal<string[] | null>(null);
  /**
   * Id do Processo Seletivo já criado na API. `null` enquanto o cadastro
   * inicial não foi persistido.
   */
  readonly processoSeletivoId = signal<string | null>(null);
  /** Mutação em curso — usado para impedir disparo duplo e travar a navegação. */
  readonly salvando = signal(false);
  /**
   * Trava adicional a `salvando()`, para uma orquestração que grava MAIS de
   * um passo em sequência (hoje só `ProcessoSeletivoPage.publicar()`: grava
   * os passos anteriores, recarrega o checklist da Revisão, valida de
   * novo). Cada `persistir()` individual já solta `salvando` no próprio
   * `finally` assim que a PRÓPRIA chamada termina — mas a orquestração
   * inteira ainda não acabou, e o intervalo entre um passo terminar e o
   * próximo começar (ou entre o último passo e a recarga que vem depois)
   * liberava o stepper e os campos por um instante real, não um microtask:
   * o operador podia navegar, editar, e voltar antes da recarga concluir, e
   * a confirmação seguinte comparava contra um checklist que já não
   * descrevia o rascunho atual. Ver `operacaoEmAndamento`.
   */
  readonly travamentoDeOrquestracao = signal(false);
  /**
   * Uma criação ficou sem resposta definitiva (rede ou 5xx): o servidor pode
   * tê-la executado. A retentativa repete o mesmo comando, então alterar o
   * rascunho agora só faria a tela divergir do que existe no servidor.
   */
  readonly criacaoIndefinida = signal(false);

  /**
   * Detalhe canônico como o servidor o devolveu, preservado **inteiro**
   * (Story #478, CA-05). O rascunho é buffer de edição e só carrega as
   * dimensões que já têm tela; as demais — etapas, distribuição de vagas,
   * cronograma, atendimento e as outras — vivem aqui até a Story que as
   * implementa estender o adaptador. Guardar só o que o wizard sabe editar
   * perderia silenciosamente o resto do agregado.
   */
  readonly remoteSnapshot = signal<ProcessoSeletivoDto | null>(null);
  /**
   * As modalidades ofertadas com a regra de aplicabilidade que o servidor congelou ao gravar o
   * quadro de vagas. Acompanha cada leitura do servidor, inclusive a que segue a gravação do
   * quadro, que não mexe no `remoteSnapshot`.
   */
  readonly regrasDasModalidades = signal<readonly RegraDaModalidadeOfertada[]>([]);

  /**
   * O número de opções de curso como o servidor o tem, na leitura mais recente do processo. Dele
   * sai a ordem das gravações do passo Vagas: o servidor recusa a distribuição com menos ofertas
   * que o número gravado. `null` é "nunca declarado".
   */
  readonly opcoesDeCursoGravadas = signal<number | null>(null);
  /** Uma gravação ficou sem resposta conclusiva: o que o servidor tem só uma releitura diz. */
  readonly vagasGravadasDefasadas = signal(false);

  /** Leitura do detalhe em curso — a tela não mostra wizard nem erro ainda. */
  readonly hidratando = signal(false);

  /**
   * A leitura por URL falhou. `motivo` decide o que a tela oferece: um id que
   * não corresponde a processo algum não tem retentativa útil, uma falha de
   * rede tem. Em nenhum caso vira rascunho vazio (CA-08) — abrir um cadastro
   * novo sob o id de outro processo é pior do que não abrir nada.
   */
  readonly falhaDeLeitura = signal<FalhaDeLeitura | null>(null);

  /**
   * Documentos do edital confirmados quando há mais de um (CA-06). O wizard
   * não elege o oficial: fica vazio enquanto o administrador não decide, e a
   * decisão zera a lista.
   */
  /**
   * Os campos que ESTA sessão acrescentou ao formulário por causa de uma exigência — memória de
   * quem entrou sozinho, e por isso pode sair sozinho quando a exigência que o pediu deixar de
   * existir. Campo declarado à mão, ou vindo da configuração gravada, nunca entra aqui.
   *
   * Vive no store porque dois passos acrescentam: o formulário, ao reconciliar, e o cronograma,
   * ao gravar um gatilho que pressupõe um dado. Guardada só no formulário, a que o cronograma
   * punha ficava sem dono — o campo sobrevivia à remoção do gatilho, e a inscrição seguia
   * coletando dado pessoal sem finalidade declarada.
   */
  readonly camposPostosPelasExigencias = signal<ReadonlySet<string>>(new Set());

  /**
   * As aplicações de modelo sem desfecho conhecido, por finalidade. O rascunho ainda é o de antes:
   * gravá-lo passaria por cima da cópia. Fica no store para sobreviver à troca de passo.
   */
  readonly aplicacoesDeModeloEmAberto = signal<ReadonlyMap<string, AplicacaoEmAberto>>(new Map());

  readonly documentosParaEscolha = signal<readonly DocumentoAPublicarDto[]>([]);

  /**
   * A leitura dos documentos falhou, mas o processo foi lido: o editor segue
   * utilizável. O aviso precisa chegar ao passo de identificação — sem ele, um
   * controle de upload vazio faz o operador concluir que não há edital anexado
   * e enviar outro, criando um segundo documento imutável.
   */
  readonly avisoDocumentos = signal<string | null>(null);

  readonly classificacao = new ClassificacaoNoServidor();

  /**
   * Muda sempre que o editor passa a tratar de outro processo — por limpeza ou
   * por hidratação de um id diferente.
   *
   * A página do editor sobrevive à troca de endereço (as duas rotas declaram a
   * mesma `reuseKey`), e com ela sobrevivem os componentes de passo e as
   * operações que eles deixaram em voo. Um upload ou uma releitura de
   * documentos disparados para o processo anterior ainda respondem, e sem esta
   * marca escreveriam no processo que está em tela agora — vinculando a ele um
   * edital que é de outro. Quem faz trabalho assíncrono captura a geração antes
   * e descarta o resultado se ela tiver mudado.
   */
  readonly geracao = signal(0);

  /**
   * Depois de criado, os dados que compuseram o comando de criação não podem
   * mais ser alterados: o contrato não expõe atualização de identificação e a
   * unidade administradora é imutável no agregado por definição. Vale também
   * enquanto uma criação inconclusiva aguarda retentativa — inclusive para o
   * tipo, escolhido no passo 1.
   */
  readonly cadastroInicialCongelado = computed(
    () => this.processoSeletivoId() !== null || this.salvando() || this.criacaoIndefinida(),
  );

  /**
   * `true` entre um `POST …/publicacao` que devolveu `204` e a releitura de
   * `GET /{id}` que confirmaria o novo status — quando essa releitura falha
   * (rede, 5xx transitório), a publicação já pode ter acontecido de forma
   * irreversível no servidor, mas `remoteSnapshot()` ainda mostra o status
   * antigo. Sem este sinal, `edicaoPermitida()` confiaria nesse status
   * desatualizado e destravaria a edição sobre um processo possivelmente já
   * publicado. `hidratar()` é quem limpa: qualquer
   * releitura que chegue ao fim traz verdade nova o bastante para o status
   * decidir sozinho de novo.
   */
  readonly publicacaoNaoConfirmada = signal(false);

  /**
   * Código canônico da fase que o passo Cronograma deve abrir ao ser mostrado — o destino de
   * quem chega de uma recusa que cita a fase. O Cronograma o consome e o limpa.
   */
  readonly faseEmFoco = signal<string | null>(null);

  readonly cronogramaVisivel = computed(() => this.passoAtual() === INDICE_DO_CRONOGRAMA);

  /** Leva ao passo Cronograma já na fase citada. */
  irParaFase(codigo: string): void {
    if (this.operacaoEmAndamento()) return;
    this.faseEmFoco.set(codigo);
    this.goTo(INDICE_DO_CRONOGRAMA);
  }

  /**
   * `ProcessoSeletivo.MutacaoPermitida` também aceita processo publicado com
   * retificação aberta, mas o detalhe não expõe a sessão editorial e a
   * retificação ainda não tem tela — daí a allowlist de um status só, que
   * também impede um status novo de abrir a edição por omissão.
   *
   * Sem detalhe nada é bloqueado: processo em criação ainda não tem status.
   */
  readonly edicaoPermitida = computed(() => {
    if (this.publicacaoNaoConfirmada()) return false;
    const detalhe = this.remoteSnapshot();
    return detalhe === null || detalhe.status === StatusProcesso.rascunho;
  });

  /**
   * O processo não admite mutação, e os passos mostram o que está gravado como texto, não
   * como formulário desabilitado. A gravação em curso não entra aqui: os campos continuam
   * campos enquanto ela termina, só não aceitam digitação (`aceitaEdicao`).
   */
  readonly emConsulta = computed(() => !this.edicaoPermitida());

  /** `salvando()` OU uma orquestração de vários passos em curso — ver `travamentoDeOrquestracao`. */
  readonly operacaoEmAndamento = computed(() => this.salvando() || this.travamentoDeOrquestracao());

  /**
   * Um passo aceita digitação quando o processo admite mutação e nenhuma
   * gravação está em curso — alterar durante o comando faria o rascunho
   * divergir do que o servidor recebeu. São duas razões para o mesmo efeito,
   * resolvidas aqui para que nenhum passo repita a conjunção.
   */
  readonly aceitaEdicao = computed(() => this.edicaoPermitida() && !this.operacaoEmAndamento());

  readonly motivoDeSomenteLeitura = computed(() =>
    motivoDeSomenteLeitura(this.remoteSnapshot()?.status, this.publicacaoNaoConfirmada()),
  );

  readonly modalidadesDoProcesso = computed(() => modalidadesDasOfertas(this.draft()));

  readonly concorrenciaDuplaAplicavel = computed(() =>
    concorrenciaDuplaAplicavel(this.modalidadesDoProcesso()),
  );

  readonly currentLabel = computed(() => this.labels[this.passoAtual()]);
  readonly currentMeta = computed(() => {
    const index = this.passoAtual();
    return `Etapa ${index + 1} de ${this.totalDePassos} (${String(index + 1).padStart(2, '0')} ${this.labels[index]})`;
  });
  readonly progress = computed(() => ((this.passoAtual() + 1) / this.totalDePassos) * 100);
  readonly isFirst = computed(() => this.passoAtual() === 0);
  readonly isLast = computed(() => this.passoAtual() === this.totalDePassos - 1);

  goTo(index: number): void {
    // Trocar de passo durante a gravação faria o avanço partir do índice novo:
    // o comando conclui e o `next()` seguinte marca como concluído um passo que
    // ninguém preencheu. `operacaoEmAndamento()`, não só `salvando()`: uma
    // orquestração de vários passos (`publicar()`) também precisa travar a
    // navegação pela janela inteira, não só enquanto CADA passo individual
    // está com sua própria chamada em voo.
    if (this.operacaoEmAndamento()) return;

    if (index < 0 || index >= this.totalDePassos) return;
    this.passoAtual.set(index);
    this.passosVisitados.update((current) => new Set(current).add(index));
  }

  next(): boolean {
    if (this.erroDoPasso()) return false;
    const current = this.passoAtual();
    if (current >= this.totalDePassos - 1) return false;
    this.passosConcluidos.update((steps) => new Set(steps).add(current));
    this.goTo(current + 1);
    return true;
  }

  /** Define as mensagens de erro do step ativo (null limpa). */
  definirErroDoPasso(messages: string[] | null): void {
    this.erroDoPasso.set(messages);
  }

  /**
   * Substitui o conjunto de passos concluídos pelo resultado de uma validação
   * completa do rascunho. Como a navegação é livre, um passo pode ter sido
   * concluído e depois invalidado — ou preenchido sem nunca passar por
   * "Próximo" —, e só a validação de todos reconcilia o progresso exibido.
   */
  syncCompleted(completed: Iterable<number>): void {
    this.passosConcluidos.set(new Set(completed));
  }

  previous(): void {
    this.goTo(this.passoAtual() - 1);
  }

  status(index: number): StepStatus {
    if (index === this.passoAtual()) return 'active';
    if (this.passosConcluidos().has(index)) return 'done';
    if (this.passosVisitados().has(index)) return 'pending';
    return 'unvisited';
  }

  /**
   * Edição do rascunho pelos passos. Fora de rascunho o servidor recusa
   * qualquer gravação, e deixar o rascunho local mudar assim mesmo faria a
   * revisão exibir valores que o avanço descarta — a tela passaria a descrever
   * um processo que não existe.
   *
   * A hidratação não passa por aqui: ela projeta o que o servidor devolveu, e
   * é o que precisa continuar chegando em qualquer status.
   */
  patchSection<K extends keyof WizardDraft>(section: K, value: WizardDraft[K]): void {
    if (!this.edicaoPermitida()) return;
    this.draft.update((draft) => ({ ...draft, [section]: value }));
  }

  /** Ver `patchSection` quanto ao bloqueio fora de rascunho. */
  patchObjectSection<K extends keyof WizardDraft>(
    section: K,
    patch: Partial<WizardDraft[K]>,
  ): void {
    if (!this.edicaoPermitida()) return;
    this.aplicarPatch(section, patch);
  }

  /**
   * Projeta no rascunho o que veio do servidor. Não passa pelo bloqueio de
   * edição: o que o servidor devolve descreve o processo, e é o que precisa
   * continuar chegando quando ele está apenas para consulta. Sem esta
   * separação, um processo publicado com edital confirmado anunciaria
   * "nenhum arquivo adicionado" e perderia a ação de abrir o edital.
   *
   * Vale também para a escolha entre documentos confirmados: ela decide qual
   * documento a tela apresenta, não altera nada no servidor.
   */
  projetarSecao<K extends keyof WizardDraft>(section: K, patch: Partial<WizardDraft[K]>): void {
    this.aplicarPatch(section, patch);
  }

  private aplicarPatch<K extends keyof WizardDraft>(
    section: K,
    patch: Partial<WizardDraft[K]>,
  ): void {
    const current = this.draft()[section];
    if (Array.isArray(current) || typeof current !== 'object' || current === null) {
      throw new Error(`A seção ${String(section)} não aceita patch de objeto.`);
    }
    this.draft.update((draft) => ({
      ...draft,
      [section]: { ...(draft[section] as object), ...patch },
    }));
  }

  reset(): void {
    this.passoAtual.set(0);
    this.passosVisitados.set(new Set([0]));
    this.passosConcluidos.set(new Set());
    this.draft.set(rascunhoInicial());
    this.erroDoPasso.set(null);
    this.processoSeletivoId.set(null);
    this.salvando.set(false);
    this.travamentoDeOrquestracao.set(false);
    this.criacaoIndefinida.set(false);
    this.publicacaoNaoConfirmada.set(false);
    this.remoteSnapshot.set(null);
    this.regrasDasModalidades.set([]);
    this.opcoesDeCursoGravadas.set(null);
    this.vagasGravadasDefasadas.set(false);
    this.hidratando.set(false);
    this.falhaDeLeitura.set(null);
    this.documentosParaEscolha.set([]);
    this.camposPostosPelasExigencias.set(new Set());
    this.aplicacoesDeModeloEmAberto.set(new Map());
    this.avisoDocumentos.set(null);
    this.classificacao.reiniciar();
    this.geracao.update((valor) => valor + 1);
  }

  hidratar(dto: ProcessoSeletivoDto): void {
    hidratarProcesso(this, dto);
  }

  registrarGravadoLido(dto: ProcessoSeletivoDto): void {
    registrarGravadoLido(this, dto);
  }

  registrarVagasGravadas(dto: ProcessoSeletivoDto): void {
    registrarVagasGravadas(this, dto);
  }

  registrarRegrasDasModalidades(dto: ProcessoSeletivoDto): void {
    registrarRegrasDasModalidades(this, dto);
  }
}
