import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  ProblemI18nService,
  isApiOk,
  type ApiFailure,
  type ApiOk,
  type ApiResult,
} from '@uniplus/shared-core/http';
import {
  ProcessosSeletivosApi,
  RetificacaoDoProcessoApi,
  SituacaoDoProcessoSeletivoCodigo,
  type DocumentoDaConfiguracao,
  type ProcessoSeletivoDto,
} from '@uniplus/shared-data/selecao';

import { motivoDaFalhaDeLeitura } from '../editor/motivo-da-falha-de-leitura';
import { ehIdentificadorDoProcesso } from '../identificador-do-processo';
import { LeiturasEmOrdem } from '../leitura';
import type { MotivoFalhaDeLeitura } from '../wizard/processo-seletivo.models';
import { RetificacaoEmEdicao } from './retificacao-em-edicao';
import { versaoBaseDaResposta } from './versao-base-da-retificacao';

/** Onde a leitura da versão vigente está, e o que a página deve fazer em cada caso. */
export type EstadoDaLeituraDaVersaoVigente =
  | { readonly estado: 'lendo' }
  | { readonly estado: 'falha'; readonly motivo: MotivoFalhaDeLeitura; readonly mensagem: string }
  | { readonly estado: 'voltarAConsulta' }
  | { readonly estado: 'aberta'; readonly processo: ProcessoSeletivoDto };

/** Só o processo nestas situações se retifica; qualquer outra volta à consulta. */
const SITUACOES_QUE_ADMITEM_RETIFICACAO: readonly SituacaoDoProcessoSeletivoCodigo[] = [
  SituacaoDoProcessoSeletivoCodigo.PUBLICADO,
];

const SEM_VERSAO_IDENTIFICADA =
  'A configuração vigente chegou sem a identificação da versão. Tente novamente.';

/**
 * Lê o que a retificação precisa para abrir: a situação do processo e a configuração da versão
 * vigente, juntas. Só leitura; nada é gravado. Cada leitura carimba a sua vez, e a resposta de uma
 * leitura superada, por troca de processo ou nova tentativa, é descartada.
 */
@Injectable()
export class LeituraDaVersaoVigente {
  private readonly processosApi = inject(ProcessosSeletivosApi);
  private readonly retificacaoApi = inject(RetificacaoDoProcessoApi);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly edicao = inject(RetificacaoEmEdicao);
  private readonly ordem = new LeiturasEmOrdem();
  private idAtual: string | null = null;

  private readonly _estado = signal<EstadoDaLeituraDaVersaoVigente>({ estado: 'lendo' });
  readonly estado = this._estado.asReadonly();

  async ler(id: string): Promise<void> {
    const vigente = this.ordem.iniciar();
    this.idAtual = id;
    this.edicao.fechar();
    if (!ehIdentificadorDoProcesso(id)) {
      this._estado.set(this.falhaDeEndereco());
      return;
    }
    this._estado.set({ estado: 'lendo' });
    const [situacao, configuracao] = await Promise.all([
      firstValueFrom(this.processosApi.obter(id)),
      firstValueFrom(this.retificacaoApi.lerConfiguracaoDaVersao(id)),
    ]);
    if (vigente()) this._estado.set(this.desfechoDe(id, situacao, configuracao));
  }

  /** Repete a leitura do processo em tela. */
  async recarregar(): Promise<void> {
    if (this.idAtual !== null) await this.ler(this.idAtual);
  }

  private desfechoDe(
    id: string,
    situacao: ApiResult<ProcessoSeletivoDto>,
    configuracao: ApiResult<DocumentoDaConfiguracao>,
  ): EstadoDaLeituraDaVersaoVigente {
    if (!isApiOk(situacao)) return this.falhaDe(situacao);
    const processo = situacao.data;
    if (!SITUACOES_QUE_ADMITEM_RETIFICACAO.includes(processo.situacao.codigo)) {
      return { estado: 'voltarAConsulta' };
    }
    return isApiOk(configuracao)
      ? this.abrirEdicao(id, processo, configuracao)
      : this.falhaDe(configuracao);
  }

  private abrirEdicao(
    id: string,
    processo: ProcessoSeletivoDto,
    configuracao: ApiOk<DocumentoDaConfiguracao>,
  ): EstadoDaLeituraDaVersaoVigente {
    const base = versaoBaseDaResposta(id, configuracao);
    if (base === null) {
      return { estado: 'falha', motivo: 'falhaTemporaria', mensagem: SEM_VERSAO_IDENTIFICADA };
    }
    this.edicao.abrir(base);
    return { estado: 'aberta', processo };
  }

  private falhaDeEndereco(): EstadoDaLeituraDaVersaoVigente {
    return {
      estado: 'falha',
      motivo: 'idInvalido',
      mensagem: 'O endereço não aponta para um identificador de processo válido.',
    };
  }

  private falhaDe(falha: ApiFailure): EstadoDaLeituraDaVersaoVigente {
    return {
      estado: 'falha',
      motivo: motivoDaFalhaDeLeitura(falha.problem.status),
      mensagem: this.problemI18n.resolve(falha.problem).title,
    };
  }
}
