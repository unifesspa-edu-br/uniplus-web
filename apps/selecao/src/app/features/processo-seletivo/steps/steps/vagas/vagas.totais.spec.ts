import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH } from '@uniplus/shared-data/configuracao';
import { ORGANIZACAO_BASE_PATH } from '@uniplus/shared-data/organizacao';
import { PUBLICACOES_BASE_PATH } from '@uniplus/shared-data/publicacoes';
import { SELECAO_BASE_PATH } from '@uniplus/shared-data/selecao';
import { DistribuicaoDeVagas } from '../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { CadastroInicial } from '../../shared/cadastro-inicial.service';
import { GravacaoDoProcesso } from '../../shared/gravacao/gravacao-do-processo';
import { GravacaoDosCamposPressupostos } from '../../shared/campos-pressupostos.service';
import { CatalogosDoCronogramaService } from '../cronograma/catalogos-do-cronograma.service';
import { VagasStepComponent } from './vagas.component';
import {
  BASE,
  LISTA_DE_CURSOS,
  MODALIDADE,
  MODALIDADES,
  OFERTA,
  OFERTAS,
  OUTRA_OFERTA,
  ServicosDasVagas,
  distribuicao,
  servicosDe,
} from './vagas.testing';

let servicos: ServicosDasVagas;

describe('VagasStepComponent — totais do quadro', () => {
  let store: ProcessoSeletivoStore;
  let controller: HttpTestingController;

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
    servicos = servicosDe(fixture);
    store = TestBed.inject(ProcessoSeletivoStore);
    controller = TestBed.inject(HttpTestingController);

    fixture.detectChanges();
    for (const requisicao of controller.match(() => true)) {
      const url = requisicao.request.url;
      if (url.includes('ofertas-curso')) requisicao.flush(OFERTAS);
      else if (url.includes('cursos')) requisicao.flush(LISTA_DE_CURSOS);
      else if (url.includes('modalidades')) requisicao.flush(MODALIDADES);
      else requisicao.flush([]);
    }
    fixture.detectChanges();
  });

  afterEach(() => controller.verify());

  function comQuadro(ofertas: readonly DistribuicaoDeVagas[]): void {
    store.patchObjectSection('vagas', { ofertas: [...ofertas] });
  }

  it('soma os totais informados pelas ofertas', () => {
    comQuadro([
      { ...distribuicao(OFERTA), voBase: '40' },
      { ...distribuicao(OUTRA_OFERTA), voBase: '30' },
    ]);

    expect(servicos.simulacao.totalGeralDeVagas()).toBe(70);
  });

  it('soma a coluna de uma modalidade declarada', () => {
    comQuadro([
      { ...distribuicao(OFERTA), quadro: [{ modalidadeId: MODALIDADE, quantidade: '5' }] },
      { ...distribuicao(OUTRA_OFERTA), quadro: [{ modalidadeId: MODALIDADE, quantidade: '7' }] },
    ]);

    expect(servicos.simulacao.totalDeclaradoDe(MODALIDADE)).toBe(12);
  });

  /**
   * Célula vazia ou malformada já é apontada pela validação; somá-la como
   * `NaN` apagaria o total inteiro, e o operador perderia a única leitura que
   * diz quantas vagas o processo publica.
   */
  it.each([[''], ['dez'], ['-5'], ['1e2']])('ignora o total malformado %j na soma', (voBase) => {
    comQuadro([
      { ...distribuicao(OFERTA), voBase: '40' },
      { ...distribuicao(OUTRA_OFERTA), voBase },
    ]);

    expect(servicos.simulacao.totalGeralDeVagas()).toBe(40);
  });

  it('devolve zero sem nenhuma oferta no quadro', () => {
    comQuadro([]);

    expect(servicos.simulacao.totalGeralDeVagas()).toBe(0);
    expect(servicos.simulacao.totalGeralPublicado()).toBe(0);
  });
});
