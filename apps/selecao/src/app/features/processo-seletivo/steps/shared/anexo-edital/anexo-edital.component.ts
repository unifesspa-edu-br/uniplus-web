import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  FileUploadComponent,
  ValorEmConsultaComponent,
  type ArquivoEmEnvio,
} from '@uniplus/shared-ui/components';
import { ProblemI18nService, isApiOk, abrirAcessoEmNovaAba } from '@uniplus/shared-core/http';
import { DocumentoAPublicarDto } from '@uniplus/shared-data/selecao';

import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { EnvioDoEdital } from '../envio-do-edital.service';
import { classificarDocumentos, descreverDocumento, uploadItemDe } from '../hidratacao';
import { EtapasDoEnvioDoEdital } from './etapas-do-envio-do-edital';

/** Limite do documento do edital no domínio: 20 MB. */
const TAMANHO_MAXIMO_MB = 20;

/**
 * Anexo do documento oficial do edital.
 *
 * Vive junto da publicação, não da identificação: o edital é o ato normativo que publica o
 * certame, e exigi-lo antes de haver configuração publicável invertia a ordem, porque a rota do
 * documento pede um processo já existente. O envio em três fases é das etapas do envio.
 */
@Component({
  selector: 'sel-anexo-edital',
  imports: [FileUploadComponent, ValorEmConsultaComponent],
  templateUrl: './anexo-edital.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [EtapasDoEnvioDoEdital],
})
export class AnexoEditalComponent {
  protected readonly store = inject(ProcessoSeletivoStore);
  protected readonly etapas = inject(EtapasDoEnvioDoEdital);
  private readonly envioDoEdital = inject(EnvioDoEdital);
  private readonly problemI18n = inject(ProblemI18nService);

  protected readonly tamanhoMaximoMb = TAMANHO_MAXIMO_MB;
  protected readonly reverificando = signal(false);

  /** Documento cujo acesso está sendo pedido, para o botão anunciar a espera. */
  protected readonly abrindoDocumento = signal<string | null>(null);

  /** Recusa da abertura, exibida junto do documento que falhou. */
  readonly erroDeAbertura = signal<string | null>(null);

  /** O anexo na forma que a lista do `ui-file-upload` exibe. */
  protected readonly itens = computed<readonly ArquivoEmEnvio[]>(() => {
    const item = this.etapas.anexo();
    if (item === undefined) return [];
    return [
      {
        id: item.id,
        nome: item.name,
        fase: item.fase,
        progresso: item.progress,
        mensagem: item.mensagemErro,
        podeTentarDeNovo: this.etapas.podeRetomar(),
        podeRetirar: !this.etapas.anexoBloqueado(),
      },
    ];
  });

  /** Metadados que distinguem um confirmado do outro na escolha do oficial. */
  protected descrever(documento: DocumentoAPublicarDto): string {
    return descreverDocumento(documento);
  }

  /**
   * Abre o PDF de um documento confirmado numa aba nova, pedindo o acesso à API no clique
   * (`abrirAcessoEmNovaAba`, que explica por que a URL não fica guardada).
   */
  async abrirDocumento(documentoAPublicarId: string): Promise<void> {
    const processoId = this.store.processoSeletivoId();
    if (processoId === null || this.abrindoDocumento() !== null) return;

    const geracao = this.store.geracao();
    this.abrindoDocumento.set(documentoAPublicarId);
    this.erroDeAbertura.set(null);
    try {
      const desfecho = await abrirAcessoEmNovaAba(
        () => this.envioDoEdital.obterAcessoAoDocumento(processoId, documentoAPublicarId),
        () => geracao === this.store.geracao(),
      );
      if (desfecho.situacao === 'bloqueada') {
        this.erroDeAbertura.set(
          'O navegador bloqueou a abertura do edital. Permita pop-ups para este endereço e tente de novo.',
        );
      } else if (desfecho.situacao === 'recusada') {
        this.erroDeAbertura.set(this.problemI18n.resolve(desfecho.problem).title);
      }
    } finally {
      this.abrindoDocumento.set(null);
    }
  }

  /** Refaz a leitura que falhou, para o anexo deixar de ser uma aposta. */
  async reverificarDocumentos(): Promise<void> {
    const id = this.store.processoSeletivoId();
    if (id === null || this.reverificando()) return;

    const geracao = this.store.geracao();
    this.reverificando.set(true);
    try {
      const resultado = await this.envioDoEdital.listarDocumentos(id);
      // O editor pode ter passado a outro processo enquanto a leitura corria.
      if (geracao !== this.store.geracao() || !isApiOk(resultado)) return;

      const { vinculo, escolha } = classificarDocumentos(resultado.data);
      if (vinculo !== null) {
        this.store.projetarSecao('identificacao', { uploads: [vinculo] });
      }
      this.store.documentosParaEscolha.set(escolha);
      this.store.avisoDocumentos.set(null);
    } finally {
      this.reverificando.set(false);
    }
  }

  /**
   * Decisão explícita entre documentos confirmados. O wizard nunca elege sozinho: adotar o mais
   * recente trocaria o edital do certame sem o operador perceber.
   */
  escolherDocumentoConfirmado(documento: DocumentoAPublicarDto): void {
    this.store.projetarSecao('identificacao', { uploads: [uploadItemDe(documento)] });
    this.store.documentosParaEscolha.set([]);
  }
}
