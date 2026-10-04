import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH } from '@uniplus/shared-data/configuracao';
import { PUBLICACOES_BASE_PATH } from '@uniplus/shared-data/publicacoes';
import { SELECAO_BASE_PATH, type FormularioDto } from '@uniplus/shared-data/selecao';
import { conteudoInicial } from '@uniplus/shared-ui/components';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { ExigenciaDeDocumento, FaseDoCronograma } from '../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { CadastroInicialService } from '../../shared/cadastro-inicial.service';
import { comExigencia, exigenciaNova } from '../../shared/exigencias-documentais';
import { CatalogosDoCronogramaService } from '../cronograma/catalogos-do-cronograma.service';
import { PASSO_DESEMPATE } from '../desempate/desempate-por-idade';
import { FormularioStepComponent } from './formulario.component';
import { conteudoDoFormulario } from './formulario-do-processo';

const BASE = 'http://localhost:5000';
const PROCESSO_ID = '01960000-0000-7000-0000-0000000007aa';
const ROTA_PROCESSO = `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}`;
const ROTA_INSCRICAO = `${BASE}/api/selecao/admin/processos-seletivos/${PROCESSO_ID}/formularios/INSCRICAO`;
const PROBLEM_JSON = { 'content-type': 'application/problem+json' };

const FASE_INSCRICAO: FaseDoCronograma = {
  faseCanonicaId: 'fc-inscricao',
  codigo: 'INSCRICAO',
  ordem: 0,
  inicio: null,
  fim: null,
  produtos: [],
  faseConcluinteCodigo: null,
  emiteParecerIndividual: false,
  bancasRequeridas: [],
  regraRecurso: null,
  congelados: {
    donoTipico: 'CEPS',
    origemData: 'PROPRIA',
    agrupaEtapas: false,
    coletaInscricao: true,
    permiteComplementacao: false,
    coletaSolicitacaoIsencao: false,
    bancas: [],
  },
};

const campo = (fatoCodigo: string, ordem: number, etapaCodigo: string) => ({
  fatoCodigo,
  ordem,
  rotulo: fatoCodigo,
  tipoRenderizacao: 'BOOLEANO',
  obrigatoriedade: { tipo: 'SEMPRE', predicado: null },
  precondicao: null,
  opcoes: null,
  etapaCodigo,
  formato: null,
  ajuda: null,
  pedirConfirmacao: false,
  restricoes: [],
  impedimento: null,
});
const etapa = (codigo: string, ordem: number, bloco: string | null = null) => ({
  codigo,
  ordem,
  tipo: bloco === null ? 'SECAO' : 'BLOCO',
  bloco,
  titulo: codigo === 'S1' ? 'Condições especiais' : codigo,
  descricao: null,
  aviso: null,
  exibicao: null,
});

/** A inscrição como o servidor a devolve: com a seção dos dados básicos que a API acrescenta. */
const GRAVADO = {
  finalidade: 'INSCRICAO',
  faseId: 'F-INSCRICAO',
  titulo: 'Inscrição — Medicina 2027',
  modeloOrigemId: null,
  modeloOrigemCodigo: null,
  etapas: [etapa('DADOS_BASICOS', 0), etapa('S1', 1), etapa('REVISAO_E_ACEITE', 2, 'REVISAO_E_ACEITE')],
  fatosColetados: [campo('NOME', 0, 'DADOS_BASICOS'), campo('PCD', 1, 'S1')],
  termos: [],
  grupos: [],
} as unknown as FormularioDto;

const PROCESSO = {
  formularios: [GRAVADO],
  cronogramaFases: [{ id: 'F-INSCRICAO', codigo: 'INSCRICAO', coletaInscricao: true }],
};

const PCD_NO_CATALOGO = {
  id: 'f-pcd',
  codigo: 'PCD',
  nome: 'Pessoa com deficiência',
  descricao: null,
  dominio: 'BOOLEANO',
  origem: 'DECLARADO',
  cardinalidade: 'ESCALAR',
  valoresDominio: null,
  pontoResolucao: 'INSCRICAO',
  binding: 'CAMPO_INSCRICAO:PCD',
  valoresDominioDeclarados: null,
  fonteValores: null,
  ativo: true,
  escopo: 'CANDIDATO',
};

describe('FormularioStepComponent', () => {
  let fixture: ComponentFixture<FormularioStepComponent>;
  let store: ProcessoSeletivoStore;
  let controller: HttpTestingController;
  let host: HTMLElement;

  /** Deixa a cadeia de `await` da gravação avançar antes da próxima expectativa. */
  const proximoPasso = () => new Promise((resolve) => setTimeout(resolve, 0));

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FormularioStepComponent],
      providers: [
        ProcessoSeletivoStore,
        CadastroInicialService,
        CatalogosDoCronogramaService,
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: SELECAO_BASE_PATH, useValue: BASE },
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
        { provide: PUBLICACOES_BASE_PATH, useValue: BASE },
      ],
    }).compileComponents();

    store = TestBed.inject(ProcessoSeletivoStore);
    controller = TestBed.inject(HttpTestingController);
    store.processoSeletivoId.set(PROCESSO_ID);
    store.patchSection('cronograma', { ...store.draft().cronograma, fases: [FASE_INSCRICAO] });
    store.patchObjectSection('formulario', {
      conteudo: conteudoDoFormulario(GRAVADO),
      referenciaTemporal: { tipo: 'DATA_ESPECIFICA', data: '2027-01-15', faseCodigo: '' },
    });

    fixture = TestBed.createComponent(FormularioStepComponent);
    host = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    for (const requisicao of controller.match(() => true)) {
      requisicao.flush(requisicao.request.url.includes('fatos-candidato') ? [PCD_NO_CATALOGO] : []);
    }
    fixture.detectChanges();
  });

  afterEach(() => controller.verify());

  function valor(rotulo: string): readonly (string | undefined)[] {
    return Array.from(host.querySelectorAll('dl'))
      .filter((dl) => dl.querySelector('dt')?.textContent?.trim() === rotulo)
      .map((dl) => dl.querySelector('dd')?.textContent?.trim());
  }

  function declararDesempate(regraCodigo: string): void {
    store.patchSection('desempate', [
      { regraCodigo, regraVersao: 'v1', etapaRef: '', idadeMinima: '', fato: '', operador: '', valor: '', areas: [] },
    ]);
  }

  it('com uma só fase que coleta inscrição, a escolhe sozinho', () => {
    expect(store.draft().formulario.faseCodigo).toBe('');
    expect(fixture.componentInstance.faseDaInscricao()).toBe('INSCRICAO');
    expect(fixture.componentInstance.validate()).toEqual({ valid: true });
  });

  it('antes de o formulário existir no servidor, o combo não oferece o conjunto básico, que a API põe na seção reservada', () => {
    expect(fixture.componentInstance.fatosIndisponiveis(), 'com a seção dos dados básicos, ela é a referência').not.toContain('SEXO');

    store.patchObjectSection('formulario', { conteudo: conteudoInicial() });

    expect(fixture.componentInstance.fatosIndisponiveis()).toContain('SEXO');
  });

  it('o campo que uma exigência documental cita não sai, e o editor diz por quê', () => {
    const exigencia = {
      ...exigenciaNova('01960000-0000-7000-0000-0000000000d1', 'INSCRICAO'),
      aplicabilidade: 'CONDICIONAL',
      condicoes: [{ clausula: 0, ordem: 0, fato: 'PCD', operador: 'IGUAL', valor: 'true' }],
    } as ExigenciaDeDocumento;
    store.patchSection('documentos', comExigencia({ raizes: [], emTodasAsFases: [] }, exigencia));
    fixture.detectChanges();

    expect(fixture.componentInstance.remocoesTravadas().get('PCD')).toMatch(/^Não pode sair: o documento/);
    expect(host.textContent).toContain('Não pode sair: o documento');
  });

  it('grava só o que mudou, seguindo o plano, e envia os itens sem os dados básicos', async () => {
    const conteudo = store.draft().formulario.conteudo;
    store.patchObjectSection('formulario', {
      conteudo: { ...conteudo, itens: conteudo.itens?.map((i) => (i.fatoCodigo === 'PCD' ? { ...i, rotulo: 'Você tem deficiência?' } : i)) ?? [] },
    });

    const gravacao = fixture.componentInstance.persistir();
    controller.expectOne(ROTA_PROCESSO).flush(PROCESSO);
    await proximoPasso();

    const itens = controller.expectOne((r) => r.method === 'PUT' && r.url === `${ROTA_INSCRICAO}/itens`);
    expect(itens.request.body.itens.map((i: { fatoCodigo: string; rotulo: string }) => [i.fatoCodigo, i.rotulo])).toEqual([
      ['PCD', 'Você tem deficiência?'],
    ]);
    expect(itens.request.headers.has('Idempotency-Key')).toBe(true);
    itens.flush(null, { status: 204, statusText: 'No Content' });
    await proximoPasso();

    controller.expectOne(`${ROTA_PROCESSO}/referencia-temporal-fatos`).flush(null, { status: 204, statusText: 'No Content' });
    await proximoPasso();
    controller.expectOne(ROTA_PROCESSO).flush(PROCESSO);

    expect(await gravacao).toEqual({ valid: true });
    // A releitura projeta o que o servidor tem, inclusive a fase pelo código.
    expect(store.draft().formulario.faseCodigo).toBe('INSCRICAO');
  });

  it('a recusa de um item vai para ele, pelo índice da lista enviada sem os dados básicos', async () => {
    const conteudo = store.draft().formulario.conteudo;
    store.patchObjectSection('formulario', {
      conteudo: { ...conteudo, itens: conteudo.itens?.map((i) => (i.fatoCodigo === 'PCD' ? { ...i, rotulo: 'Outro' } : i)) ?? [] },
    });

    const gravacao = fixture.componentInstance.persistir();
    controller.expectOne(ROTA_PROCESSO).flush(PROCESSO);
    await proximoPasso();
    controller
      .expectOne(`${ROTA_INSCRICAO}/itens`)
      .flush(
        { type: 'about:blank', title: 'Recusado.', status: 422, code: 'uniplus.selecao.formulario.item_invalido', traceId: '00000000000000000000000000000003', errors: [{ field: 'itens[0].rotulo', code: 'x', message: 'Rótulo recusado.' }] },
        { status: 422, statusText: 'Unprocessable Entity', headers: PROBLEM_JSON },
      );
    await proximoPasso();
    // Depois da recusa, relê para comparar a próxima tentativa com o que ficou gravado.
    controller.expectOne(ROTA_PROCESSO).flush(PROCESSO);

    const resultado = await gravacao;
    expect(resultado.valid).toBe(false);
    expect(fixture.componentInstance.recusas()?.porItem.get('PCD')).toEqual(['Rótulo recusado.']);
  });

  it('avisa do desempate por idoso sem apuração da idade e leva ao passo Desempate', () => {
    declararDesempate('DESEMPATE-IDOSO');
    store.patchObjectSection('formulario', { referenciaTemporal: { tipo: '', data: '', faseCodigo: '' } });
    fixture.detectChanges();

    expect(host.querySelector('#form-idoso-sem-apuracao')).not.toBeNull();
    // A data de nascimento é dos dados básicos, que a inscrição sempre coleta.
    expect(host.querySelector('#form-desempate-sem-nascimento')).toBeNull();
    (host.querySelector('#form-ir-desempate-apuracao') as HTMLButtonElement).click();
    expect(store.currentStep()).toBe(PASSO_DESEMPATE);
  });

  describe('em consulta', () => {
    beforeEach(() => {
      store.remoteSnapshot.set({ status: 'publicado' } as never);
      fixture.detectChanges();
    });

    it('lê o formulário como texto, sem controle nem ação de edição', () => {
      expect(host.querySelector('input, select, textarea, button, ui-editor-de-formulario')).toBeNull();
      expect(valor('Título do formulário')).toEqual(['Inscrição — Medicina 2027']);
      expect(valor('Fase da inscrição')).toEqual(['INSCRICAO']);
      expect(host.textContent).toContain('Condições especiais');
      expect(valor('Resposta')).toEqual(['Obrigatório', 'Obrigatório']);
    });

    it('lê a apuração da idade pelo rótulo da âncora e a data no formato brasileiro', () => {
      expect(valor('Apurar a idade em')).toEqual(['Uma data fixa']);
      expect(valor('Data de apuração')).toEqual(['15/01/2027']);
    });

    it('não mostra os avisos de idade: o processo publicado não admite a correção', () => {
      store.remoteSnapshot.set({ status: 'rascunho' } as never);
      declararDesempate('DESEMPATE-IDOSO');
      store.patchObjectSection('formulario', { referenciaTemporal: { tipo: '', data: '', faseCodigo: '' } });
      expect(fixture.componentInstance.desempateIdosoSemApuracao()).toBe(true);

      store.remoteSnapshot.set({ status: 'publicado' } as never);
      fixture.detectChanges();

      expect(fixture.componentInstance.desempateIdosoSemApuracao()).toBe(false);
      expect(host.querySelector('#form-idoso-sem-apuracao')).toBeNull();
    });
  });
});
