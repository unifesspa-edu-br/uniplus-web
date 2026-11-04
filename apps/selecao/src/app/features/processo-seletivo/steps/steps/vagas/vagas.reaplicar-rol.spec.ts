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
import { CadastroInicial } from '../../shared/cadastro-inicial.service';
import { GravacaoDoProcesso } from '../../shared/gravacao/gravacao-do-processo';
import { GravacaoDosCamposPressupostos } from '../../shared/campos-pressupostos.service';
import { CatalogosDoCronogramaService } from '../cronograma/catalogos-do-cronograma.service';
import { VagasStepComponent } from './vagas.component';
import {
  BASE,
  LISTA_DE_CURSOS,
  MODALIDADE,
  OFERTA,
  OFERTAS,
  ServicosDasVagas,
  TelaDasVagas,
  servicosDe,
} from './vagas.testing';

let servicos: ServicosDasVagas;
let operador: TelaDasVagas;

describe('VagasStepComponent — reaplicar o rol sob composição calculada', () => {
  let store: ProcessoSeletivoStore;
  let controller: HttpTestingController;
  let detectar: () => void;

  const MODALIDADE_CALCULADA = '01960000-0000-7000-0000-0000000000c1';

  const MODALIDADES_FEDERAL = [
    {
      id: MODALIDADE,
      codigo: 'AC_I',
      descricao: 'Indígena',
      naturezaLegal: 'ACAO_AFIRMATIVA',
      composicaoVagas: 'SUPLEMENTAR_AO_TOTAL',
      composicaoOrigemCodigo: null,
      regraRemanejamento: null,
      remanejamentoDestino: null,
      remanejamentoPar: null,
      remanejamentoFallback: null,
    },
    {
      id: MODALIDADE_CALCULADA,
      codigo: 'X_CALC',
      descricao: 'Calculada pela regra',
      naturezaLegal: 'COTA_RESERVADA',
      composicaoVagas: 'DENTRO_DO_VR',
      composicaoOrigemCodigo: null,
      regraRemanejamento: null,
      remanejamentoDestino: null,
      remanejamentoPar: null,
      remanejamentoFallback: null,
    },
  ];

  const REGRA_FEDERAL = {
    codigo: 'DISTRIB-VAGAS-LEI-12711',
    versao: 'v1',
    tipo: 'regra_distribuicao_vagas',
    esquemaArgs: {},
    invariantes: [],
    baseLegal: 'Lei 12.711/2012',
    hash: 'hash-federal',
    modalidadesAdmitidas: ['AC_I', 'X_CALC'],
  };

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
    operador = new TelaDasVagas(fixture);
    store = TestBed.inject(ProcessoSeletivoStore);
    controller = TestBed.inject(HttpTestingController);
    detectar = () => fixture.detectChanges();

    detectar();
    for (const requisicao of controller.match(() => true)) {
      const url = requisicao.request.url;
      if (url.includes('ofertas-curso')) requisicao.flush(OFERTAS);
      else if (url.includes('cursos')) requisicao.flush(LISTA_DE_CURSOS);
      else if (url.includes('modalidades')) requisicao.flush(MODALIDADES_FEDERAL);
      else if (url.includes('regras-catalogo')) {
        const tipo = requisicao.request.params.get('tipo');
        requisicao.flush(tipo === 'regra_distribuicao_vagas' ? [REGRA_FEDERAL] : []);
      } else requisicao.flush([]);
    }
    detectar();
  });

  afterEach(() => controller.verify());

  /**
   * A modalidade continua no rol — o id permanece selecionado —, mas sua
   * composicaoVagas é calculada pela fórmula do art. 10 sob ramo federal:
   * quadroCoerente descarta a quantidade fixada por essa segunda condição,
   * não porque a modalidade saiu da seleção. Checar só "saiu do rol" não
   * pega esse caso — reaplicarRolDaRegra precisa comparar com o resultado
   * real de quadroCoerente, não reimplementar metade do filtro dele.
   */
  it('pede confirmação quando a quantidade que seria perdida é de composição calculada, não de modalidade fora do rol', () => {
    store.patchObjectSection('vagas', {
      ofertas: [
        {
          ofertaCursoId: OFERTA,
          voBase: '40',
          pr: '0,5',
          regraDistribuicaoCodigo: 'DISTRIB-VAGAS-LEI-12711',
          regraDistribuicaoVersao: 'v1',
          regraAjusteCodigo: null,
          regraAjusteVersao: null,
          referenciaReservaDemograficaId: null,
          modalidades: [
            { id: MODALIDADE, codigo: 'AC_I' },
            { id: MODALIDADE_CALCULADA, codigo: 'X_CALC' },
          ],
          quadro: [{ modalidadeId: MODALIDADE_CALCULADA, quantidade: '5' }],
        },
      ],
    });
    detectar();

    operador.reaplicarRolDaRegra();

    expect(servicos.estado.reaplicarRolPendente()).toBe(true);
  });

  /**
   * selecaoBateComORol não vê essa divergência: os ids batem com o rol, a
   * checagem é sobre o CONTEÚDO do quadro. Sem reaplicarRolTemEfeito, o
   * botão "Recompor pelo rol da regra atual" ficaria escondido e a única
   * saída seria remover e recriar a oferta.
   */
  it('reaplicarRolTemEfeito acusa mesmo quando a seleção já bate com o rol', () => {
    store.patchObjectSection('vagas', {
      ofertas: [
        {
          ofertaCursoId: OFERTA,
          voBase: '40',
          pr: '0,5',
          regraDistribuicaoCodigo: 'DISTRIB-VAGAS-LEI-12711',
          regraDistribuicaoVersao: 'v1',
          regraAjusteCodigo: null,
          regraAjusteVersao: null,
          referenciaReservaDemograficaId: null,
          modalidades: [
            { id: MODALIDADE, codigo: 'AC_I' },
            { id: MODALIDADE_CALCULADA, codigo: 'X_CALC' },
          ],
          quadro: [{ modalidadeId: MODALIDADE_CALCULADA, quantidade: '5' }],
        },
      ],
    });
    detectar();

    expect(servicos.estado.selecaoBateComORol()).toBe(true);
    expect(operador.oferecePorRecomporORol()).toBe(true);
  });
  it('apresenta o grau junto ao curso, uma única vez no rótulo', () => {
    // O grau é atributo do curso, não da oferta: duas ofertas do mesmo curso
    // têm o mesmo grau, então ele identifica e nunca distingue. Por isso entra
    // no nome, ao lado do curso, e não no detalhe.
    expect(servicos.catalogos.nomeDaOfertaOuSemNome(OFERTA)).toBe('Medicina · Bacharelado · IGE');
    expect(servicos.catalogos.detalheDaOfertaOuVazio(OFERTA)).toBe(
      'INTEGRAL · MATUTINO e VESPERTINO',
    );

    expect(servicos.catalogos.rotuloDaOfertaOuSemNome(OFERTA)).toBe(
      'Medicina · Bacharelado · IGE · INTEGRAL · MATUTINO e VESPERTINO',
    );

    // Uma única vez: o grau entra pelo nome e não se repete no detalhe.
    expect(servicos.catalogos.rotuloDaOfertaOuSemNome(OFERTA).match(/Bacharelado/g)).toHaveLength(
      1,
    );
  });

  it('omite o grau sem deixar separador pendurado quando o curso não o declara', () => {
    // 'curso-9' não está no catálogo: nome desconhecido e grau ausente não
    // podem produzir "Curso não identificado ·  · IGE".
    expect(servicos.catalogos.nomeDaOfertaOuSemNome('oferta-inexistente')).not.toContain('·  ·');
    expect(servicos.catalogos.nomeDaOfertaOuSemNome('oferta-inexistente')).not.toMatch(/·\s*$/);
  });
});
