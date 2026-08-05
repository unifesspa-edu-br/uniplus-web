import {
  Component,
  ChangeDetectionStrategy,
  signal,
  computed,
  ViewEncapsulation,
} from '@angular/core';
import { EmptyStateComponent, TagComponent } from '@uniplus/shared-ui/components';
import { DecimalPipe } from '@angular/common';

@Component({
  selector: 'sel-dashboard',
  standalone: true,
  imports: [TagComponent, EmptyStateComponent, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'sel-page' },
  styleUrl: './dashboard.page.css',
  encapsulation: ViewEncapsulation.None,
  template: `
    <div class="page-header">
      <div class="page-header__content">
        <h1 class="page-header__title">Painel de Processos</h1>
        <p class="page-header__desc">Visão geral dos editais, inscrições e prazos.</p>
      </div>
      <button class="btn btn--primary" type="button" aria-haspopup="dialog" aria-expanded="false">
        <i class="pi pi-plus"></i>
        Novo Processo
      </button>
    </div>
    <div class="kpis">
      <div class="kpi">
        <span class="kpi__label">Editais ativos</span><span class="kpi__num">12</span
        ><span class="kpi__delta">↑ 2 vs. mês passado</span>
      </div>
      <div class="kpi">
        <span class="kpi__label">Inscrições no mês</span><span class="kpi__num">23.481</span
        ><span class="kpi__delta">↑ 14% vs. ciclo anterior</span>
      </div>
      <div class="kpi">
        <span class="kpi__label">Aguardando homologação</span><span class="kpi__num">847</span
        ><span class="kpi__delta is-down">3 vencem hoje</span>
      </div>
      <div class="kpi">
        <span class="kpi__label">Recursos abertos</span><span class="kpi__num">19</span
        ><span class="kpi__delta">↓ 4 vs. semana</span>
      </div>
    </div>
    <section class="panel" aria-labelledby="cfg-unidades-list-title">
      <div class="panel-head">
        <div class="panel-head__title">
          <h2 id="sel-editais-andamento-title">Editais em andamento</h2>
        </div>
      </div>
      @if (processos().length > 0) {
        <div class="table-responsive">
          <table>
            <thead>
              <tr>
                <th scope="col">Edital</th>
                <th scope="col">Modalidade</th>
                <th scope="col">Inscritos</th>
                <th scope="col">Prazo</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              @for (processo of processos(); track processo.id) {
                <tr>
                  <td data-label="Edital">
                    <div class="table-responsive__primary">
                      {{ processo.titulo }}
                    </div>
                    <div class="table-responsive__meta">
                      {{ processo.subtitulo }}
                    </div>
                  </td>
                  <td data-label="Modalidade">
                    {{ processo.modalidade }}
                  </td>
                  <td data-label="Inscritos">
                    {{ processo.numeroInscritos | number }}
                  </td>
                  <td data-label="Ações">
                    {{ processo.subtitulo }}
                    <div class="table-responsive__meta">
                      {{ processo.subtitulo }}
                    </div>
                  </td>
                  <td>
                    @if (processo.status === 'aberto') {
                      <ui-tag variant="success">Aberto</ui-tag>
                    } @else if (processo.status === 'analise') {
                      <ui-tag variant="warning">Em análise</ui-tag>
                    } @else {
                      <ui-tag variant="neutral">Encerrado</ui-tag>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else {
        <ui-empty-state
          heading="Nenhum processo seletivo cadastrado"
          description="Cadastre um processo seletivo para iniciar a estrutura institucional."
        >
        </ui-empty-state>
      }
    </section>
    <div class="lower">
      <div class="panel">
        <div class="panel-head">
          <h2>Próximos prazos</h2>
          <a href="#">Ver agenda</a>
        </div>
        <div class="timeline">
          <div class="tline">
            <span class="tline__bullet" style="background:var(--color-danger-500)"></span>
            <div class="tline__body">
              <div class="tline__what"><strong>Homologação SISU 2026.1</strong> — encerra hoje</div>
              <div class="tline__when">22:00 · 3 inscrições pendentes</div>
            </div>
          </div>
          <div class="tline">
            <span class="tline__bullet" style="background:var(--color-warning-600)"></span>
            <div class="tline__body">
              <div class="tline__what">
                <strong>Recursos VEST 2025.2</strong> — analisar 7 pedidos
              </div>
              <div class="tline__when">amanhã · até 18:00</div>
            </div>
          </div>
          <div class="tline">
            <span class="tline__bullet"></span>
            <div class="tline__body">
              <div class="tline__what">
                <strong>Publicação resultado parcial</strong> — Pós Educação
              </div>
              <div class="tline__when">qua, 12 mar · 14:00</div>
            </div>
          </div>
          <div class="tline">
            <span class="tline__bullet"></span>
            <div class="tline__body">
              <div class="tline__what"><strong>Início matrícula</strong> — Vestibular Indígena</div>
              <div class="tline__when">seg, 17 mar · 09:00</div>
            </div>
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head">
          <h2>Atividade recente</h2>
          <a href="#">Ver tudo</a>
        </div>
        <div class="timeline">
          <div class="tline">
            <span class="tline__bullet" style="background:var(--color-success-600)"></span>
            <div class="tline__body">
              <div class="tline__what"><strong>Edital SISU 2026.1</strong> publicado</div>
              <div class="tline__when">Joana A. · há 2 horas</div>
            </div>
          </div>
          <div class="tline">
            <span class="tline__bullet"></span>
            <div class="tline__body">
              <div class="tline__what">
                12 inscrições homologadas em <strong>PROC 09/2026</strong>
              </div>
              <div class="tline__when">Sistema · há 4 horas</div>
            </div>
          </div>
          <div class="tline">
            <span class="tline__bullet" style="background:var(--color-warning-600)"></span>
            <div class="tline__body">
              <div class="tline__what">Recurso pendente em <strong>VEST 2025.2</strong></div>
              <div class="tline__when">candidato 0823… · há 6 horas</div>
            </div>
          </div>
          <div class="tline">
            <span class="tline__bullet"></span>
            <div class="tline__body">
              <div class="tline__what">Cota PPI atualizada para <strong>VEST IND 2026</strong></div>
              <div class="tline__when">Jeferson F. · ontem · 17:14</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class DashboardPage {
  protected readonly loading = signal(false);
  protected readonly errorMessage = computed<string | null>(() => null);
  protected readonly processos = signal(PROCESSO_SELETIVOS_DTO);
  protected readonly temFiltro = signal(false);
}

interface ProcessoSeletivoDTO {
  id: number;
  titulo: string;
  subtitulo: string;
  modalidade: 'Graduação' | 'Pós-graduação' | 'Mestrado' | 'Doutorado';
  numeroInscritos: number;
  numeroVagas: number;
  dataPrazo: Date;
  status: 'aberto' | 'analise' | 'encerrado';
}

const PROCESSO_SELETIVOS_DTO: ProcessoSeletivoDTO[] = [
  {
    id: 1,
    titulo: 'SISU 2026.1',
    subtitulo: 'Edital 12/2026',
    numeroVagas: 1234,
    numeroInscritos: 12483,
    dataPrazo: new Date(),
    modalidade: 'Graduação',
    status: 'aberto',
  },
  {
    id: 2,
    titulo: 'PROC 09/2026',
    subtitulo: 'Edital 09/2026',
    numeroVagas: 47,
    numeroInscritos: 847,
    dataPrazo: new Date(),
    modalidade: 'Pós-graduação',
    status: 'analise',
  },
  {
    id: 3,
    titulo: 'VEST IND 2026',
    subtitulo: 'Edital 04/2026',
    numeroVagas: 86,
    numeroInscritos: 2108,
    dataPrazo: new Date(),
    modalidade: 'Graduação',
    status: 'encerrado',
  },
];
