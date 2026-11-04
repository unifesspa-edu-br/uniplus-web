import { ChangeDetectionStrategy, Component } from '@angular/core';

interface PassoComoFunciona {
  readonly numero: number;
  readonly titulo: string;
  readonly descricao: string;
}

const PASSOS: readonly PassoComoFunciona[] = [
  {
    numero: 1,
    titulo: 'Crie sua conta',
    descricao: 'Use seu CPF e e-mail. Se já tem conta gov.br, é mais rápido.',
  },
  {
    numero: 2,
    titulo: 'Escolha um edital',
    descricao: 'Compare modalidade, vagas, datas e leia tudo antes de começar.',
  },
  {
    numero: 3,
    titulo: 'Preencha sua inscrição',
    descricao: 'Salve a qualquer momento e volte depois — você não perde nada.',
  },
  {
    numero: 4,
    titulo: 'Acompanhe o resultado',
    descricao: 'Receba notificações por e-mail e veja tudo em "Minhas inscrições".',
  },
];

/** Os passos da inscrição, da conta ao resultado, no fim da vitrine. */
@Component({
  selector: 'ptl-como-funciona',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './como-funciona.component.html',
  styleUrl: './como-funciona.component.css',
})
export class ComoFuncionaComponent {
  protected readonly passos = PASSOS;
}
