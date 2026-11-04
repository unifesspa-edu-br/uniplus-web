import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH } from '@uniplus/shared-data/configuracao';
import { ORGANIZACAO_BASE_PATH } from '@uniplus/shared-data/organizacao';
import { PUBLICACOES_BASE_PATH } from '@uniplus/shared-data/publicacoes';
import {
  ProcessoSeletivoDto,
  SELECAO_BASE_PATH,
  StatusProcesso,
} from '@uniplus/shared-data/selecao';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { CadastroInicialService } from '../../shared/cadastro-inicial.service';
import { GravacaoDoProcesso } from '../../shared/gravacao/gravacao-do-processo';
import { CamposPressupostosService } from '../../shared/campos-pressupostos.service';
import { CatalogosDoCronogramaService } from '../cronograma/catalogos-do-cronograma.service';
import { VagasStepComponent } from './vagas.component';
import { AC_CASCATA, BASE, LB_PPI, LB_Q, distribuicaoComCascata, gravadaDe } from './vagas.testing';

describe('VagasStepComponent — consulta com o catálogo em falha', () => {
  let store: ProcessoSeletivoStore;
  let controller: HttpTestingController;
  let fixture: ComponentFixture<VagasStepComponent>;
  let tela: HTMLElement;

  /** Toda requisição pendente falha: nenhum catálogo chega. */
  const falharPendentes = () => {
    for (const requisicao of controller.match(() => true)) {
      requisicao.flush(null, { status: 500, statusText: 'Erro interno' });
    }
    fixture.detectChanges();
  };

  const leitura = () => (tela.textContent ?? '').replace(/\s+/g, ' ');

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VagasStepComponent],
      providers: [
        ProcessoSeletivoStore,
        CadastroInicialService,
        GravacaoDoProcesso,
        CatalogosDoCronogramaService,
        CamposPressupostosService,
        { provide: PUBLICACOES_BASE_PATH, useValue: BASE },
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: SELECAO_BASE_PATH, useValue: BASE },
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
        { provide: ORGANIZACAO_BASE_PATH, useValue: BASE },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(VagasStepComponent);
    store = TestBed.inject(ProcessoSeletivoStore);
    controller = TestBed.inject(HttpTestingController);
    tela = fixture.nativeElement as HTMLElement;

    store.patchObjectSection('vagas', {
      ofertas: [{ ...distribuicaoComCascata(), referenciaReservaDemograficaId: 'ref-1' }],
    });
    store.remoteSnapshot.set({
      status: StatusProcesso.publicado,
    } as unknown as ProcessoSeletivoDto);
    fixture.detectChanges();
    falharPendentes();
  });

  afterEach(() => controller.verify());

  it('lê o gravado, sem botão para tentar de novo nem aviso de carregamento ou de erro', () => {
    expect(store.emConsulta()).toBe(true);
    expect(tela.querySelectorAll('.step-card button')).toHaveLength(0);
    expect(tela.querySelector('.step-card [role="alert"]')).toBeNull();
    expect(leitura()).not.toContain('Carregando');
    expect(leitura()).not.toContain('Tentar novamente');
    expect(leitura()).toContain('DISTRIB-VAGAS-LEI-12711 · versão v1');
    expect(leitura()).toContain('AJUSTE-PADRAO · versão v1');
  });

  it('diz o que o catálogo não deu, sem concluir que a oferta ou a modalidade não existem', () => {
    expect(leitura()).toContain('Os catálogos de ofertas, modalidades e regras não foram lidos');
    expect(leitura()).toContain('Oferta sem nome: catálogo não foi lido');
    expect(leitura()).toContain('LB_PPI — descrição: o catálogo não foi lido');
    expect(leitura()).toContain('Referência gravada, mas o catálogo não foi lido');
    expect(leitura()).not.toContain('Oferta fora do catálogo');
    expect(leitura()).not.toContain('Nenhuma modalidade oferecida');
  });

  it('não conta ofertas disponíveis, que dependem do catálogo e só servem a quem edita', () => {
    expect(leitura()).toContain('1 no quadro');
    expect(leitura()).not.toContain('disponíveis');
  });

  it('no regime federal, só a modalidade com quantidade gravada vira coluna, na ordem do padrão', () => {
    store.remoteSnapshot.set({ status: StatusProcesso.rascunho } as unknown as ProcessoSeletivoDto);
    store.patchObjectSection('vagas', {
      ofertas: [
        {
          ...distribuicaoComCascata(),
          quadro: [
            { modalidadeId: AC_CASCATA, quantidade: '80' },
            { modalidadeId: LB_PPI, quantidade: '10' },
          ],
        },
      ],
    });
    store.remoteSnapshot.set({
      status: StatusProcesso.publicado,
    } as unknown as ProcessoSeletivoDto);
    fixture.detectChanges();

    const nomes = ['LB_PPI', 'LB_Q', 'AC'];
    const cabecalhos = Array.from(tela.querySelectorAll('.vagas-table thead th')).map((th) =>
      th.textContent?.trim(),
    );
    expect(cabecalhos.filter((c) => nomes.includes(c ?? ''))).toEqual(['LB_PPI', 'AC']);
    const celulas = Array.from(tela.querySelectorAll('.vagas-table td[data-label]')).map(
      (td) => `${td.getAttribute('data-label')}=${td.textContent?.trim()}`,
    );
    expect(celulas).toEqual(expect.arrayContaining(['LB_PPI=10', 'AC=80']));
    expect(celulas.filter((c) => c.startsWith('LB_Q='))).toEqual([]);
    expect(celulas).not.toContain('LB_Q=0');
  });

  /** O snapshot traz descrição e composição: a consulta as lê dele, sem esperar pelo catálogo. */
  it('lê descrição e composição do snapshot gravado, mesmo com o catálogo fora do ar', () => {
    store.remoteSnapshot.set({ status: StatusProcesso.rascunho } as unknown as ProcessoSeletivoDto);
    store.patchObjectSection('vagas', {
      ofertas: [
        {
          ...distribuicaoComCascata(),
          modalidades: [
            { id: LB_PPI, codigo: 'LB_PPI', gravada: gravadaDe('Baixa renda PPI', 'DENTRO_DO_VR') },
            { id: AC_CASCATA, codigo: 'AC', gravada: gravadaDe('Ampla concorrência', 'RETIRA_DE') },
          ],
          quadro: [{ modalidadeId: AC_CASCATA, quantidade: '80' }],
        },
      ],
    });
    store.remoteSnapshot.set({
      status: StatusProcesso.publicado,
    } as unknown as ProcessoSeletivoDto);
    fixture.detectChanges();

    expect(leitura()).toContain('LB_PPI — Baixa renda PPI');
    expect(leitura()).toContain('AC — Ampla concorrência');
    expect(leitura()).not.toContain('descrição: o catálogo');
    const colunas = Array.from(tela.querySelectorAll('.vagas-table thead th')).map((th) =>
      th.textContent?.trim(),
    );
    expect(colunas).toContain('AC');
    expect(colunas).not.toContain('LB_PPI');
  });

  /** O catálogo mudou depois da publicação: vale o gravado, e a modalidade que saiu continua. */
  it('com o catálogo divergente do snapshot, mostra o gravado e mantém a modalidade que saiu dele', () => {
    store.remoteSnapshot.set({ status: StatusProcesso.rascunho } as unknown as ProcessoSeletivoDto);
    store.patchObjectSection('vagas', {
      ofertas: [
        {
          ...distribuicaoComCascata(),
          regraDistribuicaoCodigo: 'DISTRIB-VAGAS-INSTITUCIONAL',
          modalidades: [
            {
              id: LB_PPI,
              codigo: 'LB_PPI',
              gravada: gravadaDe('Descrição publicada', 'RETIRA_DE'),
            },
            { id: LB_Q, codigo: 'LB_Q', gravada: gravadaDe('Quilombola publicada', 'RETIRA_DE') },
          ],
          quadro: [
            { modalidadeId: LB_PPI, quantidade: '10' },
            { modalidadeId: LB_Q, quantidade: '7' },
          ],
        },
      ],
    });
    // Hoje o catálogo só conhece LB_PPI, com outra descrição e outra composição.
    fixture.componentInstance.catalogos.modalidades.set([
      {
        id: LB_PPI,
        codigo: 'LB_PPI',
        descricao: 'Descrição de hoje',
        composicaoVagas: 'DENTRO_DO_VR',
      } as never,
    ]);
    store.remoteSnapshot.set({
      status: StatusProcesso.publicado,
    } as unknown as ProcessoSeletivoDto);
    fixture.detectChanges();

    expect(leitura()).toContain('LB_PPI — Descrição publicada');
    expect(leitura()).not.toContain('Descrição de hoje');
    expect(leitura()).toContain('LB_Q — Quilombola publicada');
    const celulas = Array.from(tela.querySelectorAll('.vagas-table td[data-label]')).map(
      (td) => `${td.getAttribute('data-label')}=${td.textContent?.trim()}`,
    );
    expect(celulas).toEqual(expect.arrayContaining(['LB_PPI=10', 'LB_Q=7']));
  });

  it('padrão sem modalidades diz que nenhuma é oferecida, e não que não leu', () => {
    store.remoteSnapshot.set({ status: StatusProcesso.rascunho } as unknown as ProcessoSeletivoDto);
    store.patchObjectSection('vagas', {
      ofertas: [{ ...distribuicaoComCascata(), modalidades: [], quadro: [] }],
    });
    store.remoteSnapshot.set({
      status: StatusProcesso.publicado,
    } as unknown as ProcessoSeletivoDto);
    fixture.detectChanges();

    expect(leitura()).toContain('Nenhuma modalidade oferecida');
    expect(leitura()).not.toContain('descrição: o catálogo');
  });

  it('enquanto os catálogos carregam, avisa que carrega e não diz que não leu', () => {
    const catalogos = fixture.componentInstance.catalogos;
    catalogos.erro.set(null);
    catalogos.carregando.set(true);
    fixture.detectChanges();

    expect(tela.querySelector('[role="status"]')?.textContent).toContain('Carregando');
    expect(leitura()).toContain('LB_PPI — descrição: o catálogo ainda carrega');
    expect(leitura()).not.toContain('não foi lido');
    expect(tela.querySelector('[role="alert"]')).toBeNull();
  });

  it('nova tentativa que falha depois de uma carga boa mantém o que já foi lido', () => {
    const catalogos = fixture.componentInstance.catalogos;
    catalogos.modalidades.set([{ id: LB_PPI, codigo: 'LB_PPI', descricao: 'Ampla PPI' } as never]);
    fixture.detectChanges();

    expect(catalogos.erro()).not.toBeNull();
    expect(leitura()).toContain('LB_PPI — Ampla PPI');
    expect(leitura()).not.toContain(
      'Os catálogos de ofertas, modalidades e regras não foram lidos',
    );
  });

  it('diz "Não declarada" para a regra de ajuste que o processo não gravou', () => {
    // O store não aceita mutação em consulta: grava como rascunho e volta a publicado.
    store.remoteSnapshot.set({ status: StatusProcesso.rascunho } as unknown as ProcessoSeletivoDto);
    store.patchObjectSection('vagas', {
      ofertas: [
        {
          ...distribuicaoComCascata(),
          regraAjusteCodigo: null,
          regraAjusteVersao: null,
          referenciaReservaDemograficaId: null,
        },
      ],
    });
    store.remoteSnapshot.set({
      status: StatusProcesso.publicado,
    } as unknown as ProcessoSeletivoDto);
    fixture.detectChanges();

    const regraDeAjuste = Array.from(tela.querySelectorAll('.dado')).find((par) =>
      par.textContent?.includes('Regra de ajuste'),
    );
    expect(regraDeAjuste?.textContent).toContain('Não declarada');
    expect(leitura()).not.toContain('Referência gravada');
  });

  it('em edição, a falha dos catálogos continua pedindo nova tentativa', () => {
    store.remoteSnapshot.set({ status: StatusProcesso.rascunho } as unknown as ProcessoSeletivoDto);
    fixture.detectChanges();

    expect(store.emConsulta()).toBe(false);
    expect(tela.querySelector('[role="alert"]')?.textContent).toContain(
      'Não foi possível carregar',
    );
    expect(tela.querySelector('button')?.textContent).toContain('Tentar novamente');
  });
});
