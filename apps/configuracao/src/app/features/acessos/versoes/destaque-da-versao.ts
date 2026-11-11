import { Injector, Signal, afterNextRender, effect, inject, untracked } from '@angular/core';
import { focoEstaLivre } from '../../../shared/foco';

export const ID_DO_TITULO_DA_VERSAO_PENDENTE = 'cfg-perfil-pendente';

function levarOFocoAoTitulo(): void {
  const titulo = document.getElementById(ID_DO_TITULO_DA_VERSAO_PENDENTE);
  if (titulo === null || !(focoEstaLivre() || document.activeElement === titulo)) return;
  titulo.scrollIntoView({ block: 'start' });
  titulo.focus();
}

/**
 * Quando a versão do link é a pendente, a tela rola até o título dela e o foco vai para ele, uma
 * única vez por versão aberta: ao navegar para outra versão na mesma página, o destaque se repete.
 * Se a pessoa já levou o foco a outro lugar enquanto a leitura chegava, a tela não o tira dela.
 *
 * Recebe o id da versão do link quando ela é a pendente, `null` caso contrário. Chamar em
 * contexto de injeção.
 */
export function destacarAVersaoPendente(versaoDestacavel: Signal<string | null>): void {
  const injector = inject(Injector);
  let destacada: string | null = null;
  effect(() => {
    const versaoId = versaoDestacavel();
    if (versaoId === destacada) return;
    destacada = versaoId;
    if (versaoId !== null) untracked(() => afterNextRender(levarOFocoAoTitulo, { injector }));
  });
}
