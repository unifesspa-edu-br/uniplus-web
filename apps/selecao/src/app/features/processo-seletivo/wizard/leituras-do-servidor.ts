import type { ProcessoSeletivoDto } from '@uniplus/shared-data/selecao';

import type { ProcessoSeletivoStore } from './processo-seletivo.store';
import { desempateDe, hidratarDraft } from './shared/hidratacao';
import { regrasDasModalidadesOfertadas } from './shared/regras-das-modalidades';

/**
 * Projeta o detalhe canônico sobre o rascunho (CA-05) e marca o processo como já criado: os campos
 * do comando de identificação ficam bloqueados, como depois de uma criação nesta sessão, porque o
 * contrato não expõe atualização deles.
 */
export function hidratarProcesso(store: ProcessoSeletivoStore, dto: ProcessoSeletivoDto): void {
  if (store.processoSeletivoId() !== dto.id) {
    store.geracao.update((valor) => valor + 1);
    store.classificacao.aoTrocarDeProcesso();
  }
  // Qualquer releitura que chegue até aqui traz o status atual do servidor e resolve a incerteza
  // de `publicacaoNaoConfirmada`, publicado ou não.
  store.publicacaoNaoConfirmada.set(false);
  store.remoteSnapshot.set(dto);
  registrarGravadoLido(store, dto);
  store.processoSeletivoId.set(dto.id);
  store.draft.update((draft) => hidratarDraft(draft, dto));
}

/**
 * O que o servidor tem e contra o que as gravações são conferidas: a classificação, os critérios
 * de desempate e as regras congeladas das modalidades, lidos do detalhe. A releitura depois de
 * gravar não mexe no rascunho.
 */
export function registrarGravadoLido(store: ProcessoSeletivoStore, dto: ProcessoSeletivoDto): void {
  store.classificacao.registrarLida(dto.classificacao);
  store.classificacao.criteriosDesempateGravados.set(desempateDe(dto));
  registrarRegrasDasModalidades(store, dto);
  registrarVagasGravadas(store, dto);
}

export function registrarVagasGravadas(
  store: ProcessoSeletivoStore,
  dto: ProcessoSeletivoDto,
): void {
  store.opcoesDeCursoGravadas.set(dto.opcoesDeCurso?.numero ?? null);
  store.vagasGravadasDefasadas.set(false);
}

export function registrarRegrasDasModalidades(
  store: ProcessoSeletivoStore,
  dto: ProcessoSeletivoDto,
): void {
  store.regrasDasModalidades.set(regrasDasModalidadesOfertadas(dto));
}
