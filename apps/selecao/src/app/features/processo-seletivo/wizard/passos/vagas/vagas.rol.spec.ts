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
import { CatalogoDeFatos } from '../cronograma/catalogos/catalogo-de-fatos.service';
import { VagasPassoComponent } from './vagas.component';
import {
  BASE,
  LISTA_DE_CURSOS,
  MODALIDADE,
  MODALIDADES,
  OFERTA,
  OFERTAS,
  REGRA_INSTITUCIONAL,
  REGRA_PSIQ,
  SEGUNDA_MODALIDADE,
  ServicosDasVagas,
  TelaDasVagas,
  distribuicao,
  servicosDe,
} from './vagas.testing';

let servicos: ServicosDasVagas;
let operador: TelaDasVagas;

describe('VagasPassoComponent — regra determina o rol de modalidades', () => {
  let store: ProcessoSeletivoStore;
  let controller: HttpTestingController;
  let detectar: () => void;
  let elementoRaiz: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VagasPassoComponent],
      providers: [
        ProcessoSeletivoStore,
        CadastroInicial,
        GravacaoDoProcesso,
        CatalogoDeFatos,
        GravacaoDosCamposPressupostos,
        { provide: PUBLICACOES_BASE_PATH, useValue: BASE },
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: SELECAO_BASE_PATH, useValue: BASE },
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
        { provide: ORGANIZACAO_BASE_PATH, useValue: BASE },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(VagasPassoComponent);
    servicos = servicosDe(fixture);
    operador = new TelaDasVagas(fixture);
    store = TestBed.inject(ProcessoSeletivoStore);
    controller = TestBed.inject(HttpTestingController);
    detectar = () => fixture.detectChanges();
    elementoRaiz = fixture.nativeElement;

    detectar();
    for (const requisicao of controller.match(() => true)) {
      const url = requisicao.request.url;
      if (url.includes('ofertas-curso')) requisicao.flush(OFERTAS);
      else if (url.includes('cursos')) requisicao.flush(LISTA_DE_CURSOS);
      else if (url.includes('modalidades')) requisicao.flush(MODALIDADES);
      else if (url.includes('regras-catalogo')) {
        const tipo = requisicao.request.params.get('tipo');
        requisicao.flush(
          tipo === 'regra_distribuicao_vagas' ? [REGRA_INSTITUCIONAL, REGRA_PSIQ] : [],
        );
      } else requisicao.flush([]);
    }
    detectar();
  });

  afterEach(() => controller.verify());

  /** A região viva que anuncia os problemas do padrão não pode tirar da lista o papel de lista. */
  it('anuncia os problemas do padrão numa região viva que envolve a lista', () => {
    store.patchObjectSection('vagas', { ofertas: [{ ...distribuicao(OFERTA), pr: '2' }] });
    detectar();

    const regiao = elementoRaiz.querySelector<HTMLElement>('[role="alert"]');
    expect(regiao?.tagName).toBe('DIV');
    const itens = regiao?.querySelectorAll(
      ':scope > ul[aria-label="Problemas no padrão da distribuição"] > li',
    );
    expect(Array.from(itens ?? [], (item) => item.textContent?.trim())).toContain(
      'O percentual de reserva fica entre 0,5 e 1,0 (art. 10, II da Lei 12.711).',
    );
  });

  it('rol aberto (Institucional) oferece o catálogo inteiro para seleção livre', () => {
    expect(servicos.estado.rolDaRegraEscolhida()).toBeNull();
    expect(servicos.estado.modalidadesOferecidas().map((m) => m.codigo)).toEqual(['AC_I', 'AC_Q']);
  });

  it('trocar para regra sem dado a perder aplica direto, sem confirmação', () => {
    store.patchObjectSection('vagas', { ofertas: [] });
    detectar();

    operador.escolherRegra('DISTRIB-VAGAS-PSIQ|v1');

    expect(servicos.estado.trocaDeRegraPendente()).toBeNull();
    expect(servicos.estado.padrao().regraDistribuicaoCodigo).toBe('DISTRIB-VAGAS-PSIQ');
    expect(
      servicos.estado
        .padrao()
        .modalidades.map((m) => m.codigo)
        .sort(),
    ).toEqual(['AC_I', 'AC_Q']);
  });

  it('trocar de regra com dado preenchido pede confirmação antes de mudar', () => {
    store.patchObjectSection('vagas', { ofertas: [distribuicao(OFERTA)] });
    detectar();

    operador.escolherRegra('DISTRIB-VAGAS-PSIQ|v1');

    expect(servicos.estado.trocaDeRegraPendente()).toEqual({
      codigo: 'DISTRIB-VAGAS-PSIQ',
      versao: 'v1',
    });
    expect(servicos.estado.padrao().regraDistribuicaoCodigo).toBe('DISTRIB-VAGAS-INSTITUCIONAL');
  });

  it('confirmar a troca aplica o rol fechado da nova regra por inteiro', () => {
    store.patchObjectSection('vagas', { ofertas: [distribuicao(OFERTA)] });
    detectar();

    operador.escolherRegra('DISTRIB-VAGAS-PSIQ|v1');
    operador.confirmarTrocaDeRegra();

    expect(servicos.estado.trocaDeRegraPendente()).toBeNull();
    expect(servicos.estado.padrao().regraDistribuicaoCodigo).toBe('DISTRIB-VAGAS-PSIQ');
    expect(
      servicos.estado
        .padrao()
        .modalidades.map((m) => m.codigo)
        .sort(),
    ).toEqual(['AC_I', 'AC_Q']);
    expect(servicos.estado.rolDaRegraEscolhida()).toEqual(['AC_I', 'AC_Q']);
  });

  it('cancelar a troca mantém a regra e as modalidades como estavam', () => {
    store.patchObjectSection('vagas', { ofertas: [distribuicao(OFERTA)] });
    detectar();

    operador.escolherRegra('DISTRIB-VAGAS-PSIQ|v1');
    operador.cancelarTrocaDeRegra();

    expect(servicos.estado.trocaDeRegraPendente()).toBeNull();
    expect(servicos.estado.padrao().regraDistribuicaoCodigo).toBe('DISTRIB-VAGAS-INSTITUCIONAL');
    expect(servicos.estado.padrao().modalidades).toEqual([{ id: MODALIDADE, codigo: 'AC_I' }]);
  });

  it('rol fechado não aceita alternar modalidade manualmente', () => {
    store.patchObjectSection('vagas', { ofertas: [distribuicao(OFERTA)] });
    detectar();
    operador.escolherRegra('DISTRIB-VAGAS-PSIQ|v1');
    operador.confirmarTrocaDeRegra();

    operador.alternarModalidade('AC_I');

    expect(
      servicos.estado
        .padrao()
        .modalidades.map((m) => m.codigo)
        .sort(),
    ).toEqual(['AC_I', 'AC_Q']);
  });

  /** Processo hidratado por fora do fluxo normal, trazendo modalidade que a regra atual não admite. */
  it('nomeia a modalidade hidratada fora do rol fechado, em vez de escondê-la', () => {
    store.patchObjectSection('vagas', {
      ofertas: [
        {
          ...distribuicao(OFERTA),
          regraDistribuicaoCodigo: 'DISTRIB-VAGAS-PSIQ',
          regraDistribuicaoVersao: 'v1',
          modalidades: [
            { id: MODALIDADE, codigo: 'AC_I' },
            { id: SEGUNDA_MODALIDADE, codigo: 'AC_Q' },
            { id: '01960000-0000-7000-0000-0000000000a9', codigo: 'AC_PCD' },
          ],
        },
      ],
    });
    detectar();

    const problemas = servicos.conferencia.problemasDe(store.draft().vagas.ofertas[0]);

    expect(
      problemas.some(
        (p) => p.mensagem.includes('AC_PCD') && p.mensagem.includes('não pertence ao rol'),
      ),
    ).toBe(true);
  });

  it('rol fechado incompleto: selecaoBateComORol acusa, e reaplicarRolDaRegra completa', () => {
    store.patchObjectSection('vagas', {
      ofertas: [
        {
          ...distribuicao(OFERTA),
          regraDistribuicaoCodigo: 'DISTRIB-VAGAS-PSIQ',
          regraDistribuicaoVersao: 'v1',
          modalidades: [{ id: MODALIDADE, codigo: 'AC_I' }],
        },
      ],
    });
    detectar();

    expect(servicos.estado.selecaoBateComORol()).toBe(false);

    operador.reaplicarRolDaRegra();

    expect(servicos.estado.selecaoBateComORol()).toBe(true);
    expect(
      servicos.estado
        .padrao()
        .modalidades.map((m) => m.codigo)
        .sort(),
    ).toEqual(['AC_I', 'AC_Q']);
  });

  /**
   * Diferente do caso "só falta" acima: aqui a modalidade excedente tem
   * quantidade preenchida no quadro — reaplicar descartaria essa quantidade
   * em silêncio se não pedisse confirmação, a mesma perda que a troca de
   * regra evita.
   */
  it('reaplicar o rol com quantidade a perder no quadro pede confirmação antes de completar', () => {
    store.patchObjectSection('vagas', {
      ofertas: [
        {
          ...distribuicao(OFERTA),
          regraDistribuicaoCodigo: 'DISTRIB-VAGAS-PSIQ',
          regraDistribuicaoVersao: 'v1',
          modalidades: [
            { id: MODALIDADE, codigo: 'AC_I' },
            { id: SEGUNDA_MODALIDADE, codigo: 'AC_Q' },
            { id: '01960000-0000-7000-0000-0000000000a9', codigo: 'AC_PCD' },
          ],
          quadro: [{ modalidadeId: '01960000-0000-7000-0000-0000000000a9', quantidade: '3' }],
        },
      ],
    });
    detectar();

    operador.reaplicarRolDaRegra();

    expect(servicos.estado.reaplicarRolPendente()).toBe(true);
    expect(
      servicos.estado
        .padrao()
        .modalidades.map((m) => m.codigo)
        .sort(),
    ).toEqual(['AC_I', 'AC_PCD', 'AC_Q']);

    operador.confirmarReaplicarRol();

    expect(servicos.estado.reaplicarRolPendente()).toBe(false);
    expect(
      servicos.estado
        .padrao()
        .modalidades.map((m) => m.codigo)
        .sort(),
    ).toEqual(['AC_I', 'AC_Q']);
  });

  it('cancelar o reaplicar do rol mantém a seleção divergente como estava', () => {
    store.patchObjectSection('vagas', {
      ofertas: [
        {
          ...distribuicao(OFERTA),
          regraDistribuicaoCodigo: 'DISTRIB-VAGAS-PSIQ',
          regraDistribuicaoVersao: 'v1',
          modalidades: [
            { id: MODALIDADE, codigo: 'AC_I' },
            { id: '01960000-0000-7000-0000-0000000000a9', codigo: 'AC_PCD' },
          ],
          quadro: [{ modalidadeId: '01960000-0000-7000-0000-0000000000a9', quantidade: '3' }],
        },
      ],
    });
    detectar();

    operador.reaplicarRolDaRegra();
    operador.cancelarReaplicarRol();

    expect(servicos.estado.reaplicarRolPendente()).toBe(false);
    expect(
      servicos.estado
        .padrao()
        .modalidades.map((m) => m.codigo)
        .sort(),
    ).toEqual(['AC_I', 'AC_PCD']);
    expect(store.draft().vagas.ofertas[0].quadro).toEqual([
      { modalidadeId: '01960000-0000-7000-0000-0000000000a9', quantidade: '3' },
    ]);
  });

  it('rol fechado com a seleção certa: selecaoBateComORol aprova', () => {
    store.patchObjectSection('vagas', { ofertas: [distribuicao(OFERTA)] });
    detectar();

    operador.escolherRegra('DISTRIB-VAGAS-PSIQ|v1');
    operador.confirmarTrocaDeRegra();

    expect(servicos.estado.selecaoBateComORol()).toBe(true);
  });

  /**
   * NgModel só reescreve o <select> nativo quando o valor do binding muda
   * entre ciclos de detecção — chamar os métodos direto na instância (como os
   * demais testes deste describe) não exercita essa reescrita. Este teste
   * interage com o elemento real.
   */
  it('cancelar a troca devolve o <select> nativo à regra vigente, não à rejeitada', () => {
    store.patchObjectSection('vagas', { ofertas: [distribuicao(OFERTA)] });
    detectar();

    const campoRegra = elementoRaiz.querySelector<HTMLSelectElement>('#f-regra');
    if (campoRegra === null) throw new Error('Campo #f-regra não encontrado no template.');

    campoRegra.value = 'DISTRIB-VAGAS-PSIQ|v1';
    campoRegra.dispatchEvent(new Event('change'));
    detectar();

    expect(servicos.estado.trocaDeRegraPendente()).not.toBeNull();
    expect(campoRegra.value).toBe('DISTRIB-VAGAS-PSIQ|v1');

    operador.cancelarTrocaDeRegra();
    detectar();

    expect(campoRegra.value).toBe('DISTRIB-VAGAS-INSTITUCIONAL|v1');
  });
});
