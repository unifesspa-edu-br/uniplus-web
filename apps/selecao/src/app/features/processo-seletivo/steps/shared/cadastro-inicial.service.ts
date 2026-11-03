import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  SignedUploadClient,
  enviarAoStorage,
  type ResultadoEnvio,
} from '@uniplus/shared-core/http';
import {
  ConfiguracaoDistribuicaoVagasInput,
  DefinirOpcoesDeCursoRequest,
  CriarProcessoSeletivoCommand,
  CriterioDesempateInput,
  DefinirAlgoritmoContagemPrazoRequest,
  DefinirBonusRegionalRequest,
  DefinirCascataRemanejamentoRequest,
  DefinirClassificacaoRequest,
  DefinirOpcoesDeclaradasRequest,
  DefinirOfertaAtendimentoRequest,
  DefinirTaxaInscricaoRequest,
  EtapaProcessoInput,
  FaseCronogramaInput,
  FinalidadeDoDocumento,
  IniciarEnvioDoDocumentoAPublicarDto,
  NoExigenciaInput,
  ProcessosSeletivosApi,
  PublicarProcessoSeletivoRequest,
  DefinirIdentificadorLegivelRequest,
  DefinirReferenciaTemporalFatosRequest,
} from '@uniplus/shared-data/selecao';

import type { FormularioParaGravar } from '../steps/formulario/formulario-do-processo';
import { gravarFormulario } from './gravacao-do-formulario';
import { GravacaoDoProcesso } from './gravacao/gravacao-do-processo';
import type {
  ResultadoAplicacaoDeModelo,
  ResultadoCriacao,
  ResultadoGravacao,
  ResultadoGravacaoCascata,
  ResultadoGravacaoComInconclusiva,
  ResultadoIniciacao,
} from './gravacao/resultado-da-gravacao';
import { TIPO_DE_MIDIA_DO_EDITAL } from './hidratacao';

export type {
  FalhaOperacao,
  ResultadoCriacao,
  ResultadoGravacao,
  ResultadoGravacaoCascata,
  ResultadoGravacaoComInconclusiva,
  ResultadoIniciacao,
} from './gravacao/resultado-da-gravacao';

/** Cadastro do Processo Seletivo: cada comando de gravação entra por `GravacaoDoProcesso`. */
@Injectable()
export class CadastroInicialService {
  private readonly api = inject(ProcessosSeletivosApi);
  private readonly upload = inject(SignedUploadClient);
  private readonly gravacao = inject(GravacaoDoProcesso);

  /**
   * Comando de uma criação sem resposta definitiva (rede ou 5xx). O servidor pode tê-la
   * executado, então a retentativa repete o **mesmo corpo com a mesma chave** para receber o
   * replay em vez de criar um segundo processo. Editar os campos nesse intervalo não muda o que
   * será reenviado, daí o congelamento na interface.
   */
  private criacaoPendente: CriarProcessoSeletivoCommand | null = null;

  temCriacaoPendente(): boolean {
    return this.criacaoPendente !== null;
  }

  /**
   * Esquece o cadastro acompanhado. A página do editor sobrevive à troca de endereço, e este
   * serviço com ela: sem esquecer, o próximo envio repetiria o comando antigo com a chave antiga
   * e receberia de volta o id do processo anterior.
   */
  descartarCadastroEmAndamento(): void {
    this.criacaoPendente = null;
    this.gravacao.descartar();
  }

  /** O comando recebido já é um instantâneo do rascunho: quem chama congela os campos antes. */
  async criar(command: CriarProcessoSeletivoCommand): Promise<ResultadoCriacao> {
    const geracao = this.gravacao.geracao();
    const comando = this.criacaoPendente ?? command;
    const resultado = await this.gravacao.gravarRetida('criacao', (contexto) =>
      this.api.criar(comando, contexto),
    );

    if (geracao === this.gravacao.geracao()) {
      this.criacaoPendente = this.gravacao.retidaPendente('criacao') ? comando : null;
    }
    return resultado.ok ? { ok: true, processoSeletivoId: resultado.dados } : resultado;
  }

  /**
   * Documentos do edital já registrados no processo, para a retomada e para a reverificação depois
   * de uma leitura que falhou. Só o documento do edital: os anexos vivem na mesma coleção.
   */
  listarDocumentos(processoSeletivoId: string) {
    return firstValueFrom(
      this.api.listarDocumentosAPublicar(
        processoSeletivoId,
        FinalidadeDoDocumento.documentoDoEdital,
      ),
    );
  }

  /**
   * A URL vem assinada e com validade curta, e não é guardada: quem a tem abre o arquivo sem
   * passar por autorização de novo, por isso o servidor a emite por pedido.
   */
  obterAcessoAoDocumento(processoSeletivoId: string, documentoAPublicarId: string) {
    return firstValueFrom(
      this.api.obterAcessoDocumentoAPublicar(processoSeletivoId, documentoAPublicarId),
    );
  }

  definirTaxaInscricao(
    processoSeletivoId: string,
    request: DefinirTaxaInscricaoRequest,
  ): Promise<ResultadoGravacao> {
    return this.gravacao.gravar('taxa', request, (contexto) =>
      this.api.definirTaxaInscricao(processoSeletivoId, request, contexto),
    );
  }

  /** Substitui o conjunto inteiro: a oferta ausente do envio deixa de ter distribuição. */
  definirDistribuicaoVagas(
    processoSeletivoId: string,
    distribuicoes: readonly ConfiguracaoDistribuicaoVagasInput[],
  ): Promise<ResultadoGravacaoComInconclusiva> {
    return this.gravacao.gravar('distribuicao', distribuicoes, (contexto) =>
      this.api.definirDistribuicaoVagas(processoSeletivoId, distribuicoes, contexto),
    );
  }

  /** Chave própria: é gravado junto da distribuição, e a recusa de um não invalida a chave do outro. */
  definirOpcoesDeCurso(
    processoSeletivoId: string,
    request: DefinirOpcoesDeCursoRequest,
  ): Promise<ResultadoGravacaoComInconclusiva> {
    return this.gravacao.gravar('opcoesDeCurso', request, (contexto) =>
      this.api.definirOpcoesDeCurso(processoSeletivoId, request, contexto),
    );
  }

  /** Remove a cascata quando `request` traz os quatro campos nulos. */
  definirCascataRemanejamento(
    processoSeletivoId: string,
    request: DefinirCascataRemanejamentoRequest,
  ): Promise<ResultadoGravacaoCascata> {
    return this.gravacao.gravar('cascata', request, (contexto) =>
      this.api.definirCascataRemanejamento(processoSeletivoId, request, contexto),
    );
  }

  /** Coleção vazia é estado válido: processo de classificação importada não tem etapa pontuada. */
  definirEtapas(
    processoSeletivoId: string,
    etapas: readonly EtapaProcessoInput[],
  ): Promise<ResultadoGravacao> {
    return this.gravacao.gravar('etapas', etapas, (contexto) =>
      this.api.definirEtapas(processoSeletivoId, etapas, contexto),
    );
  }

  /** Substitui a árvore inteira; árvore vazia é certame que não coleta documento. */
  definirDocumentosExigidos(
    processoSeletivoId: string,
    raizes: readonly NoExigenciaInput[],
  ): Promise<ResultadoGravacao> {
    return this.gravacao.gravar('documentosExigidos', raizes, (contexto) =>
      this.api.definirDocumentosExigidos(processoSeletivoId, raizes, contexto),
    );
  }

  /** Substitui a coleção inteira: a fase ausente do envio deixa de existir no processo. */
  definirCronogramaFases(
    processoSeletivoId: string,
    fases: readonly FaseCronogramaInput[],
  ): Promise<ResultadoGravacao> {
    return this.gravacao.gravar('cronograma', fases, (contexto) =>
      this.api.definirCronogramaFases(processoSeletivoId, fases, contexto),
    );
  }

  /** Só é chamada quando há escolha: o endpoint recusa código ou versão nulos. */
  definirAlgoritmoContagemPrazo(
    processoSeletivoId: string,
    request: DefinirAlgoritmoContagemPrazoRequest,
  ): Promise<ResultadoGravacao> {
    return this.gravacao.gravar('algoritmoContagem', request, (contexto) =>
      this.api.definirAlgoritmoContagemPrazo(processoSeletivoId, request, contexto),
    );
  }

  /** Regra de cálculo, precisão, ordem de alocação, opções e eliminação, num corpo só (UNI-REQ-0482). */
  definirClassificacao(
    processoSeletivoId: string,
    request: DefinirClassificacaoRequest,
  ): Promise<ResultadoGravacaoComInconclusiva> {
    return this.gravacao.gravar('classificacao', request, (contexto) =>
      this.api.definirClassificacao(processoSeletivoId, request, contexto),
    );
  }

  definirOpcoesDeclaradas(
    processoSeletivoId: string,
    fatoCodigo: string,
    request: DefinirOpcoesDeclaradasRequest,
  ): Promise<ResultadoGravacao> {
    return this.gravacao.gravar('opcoesDeclaradas', { fatoCodigo, request }, (contexto) =>
      this.api.definirOpcoesDeclaradas(processoSeletivoId, fatoCodigo, request, contexto),
    );
  }

  /** Instante contra o qual a idade do candidato é apurada. */
  definirReferenciaTemporalFatos(
    processoSeletivoId: string,
    request: DefinirReferenciaTemporalFatosRequest,
  ): Promise<ResultadoGravacao> {
    return this.gravacao.gravar('referenciaTemporal', request, (contexto) =>
      this.api.definirReferenciaTemporalFatos(processoSeletivoId, request, contexto),
    );
  }

  /**
   * Endereço público do certame. Na recusa inconclusiva o servidor pode ter gravado o valor
   * enviado, e quem chama não pode mais tomar o anterior como o que o servidor tem.
   */
  definirIdentificadorLegivel(
    processoSeletivoId: string,
    request: DefinirIdentificadorLegivelRequest,
  ): Promise<ResultadoGravacaoComInconclusiva> {
    return this.gravacao.gravar('identificadorLegivel', request, (contexto) =>
      this.api.definirIdentificadorLegivel(processoSeletivoId, request, contexto),
    );
  }

  gravarFormulario(
    processoSeletivoId: string,
    finalidade: string,
    servidor: FormularioParaGravar | null,
    desejado: FormularioParaGravar & { readonly faseId: string },
  ): Promise<ResultadoGravacao> {
    return gravarFormulario(
      this.gravacao,
      this.api,
      { processoSeletivoId, finalidade },
      servidor,
      desejado,
    );
  }

  /**
   * Remove o formulário de uma finalidade, com os itens e os termos dele. A API só remove em
   * rascunho, e quem chama confere o desfecho relendo o processo.
   */
  removerFormulario(processoSeletivoId: string, finalidade: string): Promise<ResultadoGravacao> {
    return this.gravacao.remover(() => this.api.removerFormulario(processoSeletivoId, finalidade));
  }

  /**
   * O formulário da finalidade do modelo é criado ou substituído por inteiro. Devolve o relato da
   * cópia (o que trouxe, manteve, descartou e derivou), que só o servidor sabe.
   */
  async aplicarModeloDeFormulario(
    processoSeletivoId: string,
    modeloId: string,
  ): Promise<ResultadoAplicacaoDeModelo> {
    const corpo = { modeloId };
    const resultado = await this.gravacao.gravar('aplicacaoDeModelo', corpo, (contexto) =>
      this.api.aplicarModeloDeFormulario(processoSeletivoId, corpo, contexto),
    );
    return resultado.ok ? { ok: true, relato: resultado.dados } : resultado;
  }

  /** `aplica: false` grava a declaração com os cinco campos do bônus nulos; `true` exige a configuração. */
  definirBonusRegional(
    processoSeletivoId: string,
    request: DefinirBonusRegionalRequest,
  ): Promise<ResultadoGravacao> {
    return this.gravacao.gravar('bonus', request, (contexto) =>
      this.api.definirBonusRegional(processoSeletivoId, request, contexto),
    );
  }

  /** Critérios na ordem em que serão avaliados; coleção vazia é estado válido. */
  definirCriteriosDesempate(
    processoSeletivoId: string,
    criterios: readonly CriterioDesempateInput[],
  ): Promise<ResultadoGravacaoComInconclusiva> {
    return this.gravacao.gravar('desempate', criterios, (contexto) =>
      this.api.definirCriteriosDesempate(processoSeletivoId, criterios, contexto),
    );
  }

  /** Substitui a configuração inteira: lista vazia apaga o que estava declarado (CA-05). */
  definirOfertaAtendimento(
    processoSeletivoId: string,
    request: DefinirOfertaAtendimentoRequest,
  ): Promise<ResultadoGravacao> {
    return this.gravacao.gravar('atendimento', request, (contexto) =>
      this.api.definirOfertaAtendimento(processoSeletivoId, request, contexto),
    );
  }

  /**
   * Depois de um 422 a próxima tentativa gira a chave; conflito de processamento, rede e 5xx a
   * preservam. A tela de Revisão usa `inconclusiva` para manter a edição travada: um retry com o
   * corpo editado giraria a chave e deixaria de ser o replay seguro do comando incerto.
   */
  publicar(
    processoSeletivoId: string,
    request: PublicarProcessoSeletivoRequest,
  ): Promise<ResultadoGravacaoComInconclusiva> {
    return this.gravacao.gravar('publicacao', request, (contexto) =>
      this.api.publicar(processoSeletivoId, request, contexto),
    );
  }

  /** Releitura pós-publicação (CA-08 da #486): confirma `status === publicado` depois do `204`. */
  obterDetalhe(processoSeletivoId: string) {
    return firstValueFrom(this.api.obter(processoSeletivoId));
  }

  /** O `configuracao` do snapshot não vira comando de gravação: a tela só confirma que congelou. */
  obterSnapshotVigente(processoSeletivoId: string) {
    return firstValueFrom(this.api.obterSnapshotVigente(processoSeletivoId));
  }

  /** Passo 1 do anexo: registro pendente + URL pré-assinada. */
  async iniciarUpload(
    processoSeletivoId: string,
    nomeArquivo: string,
  ): Promise<ResultadoIniciacao> {
    const request = {
      finalidade: FinalidadeDoDocumento.documentoDoEdital,
      nomeArquivo,
      tipoDeMidia: TIPO_DE_MIDIA_DO_EDITAL,
    };
    const resultado = await this.gravacao.gravar('iniciacaoDoEdital', request, (contexto) =>
      this.api.iniciarEnvioDocumentoAPublicar(processoSeletivoId, request, contexto),
    );
    return resultado.ok ? { ok: true, iniciacao: resultado.dados } : resultado;
  }

  /** Passo 2: envia o arquivo direto ao storage. */
  enviarArquivo(
    iniciacao: IniciarEnvioDoDocumentoAPublicarDto,
    arquivo: File,
    onProgresso: (percentual: number) => void,
  ): Promise<ResultadoEnvio> {
    return enviarAoStorage(this.upload, iniciacao, arquivo, onProgresso);
  }

  /**
   * Confirmação sem resposta definitiva: o documento pode já estar selado e imutável, e a única
   * saída correta é repetir esta confirmação com a mesma chave. Trocar de arquivo criaria um
   * segundo edital e perderia a referência do primeiro.
   */
  temConfirmacaoPendente(): boolean {
    return this.gravacao.retidaPendente('confirmacaoDoEdital');
  }

  /** Passo 3: a API valida o objeto no storage e sela o documento. */
  confirmarUpload(
    processoSeletivoId: string,
    documentoAPublicarId: string,
  ): Promise<ResultadoGravacao> {
    return this.gravacao.gravarRetida('confirmacaoDoEdital', (contexto) =>
      this.api.confirmarEnvioDocumentoAPublicar(processoSeletivoId, documentoAPublicarId, contexto),
    );
  }
}
