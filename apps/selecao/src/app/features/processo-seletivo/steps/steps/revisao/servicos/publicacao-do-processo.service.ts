import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { ProblemDetails, ProblemI18nService } from '@uniplus/shared-core/http';
import { AtoNormativoDto, AtosApi } from '@uniplus/shared-data/publicacoes';
import { SnapshotVigenteDto, StatusProcesso } from '@uniplus/shared-data/selecao';
import { firstValueFrom } from 'rxjs';

import { ValidacaoDoPasso } from '../../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { CadastroInicial } from '../../../shared/cadastro-inicial.service';
import {
  gravarNoPasso,
  RESPOSTA_DESCARTADA,
  RespostaDescartada,
} from '../../../shared/gravacao/gravacao-no-passo';
import { CatalogosDoCronograma } from '../../cronograma/catalogos-do-cronograma.service';
import { comoComandoDePublicacao } from '../comando-de-publicacao';
import { ConferenciaDaPublicacao } from './conferencia-da-publicacao.service';

/**
 * O ato vigente de um processo já publicado. A tela o lê do servidor ao abrir, porque o
 * formulário do ato só guarda o que esta sessão transcreveu antes de publicar.
 */
export type AtoPublicado =
  | { readonly estado: 'lendo' }
  | { readonly estado: 'lido'; readonly ato: AtoNormativoDto }
  | { readonly estado: 'falha' };

const PUBLICACAO_NAO_CONFIRMADA =
  'A publicação foi aceita, mas não foi possível confirmar o estado do processo. Recarregue a página para conferir.';

function recusado(mensagem: string): ValidacaoDoPasso {
  return { valid: false, messages: [mensagem] };
}

/**
 * A publicação do processo e o que ela produz: o comando, a releitura que a confirma e o ato
 * vigente de um processo já publicado.
 */
@Injectable()
export class PublicacaoDoProcesso {
  private readonly store = inject(ProcessoSeletivoStore);
  private readonly conferencia = inject(ConferenciaDaPublicacao);
  private readonly cadastro = inject(CadastroInicial);
  private readonly atos = inject(AtosApi);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly catalogosDoCronograma = inject(CatalogosDoCronograma);

  /** O snapshot lido depois do `204`: só existe quando esta sessão acabou de publicar. */
  readonly snapshotConfirmado = signal<SnapshotVigenteDto | null>(null);

  /** O ato vigente, para processo publicado; `null` enquanto não há o que ler. */
  readonly atoPublicado = signal<AtoPublicado | null>(null);

  /**
   * Se o processo tem versão publicada e, portanto, um ato vigente a mostrar no lugar do
   * formulário. Só `publicado` garante isso: cancelado ou encerrado não dizem se houve publicação,
   * e ler o snapshot vigente de um rascunho cancelado falharia e esconderia a transcrição que ele guarda.
   */
  readonly jaPublicado = computed(
    () => this.store.remoteSnapshot()?.status === StatusProcesso.publicado,
  );

  /** O ato da versão vigente, quando já foi lido: é nele que estão os anexos publicados do edital. */
  readonly atoVigenteId = computed(() => {
    const leitura = this.atoPublicado();
    return leitura?.estado === 'lido' ? leitura.ato.id : null;
  });

  constructor() {
    effect(() => {
      this.store.geracao();
      untracked(() => {
        this.snapshotConfirmado.set(null);
        this.atoPublicado.set(null);
      });
    });

    // Processo publicado: o ato que vale é o do servidor, lido uma vez ao entrar no passo.
    effect(() => {
      const id = this.store.processoSeletivoId();
      if (id === null || !this.store.isLast() || !this.jaPublicado()) return;
      if (untracked(() => this.atoPublicado()) !== null) return;
      untracked(() => void this.lerAtoPublicado(id));
    });
  }

  /**
   * Lê o ato vigente: o `atoId` vem do snapshot publicado, e o ato, da Publicações. Quando esta
   * sessão acabou de publicar, o snapshot já relido serve, sem ler de novo.
   */
  async lerAtoPublicado(processoId: string): Promise<void> {
    const geracao = this.store.geracao();
    this.atoPublicado.set({ estado: 'lendo' });

    const atoId =
      this.snapshotConfirmado()?.atoId ?? (await this.atoIdDoSnapshotVigente(processoId));
    if (geracao !== this.store.geracao()) return;
    if (atoId === null) {
      this.atoPublicado.set({ estado: 'falha' });
      return;
    }

    const ato = await firstValueFrom(this.atos.obter(atoId));
    if (geracao !== this.store.geracao()) return;
    this.atoPublicado.set(ato.ok ? { estado: 'lido', ato: ato.data } : { estado: 'falha' });
  }

  /** Publica e, com `204`, confirma o snapshot antes de devolver sucesso. */
  async persistir(): Promise<ValidacaoDoPasso> {
    const processoId = this.store.processoSeletivoId();
    if (processoId === null)
      return recusado('Conclua a identificação do processo antes de publicar.');

    const conferencia = this.conferencia.validate();
    if (!conferencia.valid) return conferencia;

    // A conferência já cobre a ausência do documento; a checagem estreita o tipo para o comando.
    const documentoId = this.conferencia.documentoAPublicarId();
    if (documentoId === null) return { valid: false, messages: [] };

    return gravarNoPasso(this.store, () => this.publicar(processoId, documentoId));
  }

  private async publicar(
    processoId: string,
    documentoEditalId: string,
  ): Promise<ValidacaoDoPasso | RespostaDescartada> {
    const comando = comoComandoDePublicacao(
      this.store.draft(),
      documentoEditalId,
      this.catalogosDoCronograma.fasePorId(),
    );
    const geracao = this.store.geracao();
    this.conferencia.descartarRecusa();

    const resultado = await this.cadastro.publicar(processoId, comando);
    if (geracao !== this.store.geracao()) return RESPOSTA_DESCARTADA;
    if (!resultado.ok) return this.recusada(resultado);

    const confirmado = await this.confirmarPublicacao(processoId);
    if (geracao !== this.store.geracao()) return RESPOSTA_DESCARTADA;
    return confirmado ? { valid: true } : recusado(PUBLICACAO_NAO_CONFIRMADA);
  }

  private recusada(resultado: {
    readonly problem: ProblemDetails;
    readonly inconclusiva: boolean;
  }): ValidacaoDoPasso {
    // Sem resposta conclusiva o comando pode já ter sido executado. Editar um campo antes de tentar
    // de novo giraria a chave de idempotência e deixaria o retry correr contra a primeira tentativa,
    // por isso a tela segue travada até uma releitura dizer o que o servidor tem.
    if (resultado.inconclusiva) this.store.publicacaoNaoConfirmada.set(true);

    const titulo = this.problemI18n.resolve(resultado.problem).title;
    this.conferencia.registrarRecusa(resultado.problem, titulo);
    return recusado(titulo);
  }

  /**
   * Relê o detalhe e o snapshot vigente depois do `204`. A hidratação do detalhe é o que leva o
   * wizard a somente leitura, e por isso não espera pelo snapshot: o processo pode já estar
   * publicado, mesmo que a leitura do snapshot falhe.
   */
  private async confirmarPublicacao(processoId: string): Promise<boolean> {
    const [detalhe, snapshot] = await Promise.all([
      this.cadastro.obterDetalhe(processoId),
      this.cadastro.obterSnapshotVigente(processoId),
    ]);

    // Sem o detalhe, ou com ele ainda em rascunho (réplica que não viu a escrita, ou falha real), não
    // há como confirmar nem descartar a publicação. A edição segue travada até uma releitura mostrar
    // um status definitivo.
    if (!detalhe.ok || detalhe.data.status === StatusProcesso.rascunho) {
      this.store.publicacaoNaoConfirmada.set(true);
      return false;
    }

    this.store.hidratar(detalhe.data);
    if (!snapshot.ok) return false;

    this.snapshotConfirmado.set(snapshot.data);
    return detalhe.data.status === StatusProcesso.publicado;
  }

  private async atoIdDoSnapshotVigente(processoId: string): Promise<string | null> {
    const snapshot = await this.cadastro.obterSnapshotVigente(processoId);
    return snapshot.ok ? snapshot.data.atoId : null;
  }
}
