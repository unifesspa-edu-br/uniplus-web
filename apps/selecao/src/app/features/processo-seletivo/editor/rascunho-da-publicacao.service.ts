import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  ChaveDeSubstituicao,
  ProblemI18nService,
  STATUS_HTTP,
  isApiOk,
} from '@uniplus/shared-core/http';
import { ProcessosSeletivosApi } from '@uniplus/shared-data/selecao';

import { ProcessoSeletivoStore } from '../steps/processo-seletivo.store';
import { anexoConfirmado } from '../steps/shared/anexos-do-edital/anexos-do-edital';
import {
  VERSAO_DO_RASCUNHO,
  blocoDoDocumento,
  documentoDoRascunho,
  temAlgoAGuardar,
} from '../steps/shared/rascunho-da-publicacao';

/**
 * O rascunho do bloco do ato que o operador transcreve na Revisão e ainda não publicou, e o rastro
 * local do que o servidor tem dele.
 *
 * A vez do rascunho muda quando o de antes deixa de valer, na troca de processo e na publicação,
 * que apaga o rascunho no servidor. A resposta de uma gravação ou de um descarte que chega depois
 * descreve algo que não existe mais: sem o carimbo, ela escrevia "salvo às …" sobre um rascunho que
 * a publicação tinha acabado de apagar.
 */
@Injectable()
export class RascunhoDaPublicacao {
  private readonly store = inject(ProcessoSeletivoStore);
  private readonly api = inject(ProcessosSeletivosApi);
  private readonly problemI18n = inject(ProblemI18nService);

  /** Quando o rascunho foi gravado, para o carimbo do passo de Revisão. */
  readonly salvoEm = signal<string | null>(null);

  /** Aviso de rascunho descartado por mudança de formato; some assim que outro é gravado. */
  readonly aviso = signal<string | null>(null);

  /** Enquanto a gravação do rascunho está em voo, o botão não aceita um segundo clique. */
  readonly salvando = signal(false);

  /** A recusa da última gravação de rascunho, dita na tela em vez de engolida. */
  readonly falha = signal<string | null>(null);

  /**
   * O documento que o servidor tem, para saber se há edição não gravada. `null` enquanto nada foi
   * gravado nesta sessão, e aí qualquer coisa preenchida já conta como pendente.
   */
  private readonly documentoNoServidor = signal<string | null>(null);

  private readonly chave = new ChaveDeSubstituicao();
  private vez = 0;

  /**
   * Há transcrição do ato que o servidor ainda não tem. É a condição da guarda de saída, e é
   * deliberadamente "não gravado", não "algo digitado": um aviso que dispara sempre que existe
   * texto na tela é o que todo operador aprende a descartar sem ler.
   */
  readonly pendente = computed(() => {
    const publicacao = this.store.draft().publicacao;
    const noServidor = this.documentoNoServidor();

    // Nada gravado ainda: a tela em branco não é edição pendente, é a tela como nasceu.
    if (noServidor === null) return temAlgoAGuardar(publicacao);

    // Com rascunho gravado, esvaziar os campos É a edição a proteger: a volta ao processo
    // reporia do servidor justamente o que o operador tinha acabado de limpar.
    return JSON.stringify(documentoDoRascunho(publicacao)) !== noServidor;
  });

  /**
   * Repõe o bloco do ato que o operador tinha transcrito. Vem DEPOIS de hidratar o processo, que
   * reescreve o rascunho inteiro a partir do detalhe.
   *
   * Rascunho de outro formato é descartado com aviso, nunca reidratado pela metade: o operador
   * publicaria acreditando ter conferido.
   */
  async restaurar(processoSeletivoId: string, superada: () => boolean): Promise<void> {
    const resultado = await firstValueFrom(this.api.obterRascunhoDaPublicacao(processoSeletivoId));
    if (superada()) return;

    if (!isApiOk(resultado)) {
      // 404 é ausência: não há rascunho, ou o que havia venceu. Qualquer outra recusa é
      // ignorância, e o rascunho pode existir no servidor: abrir em branco calado convidaria a
      // gravar por cima do que o operador nunca viu.
      if (resultado.problem.status !== STATUS_HTTP.NAO_ENCONTRADO) {
        this.aviso.set(
          'Não foi possível verificar se há rascunho da publicação guardado para este processo. ' +
            'Recarregue antes de salvar: gravar agora substitui o que estiver lá.',
        );
      }
      return;
    }

    if (resultado.data.versao !== VERSAO_DO_RASCUNHO) {
      this.aviso.set(
        'Havia um rascunho da publicação gravado num formato anterior desta tela, e ele foi descartado. Preencha o bloco do ato novamente.',
      );
      return;
    }

    this.aviso.set(null);
    const bloco = blocoDoDocumento(resultado.data.conteudo);
    this.store.projetarSecao('publicacao', bloco);
    this.documentoNoServidor.set(JSON.stringify(documentoDoRascunho(bloco)));
    this.salvoEm.set(resultado.data.salvoEm);
  }

  /**
   * Guarda no servidor o bloco do ato que está em tela. Só sai do botão, nunca de `reset()`, de
   * hidratação ou de `valueChanges`: a retomada limpa o rascunho ANTES de hidratar, e uma gravação
   * automática dispararia nessa limpeza, apagando no servidor o que ela ia buscar em seguida.
   */
  async salvar(): Promise<void> {
    const processoId = this.store.processoSeletivoId();
    if (processoId === null || this.salvando()) return;

    const documento = documentoDoRascunho(this.store.draft().publicacao);
    const corpo = { versao: VERSAO_DO_RASCUNHO, conteudo: documento };

    // A página é reusada entre processos, e publicar apaga o rascunho no servidor: a resposta
    // atrasada escreveria o documento e o horário sobre um estado que já é de outro processo.
    const vez = this.vez;
    const superada = (): boolean => vez !== this.vez;

    this.salvando.set(true);
    this.falha.set(null);
    const resultado = await firstValueFrom(
      this.api.salvarRascunhoDaPublicacao(processoId, corpo, this.chave.contextoPara(corpo)),
    );
    if (superada()) return;
    this.salvando.set(false);

    if (!isApiOk(resultado)) {
      this.chave.recusada(resultado);
      this.falha.set(this.problemI18n.resolve(resultado.problem).title);
      return;
    }

    this.aviso.set(null);
    this.documentoNoServidor.set(JSON.stringify(documento));
    this.salvoEm.set(new Date().toISOString());

    // A chave termina com a gravação que a usou. Retida, o clique seguinte repetiria a anterior:
    // com o mesmo corpo, o servidor devolveria o resultado guardado em vez de gravar de novo, e o
    // que estiver lá agora, posto por outra aba, permaneceria enquanto a tela anuncia que salvou.
    this.chave.renovar();
  }

  /**
   * Retira do servidor o rascunho deste operador e esvazia o bloco em tela: descartar e deixar os
   * campos preenchidos daria a impressão de que ainda há algo guardado.
   */
  async descartar(): Promise<void> {
    const processoId = this.store.processoSeletivoId();
    if (processoId === null || this.salvando()) return;

    const vez = this.vez;
    const superada = (): boolean => vez !== this.vez;

    // O bloco como estava quando o descarte saiu: o formulário segue editável enquanto a resposta
    // não chega, e esvaziá-lo sem olhar apagaria o que o operador escreveu nesse intervalo.
    const aoPedir = JSON.stringify(documentoDoRascunho(this.store.draft().publicacao));

    this.salvando.set(true);
    this.falha.set(null);
    const resultado = await firstValueFrom(this.api.descartarRascunhoDaPublicacao(processoId));
    if (superada()) return;
    this.salvando.set(false);

    if (!isApiOk(resultado)) {
      this.falha.set(this.problemI18n.resolve(resultado.problem).title);
      return;
    }

    const intocado = JSON.stringify(documentoDoRascunho(this.store.draft().publicacao)) === aoPedir;
    if (intocado) {
      // O anexo em envio não está no documento guardado, mas continua em curso: zerá-lo faria o
      // envio perder o item e o documento selado sumir da tela sem aviso.
      const emEnvio = this.store
        .draft()
        .publicacao.anexos.filter((anexo) => !anexoConfirmado(anexo));
      this.store.projetarSecao('publicacao', { ...blocoDoDocumento(null), anexos: emEnvio });
    }
    this.documentoNoServidor.set(null);
    this.salvoEm.set(null);
    this.aviso.set(null);

    // A chave sai com o rascunho que ela acompanhou: reescrever a mesma transcrição receberia o
    // replay da gravação anterior, anulada por este descarte, e a tela diria "salvo" sobre um
    // rascunho que não foi recriado.
    this.chave.renovar();
  }

  /**
   * Toma o que está em tela como já guardado, sem gravar nada: é o estado de quem publicou. O
   * rascunho no servidor sumiu com o ato, e os campos que restam são a declaração que virou
   * publicação, sem nada pendente a proteger.
   */
  fixarComoJaGravado(): void {
    this.reiniciar(JSON.stringify(documentoDoRascunho(this.store.draft().publicacao)));
  }

  /**
   * Esquece o rastro local do rascunho, sem tocar no que está em tela. Serve a quem publicou e a
   * quem troca de processo: o rastro do anterior faria a guarda de saída perguntar sobre um
   * rascunho que não é mais o desta tela.
   */
  esquecer(): void {
    this.reiniciar(null);
  }

  /**
   * O que estiver em voo não descreve mais nada. A chave também sai: ela só gira sozinha quando o
   * corpo muda, e dois processos em branco produzem o MESMO documento serializado, então a
   * primeira gravação do processo novo receberia o replay do anterior.
   */
  private reiniciar(documentoNoServidor: string | null): void {
    this.vez += 1;
    this.salvando.set(false);
    this.documentoNoServidor.set(documentoNoServidor);
    this.salvoEm.set(null);
    this.aviso.set(null);
    this.falha.set(null);
    this.chave.renovar();
  }
}
