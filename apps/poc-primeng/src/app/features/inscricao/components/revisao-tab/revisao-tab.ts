import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormGroup } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TableModule } from 'primeng/table';

import type { InscricaoForm } from '../../services/inscricao-form.service';
import { CIDADES_MOCK, CURSOS_MOCK, MODALIDADES_COTA } from '../../models/inscricao.model';

interface ResumoLinha {
  campo: string;
  valor: string;
}

@Component({
  selector: 'poc-revisao-tab',
  standalone: true,
  imports: [TableModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 class="text-govbr-xl font-bold text-govbr-gray-80 mb-govbr-4">Revisão da Inscrição</h2>

    <p class="text-govbr-sm text-govbr-gray-60 mb-govbr-4">
      Confira os dados preenchidos antes de enviar sua inscrição.
    </p>

    <p-table [value]="linhas()" [tableStyle]="{ 'min-width': '100%' }">
      <ng-template #header>
        <tr>
          <th class="bg-govbr-primary text-govbr-pure-0 text-left px-govbr-4 py-govbr-3 text-govbr-sm font-semibold">Campo</th>
          <th class="bg-govbr-primary text-govbr-pure-0 text-left px-govbr-4 py-govbr-3 text-govbr-sm font-semibold">Valor informado</th>
        </tr>
      </ng-template>
      <ng-template #body let-linha let-i="rowIndex">
        <tr class="border-t border-govbr-gray-10 hover:bg-govbr-primary-lightest transition-colors"
            [class.bg-govbr-gray-2]="i % 2 === 1">
          <td class="px-govbr-4 py-govbr-3 text-govbr-sm text-govbr-gray-80">{{ linha.campo }}</td>
          <td class="px-govbr-4 py-govbr-3 text-govbr-sm text-govbr-gray-80">{{ linha.valor }}</td>
        </tr>
      </ng-template>
    </p-table>
  `,
})
export class RevisaoTabComponent {
  readonly form = input.required<FormGroup<InscricaoForm>>();
  private readonly destroyRef = inject(DestroyRef);

  private readonly linhasSignal = signal<ResumoLinha[]>([]);
  protected readonly linhas = this.linhasSignal.asReadonly();

  constructor() {
    effect(() => {
      const f = this.form();
      this.linhasSignal.set(this.buildLinhas(f.getRawValue()));
      f.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((value) => {
        this.linhasSignal.set(this.buildLinhas(value));
      });
    });
  }

  private buildLinhas(value: Partial<{
    nome: string;
    cpf: string;
    email: string;
    cursoId: string;
    cidadeId: string;
    modalidadeCota: string;
    opcaoCurso: string;
  }>): ResumoLinha[] {
    const curso = CURSOS_MOCK.find((c) => c.id === value.cursoId);
    const cidade = CIDADES_MOCK.find((c) => c.id === value.cidadeId);
    const mod = MODALIDADES_COTA.find((m) => m.id === value.modalidadeCota);
    const opcao =
      value.opcaoCurso === 'primeira'
        ? '1ª Opção'
        : value.opcaoCurso === 'segunda'
          ? '2ª Opção'
          : '';

    return [
      { campo: 'Nome completo', valor: value.nome || '—' },
      { campo: 'CPF', valor: value.cpf || '—' },
      { campo: 'E-mail', valor: value.email || '—' },
      { campo: 'Curso', valor: curso?.nome ?? '—' },
      { campo: 'Cidade', valor: cidade ? `${cidade.nome} — ${cidade.uf}` : '—' },
      { campo: 'Modalidade de concorrência', valor: mod?.label ?? '—' },
      { campo: 'Opção de curso', valor: opcao || '—' },
    ];
  }
}
