import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom, type Observable } from 'rxjs';
import {
  ProblemI18nService,
  coletarPaginas,
  isApiOk,
  type ApiResult,
} from '@uniplus/shared-core/http';
import { withIdempotencyKey } from '@uniplus/shared-core/idempotency';
import { PERMISSAO, PermissoesService } from '@uniplus/shared-auth/bootstrap';
import {
  MotivosDeDecisaoApi,
  MotivosDoProcessoApi,
  type MotivoDeDecisaoDoProcessoDto,
  type MotivoDeDecisaoDto,
} from '@uniplus/shared-data/selecao';
import type { RecusaDoCampo } from '@uniplus/shared-ui/components';

import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import type { ModoDaSecao } from '../../../shared/modo-da-secao';
import type {
  IdentidadeDoMotivo,
  MotivoNoDocumento,
} from '../../../shared/motivos/motivo-no-documento';
import { FasesNoServidor } from '../../cronograma/servicos/fases-no-servidor.service';
import { FaseEmEdicao } from '../fase-em-edicao';
import {
  comoMotivoNoDocumento,
  ehDesfavoravelDaHomologacao,
  escolhidosDaFase,
  idDoEscolhido,
  idNoCadastro,
  TIPO_DA_HOMOLOGACAO,
} from './motivos-escolhidos-da-fase';
import { desfechoDaRecusa, recusaDaEscolha } from './recusa-da-escolha-do-motivo';

const MENSAGEM_DE_FALHA = 'Não foi possível carregar os motivos desta fase.';

/** A escolha que a pessoa pediu: incluir o motivo na fase ou retirá-lo dela. */
interface PedidoDeEscolha {
  readonly acao: 'incluir' | 'retirar';
  readonly motivoDeDecisaoId: string;
}

/**
 * Os motivos de decisão que a fase aberta escolhe. A escolha grava na hora, fora do cronograma, e
 * a lista que a tela mostra é sempre a do servidor: depois de cada gravação, dê certo ou não, a
 * escolha do processo é lida de novo. Cada passo da fase tem a sua instância, porque o Cronograma
 * embute um passo por fase.
 */
@Injectable()
export class MotivosDaFaseStore {
  private readonly processo = inject(ProcessoSeletivoStore);
  private readonly faseEmEdicao = inject(FaseEmEdicao);
  private readonly fasesNoServidor = inject(FasesNoServidor);
  private readonly escolhaApi = inject(MotivosDoProcessoApi);
  private readonly cadastroApi = inject(MotivosDeDecisaoApi);
  private readonly permissoes = inject(PermissoesService);
  private readonly textos = inject(ProblemI18nService);

  private readonly escolhaDoProcesso = signal<readonly MotivoDeDecisaoDoProcessoDto[]>([]);
  private readonly pedidoSemResposta = signal<PedidoDeEscolha | null>(null);
  private readonly cadastroFalhou = signal(false);
  private readonly escolhaFalhou = signal(false);
  private ultimaLeitura = 0;
  private iniciada = false;

  /** Os motivos de homologação das inscrições do cadastro, desativados inclusive. */
  readonly cadastro = signal<readonly MotivoDeDecisaoDto[]>([]);
  readonly cadastroCarregado = signal(false);
  /** O cadastro e a escolha do processo estão sendo lidos. */
  readonly lendo = signal(false);
  /** Uma gravação, ou a leitura que a segue, está em curso: as caixas ficam desabilitadas. */
  readonly gravando = signal(false);
  /** A recusa da última gravação, com a mensagem, o código e a página dele. */
  readonly recusa = signal<RecusaDoCampo | null>(null);

  readonly falhaDeLeitura = computed(() =>
    this.cadastroFalhou() || this.escolhaFalhou() ? MENSAGEM_DE_FALHA : null,
  );

  /** A fase aberta já existe no servidor: só então a escolha de motivo tem onde gravar. */
  readonly faseGravada = computed(() => {
    return this.fasesNoServidor.origens().has(this.faseEmEdicao.faseAberta());
  });

  /** Os motivos que a fase escolheu, como o servidor os tem. */
  readonly escolhidos = computed<readonly MotivoNoDocumento[]>(() => {
    const aberta = this.faseEmEdicao.faseAberta();
    return escolhidosDaFase(this.escolhaDoProcesso(), aberta).map((motivo) =>
      comoMotivoNoDocumento(motivo, aberta),
    );
  });

  /** Os motivos que uma condição da homologação das inscrições pode apontar: os desfavoráveis que a fase escolheu. */
  readonly desfavoraveisDaHomologacao = computed(() =>
    this.escolhidos().filter(ehDesfavoravelDaHomologacao),
  );

  /** O servidor estava ocupado e não atendeu o último pedido: a pessoa pode pedir de novo. */
  readonly podeTentarDeNovo = computed(() => this.pedidoSemResposta() !== null);

  readonly modo = computed<ModoDaSecao>(() => {
    if (this.processo.emConsulta()) return 'consulta';
    const liberada =
      this.faseGravada() &&
      !this.gravando() &&
      !this.escolhaFalhou() &&
      this.processo.aceitaEdicao() &&
      this.permissoes.tem(PERMISSAO.selecao.processosConfigurar);
    return liberada ? 'edicao' : 'bloqueado';
  });

  /** Lê o cadastro e a escolha do processo, uma vez; `recarregar()` repete depois de uma falha. */
  carregar(): void {
    if (this.iniciada) return;
    void this.recarregar();
  }

  async recarregar(): Promise<void> {
    this.iniciada = true;
    this.lendo.set(true);
    try {
      await Promise.all([this.lerOCadastro(), this.reler()]);
    } finally {
      this.lendo.set(false);
    }
  }

  async escolher(motivo: MotivoNoDocumento): Promise<void> {
    const id = idNoCadastro(this.cadastro(), motivo);
    if (id !== null) await this.gravar({ acao: 'incluir', motivoDeDecisaoId: id });
  }

  async retirar(motivo: IdentidadeDoMotivo): Promise<void> {
    const id = idDoEscolhido(this.escolhaDaFase(), motivo);
    if (id !== null) await this.gravar({ acao: 'retirar', motivoDeDecisaoId: id });
  }

  /** Repete o último pedido que o servidor não atendeu por estar ocupado, com chave nova. */
  async tentarDeNovo(): Promise<void> {
    const pedido = this.pedidoSemResposta();
    if (pedido !== null) await this.gravar(pedido);
  }

  /** Lê a escolha do processo. Só a leitura mais recente vale; a que falha mantém a lista que já se tinha. */
  async reler(): Promise<void> {
    const processoId = this.processo.processoSeletivoId();
    if (processoId === null) return;
    const leitura = ++this.ultimaLeitura;
    const geracao = this.processo.geracao();
    const resultado = await firstValueFrom(this.escolhaApi.listar(processoId));
    if (leitura !== this.ultimaLeitura || geracao !== this.processo.geracao()) return;
    if (isApiOk(resultado)) this.escolhaDoProcesso.set(resultado.data);
    this.escolhaFalhou.set(!isApiOk(resultado));
  }

  private escolhaDaFase(): readonly MotivoDeDecisaoDoProcessoDto[] {
    return escolhidosDaFase(this.escolhaDoProcesso(), this.faseEmEdicao.faseAberta());
  }

  private async lerOCadastro(): Promise<void> {
    const geracao = this.processo.geracao();
    const resultado = await firstValueFrom(
      coletarPaginas((cursor) =>
        this.cadastroApi.listar({ tipo: TIPO_DA_HOMOLOGACAO, apenasAtivos: false, cursor }),
      ),
    );
    if (geracao !== this.processo.geracao()) return;
    if (isApiOk(resultado)) this.cadastro.set(resultado.data);
    this.cadastroCarregado.set(isApiOk(resultado));
    this.cadastroFalhou.set(!isApiOk(resultado));
  }

  private async gravar(pedido: PedidoDeEscolha): Promise<void> {
    const processoId = this.processo.processoSeletivoId();
    if (processoId === null || this.gravando()) return;
    const geracao = this.processo.geracao();
    this.comecarAGravar();
    try {
      const resultado = await firstValueFrom(this.enviar(processoId, pedido));
      if (geracao !== this.processo.geracao()) return;
      this.registrarAResposta(resultado, pedido);
      await this.reler();
    } finally {
      if (geracao === this.processo.geracao()) this.gravando.set(false);
    }
  }

  private comecarAGravar(): void {
    this.gravando.set(true);
    this.recusa.set(null);
    this.pedidoSemResposta.set(null);
  }

  private enviar(
    processoId: string,
    { acao, motivoDeDecisaoId }: PedidoDeEscolha,
  ): Observable<ApiResult<void>> {
    const faseCanonicaId = this.faseEmEdicao.faseAberta();
    const contexto = withIdempotencyKey();
    return acao === 'incluir'
      ? this.escolhaApi.incluirNaFase(processoId, faseCanonicaId, motivoDeDecisaoId, contexto)
      : this.escolhaApi.retirarDaFase(processoId, faseCanonicaId, motivoDeDecisaoId, contexto);
  }

  private registrarAResposta(resultado: ApiResult<void>, pedido: PedidoDeEscolha): void {
    if (isApiOk(resultado)) return;
    const desfecho = desfechoDaRecusa(resultado);
    if (desfecho === 'ja-estava-como-pedido') return;
    if (desfecho === 'tentar-de-novo') this.pedidoSemResposta.set(pedido);
    this.recusa.set(recusaDaEscolha(resultado, this.textos));
  }
}
