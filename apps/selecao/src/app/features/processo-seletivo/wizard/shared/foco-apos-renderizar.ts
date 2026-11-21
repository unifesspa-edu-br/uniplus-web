import { afterNextRender, Injector } from '@angular/core';

/**
 * Leva o foco ao primeiro destino que existir e estiver habilitado, depois que a tela renderizar.
 *
 * A espera é por renderização, não por microtask: o ciclo de detecção do Angular roda depois que a
 * fila de microtasks drena, e consultar o DOM antes disso acharia o elemento que está prestes a
 * sair, ou não acharia o que está prestes a entrar. Os destinos vêm do preferido ao de reserva.
 * O destino que é um grupo de opções leva o foco a uma opção dele.
 */
export function focarAposRenderizar(injector: Injector, ...ids: readonly string[]): void {
  afterNextRender(() => primeiroDestinoDisponivel(ids)?.focus(), { injector });
}

/**
 * Como `focarAposRenderizar`, mas só recupera o foco que se perdeu: quem já levou o foco para
 * outro campo não é arrastado de volta.
 */
export function focarAposRenderizarSeSemFoco(injector: Injector, ...ids: readonly string[]): void {
  afterNextRender(
    () => {
      const ativo = document.activeElement;
      if (ativo !== null && ativo !== document.body) return;
      primeiroDestinoDisponivel(ids)?.focus();
    },
    { injector },
  );
}

/**
 * Como `focarAposRenderizar`, mas para quem chega de outro passo: espera também a troca de passo
 * devolver o foco ao título, para que o destino não o perca logo em seguida.
 */
export function focarAposATrocaDePasso(injector: Injector, ...ids: readonly string[]): void {
  afterNextRender(() => setTimeout(() => primeiroDestinoDisponivel(ids)?.focus(), 0), { injector });
}

/**
 * Se o foco está agora em `origem`, leva-o ao primeiro destino disponível depois que a tela
 * renderizar. Serve ao elemento que está prestes a sair da tela, como o parágrafo que ocupa o
 * lugar de um campo enquanto ele não pode ser usado: a pessoa que estava nele não perde o foco.
 * Chamar antes da renderização que remove `origem`.
 */
export function migrarFocoAposRenderizar(
  injector: Injector,
  origem: string,
  ...destinos: readonly string[]
): void {
  if (origem === '' || document.activeElement?.id !== origem) return;
  focarAposRenderizar(injector, ...destinos);
}

/**
 * O destino de um grupo de opções é a opção marcada, a primeira opção ou, sem opção nenhuma, o
 * parágrafo de situação que ocupa o lugar delas.
 */
function destinoDoGrupoDeOpcoes(grupo: HTMLElement): HTMLElement | null {
  return (
    grupo.querySelector<HTMLElement>('input[type="radio"]:checked') ??
    grupo.querySelector<HTMLElement>('input[type="radio"]') ??
    grupo.querySelector<HTMLElement>('[tabindex="-1"]')
  );
}

function destinoDe(id: string): HTMLElement | null {
  const elemento = document.getElementById(id);
  const ehGrupo = elemento?.getAttribute('role') === 'radiogroup';
  return ehGrupo ? destinoDoGrupoDeOpcoes(elemento as HTMLElement) : elemento;
}

function primeiroDestinoDisponivel(ids: readonly string[]): HTMLElement | undefined {
  return ids
    .map(destinoDe)
    .find(
      (elemento): elemento is HTMLElement =>
        elemento !== null && !(elemento as HTMLButtonElement).disabled,
    );
}
