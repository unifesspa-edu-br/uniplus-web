import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ProblemI18nService, STATUS_HTTP, isApiOk } from '@uniplus/shared-core/http';
import {
  FinalidadeDoDocumento,
  ProcessoSeletivoDto,
  ProcessosSeletivosApi,
  PublicacaoDoProcessoApi,
  DocumentosEAtosDoProcessoApi,
} from '@uniplus/shared-data/selecao';

import type { MotivoFalhaDeLeitura } from '../wizard/processo-seletivo.models';
import { ProcessoSeletivoStore } from '../wizard/processo-seletivo.store';
import { CadastroInicial } from '../wizard/shared/cadastro-inicial.service';
import { classificarDocumentos } from '../wizard/shared/hidratacao';
import { passosConcluidosDe } from '../wizard/shared/passos-concluidos';
import { CatalogosDeClassificacao } from '../wizard/passos/classificacao/catalogos-de-classificacao.service';
import { ConducaoDoWizard } from './conducao-do-wizard.service';
import { RascunhoDaPublicacao } from './rascunho-da-publicacao.service';

/** Formato do `:id` na rota; recusar aqui poupa uma ida ao servidor com lixo. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 404 e 403 descrevem o endereço, não uma indisponibilidade: repetir a leitura daria o mesmo
 * resultado, e a saída é voltar à listagem. O resto admite retentativa.
 */
function motivoDe(status: number): MotivoFalhaDeLeitura {
  if (status === STATUS_HTTP.NAO_ENCONTRADO) return 'naoEncontrado';
  if (status === STATUS_HTTP.SEM_PERMISSAO || status === STATUS_HTTP.NAO_AUTENTICADO) {
    return 'semPermissao';
  }
  return 'falhaTemporaria';
}

/**
 * Dona única da troca de processo no editor: lê o que o servidor tem e limpa o que a tela guardava
 * do anterior. A página reusa a mesma instância entre endereços, então quem lê e quem esquece
 * precisam ser um só, ou o estado de um processo vaza para o seguinte.
 */
@Injectable()
export class LeituraDoProcesso {
  private readonly store = inject(ProcessoSeletivoStore);
  private readonly api = inject(ProcessosSeletivosApi);
  private readonly publicacaoApi = inject(PublicacaoDoProcessoApi);
  private readonly documentosApi = inject(DocumentosEAtosDoProcessoApi);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly cadastro = inject(CadastroInicial);
  private readonly catalogosDeClassificacao = inject(CatalogosDeClassificacao);
  private readonly rascunho = inject(RascunhoDaPublicacao);
  private readonly conducao = inject(ConducaoDoWizard);

  /** Vez da leitura em curso; as respostas de vezes anteriores são descartadas. */
  private leituraEmCurso = 0;

  /**
   * Retomada por endereço (CA-05, CA-06, CA-08): lê o detalhe canônico e o readback dos documentos
   * do edital. Falha de leitura nunca vira rascunho vazio: abrir um cadastro novo sob o id de
   * outro processo levaria o operador a preencher tudo de novo e, na identificação, a criar uma
   * duplicata.
   */
  async retomar(id: string): Promise<void> {
    // Com a página reusada, trocar de processo antes de a leitura anterior responder deixa duas em
    // voo. Se a mais antiga chegar por último, o endereço mostraria B com os dados de A, e um
    // anexo enviado ali iria para o processo errado. Cada leitura carimba sua vez e desiste ao
    // descobrir que foi superada.
    const leitura = ++this.leituraEmCurso;
    const superada = (): boolean => leitura !== this.leituraEmCurso;

    if (!UUID.test(id)) {
      // A leitura anterior já foi superada pelo carimbo acima; sem encerrar o carregamento aqui,
      // voltar ao processo que estava aberto encontraria o editor preso no indicador de progresso.
      this.store.hidratando.set(false);
      this.store.falhaDeLeitura.set({
        motivo: 'idInvalido',
        mensagem: 'O endereço não aponta para um identificador de processo válido.',
      });
      return;
    }

    // Abrir um processo por endereço sempre começa do zero. Hidratar por cima do que estava em
    // tela manteria o que o detalhe não traz (anexo, metadados locais do edital, seções sem
    // readback) atribuído ao processo errado, vindo de outro `:id` ou de um `novo` já preenchido.
    // O caminho `novo` → id recém-criado não passa por aqui: o rascunho local é do processo que
    // acabou de nascer.
    this.limparEditor();

    this.store.falhaDeLeitura.set(null);
    this.store.hidratando.set(true);

    const detalhe = await firstValueFrom(this.api.obter(id));
    if (superada()) return;

    if (!isApiOk(detalhe)) {
      this.store.hidratando.set(false);
      this.store.falhaDeLeitura.set({
        motivo: motivoDe(detalhe.problem.status),
        mensagem: this.problemI18n.resolve(detalhe.problem).title,
      });
      return;
    }

    this.store.hidratar(detalhe.data);
    await this.restaurarDocumentoEdital(id, superada);
    if (superada()) return;
    await this.rascunho.restaurar(id, superada);
    if (superada()) return;
    await this.derivarPassosConcluidos(detalhe.data, superada);
    if (superada()) return;

    this.store.hidratando.set(false);
  }

  /** Invalida a leitura em voo e limpa o editor: o operador voltou ao cadastro novo. */
  abandonar(): void {
    this.leituraEmCurso += 1;
    this.limparEditor();
  }

  /**
   * Limpa o editor por inteiro. O store guarda o que está em tela; o cadastro guarda o comando
   * retido e as chaves de idempotência da criação em andamento. Os dois descrevem o mesmo processo
   * e são esquecidos juntos: deixar as chaves para trás faria o próximo envio repetir o cadastro
   * anterior.
   */
  private limparEditor(): void {
    this.store.reset();
    this.cadastro.descartarCadastroEmAndamento();
    this.catalogosDeClassificacao.esquecerPesosAreaEnem();

    // A rota reusa a página, então o resumo aberto sobreviveria à troca: confirmá-lo resolveria o
    // passo pelo estado novo enquanto exibe os dados do editor anterior. O efeito que o zera ao
    // trocar de passo só roda na detecção de mudanças, depois da leitura que já saiu.
    this.conducao.confirmacaoPendente.set(null);

    // O rastro do rascunho descreve o processo que estava aberto: sem esquecê-lo, a guarda de saída
    // perguntaria sobre a transcrição do processo anterior.
    this.rascunho.esquecer();
  }

  /**
   * O stepper de um processo retomado mostra o que o servidor tem gravado e conforme, não a
   * navegação desta sessão, que recomeça vazia a cada abertura. Sem o checklist não há como
   * afirmar a conformidade, então nenhum passo é dado por concluído, em vez de um verde que a
   * Revisão contradiria.
   */
  private async derivarPassosConcluidos(
    detalhe: ProcessoSeletivoDto,
    superada: () => boolean,
  ): Promise<void> {
    const checklist = await firstValueFrom(this.publicacaoApi.obterConformidade(detalhe.id));
    if (superada() || !isApiOk(checklist)) return;
    this.store.syncCompleted(passosConcluidosDe(detalhe, checklist.data.itens));
  }

  /**
   * Um único documento confirmado restaura o vínculo sozinho; havendo mais de um, a escolha é do
   * administrador (CA-06), porque presumir o mais recente trocaria o edital do certame em silêncio.
   *
   * Falha aqui não bloqueia o editor: o aviso diz que o anexo existente não pôde ser verificado,
   * para o operador não concluir que não há nenhum.
   */
  private async restaurarDocumentoEdital(
    processoSeletivoId: string,
    superada: () => boolean,
  ): Promise<void> {
    if (!this.conducao.podePublicar()) return;
    const resultado = await firstValueFrom(
      this.documentosApi.listarDocumentosAPublicar(
        processoSeletivoId,
        FinalidadeDoDocumento.documentoDoEdital,
      ),
    );
    if (superada()) return;

    if (!isApiOk(resultado)) {
      this.store.avisoDocumentos.set(
        'Não foi possível verificar se este processo já tem edital anexado. Confira antes de enviar outro.',
      );
      return;
    }

    this.store.avisoDocumentos.set(null);

    const { vinculo, escolha } = classificarDocumentos(resultado.data);
    if (vinculo !== null) {
      this.store.projetarSecao('identificacao', { uploads: [vinculo] });
    }
    this.store.documentosParaEscolha.set(escolha);
  }
}
