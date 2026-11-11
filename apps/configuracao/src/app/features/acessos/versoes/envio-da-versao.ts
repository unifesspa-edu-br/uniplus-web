import { Injectable, inject } from '@angular/core';
import { ChaveDeSubstituicao, comChave, type ProblemDetails } from '@uniplus/shared-core/http';
import {
  PerfisApi,
  VersoesDoPerfilApi,
  type DadosDaVersaoRequest,
  type EnvioDoDocumentoDto,
  type ProporVersaoRequest,
  type RemoverPermissoesRequest,
} from '@uniplus/shared-data/autorizacao';
import { DocumentoDaVersaoService, type AoAndar } from './documento-da-versao.service';

/** O que a tela envia: um perfil novo, uma proposta de versão ou a retirada de permissões. */
export type PlanoDeEnvio =
  | { readonly tipo: 'criacao'; readonly corpo: DadosDaVersaoRequest; readonly arquivo: File }
  | {
      readonly tipo: 'proposta';
      readonly perfilId: string;
      readonly corpo: ProporVersaoRequest;
      readonly arquivo: File;
    }
  | {
      readonly tipo: 'remocao';
      readonly perfilId: string;
      readonly corpo: RemoverPermissoesRequest;
    };

export type DesfechoDoEnvio =
  | { readonly tipo: 'concluido' }
  | { readonly tipo: 'sem_documento'; readonly mensagem: string }
  | {
      readonly tipo: 'recusado';
      readonly problema: ProblemDetails;
      /** A recusa não diz se a API executou o comando: repetir é seguro, sob a mesma chave. */
      readonly inconclusivo: boolean;
    };

function ehEnvio(resposta: object): resposta is EnvioDoDocumentoDto {
  return 'urlDeEnvio' in resposta;
}

/**
 * Envia o plano à API e, quando ele criou uma versão pendente, leva o PDF ao armazenamento. A
 * chave de idempotência acompanha o corpo: repetir o mesmo plano repete a mesma chave.
 */
@Injectable()
export class EnvioDaVersao {
  private readonly perfis = inject(PerfisApi);
  private readonly versoes = inject(VersoesDoPerfilApi);
  private readonly documento = inject(DocumentoDaVersaoService);
  private readonly chave = new ChaveDeSubstituicao();

  async executar(plano: PlanoDeEnvio, aoAndar: AoAndar): Promise<DesfechoDoEnvio> {
    aoAndar('registrando', 0);
    const { resultado, inconclusiva } = await comChave<object>(
      this.chave,
      { plano: plano.tipo, perfilId: this.perfilDe(plano), corpo: plano.corpo },
      (contexto) => this.enviar(plano, contexto),
    );
    if (!resultado.ok) {
      return { tipo: 'recusado', problema: resultado.problem, inconclusivo: inconclusiva };
    }
    if (plano.tipo === 'remocao' || !ehEnvio(resultado.data)) return { tipo: 'concluido' };
    return this.levarDocumento(resultado.data, plano.arquivo, aoAndar);
  }

  private perfilDe(plano: PlanoDeEnvio): string | null {
    return plano.tipo === 'criacao' ? null : plano.perfilId;
  }

  private enviar(plano: PlanoDeEnvio, contexto: Parameters<PerfisApi['criar']>[1]) {
    switch (plano.tipo) {
      case 'criacao':
        return this.perfis.criar(plano.corpo, contexto);
      case 'proposta':
        return this.versoes.propor(plano.perfilId, plano.corpo, contexto);
      case 'remocao':
        return this.perfis.remover(plano.perfilId, plano.corpo, contexto);
    }
  }

  private async levarDocumento(
    envio: EnvioDoDocumentoDto,
    arquivo: File,
    aoAndar: AoAndar,
  ): Promise<DesfechoDoEnvio> {
    const desfecho = await this.documento.enviar(envio, arquivo, aoAndar);
    return desfecho.ok ? { tipo: 'concluido' } : { tipo: 'sem_documento', mensagem: desfecho.mensagem };
  }
}
