import { computed, Injectable, signal } from '@angular/core';
import { StatusProcesso } from '@uniplus/shared-data/selecao';
import type { DocumentoEditalDto, ProcessoSeletivoDto } from '@uniplus/shared-data/selecao';
import { STEP_LABELS } from './processo-seletivo.data';
import { exigenciasVazias } from './shared/exigencias-documentais';
import { desempateDe, hidratarDraft } from './shared/hidratacao';
import type { MotivoDaReleitura } from './shared/motivo-da-releitura';
import {
  mesmoQuadro,
  quadroCongelado,
  type CopiaCongelada,
  type GrupoDoQuadro,
} from './shared/quadro-de-pesos';
import {
  CriterioDesempateConfigurado,
  ExigenciasDoRascunho,
  FalhaDeLeitura,
  StepStatus,
  WizardDraft,
} from './processo-seletivo.models';

/**
 * O rascunho nasce sem documento nenhum: quais existem é o cadastro de Configuração que
 * diz, e ele cresce sem deploy. Semear a partir de uma lista local fazia o rascunho
 * carregar entradas de documentos que ninguém marcou — e envelhecer junto com a lista.
 */
function initialDocumentos(): ExigenciasDoRascunho {
  return exigenciasVazias();
}

const INITIAL_DRAFT: WizardDraft = {
  // Desmarcado por padrão — o usuário DEVE escolher um tipo no step-01.
  tipoProcesso: { selected: '', rotulo: '' },
  // Todos os campos do Passo 2 começam vazios para obrigar o preenchimento.
  identificacao: {
    nome: '',
    identificadorLegivel: '',
    unidadeAdministradoraId: '',
    origemCandidatos: '',
    localidade: null,
    uploads: [],
  },
  pagamento: { cobra: null, valor: '', fundamentos: [] },
  vagas: { ofertas: [], cascata: null },
  // Cronograma e etapas nascem vazios: quais fases o certame tem é decisão de
  // quem configura, e processo com classificação importada não tem etapa
  // pontuada. Semear qualquer um dos dois inventaria configuração que ninguém
  // declarou, e a etapa fictícia ainda faria o processo novo nascer com uma
  // linha que o operador não pediu.
  cronograma: { fases: [], etapas: [], algoritmoContagemCodigo: '', algoritmoContagemVersao: '' },
  // Classificação começa vazia — o usuário DEVE escolher a regra de cálculo
  // no passo de Fórmula antes de a Eliminação poder gravar.
  classificacao: {
    regraCalculoCodigo: '',
    regraCalculoVersao: '',
    regraArredondamentoCodigo: '',
    regraArredondamentoVersao: '',
    casasArredondamento: '',
    regraOrdemAlocacaoCodigo: '',
    regraOrdemAlocacaoVersao: '',
    nOpcoesAlocacao: '',
    baseadoEmEnem: false,
    resolucaoPesoAreaEnem: '',
    regrasEliminacao: [],
  },
  bonus: {
    ativo: false,
    regraCodigo: '',
    regraVersao: '',
    fator: '',
    teto: '',
    baseLegalBonusRegionalId: '',
  },
  desempate: [],
  documentos: initialDocumentos(),
  // O formulário nasce vazio: título, termo e campos são declaração do certame, e semear
  // qualquer coisa aqui poria no formulário do candidato um campo que ninguém escolheu.
  formulario: {
    titulo: '',
    termoAceiteTexto: '',
    fatos: [],
    referenciaTemporal: { tipo: '', data: '', faseCodigo: '' },
    derivacao: [],
  },
  atendimento: { condicoes: [], recursos: [], tiposDeficiencia: [] },
  publicacao: {
    numero: '',
    periodoInscricaoInicio: '',
    periodoInscricaoFim: '',
    ato: { orgao: '', serie: '', ano: '', dataPublicacao: '', assinante: '', tipoAtoCodigo: '' },
  },
};

/**
 * O que se sabe da classificação que o processo tem no servidor. `desconhecida` depois de uma
 * gravação sem resposta conclusiva, ou de uma gravação que deu certo com a resolução sem o
 * cadastro de Peso por Área lido, que não diz o que foi copiado: o servidor pode ter qualquer das
 * outras, e só uma releitura decide. O servidor só conta como quadro o que tem ao menos um grupo.
 *
 * `com-quadro` sem `confirmada` é a cópia que a gravação que deu certo presume: o quadro do
 * cadastro lido pelo cliente. O servidor copia o cadastro dele no momento da gravação, que pode ser
 * mais novo, e só a releitura confirma o que ficou congelado.
 */
export type ClassificacaoGravada =
  | { readonly estado: 'nunca-gravada' }
  | { readonly estado: 'sem-quadro' }
  | {
      readonly estado: 'com-quadro';
      readonly resolucao: string;
      readonly grupos: readonly GrupoDoQuadro[];
      readonly confirmada: boolean;
    }
  | { readonly estado: 'desconhecida' };

@Injectable()
export class ProcessoSeletivoStore {
  readonly totalSteps = STEP_LABELS.length;
  readonly labels = STEP_LABELS;
  readonly currentStep = signal(0);
  readonly visitedSteps = signal<ReadonlySet<number>>(new Set([0]));
  readonly completedSteps = signal<ReadonlySet<number>>(new Set());
  readonly draft = signal<WizardDraft>(structuredClone(INITIAL_DRAFT));
  /** Mensagens de validação do step ativo. `null` indica sem erro. */
  readonly stepError = signal<string[] | null>(null);
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
   * descrevia o rascunho atual (achado do Codex na #486, P1 — a mesma
   * "estado intermediário tratado como final" que já apareceu três vezes
   * nesta frente, agora na janela assíncrona ENTRE passos, não dentro de
   * um só). Ver `operacaoEmAndamento`.
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

  readonly documentosParaEscolha = signal<readonly DocumentoEditalDto[]>([]);

  /**
   * A leitura dos documentos falhou, mas o processo foi lido: o editor segue
   * utilizável. O aviso precisa chegar ao passo de identificação — sem ele, um
   * controle de upload vazio faz o operador concluir que não há edital anexado
   * e enviar outro, criando um segundo documento imutável.
   */
  readonly avisoDocumentos = signal<string | null>(null);

  /**
   * Recusa do servidor ao campo `resolucaoPesoAreaEnem`, na última gravação da classificação.
   *
   * Vive no store porque quem grava a classificação é a Eliminação, e o campo é do passo da
   * fórmula: sem um lugar comum, o operador voltava à fórmula e não via ali o que o servidor
   * recusou. Some quando a resolução muda ou deixa de ser exigida, quando o cadastro é relido e
   * quando a gravação seguinte dá certo. Uma recusa de outro campo não a apaga: o servidor pode
   * ter recusado antes de julgar a resolução.
   */
  readonly recusaDaResolucaoPesoAreaEnem = signal<string | null>(null);

  /**
   * Recusa do servidor à gravação da classificação por um critério de desempate já gravado que
   * compara a nota de área do ENEM, mostrada, como a da resolução, sob o campo do passo da
   * fórmula. Some quando a resolução muda ou deixa de ser exigida e quando a gravação seguinte da
   * classificação dá certo; depois de gravar o desempate ou de reler o cadastro, só quando a
   * conferência dos critérios gravados contra o rascunho da classificação e o cadastro lido
   * mostra que a pendência acabou — com os critérios gravados desconhecidos, ela fica.
   */
  readonly recusaPeloDesempatePorArea = signal<string | null>(null);

  /**
   * A leitura do cadastro de Peso por Área em mãos quando o servidor recusou pelo desempate. O
   * servidor julgou pelo cadastro dele: só uma leitura posterior a esta pode dizer que a área que
   * ele recusou passou a valer.
   */
  readonly leituraDoCadastroNaRecusaPeloDesempate = signal(0);

  /** Os critérios gravados que o servidor julgou ao recusar pelo desempate. */
  readonly criteriosNaRecusaPeloDesempate = signal<readonly CriterioDesempateConfigurado[] | null>(
    null,
  );

  recusarPeloDesempate(recusa: string | null, leituraDoCadastro: number): void {
    this.recusaPeloDesempatePorArea.set(recusa);
    this.leituraDoCadastroNaRecusaPeloDesempate.set(leituraDoCadastro);
    this.criteriosNaRecusaPeloDesempate.set(this.criteriosDesempateGravados());
  }

  /** A resolução mudou, deixou de ser exigida ou foi gravada: as recusas eram sobre a de antes. */
  descartarRecusasDaClassificacao(): void {
    this.recusaDaResolucaoPesoAreaEnem.set(null);
    this.recusaPeloDesempatePorArea.set(null);
  }

  readonly classificacaoGravada = signal<ClassificacaoGravada>({ estado: 'nunca-gravada' });

  readonly motivoDaReleituraDaClassificacao = computed(() =>
    motivoDaReleitura(this.classificacaoGravada()),
  );

  readonly classificacaoPorReler = computed(() => this.motivoDaReleituraDaClassificacao() !== null);

  /** O quadro que o processo congelou, quando se sabe que ele tem um e quais são os valores. */
  readonly copiaCongeladaEmVigor = computed<CopiaCongelada | null>(() => {
    const gravada = this.classificacaoGravada();
    return gravada.estado === 'com-quadro' && gravada.confirmada
      ? { resolucao: gravada.resolucao, grupos: gravada.grupos }
      : null;
  });

  /**
   * Os critérios de desempate que o servidor tem, pela leitura do processo e pelas gravações desta
   * sessão. É contra eles, e não contra o rascunho, que a gravação da classificação é conferida.
   * `null` depois de uma gravação sem resposta conclusiva: o servidor pode ter gravado, e só ele
   * sabe o que tem.
   */
  readonly criteriosDesempateGravados = signal<readonly CriterioDesempateConfigurado[] | null>([]);

  /**
   * O Desempate deixou os critérios para gravar depois da classificação: o servidor recusa o
   * critério por área enquanto o processo não tem o quadro congelado, e quem o congela é a gravação
   * da classificação, no passo seguinte.
   */
  readonly desempatePendenteDeGravacao = signal(false);

  /** Algo do que o servidor tem só uma releitura do processo diz. */
  readonly gravadoPorReler = computed(
    () => this.classificacaoPorReler() || this.criteriosDesempateGravados() === null,
  );

  /**
   * Muda a cada troca de processo e a cada leitura que muda a classificação conhecida — a que só
   * confirma o que já se sabia não muda. Uma leitura do cadastro de Peso por Área pedida nesta
   * versão, ou depois, é posterior ao que o processo congelou.
   */
  readonly versaoDaClassificacaoLida = signal(0);

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
   * publicado (achado do Codex na #486). `hidratar()` é quem limpa: qualquer
   * releitura que chegue ao fim traz verdade nova o bastante para o status
   * decidir sozinho de novo.
   */
  readonly publicacaoNaoConfirmada = signal(false);

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

  /** `salvando()` OU uma orquestração de vários passos em curso — ver `travamentoDeOrquestracao`. */
  readonly operacaoEmAndamento = computed(() => this.salvando() || this.travamentoDeOrquestracao());

  /**
   * Um passo aceita digitação quando o processo admite mutação e nenhuma
   * gravação está em curso — alterar durante o comando faria o rascunho
   * divergir do que o servidor recebeu. São duas razões para o mesmo efeito,
   * resolvidas aqui para que nenhum passo repita a conjunção.
   */
  readonly aceitaEdicao = computed(() => this.edicaoPermitida() && !this.operacaoEmAndamento());

  /**
   * Por que a configuração está apenas para consulta. O texto acompanha o
   * status: um rascunho cancelado nunca foi publicado e não se corrige por
   * retificação, então prometer esse caminho mandaria o operador a lugar
   * nenhum.
   */
  readonly motivoDeSomenteLeitura = computed(() => {
    if (this.publicacaoNaoConfirmada()) {
      return 'A publicação foi aceita, mas ainda não foi possível confirmar o novo estado do processo. A configuração fica bloqueada até a confirmação ser refeita — recarregue a página.';
    }

    const status = this.remoteSnapshot()?.status;
    if (status === undefined || status === StatusProcesso.rascunho) return null;

    if (status === StatusProcesso.publicado) {
      return 'Este processo já foi publicado. A configuração fica disponível para consulta; alterá-la depende de abrir uma retificação.';
    }

    if (status === StatusProcesso.encerrado || status === StatusProcesso.cancelado) {
      const situacao = status === StatusProcesso.encerrado ? 'encerrado' : 'cancelado';
      return `Este processo está ${situacao} e não aceita alteração. A configuração fica disponível para consulta.`;
    }

    // Status que este cliente não conhece. A allowlist estabelece que não é
    // rascunho, e nada além disso — nomear a situação seria inventá-la.
    return 'Este processo não está em rascunho e não aceita alteração. A configuração fica disponível para consulta.';
  });

  /**
   * Modalidades que o processo aceita: a união do que suas distribuições de
   * vagas selecionam.
   *
   * Não é escolha própria do processo. Modalidade participa da distribuição de
   * cada oferta, e o passo que a declarava globalmente foi removido — ele
   * pedia duas vezes a mesma decisão e não tinha para onde gravar.
   */
  readonly modalidadesDoProcesso = computed<readonly string[]>(() => {
    const codigos = this.draft().vagas.ofertas.flatMap((oferta) =>
      oferta.modalidades.map((modalidade) => modalidade.codigo),
    );
    return [...new Set(codigos)];
  });

  /**
   * Concorrência dupla (Lei 14.723/2023) vale quando o processo oferece cota
   * reservada. É consequência das modalidades, não uma opção: o servidor a
   * computa do mesmo modo em `ConcorrenciaDuplaAplicavel`.
   */
  readonly concorrenciaDuplaAplicavel = computed(() =>
    this.modalidadesDoProcesso().some(
      (codigo) => codigo.startsWith('LB_') || codigo.startsWith('LI_'),
    ),
  );

  readonly currentLabel = computed(() => this.labels[this.currentStep()]);
  readonly currentMeta = computed(() => {
    const index = this.currentStep();
    return `Etapa ${index + 1} de ${this.totalSteps} (${String(index + 1).padStart(2, '0')} ${this.labels[index]})`;
  });
  readonly progress = computed(() => ((this.currentStep() + 1) / this.totalSteps) * 100);
  readonly isFirst = computed(() => this.currentStep() === 0);
  readonly isLast = computed(() => this.currentStep() === this.totalSteps - 1);

  goTo(index: number): void {
    // Trocar de passo durante a gravação faria o avanço partir do índice novo:
    // o comando conclui e o `next()` seguinte marca como concluído um passo que
    // ninguém preencheu. `operacaoEmAndamento()`, não só `salvando()`: uma
    // orquestração de vários passos (`publicar()`) também precisa travar a
    // navegação pela janela inteira, não só enquanto CADA passo individual
    // está com sua própria chamada em voo.
    if (this.operacaoEmAndamento()) return;

    if (index < 0 || index >= this.totalSteps) return;
    this.currentStep.set(index);
    this.visitedSteps.update((current) => new Set(current).add(index));
  }

  next(): boolean {
    if (this.stepError()) return false;
    const current = this.currentStep();
    if (current >= this.totalSteps - 1) return false;
    this.completedSteps.update((steps) => new Set(steps).add(current));
    this.goTo(current + 1);
    return true;
  }

  /** Define as mensagens de erro do step ativo (null limpa). */
  setStepError(messages: string[] | null): void {
    this.stepError.set(messages);
  }

  /**
   * Substitui o conjunto de passos concluídos pelo resultado de uma validação
   * completa do rascunho. Como a navegação é livre, um passo pode ter sido
   * concluído e depois invalidado — ou preenchido sem nunca passar por
   * "Próximo" —, e só a validação de todos reconcilia o progresso exibido.
   */
  syncCompleted(completed: Iterable<number>): void {
    this.completedSteps.set(new Set(completed));
  }

  previous(): void {
    this.goTo(this.currentStep() - 1);
  }

  status(index: number): StepStatus {
    if (index === this.currentStep()) return 'active';
    if (this.completedSteps().has(index)) return 'done';
    if (this.visitedSteps().has(index)) return 'pending';
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
    this.currentStep.set(0);
    this.visitedSteps.set(new Set([0]));
    this.completedSteps.set(new Set());
    this.draft.set(structuredClone(INITIAL_DRAFT));
    this.stepError.set(null);
    this.processoSeletivoId.set(null);
    this.salvando.set(false);
    this.travamentoDeOrquestracao.set(false);
    this.criacaoIndefinida.set(false);
    this.publicacaoNaoConfirmada.set(false);
    this.remoteSnapshot.set(null);
    this.hidratando.set(false);
    this.falhaDeLeitura.set(null);
    this.documentosParaEscolha.set([]);
    this.camposPostosPelasExigencias.set(new Set());
    this.avisoDocumentos.set(null);
    this.recusaDaResolucaoPesoAreaEnem.set(null);
    this.recusaPeloDesempatePorArea.set(null);
    this.classificacaoGravada.set({ estado: 'nunca-gravada' });
    this.criteriosDesempateGravados.set([]);
    this.desempatePendenteDeGravacao.set(false);
    this.versaoDaClassificacaoLida.update((versao) => versao + 1);
    this.geracao.update((valor) => valor + 1);
  }

  /**
   * A classificação do processo, lida do servidor. Só ela: a releitura depois de gravar não pode
   * mexer no `remoteSnapshot`, de que outros passos derivam estado, nem no rascunho, que é o que o
   * operador está editando.
   */
  registrarClassificacaoLida(classificacao: ProcessoSeletivoDto['classificacao']): void {
    const lida = classificacaoGravadaDe(classificacao);
    if (!mesmaClassificacao(this.classificacaoGravada(), lida)) {
      this.versaoDaClassificacaoLida.update((versao) => versao + 1);
    }
    this.classificacaoGravada.set(lida);
  }

  /**
   * A gravação que não envolve resolução nenhuma deixa o processo com uma classificação sem quadro,
   * e não precisa de releitura para sabê-lo. Sem este registro, a tela trataria o processo como sem
   * classificação gravada, e o desempate seria conferido contra o rascunho, não contra o servidor.
   */
  registrarClassificacaoGravadaSemQuadro(): void {
    this.classificacaoGravada.set({ estado: 'sem-quadro' });
  }

  /**
   * A gravação que deu certo com a resolução copiou para o processo o quadro dela no cadastro do
   * servidor. O que o cadastro lido aqui tem é a cópia presumida, por confirmar na releitura.
   */
  registrarClassificacaoGravadaComQuadro(
    resolucao: string,
    grupos: readonly GrupoDoQuadro[],
  ): void {
    this.classificacaoGravada.set({ estado: 'com-quadro', resolucao, grupos, confirmada: false });
  }

  /** A gravação ficou sem resposta conclusiva: o que o processo tem só uma releitura decide. */
  marcarClassificacaoDesconhecida(): void {
    this.classificacaoGravada.set({ estado: 'desconhecida' });
  }

  /**
   * Projeta o detalhe canônico sobre o rascunho (CA-05) e marca o processo
   * como já criado — os campos do comando de identificação ficam bloqueados,
   * exatamente como ficariam depois de uma criação nesta mesma sessão
   * (`cadastroInicialCongelado`), porque o contrato não expõe atualização
   * deles.
   */
  hidratar(dto: ProcessoSeletivoDto): void {
    if (this.processoSeletivoId() !== dto.id) {
      this.geracao.update((valor) => valor + 1);
      this.versaoDaClassificacaoLida.update((versao) => versao + 1);
    }
    // Qualquer releitura que chegue até aqui traz status atual do servidor —
    // resolve a incerteza de `publicacaoNaoConfirmada`, publicado ou não.
    this.publicacaoNaoConfirmada.set(false);
    this.remoteSnapshot.set(dto);
    this.registrarGravadoLido(dto);
    this.processoSeletivoId.set(dto.id);
    this.draft.update((draft) => hidratarDraft(draft, dto));
  }

  /**
   * O que o servidor tem e contra o que as gravações são conferidas: a classificação e os critérios
   * de desempate, lidos do detalhe. Só isso — a releitura depois de gravar não mexe no rascunho.
   */
  registrarGravadoLido(dto: ProcessoSeletivoDto): void {
    this.registrarClassificacaoLida(dto.classificacao);
    this.criteriosDesempateGravados.set(desempateDe(dto));
  }
}

/** A classificação lida sem o quadro fica sem grupo, e não é um erro de leitura. */
function classificacaoGravadaDe(
  classificacao: ProcessoSeletivoDto['classificacao'],
): ClassificacaoGravada {
  if (classificacao === null || classificacao === undefined) return { estado: 'nunca-gravada' };
  const resolucao = classificacao.resolucaoPesoAreaEnem ?? null;
  const grupos = quadroCongelado(classificacao.quadroPesoAreaEnem ?? []);
  return resolucao === null || grupos.length === 0
    ? { estado: 'sem-quadro' }
    : { estado: 'com-quadro', resolucao, grupos, confirmada: true };
}

/** Por que só uma releitura diz o que a classificação gravada tem, ou `null` quando se sabe. */
export function motivoDaReleitura(gravada: ClassificacaoGravada): MotivoDaReleitura | null {
  if (gravada.estado === 'desconhecida') return 'desconhecida';
  return gravada.estado === 'com-quadro' && !gravada.confirmada ? 'por-confirmar' : null;
}

/** A mesma classificação, com os mesmos valores, confirmada ou não. */
function mesmaClassificacao(a: ClassificacaoGravada, b: ClassificacaoGravada): boolean {
  if (a.estado === 'com-quadro' && b.estado === 'com-quadro') {
    return a.resolucao === b.resolucao && mesmoQuadro(a.grupos, b.grupos);
  }
  return a.estado === b.estado;
}
