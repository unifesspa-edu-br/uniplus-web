import { HttpContext, HttpEventType } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  ProblemDetails,
  SignedUploadClient,
  idempotencyKey,
  isApiOk,
  withIdempotencyKey,
} from '@uniplus/shared-core/http';
import {
  ConfiguracaoDistribuicaoVagasInput,
  CriarProcessoSeletivoCommand,
  CriterioDesempateInput,
  DefinirAlgoritmoContagemPrazoRequest,
  DefinirBonusRegionalRequest,
  DefinirCascataRemanejamentoRequest,
  DefinirClassificacaoRequest,
  DefinirOfertaAtendimentoRequest,
  DefinirTaxaInscricaoRequest,
  EtapaProcessoInput,
  FaseCronogramaInput,
  IniciarUploadDocumentoEditalDto,
  ProcessosSeletivosApi,
} from '@uniplus/shared-data/selecao';

import { ChaveDeSubstituicao, proximaChave } from './chave-de-substituicao';

/** Recusa nomeada por `ProblemDetails`, para o chamador exibir e decidir o retry. */
export interface FalhaOperacao {
  readonly ok: false;
  readonly problem: ProblemDetails;
}

export type ResultadoCriacao =
  | { readonly ok: true; readonly processoSeletivoId: string }
  | FalhaOperacao;

/** As gravações de configuração respondem 204 — não há corpo a devolver. */
export type ResultadoGravacao = { readonly ok: true } | FalhaOperacao;

/**
 * A gravação da cascata precisa dizer se a recusa é inconclusiva — a
 * `ChaveDeSubstituicao` preservou a chave porque a execução anterior ainda
 * pode ter sido aplicada (erro de rede ou 5xx). `VagasStepComponent` usa
 * isso para decidir se uma remoção futura continua obrigatória mesmo sem
 * confirmação de que a gravação chegou a aplicar — nunca dar a cascata como
 * ausente do servidor só porque a resposta não chegou.
 */
export type ResultadoGravacaoCascata =
  | { readonly ok: true }
  | (FalhaOperacao & { readonly inconclusiva: boolean });

export type ResultadoIniciacao =
  | { readonly ok: true; readonly iniciacao: IniciarUploadDocumentoEditalDto }
  | FalhaOperacao;

/**
 * Falha do envio ao storage. `expirada` separa o caso em que repetir o mesmo
 * PUT é inútil — a assinatura da URL não volta a valer.
 */
export interface EnvioFalhou {
  readonly ok: false;
  readonly status: number;
  readonly expirada: boolean;
}

export type ResultadoEnvio = { readonly ok: true } | EnvioFalhou;

/**
 * Resposta que chegou depois de o editor passar a outro cadastro. Não descreve
 * uma recusa do servidor — é o resultado de um comando que já não pertence ao
 * que está em tela, e por isso não pode virar mensagem para o operador nem
 * mexer nas chaves do cadastro atual.
 */
const SUPERADO: ProblemDetails = {
  type: 'about:blank',
  title: 'Operação abandonada ao trocar de processo.',
  status: 409,
  code: 'uniplus.client.operacao_superada',
  traceId: '',
};

/**
 * Orquestra o cadastro inicial do Processo Seletivo e o anexo do edital,
 * escondendo dos componentes as duas mecânicas que erram fácil: quando a
 * `Idempotency-Key` pode ser reaproveitada e o que significa repetir cada fase
 * do upload.
 *
 * Uma chave por operação — criar, iniciar e confirmar são comandos distintos e
 * não compartilham chave.
 */
@Injectable()
export class CadastroInicialService {
  private readonly api = inject(ProcessosSeletivosApi);
  private readonly upload = inject(SignedUploadClient);

  /**
   * Muda a cada descarte. Uma iniciação ou confirmação disparada para o
   * cadastro anterior ainda responde depois que o editor passou a outro, e
   * escreveria por cima das chaves novas — fazendo a retentativa do cadastro
   * atual usar uma chave diferente da que o servidor viu, justamente o oposto
   * da garantia que estas chaves existem para dar.
   */
  private geracao = 0;

  private chaveCriacao = idempotencyKey.create();
  private chaveIniciacao = idempotencyKey.create();
  private chaveConfirmacao = idempotencyKey.create();

  private readonly chaveTaxa = new ChaveDeSubstituicao();
  private readonly chaveDistribuicao = new ChaveDeSubstituicao();
  private readonly chaveCascata = new ChaveDeSubstituicao();
  private readonly chaveEtapas = new ChaveDeSubstituicao();
  private readonly chaveCronograma = new ChaveDeSubstituicao();
  private readonly chaveAlgoritmoContagem = new ChaveDeSubstituicao();
  private readonly chaveClassificacao = new ChaveDeSubstituicao();
  private readonly chaveBonus = new ChaveDeSubstituicao();
  private readonly chaveDesempate = new ChaveDeSubstituicao();
  private readonly chaveAtendimento = new ChaveDeSubstituicao();

  /**
   * Comando de uma criação que ficou sem resposta definitiva (falha de rede ou
   * 5xx). O servidor pode tê-la executado, então a retentativa precisa repetir
   * o **mesmo corpo com a mesma chave** para receber o replay em vez de criar
   * um segundo processo. Enquanto isso não se resolve, editar os campos não
   * muda o que será reenviado — daí o congelamento na interface.
   */
  private criacaoPendente: CriarProcessoSeletivoCommand | null = null;

  /** Há criação sem resposta definitiva aguardando retentativa. */
  temCriacaoPendente(): boolean {
    return this.criacaoPendente !== null;
  }

  /**
   * Esquece o cadastro que este serviço estava acompanhando.
   *
   * A página do editor sobrevive à troca de endereço, e este serviço com ela.
   * Uma criação que ficou sem resposta definitiva retém o comando **e** a
   * `Idempotency-Key` para poder repetir o mesmo envio — o que é correto
   * enquanto o rascunho for o mesmo, e errado assim que o editor passa a
   * tratar de outro. Sem esquecer, o próximo envio repetiria o comando antigo
   * com a chave antiga e receberia de volta o id do processo anterior.
   */
  descartarCadastroEmAndamento(): void {
    this.geracao += 1;
    this.criacaoPendente = null;
    this.chaveCriacao = idempotencyKey.create();
    this.chaveIniciacao = idempotencyKey.create();
    this.chaveConfirmacao = idempotencyKey.create();
    this.chaveTaxa.renovar();
    this.chaveDistribuicao.renovar();
    this.chaveCascata.renovar();
    this.chaveEtapas.renovar();
    this.chaveCronograma.renovar();
    this.chaveAlgoritmoContagem.renovar();
    this.chaveClassificacao.renovar();
    this.chaveBonus.renovar();
    this.chaveDesempate.renovar();
    this.chaveAtendimento.renovar();
  }

  /**
   * Cria o processo em rascunho. O comando recebido já é um instantâneo do
   * rascunho: quem chama congela os campos antes, para que a resposta nunca
   * descreva um estado diferente do que foi enviado.
   */
  async criar(command: CriarProcessoSeletivoCommand): Promise<ResultadoCriacao> {
    const geracao = this.geracao;
    const comando = this.criacaoPendente ?? command;
    const result = await firstValueFrom(this.api.criar(comando, contextoCom(this.chaveCriacao)));

    if (geracao !== this.geracao)
      return { ok: false, problem: result.ok ? SUPERADO : result.problem };

    if (isApiOk(result)) {
      this.chaveCriacao = idempotencyKey.create();
      this.criacaoPendente = null;
      return { ok: true, processoSeletivoId: result.data };
    }

    const chaveAnterior = this.chaveCriacao;
    this.chaveCriacao = proximaChave(chaveAnterior, result);
    // Chave preservada significa resposta inconclusiva: o comando fica retido
    // para ser repetido igual. Chave nova significa recusa definitiva, e o
    // próximo envio parte do rascunho corrigido.
    this.criacaoPendente = this.chaveCriacao === chaveAnterior ? comando : null;
    return { ok: false, problem: result.problem };
  }

  /**
   * Documentos do edital já registrados no processo. Usado na retomada e na
   * reverificação depois de uma leitura que falhou — sem ela, o operador não
   * tem como saber se o processo já tem edital antes de enviar outro.
   */
  listarDocumentos(processoSeletivoId: string) {
    return firstValueFrom(this.api.listarDocumentosEdital(processoSeletivoId));
  }

  /**
   * Acesso de leitura a um documento confirmado, pedido no momento em que o
   * operador quer conferir o PDF. A URL vem assinada e com validade curta, e
   * não é guardada: quem a tem abre o arquivo sem passar por autorização de
   * novo, e é por isso que o servidor a emite por pedido em vez de distribuí-la
   * na listagem.
   */
  obterAcessoAoDocumento(processoSeletivoId: string, documentoEditalId: string) {
    return firstValueFrom(
      this.api.obterAcessoDocumentoEdital(processoSeletivoId, documentoEditalId),
    );
  }

  /**
   * Declara a cobrança de taxa e os fundamentos de isenção do processo.
   */
  async definirTaxaInscricao(
    processoSeletivoId: string,
    request: DefinirTaxaInscricaoRequest,
  ): Promise<ResultadoGravacao> {
    const geracao = this.geracao;
    const result = await firstValueFrom(
      this.api.definirTaxaInscricao(
        processoSeletivoId,
        request,
        this.chaveTaxa.contextoPara(request),
      ),
    );

    if (geracao !== this.geracao) return { ok: false, problem: SUPERADO };

    if (isApiOk(result)) {
      this.chaveTaxa.renovar();
      return { ok: true };
    }

    this.chaveTaxa.recusada(result);
    return { ok: false, problem: result.problem };
  }

  /**
   * Grava a distribuição de vagas do processo. O comando substitui o conjunto
   * inteiro: as ofertas ausentes do envio deixam de ter distribuição, e é isso
   * que permite ao operador remover uma linha do quadro.
   */
  async definirDistribuicaoVagas(
    processoSeletivoId: string,
    distribuicoes: readonly ConfiguracaoDistribuicaoVagasInput[],
  ): Promise<ResultadoGravacao> {
    const geracao = this.geracao;
    const result = await firstValueFrom(
      this.api.definirDistribuicaoVagas(
        processoSeletivoId,
        distribuicoes,
        this.chaveDistribuicao.contextoPara(distribuicoes),
      ),
    );

    if (geracao !== this.geracao) return { ok: false, problem: SUPERADO };

    if (isApiOk(result)) {
      this.chaveDistribuicao.renovar();
      return { ok: true };
    }

    this.chaveDistribuicao.recusada(result);
    return { ok: false, problem: result.problem };
  }

  /**
   * Grava a cascata de remanejamento do processo — ou a remove, quando
   * `request` traz os quatro campos nulos.
   *
   * Chave própria, separada da distribuição de vagas: a cascata é gravada
   * depois dela no `persistir()` do passo Vagas, e uma recusa aqui não pode
   * invalidar a chave de um comando de distribuição que já foi aceito.
   */
  async definirCascataRemanejamento(
    processoSeletivoId: string,
    request: DefinirCascataRemanejamentoRequest,
  ): Promise<ResultadoGravacaoCascata> {
    const geracao = this.geracao;
    const result = await firstValueFrom(
      this.api.definirCascataRemanejamento(
        processoSeletivoId,
        request,
        this.chaveCascata.contextoPara(request),
      ),
    );

    if (geracao !== this.geracao) return { ok: false, problem: SUPERADO, inconclusiva: false };

    if (isApiOk(result)) {
      this.chaveCascata.renovar();
      return { ok: true };
    }

    const inconclusiva = this.chaveCascata.recusada(result);
    return { ok: false, problem: result.problem, inconclusiva };
  }

  /**
   * Grava as etapas pontuadas do processo. O comando substitui a coleção
   * inteira: as ausentes deixam de existir, e é isso que permite remover uma
   * etapa. Coleção vazia é estado válido — processo cuja classificação é
   * importada não tem etapa pontuada.
   *
   * Chave própria, separada das demais dimensões: uma recusa aqui não pode
   * invalidar a chave de uma gravação de vagas ou de taxa em curso.
   */
  async definirEtapas(
    processoSeletivoId: string,
    etapas: readonly EtapaProcessoInput[],
  ): Promise<ResultadoGravacao> {
    const geracao = this.geracao;
    const result = await firstValueFrom(
      this.api.definirEtapas(processoSeletivoId, etapas, this.chaveEtapas.contextoPara(etapas)),
    );

    if (geracao !== this.geracao) return { ok: false, problem: SUPERADO };

    if (isApiOk(result)) {
      this.chaveEtapas.renovar();
      return { ok: true };
    }

    this.chaveEtapas.recusada(result);
    return { ok: false, problem: result.problem };
  }

  /**
   * Grava o cronograma de fases. Substitui a coleção inteira: uma fase ausente
   * do envio deixa de existir no processo.
   *
   * Chave própria — uma recusa do cronograma não pode invalidar a chave da
   * gravação de etapas, que costuma vir logo antes na mesma interação.
   */
  async definirCronogramaFases(
    processoSeletivoId: string,
    fases: readonly FaseCronogramaInput[],
  ): Promise<ResultadoGravacao> {
    const geracao = this.geracao;
    const result = await firstValueFrom(
      this.api.definirCronogramaFases(
        processoSeletivoId,
        fases,
        this.chaveCronograma.contextoPara(fases),
      ),
    );

    if (geracao !== this.geracao) return { ok: false, problem: SUPERADO };

    if (isApiOk(result)) {
      this.chaveCronograma.renovar();
      return { ok: true };
    }

    this.chaveCronograma.recusada(result);
    return { ok: false, problem: result.problem };
  }

  /**
   * Declara a convenção de contagem de prazo do processo, por código e versão.
   *
   * Só é chamada quando há escolha: o endpoint recusa código ou versão nulos, e
   * não existe caminho para desdeclarar a convenção.
   */
  async definirAlgoritmoContagemPrazo(
    processoSeletivoId: string,
    request: DefinirAlgoritmoContagemPrazoRequest,
  ): Promise<ResultadoGravacao> {
    const geracao = this.geracao;
    const result = await firstValueFrom(
      this.api.definirAlgoritmoContagemPrazo(
        processoSeletivoId,
        request,
        this.chaveAlgoritmoContagem.contextoPara(request),
      ),
    );

    if (geracao !== this.geracao) return { ok: false, problem: SUPERADO };

    if (isApiOk(result)) {
      this.chaveAlgoritmoContagem.renovar();
      return { ok: true };
    }

    this.chaveAlgoritmoContagem.recusada(result);
    return { ok: false, problem: result.problem };
  }

  /**
   * Grava a classificação inteira do processo — regra de cálculo, precisão,
   * ordem de alocação, número de opções e o vetor de regras de eliminação, num
   * corpo só (UNI-REQ-0482). Chave própria: uma recusa aqui não pode invalidar
   * a chave da gravação de bônus ou desempate, que costumam vir na mesma
   * interação.
   */
  async definirClassificacao(
    processoSeletivoId: string,
    request: DefinirClassificacaoRequest,
  ): Promise<ResultadoGravacao> {
    const geracao = this.geracao;
    const result = await firstValueFrom(
      this.api.definirClassificacao(
        processoSeletivoId,
        request,
        this.chaveClassificacao.contextoPara(request),
      ),
    );

    if (geracao !== this.geracao) return { ok: false, problem: SUPERADO };

    if (isApiOk(result)) {
      this.chaveClassificacao.renovar();
      return { ok: true };
    }

    this.chaveClassificacao.recusada(result);
    return { ok: false, problem: result.problem };
  }

  /**
   * Declara o bônus regional do processo (RN05). Enviar os cinco campos
   * `null` é a forma de declarar "sem bônus" — não existe rota separada para
   * desligá-lo.
   */
  async definirBonusRegional(
    processoSeletivoId: string,
    request: DefinirBonusRegionalRequest,
  ): Promise<ResultadoGravacao> {
    const geracao = this.geracao;
    const result = await firstValueFrom(
      this.api.definirBonusRegional(
        processoSeletivoId,
        request,
        this.chaveBonus.contextoPara(request),
      ),
    );

    if (geracao !== this.geracao) return { ok: false, problem: SUPERADO };

    if (isApiOk(result)) {
      this.chaveBonus.renovar();
      return { ok: true };
    }

    this.chaveBonus.recusada(result);
    return { ok: false, problem: result.problem };
  }

  /**
   * Grava os critérios de desempate, na ordem em que serão avaliados.
   * Substitui a coleção inteira: coleção vazia é estado válido.
   */
  async definirCriteriosDesempate(
    processoSeletivoId: string,
    criterios: readonly CriterioDesempateInput[],
  ): Promise<ResultadoGravacao> {
    const geracao = this.geracao;
    const result = await firstValueFrom(
      this.api.definirCriteriosDesempate(
        processoSeletivoId,
        criterios,
        this.chaveDesempate.contextoPara(criterios),
      ),
    );

    if (geracao !== this.geracao) return { ok: false, problem: SUPERADO };

    if (isApiOk(result)) {
      this.chaveDesempate.renovar();
      return { ok: true };
    }

    this.chaveDesempate.recusada(result);
    return { ok: false, problem: result.problem };
  }

  /**
   * Grava a oferta de atendimento especializado — condições, recursos de
   * acessibilidade e tipos de deficiência, por id do cadastro de
   * Configuração. Substitui a configuração inteira: lista vazia é estado
   * válido e apaga o que estava declarado (CA-05).
   */
  async definirOfertaAtendimento(
    processoSeletivoId: string,
    request: DefinirOfertaAtendimentoRequest,
  ): Promise<ResultadoGravacao> {
    const geracao = this.geracao;
    const result = await firstValueFrom(
      this.api.definirOfertaAtendimento(
        processoSeletivoId,
        request,
        this.chaveAtendimento.contextoPara(request),
      ),
    );

    if (geracao !== this.geracao) return { ok: false, problem: SUPERADO };

    if (isApiOk(result)) {
      this.chaveAtendimento.renovar();
      return { ok: true };
    }

    this.chaveAtendimento.recusada(result);
    return { ok: false, problem: result.problem };
  }

  /** Passo 1 do anexo: registro pendente + URL pré-assinada. */
  async iniciarUpload(processoSeletivoId: string): Promise<ResultadoIniciacao> {
    const geracao = this.geracao;
    const result = await firstValueFrom(
      this.api.iniciarUploadDocumentoEdital(processoSeletivoId, contextoCom(this.chaveIniciacao)),
    );

    if (geracao !== this.geracao) return { ok: false, problem: SUPERADO };

    if (isApiOk(result)) {
      this.chaveIniciacao = idempotencyKey.create();
      return { ok: true, iniciacao: result.data };
    }

    this.chaveIniciacao = proximaChave(this.chaveIniciacao, result);
    return { ok: false, problem: result.problem };
  }

  /**
   * Passo 2: envia o arquivo direto ao storage, relatando o progresso em bytes.
   *
   * Este PUT não passa pelos interceptors da aplicação, então a falha chega
   * como erro HTTP de verdade. 403 é como o storage recusa assinatura inválida
   * — na prática, URL expirada: repetir o mesmo PUT nunca funciona, e o
   * chamador precisa recomeçar da iniciação.
   */
  enviarArquivo(
    iniciacao: IniciarUploadDocumentoEditalDto,
    arquivo: File,
    onProgresso: (percentual: number) => void,
  ): Promise<ResultadoEnvio> {
    return new Promise<ResultadoEnvio>((resolve) => {
      this.upload.enviar(iniciacao.urlUpload, arquivo, iniciacao.contentTypeExigido).subscribe({
        next: (evento) => {
          if (evento.type === HttpEventType.UploadProgress) {
            onProgresso(percentualDe(evento.loaded, evento.total));
          }
        },
        error: (erro: unknown) => {
          const status = statusDe(erro);
          resolve({ ok: false, status, expirada: status === 403 });
        },
        complete: () => {
          onProgresso(100);
          resolve({ ok: true });
        },
      });
    });
  }

  /**
   * Confirmação que ficou sem resposta definitiva. O documento pode já estar
   * selado no servidor — imutável, portanto — e a única saída correta é repetir
   * esta mesma confirmação com a mesma chave até obter resposta. Trocar de
   * arquivo aqui criaria um segundo edital imutável e perderia a referência do
   * primeiro.
   */
  private confirmacaoPendente = false;

  /** Há confirmação sem resposta definitiva aguardando retentativa. */
  temConfirmacaoPendente(): boolean {
    return this.confirmacaoPendente;
  }

  /** Passo 3: a API valida o objeto no storage e sela o documento. */
  async confirmarUpload(
    processoSeletivoId: string,
    documentoEditalId: string,
  ): Promise<ResultadoGravacao> {
    const geracao = this.geracao;
    const result = await firstValueFrom(
      this.api.confirmarUploadDocumentoEdital(
        processoSeletivoId,
        documentoEditalId,
        contextoCom(this.chaveConfirmacao),
      ),
    );

    if (geracao !== this.geracao) return { ok: false, problem: SUPERADO };

    if (isApiOk(result)) {
      this.chaveConfirmacao = idempotencyKey.create();
      this.confirmacaoPendente = false;
      return { ok: true };
    }

    const chaveAnterior = this.chaveConfirmacao;
    this.chaveConfirmacao = proximaChave(chaveAnterior, result);
    // Mesma leitura da criação: chave preservada é resposta inconclusiva.
    this.confirmacaoPendente = this.chaveConfirmacao === chaveAnterior;
    return { ok: false, problem: result.problem };
  }
}

function contextoCom(chave: string): HttpContext {
  return withIdempotencyKey(chave);
}

function percentualDe(loaded: number, total: number | undefined): number {
  if (total === undefined || total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((loaded / total) * 100)));
}

function statusDe(erro: unknown): number {
  if (typeof erro === 'object' && erro !== null && 'status' in erro) {
    const status = (erro as { status: unknown }).status;
    return typeof status === 'number' ? status : 0;
  }
  return 0;
}
