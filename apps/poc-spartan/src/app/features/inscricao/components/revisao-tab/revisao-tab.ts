import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { CdkTableModule } from '@angular/cdk/table';
import { InscricaoForm } from '../../services/inscricao-form.service';
import { CURSOS_MOCK, CIDADES_MOCK, MODALIDADES_COTA } from '../../models/inscricao.model';

interface ResumoItem {
  campo: string;
  valor: string;
}

@Component({
  selector: 'poc-revisao-tab',
  standalone: true,
  imports: [CdkTableModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-govbr-5">
      <h2 class="text-govbr-xl font-bold text-govbr-primary-dark mb-govbr-4">
        Revisão da Inscrição
      </h2>

      <p class="text-govbr-base text-govbr-gray-60 mb-govbr-4">
        Confira os dados informados antes de enviar sua inscrição.
      </p>

      <table cdk-table [dataSource]="resumoData()"
             class="w-full border-collapse bg-govbr-pure-0 rounded-govbr-sm overflow-hidden shadow-sm">

        <!-- Coluna Campo -->
        <ng-container cdkColumnDef="campo">
          <th cdk-header-cell *cdkHeaderCellDef
              class="px-govbr-4 py-govbr-3 text-left text-govbr-sm font-semibold
                     text-govbr-pure-0 bg-govbr-primary">
            Campo
          </th>
          <td cdk-cell *cdkCellDef="let item"
              class="px-govbr-4 py-govbr-3 text-govbr-sm font-medium text-govbr-gray-80
                     border-b border-govbr-gray-5">
            {{ item.campo }}
          </td>
        </ng-container>

        <!-- Coluna Valor -->
        <ng-container cdkColumnDef="valor">
          <th cdk-header-cell *cdkHeaderCellDef
              class="px-govbr-4 py-govbr-3 text-left text-govbr-sm font-semibold
                     text-govbr-pure-0 bg-govbr-primary">
            Valor informado
          </th>
          <td cdk-cell *cdkCellDef="let item"
              class="px-govbr-4 py-govbr-3 text-govbr-base text-govbr-gray-80
                     border-b border-govbr-gray-5">
            {{ item.valor || '—' }}
          </td>
        </ng-container>

        <tr cdk-header-row *cdkHeaderRowDef="colunas" class=""></tr>
        <tr cdk-row *cdkRowDef="let row; columns: colunas"
            class="even:bg-govbr-gray-2 hover:bg-govbr-primary-lightest transition-colors"></tr>
      </table>
    </div>
  `,
})
export class RevisaoTabComponent {
  readonly form = input.required<FormGroup<InscricaoForm>>();
  readonly colunas = ['campo', 'valor'];

  readonly resumoData = computed<ResumoItem[]>(() => {
    const f = this.form().getRawValue();
    const curso = CURSOS_MOCK.find((c) => c.id === f.cursoId);
    const cidade = CIDADES_MOCK.find((c) => c.id === f.cidadeId);
    const modalidade = MODALIDADES_COTA.find((m) => m.id === f.modalidadeCota);
    const opcaoLabel = f.opcaoCurso === 'primeira' ? '1ª Opção' : f.opcaoCurso === 'segunda' ? '2ª Opção' : '';

    return [
      { campo: 'Nome completo', valor: f.nome },
      { campo: 'CPF', valor: f.cpf },
      { campo: 'E-mail', valor: f.email },
      { campo: 'Curso', valor: curso?.nome ?? '' },
      { campo: 'Cidade', valor: cidade ? `${cidade.nome} — ${cidade.uf}` : '' },
      { campo: 'Modalidade de concorrência', valor: modalidade?.label ?? '' },
      { campo: 'Opção de curso', valor: opcaoLabel },
    ];
  });
}
