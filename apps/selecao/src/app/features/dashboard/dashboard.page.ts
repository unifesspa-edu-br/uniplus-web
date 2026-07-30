import { Component, ChangeDetectionStrategy, signal, computed } from '@angular/core';
import { DatePipe, DecimalPipe, registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';

import { EmptyStateComponent, FilterChipsComponent, TagComponent } from '@uniplus/shared-ui';
import { type UiFilterChipOption } from '@uniplus/shared-ui/components';
import { RouterLink } from '@angular/router';

registerLocaleData(localePt);

export enum TipoStatus {
  abertos = 'Abertos',
  emAnalise = 'Em análise',
  encerrados = 'Encerrados',
}

export interface StatusTipoOption {
  readonly value: TipoStatus;
  readonly label: string;
}

export const TIPOS_MODALIDADE: readonly StatusTipoOption[] = [
  { value: TipoStatus.abertos, label: 'Abertos' },
  { value: TipoStatus.emAnalise, label: 'Em análise' },
  { value: TipoStatus.encerrados, label: 'Encerrados' },
] as const;

@Component({
  selector: 'sel-dashboard',
  standalone: true,
  imports: [
    TagComponent,
    EmptyStateComponent,
    DecimalPipe,
    FilterChipsComponent,
    DatePipe,
    RouterLink,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'sel-page' },
  template: `
    <div class="page-header">
      <div class="page-header__content">
        <h1 class="page-header__title">Painel de Processos</h1>
        <p class="page-header__desc">Visão geral dos processos seletivos, inscrições e prazos.</p>
      </div>
      <button class="btn btn--primary" type="button" routerLink="/processo-seletivo">
        <i class="pi pi-plus btn__icon"></i>
        Novo Processo
      </button>
    </div>
    <div class="kpis">
      <div class="kpi">
        <span class="kpi__label">Processos seletivos ativos</span
        ><span class="kpi__num"> {{ 12 | number: '1.0' }} </span
        ><span class="kpi__delta">↑ 2 vs. mês passado</span>
      </div>
      <div class="kpi">
        <span class="kpi__label">Inscrições no mês</span>
        <span class="kpi__num">{{ 23.481 | number: '1.0' }}</span>
        <span class="kpi__delta">↑ 14% vs. ciclo anterior</span>
      </div>
      <div class="kpi">
        <span class="kpi__label">Aguardando homologação</span
        ><span class="kpi__num"> {{ 847 | number: '1.0' }} </span
        ><span class="kpi__delta is-down">3 vencem hoje</span>
      </div>
      <div class="kpi">
        <span class="kpi__label">Recursos abertos</span
        ><span class="kpi__num"> {{ 19 | number: '1.0' }} </span
        ><span class="kpi__delta">↓ 4 vs. semana</span>
      </div>
    </div>
    <section class="panel" aria-labelledby="cfg-unidades-list-title">
      <div class="panel-head">
        <div class="panel-head__title">
          <h2 id="processos-seletivos-andamento">Processos seletivos em andamento</h2>
        </div>
        <div class="filter-bar__group">
          <ui-filter-chips
            [options]="tipoChips"
            [selected]="tipoFiltro()"
            (selectedChange)="tipoFiltro.set($event ?? '')"
            ariaLabel="Filtrar por tipo"
          />
        </div>
      </div>
      @if (processosFiltrados().length > 0) {
        <div class="table-responsive">
          <table>
            <thead>
              <tr>
                <th scope="col">Processo seletivo</th>
                <th scope="col">Modalidade</th>
                <th scope="col">Inscritos</th>
                <th scope="col">Prazo</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              @for (processo of processosFiltrados(); track processo.id) {
                <tr>
                  <td data-label="Processo seletivo">
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
                    {{ processo.numeroInscritos | number: '1.0' : 'pt-BR' }}
                  </td>
                  <td data-label="Prazo">
                    {{ processo.dataPrazo | date: 'mediumDate' }}
                    <div class="table-responsive__meta">Em 5 dias</div>
                  </td>
                  <td data-label="Status">
                    @if (processo.status === TipoStatus.abertos) {
                      <ui-tag [dot]="true" variant="success">Aberto</ui-tag>
                    } @else if (processo.status === TipoStatus.emAnalise) {
                      <ui-tag [dot]="true" variant="warning">Em análise</ui-tag>
                    } @else {
                      <ui-tag [dot]="true" variant="neutral">Encerrado</ui-tag>
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
          <a class="panel-head__link">Ver agenda</a>
        </div>
        <div class="timeline">
          <div class="tline">
            <span class="tline__bullet tline__bullet--danger"></span>
            <div class="tline__body">
              <div class="tline__what"><strong>Homologação SISU 2026.1</strong> — encerra hoje</div>
              <div class="tline__when">22:00 · 3 inscrições pendentes</div>
            </div>
          </div>
          <div class="tline">
            <span class="tline__bullet tline__bullet--primary"></span>
            <div class="tline__body">
              <div class="tline__what">
                <strong>Recursos VEST 2025.2</strong> — analisar 7 pedidos
              </div>
              <div class="tline__when">amanhã · até 18:00</div>
            </div>
          </div>
          <div class="tline">
            <span class="tline__bullet tline__bullet--success"></span>
            <div class="tline__body">
              <div class="tline__what">
                <strong>Publicação resultado parcial</strong> — Pós Educação
              </div>
              <div class="tline__when">qua, 12 mar · 14:00</div>
            </div>
          </div>
          <div class="tline">
            <span class="tline__bullet tline__bullet--danger"></span>
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
          <a class="panel-head__link">Ver tudo</a>
        </div>
        <div class="timeline">
          <div class="tline">
            <span class="tline__bullet tline__bullet--danger"></span>
            <div class="tline__body">
              <div class="tline__what">
                <strong>Processo seletivo SISU 2026.1</strong> publicado
              </div>
              <div class="tline__when">Joana A. · há 2 horas</div>
            </div>
          </div>
          <div class="tline">
            <span class="tline__bullet tline__bullet--danger"></span>
            <div class="tline__body">
              <div class="tline__what">
                12 inscrições homologadas em <strong>PROC 09/2026</strong>
              </div>
              <div class="tline__when">Sistema · há 4 horas</div>
            </div>
          </div>
          <div class="tline">
            <span class="tline__bullet tline__bullet--warning"></span>
            <div class="tline__body">
              <div class="tline__what">Recurso pendente em <strong>VEST 2025.2</strong></div>
              <div class="tline__when">candidato 0823… · há 6 horas</div>
            </div>
          </div>
          <div class="tline">
            <span class="tline__bullet tline__bullet--primary"></span>
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
  protected readonly processosFiltrados = computed<ProcessoSeletivoDTO[]>(() => {
    if (this.tipoFiltro() === '') {
      return this.processos();
    }
    return this.processos().filter((processo) => processo.status === this.tipoFiltro());
  });
  protected readonly tipoFiltro = signal('');
  protected readonly tipoChips: readonly UiFilterChipOption[] = [
    { value: '', label: 'Todas', count: this.processos().length },
    ...TIPOS_MODALIDADE.map((tipo) => ({
      value: tipo.value,
      label: tipo.label,
      count: this.processos().filter((processo) => processo.status === tipo.value).length,
    })),
  ];
  protected readonly TipoStatus = TipoStatus;
  protected dataAtual = new Date();
}

interface ProcessoSeletivoDTO {
  id: number;
  titulo: string;
  subtitulo: string;
  modalidade: 'Graduação' | 'Pós-graduação'  | 'Mestrado' | 'Doutorado';
  numeroInscritos: number;
  numeroVagas: number;
  dataPrazo: Date;
  status: TipoStatus;
}

const PROCESSO_SELETIVOS_DTO: ProcessoSeletivoDTO[] = [
  {
    id: 1,
    titulo: 'SISU 2026.1',
    subtitulo: 'Processo seletivo 12/2026',
    numeroVagas: 1234,
    numeroInscritos: 12483,
    dataPrazo: new Date(),
    modalidade: 'Graduação',
    status: TipoStatus.abertos,
  },
  {
    id: 2,
    titulo: 'PROC 09/2026',
    subtitulo: 'Processo seletivo 09/2026',
    numeroVagas: 47,
    numeroInscritos: 847,
    dataPrazo: new Date(),
    modalidade: 'Pós-graduação',
    status: TipoStatus.emAnalise,
  },
  {
    id: 3,
    titulo: 'VEST IND 2026',
    subtitulo: 'Processo seletivo 04/2026',
    numeroVagas: 86,
    numeroInscritos: 2108,
    dataPrazo: new Date(),
    modalidade: 'Graduação',
    status: TipoStatus.encerrados,
  },
];
