import type { CaminhoDeTela } from '../acesso/permissoes-das-telas';

export interface ItemDoMenu {
  readonly label: string;
  readonly icon: string;
  readonly routerLink?: string;
  readonly exact?: boolean;
  /** Tela protegida cuja permissão libera a entrada; ausente, basta a sessão. */
  readonly tela?: CaminhoDeTela;
}

export interface GrupoDoMenu {
  readonly label: string;
  readonly items: readonly ItemDoMenu[];
}

export const MENU_LATERAL: readonly GrupoDoMenu[] = [
  {
    label: 'Acompanhamento',
    items: [
      {
        label: 'Painel de processos',
        icon: 'pi-table',
        routerLink: '/dashboard',
      },
    ],
  },
  {
    label: 'Cadastro',
    items: [
      {
        label: 'Processos seletivos',
        icon: 'pi-file',
        routerLink: '/processo-seletivo',
        tela: 'processo-seletivo',
      },
    ],
  },
];
