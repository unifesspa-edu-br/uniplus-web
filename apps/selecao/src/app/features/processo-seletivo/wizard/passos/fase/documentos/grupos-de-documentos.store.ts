import { Injectable, computed, inject } from '@angular/core';

import type { ExigenciasDoRascunho, RegraDeComprovacao } from '../../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { documentosDe } from '../../../shared/exigencias/consulta-das-exigencias';
import {
  criarGrupo,
  editarGrupo,
  incluirNoGrupo,
  retirarDoGrupo,
  trocarCriterioDeDistincao,
  trocarFormaDoGrupo,
  trocarQuantidadeMinima,
} from '../../../shared/exigencias/composicao-dos-grupos';
import { criarIdentificadorDaRegra } from '../../../shared/exigencias/identificador-da-regra';
import { FaseEmEdicao } from '../fase-em-edicao';

@Injectable()
export class GruposDeDocumentosStore {
  private readonly processo = inject(ProcessoSeletivoStore);
  private readonly fase = inject(FaseEmEdicao);

  readonly documentosSoltos = computed(() => {
    const codigo = this.fase.faseDoRascunho()?.codigo;
    const exigencias = this.processo.draft().documentos;
    return exigencias.regrasDeComprovacao.filter(
      (regra) =>
        regra.forma === 'DOCUMENTO' &&
        regra.documento !== null &&
        regra.documento.faseCodigo === codigo &&
        !exigencias.emTodasAsFases.includes(regra.documento.tipoDocumentoId),
    );
  });

  readonly grupos = computed(() =>
    gruposDaFase(
      this.processo.draft().documentos.regrasDeComprovacao,
      this.fase.faseDoRascunho()?.codigo,
    ),
  );

  criar(identificadores: readonly string[]): void {
    this.atualizar((exigencias) =>
      criarGrupo(exigencias, identificadores, criarIdentificadorDaRegra()),
    );
  }

  trocarForma(identificador: string, forma: 'TODOS_OS_ITENS' | 'QUANTIDADE_MINIMA_DE_ITENS'): void {
    this.atualizar((exigencias) => trocarFormaDoGrupo(exigencias, identificador, forma));
  }

  trocarQuantidade(identificador: string, quantidade: number): void {
    this.atualizar((exigencias) => trocarQuantidadeMinima(exigencias, identificador, quantidade));
  }

  trocarCriterio(identificador: string, criterio: string | null): void {
    this.atualizar((exigencias) => trocarCriterioDeDistincao(exigencias, identificador, criterio));
  }

  incluir(identificador: string, item: string): void {
    this.atualizar((exigencias) => incluirNoGrupo(exigencias, identificador, item));
  }

  retirar(identificador: string, item: string): void {
    this.atualizar((exigencias) => retirarDoGrupo(exigencias, identificador, item));
  }

  editar(
    identificador: string,
    alteracao: Pick<RegraDeComprovacao, 'consequencia' | 'basesLegais'>,
  ): void {
    this.atualizar((exigencias) => editarGrupo(exigencias, identificador, alteracao));
  }

  private atualizar(operacao: (exigencias: ExigenciasDoRascunho) => ExigenciasDoRascunho): void {
    this.processo.patchSection('documentos', operacao(this.processo.draft().documentos));
  }
}

function gruposDaFase(
  regras: readonly RegraDeComprovacao[],
  codigo: string | undefined,
): readonly RegraDeComprovacao[] {
  return regras.flatMap((regra) => {
    if (regra.forma === 'DOCUMENTO') return [];
    const documentos = documentosDe([regra]);
    const grupo = documentos.some((documento) => documento.faseCodigo === codigo) ? [regra] : [];
    return [...grupo, ...gruposDaFase(regra.itens ?? [], codigo)];
  });
}
