import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
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
import { CadastroInicial } from '../../shared/cadastro-inicial.service';
import { GravacaoDoProcesso } from '../../shared/gravacao/gravacao-do-processo';
import { GravacaoDosCamposPressupostos } from '../../shared/campos-pressupostos.service';
import { CatalogosDoCronogramaService } from '../cronograma/catalogos-do-cronograma.service';
import { VagasStepComponent } from './vagas.component';
import {
  BASE,
  LISTA_DE_CURSOS,
  MODALIDADES,
  OFERTA,
  OFERTAS,
  OUTRA_OFERTA,
  distribuicao,
} from './vagas.testing';

describe('VagasStepComponent — consulta', () => {
  let store: ProcessoSeletivoStore;
  let controller: HttpTestingController;
  let tela: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VagasStepComponent],
      providers: [
        ProcessoSeletivoStore,
        CadastroInicial,
        GravacaoDoProcesso,
        CatalogosDoCronogramaService,
        GravacaoDosCamposPressupostos,
        { provide: PUBLICACOES_BASE_PATH, useValue: BASE },
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: SELECAO_BASE_PATH, useValue: BASE },
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
        { provide: ORGANIZACAO_BASE_PATH, useValue: BASE },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(VagasStepComponent);
    store = TestBed.inject(ProcessoSeletivoStore);
    controller = TestBed.inject(HttpTestingController);
    tela = fixture.nativeElement as HTMLElement;

    fixture.detectChanges();
    for (const requisicao of controller.match(() => true)) {
      const url = requisicao.request.url;
      if (url.includes('ofertas-curso')) requisicao.flush(OFERTAS);
      else if (url.includes('cursos')) requisicao.flush(LISTA_DE_CURSOS);
      else if (url.includes('modalidades')) requisicao.flush(MODALIDADES);
      else requisicao.flush([]);
    }
    fixture.detectChanges();

    store.patchObjectSection('vagas', {
      ofertas: [distribuicao(OFERTA), distribuicao(OUTRA_OFERTA)],
    });
    store.remoteSnapshot.set({
      status: StatusProcesso.publicado,
    } as unknown as ProcessoSeletivoDto);
    fixture.detectChanges();
  });

  afterEach(() => controller.verify());

  const leitura = () => (tela.textContent ?? '').replace(/\s+/g, ' ');

  it('lê o padrão e as modalidades como texto, sem campo nem ação de edição', () => {
    expect(
      tela.querySelectorAll('.step-card select, .step-card input, .step-card textarea'),
    ).toHaveLength(0);
    expect(tela.querySelectorAll('.step-card button')).toHaveLength(0);
    expect(leitura()).toContain('DISTRIB-VAGAS-INSTITUCIONAL · versão');
    expect(leitura()).toContain('AC_I — Indígena');
    expect(leitura()).not.toContain('Adicionar ofertas ao quadro');
    expect(leitura()).not.toContain('Simular o quadro');
  });

  it('lê o total de cada oferta na tabela do quadro, sem a coluna de ações', () => {
    const tabela = tela.querySelector('table.vagas-table') as HTMLTableElement;

    expect(tabela.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(tabela.querySelector('input')).toBeNull();
    expect(
      Array.from(tabela.querySelectorAll('thead th')).map((th) => th.textContent?.trim()),
    ).not.toContain('Ações');
  });
});
