export interface ItemDaNavegacao {
  readonly label: string;
  readonly icon: string;
  readonly routerLink?: string;
  readonly requiresAuth?: boolean;
}

export const NAVEGACAO_DO_PORTAL: readonly ItemDaNavegacao[] = [
  { label: 'Editais', icon: 'pi-calendar', routerLink: '/processos' },
  {
    label: 'Minhas inscrições',
    icon: 'pi-check-square',
    routerLink: '/inscricao',
    requiresAuth: true,
  },
  { label: 'Ajuda', icon: 'pi-question-circle' },
];
