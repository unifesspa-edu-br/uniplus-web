import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH } from '@uniplus/shared-data/configuracao';
import {
  OrigemCandidatosCodigo,
  ProcessoSeletivoDto,
  SELECAO_BASE_PATH,
  SituacaoDoProcessoSeletivoCodigo,
} from '@uniplus/shared-data/selecao';
import { apresentacaoDaPagina, apresentacaoDoCampo } from '@uniplus/shared-inscricao/formulario';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { CatalogoDeFases } from '../cronograma/catalogos/catalogo-de-fases.service';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { CadastroInicial } from '../../shared/cadastro-inicial.service';
import { GravacaoDoProcesso } from '../../shared/gravacao/gravacao-do-processo';
import { ReleituraDoSnapshot } from '../../shared/releitura-do-snapshot.service';
import { LeituraDoCadastroDePesos } from '../classificacao/leitura-do-cadastro-de-pesos.service';
import { CatalogosDeClassificacao } from '../classificacao/catalogos-de-classificacao.service';
import { comInscricao, item, secao } from '../formulario/formulario-de-inscricao.testing';
import { FASE_INSCRICAO } from '../formulario/formulario-gravado.testing';
import { DesempatePassoComponent } from './desempate.component';
import {
  BASE,
  criterio,
  FATOS,
  montarPassoDeDesempate,
  PROCESSO_ID,
} from './desempate.component.testing';
import { EdicaoDosCriterios } from './edicao-dos-criterios.service';
import { PASSO_FORMULARIO } from '../../processo-seletivo.data';

describe('DesempatePassoComponent', () => {
  let componente: DesempatePassoComponent;
  let fixture: ComponentFixture<DesempatePassoComponent>;
  const edicao = (): EdicaoDosCriterios => fixture.debugElement.injector.get(EdicaoDosCriterios);
  let store: ProcessoSeletivoStore;
  let controller: HttpTestingController;

  beforeEach(async () => {
    ({ fixture, store, controller } = await montarPassoDeDesempate());
    componente = fixture.componentInstance;
  });

  afterEach(() => controller.verify());

  /** A fase em que o candidato se inscreve é a que diz qual formulário é o da inscrição. */
  const comFaseDeInscricao = () =>
    store.patchObjectSection('cronograma', { fases: [FASE_INSCRICAO] });

  /**
   * O catálogo de fatos governa o que o predicado pode citar. Falhando a busca sem aviso nem
   * nova tentativa, todo critério já configurado por predicado aparecia como fato fora do
   * cadastro e a gravação do passo era recusada — sem explicação e sem caminho de volta que
   * não fosse recarregar a página.
   */
  it('anuncia a falha do catálogo de fatos e busca de novo quando pedido', async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [DesempatePassoComponent],
      providers: [
        ProcessoSeletivoStore,
        CadastroInicial,
        GravacaoDoProcesso,
        CatalogosDeClassificacao,
        CatalogoDeFases,
        LeituraDoCadastroDePesos,
        ReleituraDoSnapshot,
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: SELECAO_BASE_PATH, useValue: BASE },
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(DesempatePassoComponent);
    const controllerLocal = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    for (const requisicao of controllerLocal.match(() => true)) {
      if (requisicao.request.url.includes('fatos-candidato')) {
        requisicao.flush(
          { type: 'about:blank', title: 'Falha ao consultar o cadastro', status: 500 },
          {
            status: 500,
            statusText: 'Internal Server Error',
            headers: { 'content-type': 'application/problem+json' },
          },
        );
        continue;
      }
      requisicao.flush([]);
    }
    fixture.detectChanges();

    const raiz = fixture.nativeElement as HTMLElement;
    const alerta = (): Element | null => raiz.querySelector('.alert--danger');
    expect(alerta()?.textContent).toContain('Sem esses dados');

    // A nova tentativa existe, e é ela que devolve o vocabulário sem recarregar a página.
    (alerta()?.querySelector('button') as HTMLButtonElement).click();
    const retentativa = controllerLocal.expectOne((r) => r.url.includes('fatos-candidato'));
    retentativa.flush(FATOS);
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();

    expect(alerta()).toBeNull();
    controllerLocal.verify();
  });

  it('em consulta, com o catálogo de fatos em falha, lê o fato pelo código gravado e avisa, sem dizer que saiu do catálogo', async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [DesempatePassoComponent],
      providers: [
        ProcessoSeletivoStore,
        CadastroInicial,
        GravacaoDoProcesso,
        CatalogosDeClassificacao,
        CatalogoDeFases,
        LeituraDoCadastroDePesos,
        ReleituraDoSnapshot,
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: SELECAO_BASE_PATH, useValue: BASE },
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(DesempatePassoComponent);
    const storeLocal = TestBed.inject(ProcessoSeletivoStore);
    const controllerLocal = TestBed.inject(HttpTestingController);
    storeLocal.processoSeletivoId.set(PROCESSO_ID);
    storeLocal.patchSection('desempate', [
      criterio({
        regraCodigo: 'DESEMPATE_CONDICAO_SOBRE_DADO',
        regraVersao: '1.0',
        fato: 'RENDA_PER_CAPITA',
        operador: 'MENOR_OU_IGUAL',
        valor: '1',
      }),
    ]);
    storeLocal.remoteSnapshot.set({
      id: PROCESSO_ID,
      situacao: {
        codigo: SituacaoDoProcessoSeletivoCodigo.PUBLICADO,
        rotulo: SituacaoDoProcessoSeletivoCodigo.PUBLICADO,
      },
    } as unknown as ProcessoSeletivoDto);
    fixture.detectChanges();

    for (const requisicao of controllerLocal.match(() => true)) {
      if (requisicao.request.url.includes('fatos-candidato')) {
        requisicao.flush(
          { type: 'about:blank', title: 'Falha ao consultar o cadastro', status: 500 },
          {
            status: 500,
            statusText: 'Internal Server Error',
            headers: { 'content-type': 'application/problem+json' },
          },
        );
        continue;
      }
      requisicao.flush([]);
    }
    fixture.detectChanges();
    for (const requisicao of controllerLocal.match(() => true)) requisicao.flush([]);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('RENDA_PER_CAPITA');
    expect(host.textContent).not.toContain('fora do catálogo');
    expect(host.textContent).toContain('Não foi possível carregar os dados do candidato');
    expect(host.textContent).toContain(
      'Os critérios que citam um fato aparecem pelo código gravado',
    );
    expect(host.querySelector('button')?.textContent).toContain('Tentar novamente');
  });

  it('avisa que o maior idade não tem data de nascimento no formulário e leva a ele', () => {
    // A data de nascimento é dos dados básicos: só falta quando a seção deles veio sem ela.
    const dadosBasicos = secao('DADOS_BASICOS', 0, { apresentacao: apresentacaoDaPagina('Dados') });
    const campo = (fatoCodigo: string, ordem: number) =>
      item(fatoCodigo, ordem, 'DADOS_BASICOS', {
        apresentacao: apresentacaoDoCampo(fatoCodigo, 'TEXTO'),
      });
    const conteudo = (...itens: ReturnType<typeof campo>[]) => ({
      titulo: null,
      paginas: [dadosBasicos],
      itens,
      termos: [],
      pressupostos: [],
      grupos: [],
    });
    comFaseDeInscricao();
    store.patchObjectSection(
      'formulario',
      comInscricao(store.draft().formulario, conteudo(campo('NOME', 0))),
    );
    expect(componente.semDataDeNascimento()).toBe(false);

    store.patchSection('desempate', [
      criterio({ regraCodigo: 'DESEMPATE_MAIOR_IDADE', regraVersao: 'v1' }),
    ]);
    expect(componente.semDataDeNascimento()).toBe(true);

    componente.irParaFormulario();
    expect(store.passoAtual()).toBe(PASSO_FORMULARIO);

    store.patchObjectSection(
      'formulario',
      comInscricao(
        store.draft().formulario,
        conteudo(campo('NOME', 0), campo('DATA_NASCIMENTO', 1)),
      ),
    );
    expect(componente.semDataDeNascimento()).toBe(false);
  });

  it('em consulta, não acusa a idade: o processo publicado não admite a correção', () => {
    store.patchSection('desempate', [
      criterio({ regraCodigo: 'DESEMPATE_IDOSO', regraVersao: 'v1', idadeMinima: '60' }),
    ]);
    expect(componente.idosoSemApuracao()).toBe(true);

    store.remoteSnapshot.set({
      situacao: {
        codigo: SituacaoDoProcessoSeletivoCodigo.PUBLICADO,
        rotulo: SituacaoDoProcessoSeletivoCodigo.PUBLICADO,
      },
    } as never);

    expect(componente.idosoSemApuracao()).toBe(false);
  });

  it('não exige a apuração da idade do maior idade, só do idoso', () => {
    store.patchSection('desempate', [
      criterio({ regraCodigo: 'DESEMPATE_MAIOR_IDADE', regraVersao: 'v1' }),
    ]);
    expect(store.draft().formulario.referenciaTemporal.tipo).toBe('');
    expect(componente.idosoSemApuracao()).toBe(false);

    store.patchSection('desempate', [
      criterio({ regraCodigo: 'DESEMPATE_IDOSO', regraVersao: 'v1', idadeMinima: '60' }),
    ]);
    expect(componente.idosoSemApuracao()).toBe(true);

    store.patchObjectSection('formulario', {
      referenciaTemporal: { tipo: 'FIM_INSCRICAO', data: '', faseCodigo: '' },
    });
    expect(componente.idosoSemApuracao()).toBe(false);
  });

  it('exige ao menos um critério quando a inscrição é feita no sistema', () => {
    store.patchObjectSection('identificacao', {
      origemCandidatos: OrigemCandidatosCodigo.INSCRICAO_PROPRIA,
    });

    const resultado = componente.validar();

    expect(resultado.valid).toBe(false);
    expect(resultado).toMatchObject({
      messages: [expect.stringContaining('ao menos um critério de desempate')],
    });
  });

  it('é válido sem critério quando o resultado é importado: a lista já vem classificada', () => {
    store.patchObjectSection('identificacao', {
      origemCandidatos: OrigemCandidatosCodigo.IMPORTACAO_EXTERNA,
    });

    expect(componente.validar().valid).toBe(true);
  });

  it('reordena com mover()', () => {
    store.patchSection('desempate', [
      criterio({ regraCodigo: 'DESEMPATE_MAIOR_IDADE', regraVersao: '1.0' }),
      criterio({ regraCodigo: 'DESEMPATE_IDOSO', regraVersao: '1.0', idadeMinima: '60' }),
    ]);

    edicao().mover(1, -1);

    expect(store.draft().desempate.map((item) => item.regraCodigo)).toEqual([
      'DESEMPATE_IDOSO',
      'DESEMPATE_MAIOR_IDADE',
    ]);
  });

  it('remove um critério pelo índice', () => {
    store.patchSection('desempate', [
      criterio({ regraCodigo: 'DESEMPATE_MAIOR_IDADE', regraVersao: '1.0' }),
    ]);

    edicao().remover(0);

    expect(store.draft().desempate).toEqual([]);
  });
});
