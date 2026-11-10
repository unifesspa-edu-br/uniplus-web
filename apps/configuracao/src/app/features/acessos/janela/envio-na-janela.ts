import { HttpContext } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { ProblemI18nService, type ApiResult, type ProblemDetails } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import type { JanelaDeMigracaoDto } from '@uniplus/shared-data/autorizacao';
import type { Observable } from 'rxjs';
import { mensagemDaRecusa } from '../falha-de-servidor';
import { ChavesPorComando } from '../versoes/chaves-por-comando';
import { EscritaDoPerfil } from '../versoes/escrita-do-perfil';

const RAIZ = 'uniplus.autorizacao.migracao.';

/** A recusa mostra que a janela mudou: a tela é relida e a explicação continua à vista. */
const RECUSAS_QUE_MOSTRAM_OUTRO_ESTADO: readonly string[] = [
  'prazo_encerrado',
  'janela_encerrada',
  'janela_nao_encontrada',
  'janela_em_encerramento',
  'lote_ja_enviado',
  'concessao_ja_decidida',
].map((sufixo) => RAIZ + sufixo);

/** Envia uma operação da janela sob a chave de idempotência e cuida do desfecho que é comum a todas. */
@Injectable()
export class EnvioNaJanela {
  private readonly escrita = inject(EscritaDoPerfil);
  private readonly problemas = inject(ProblemI18nService);
  private readonly notificacoes = inject(NotificationService);
  private readonly chaves = new ChavesPorComando();
  /** O que mudou na janela quando a API recusou a operação; fica à vista depois da releitura. */
  readonly aviso = signal<string | null>(null);

  /**
   * Devolve a recusa da API, ou `null` quando a operação foi gravada. Cada comando guarda a própria
   * chave até o resultado se resolver: repetir o mesmo comando reusa a chave, e outro comando entre
   * as duas tentativas não a descarta.
   */
  async enviar(
    comando: string,
    corpo: unknown,
    chamada: (contexto: HttpContext) => Observable<ApiResult<JanelaDeMigracaoDto>>,
  ): Promise<ProblemDetails | null> {
    this.aviso.set(null);
    const { resultado } = await this.chaves.enviar(comando, corpo, chamada);
    return resultado.ok ? null : resultado.problem;
  }

  concluir(titulo: string): void {
    this.notificacoes.success(titulo);
    this.escrita.recarregar();
  }

  /**
   * O texto da recusa para o lugar onde a pessoa agiu. Quando a recusa diz que a janela já mudou,
   * a tela é relida, o texto vai para o aviso da página e a devolução é `null`.
   */
  tratar(problema: ProblemDetails): string | null {
    const texto = mensagemDaRecusa(this.problemas, this.notificacoes, problema);
    if (!RECUSAS_QUE_MOSTRAM_OUTRO_ESTADO.includes(problema.code)) return texto;
    this.aviso.set(texto);
    this.escrita.recarregar();
    return null;
  }
}
