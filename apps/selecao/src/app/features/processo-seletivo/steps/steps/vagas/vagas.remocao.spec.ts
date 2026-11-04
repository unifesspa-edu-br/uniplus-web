import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH } from '@uniplus/shared-data/configuracao';
import { ORGANIZACAO_BASE_PATH } from '@uniplus/shared-data/organizacao';
import { PUBLICACOES_BASE_PATH } from '@uniplus/shared-data/publicacoes';
import { SELECAO_BASE_PATH } from '@uniplus/shared-data/selecao';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { CadastroInicialService } from '../../shared/cadastro-inicial.service';
import { GravacaoDoProcesso } from '../../shared/gravacao/gravacao-do-processo';
import { CamposPressupostosService } from '../../shared/campos-pressupostos.service';
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
  TelaDasVagas,
  distribuicao,
  servicosDe,
} from './vagas.testing';

let servicos: ServicosDasVagas;
let operador: TelaDasVagas;

describe('VagasStepComponent — remoção de oferta do quadro', () => {
  let store: ProcessoSeletivoStore;
  let controller: HttpTestingController;
  let detectar: () => void;

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

    const fixture = TestBed.createComponent(VagasStepComponent);
    servicos = servicosDe(fixture);
    operador = new TelaDasVagas(fixture);
    store = TestBed.inject(ProcessoSeletivoStore);
    controller = TestBed.inject(HttpTestingController);
    detectar = () => fixture.detectChanges();

    detectar();
    responderCatalogos();
    detectar();

    store.patchObjectSection('vagas', {
      ofertas: [distribuicao(OFERTA), distribuicao(OUTRA_OFERTA)],
    });
    detectar();
  });

  afterEach(() => controller.verify());

  /** Sem cabeçalho `Link`, a coleta de páginas encerra na primeira. */
  function responderCatalogos(): void {
    for (const requisicao of controller.match(() => true)) {
      const url = requisicao.request.url;
      if (url.includes('ofertas-curso')) requisicao.flush(OFERTAS);
      else if (url.includes('cursos')) requisicao.flush(LISTA_DE_CURSOS);
      else if (url.includes('modalidades')) requisicao.flush(MODALIDADES);
      else requisicao.flush([]);
    }
  }

  function ofertasNoQuadro(): readonly string[] {
    return store.draft().vagas.ofertas.map((item) => item.ofertaCursoId);
  }

  it('não remove ao pedir a remoção — só marca a oferta como pendente', () => {
    operador.pedirRemocao(OFERTA);

    expect(servicos.estado.remocaoPendente()).toBe(OFERTA);
    expect(ofertasNoQuadro()).toEqual([OFERTA, OUTRA_OFERTA]);
  });

  it('remove a oferta ao confirmar', () => {
    operador.pedirRemocao(OFERTA);
    operador.confirmarRemocao();

    expect(ofertasNoQuadro()).toEqual([OUTRA_OFERTA]);
    expect(servicos.estado.remocaoPendente()).toBeNull();
  });

  it('mantém a oferta ao cancelar', () => {
    operador.pedirRemocao(OFERTA);
    operador.cancelarRemocao();

    expect(ofertasNoQuadro()).toEqual([OFERTA, OUTRA_OFERTA]);
    expect(servicos.estado.remocaoPendente()).toBeNull();
  });

  /** Confirmar sem pedido pendente não pode remover a primeira da lista. */
  it('ignora a confirmação quando nada está pendente', () => {
    operador.confirmarRemocao();

    expect(ofertasNoQuadro()).toEqual([OFERTA, OUTRA_OFERTA]);
  });

  it('nomeia a oferta no aviso de confirmação', () => {
    operador.pedirRemocao(OFERTA);

    expect(operador.avisoDaRemocao()).toContain('Medicina');
    expect(operador.avisoDaRemocao()).toContain('quando o passo for gravado');
  });

  /**
   * Num processo retomado o padrão vem da primeira oferta, e `padraoPendente`
   * só é preenchido por quem edita esses campos. Sem preservá-lo, tirar a
   * última linha apagaria regra, percentual e modalidades já gravados.
   */
  it('preserva o padrão ao remover a última oferta do quadro', () => {
    comQuadroDeUmaOferta();

    operador.pedirRemocao(OFERTA);
    operador.confirmarRemocao();

    expect(store.draft().vagas.ofertas).toEqual([]);
    expect(servicos.estado.padrao()).toMatchObject({
      regraDistribuicaoCodigo: 'DISTRIB-VAGAS-INSTITUCIONAL',
      pr: '0,5',
      modalidades: [{ id: MODALIDADE, codigo: 'AC_I' }],
    });
  });

  function comQuadroDeUmaOferta(): void {
    store.patchObjectSection('vagas', { ofertas: [distribuicao(OFERTA)] });
  }

  /** Passo em leitura não abre confirmação: não há remoção a confirmar. */
  it('não abre a confirmação com a edição bloqueada', () => {
    store.salvando.set(true);
    operador.pedirRemocao(OFERTA);

    expect(servicos.estado.remocaoPendente()).toBeNull();
  });
});
