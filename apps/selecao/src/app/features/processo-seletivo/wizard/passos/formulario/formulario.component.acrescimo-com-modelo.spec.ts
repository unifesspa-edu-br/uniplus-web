import { BlocoSistemaCodigo } from '@uniplus/shared-data/selecao';
import { beforeEach, describe, expect, it } from 'vitest';

import { formularioDoCodigo } from './formularios-do-rascunho';
import { AplicacaoDeModelo } from './servicos/aplicacao-de-modelo.service';
import {
  FASE_HABILITACAO,
  FASE_INSCRICAO,
  HABILITACAO_GRAVADA,
  GRAVADO,
  PROBLEM_JSON,
  PROCESSO_COM_DERIVACOES,
  pagina,
  proximoPasso,
  relato,
  ROTA_APLICACAO,
  ROTA_HABILITACAO,
  ROTA_PROCESSO,
  usarPasso,
  type ContextoDoPasso,
} from './formulario-passo.testing';

const SEM_CONTEUDO = { status: 204, statusText: 'No Content' };
const FASES = [
  { id: 'F-INSCRICAO', codigo: 'INSCRICAO', coletaInscricao: true },
  { id: 'F-HABILITACAO', codigo: 'HABILITACAO', coletaInscricao: false },
];

describe('FormularioPassoComponent: acrescentar formulário partindo de um modelo', () => {
  let fixture: ContextoDoPasso['fixture'];
  let store: ContextoDoPasso['store'];
  let controller: ContextoDoPasso['controller'];
  let host: ContextoDoPasso['host'];
  let servicoDeModelos: ContextoDoPasso['servicoDeModelos'];
  let comModelosCarregados: ContextoDoPasso['comModelosCarregados'];

  usarPasso((contexto) => {
    ({ fixture, store, controller, host, servicoDeModelos, comModelosCarregados } = contexto);
  });

  beforeEach(() => {
    comModelosCarregados();
    store.patchObjectSection('cronograma', { fases: [FASE_INSCRICAO, FASE_HABILITACAO] });
    fixture.detectChanges();
  });

  const acrescentarComModelo = (): Promise<void> => {
    const modelo = servicoDeModelos()
      .modelos()
      .find((item) => item.id === 'hab');
    if (modelo === undefined) throw new Error('O modelo de habilitação não foi carregado.');
    return fixture.componentInstance.acrescentar({
      faseCodigo: 'HABILITACAO',
      codigo: 'HABILITACAO',
      modelo,
    });
  };

  const anuncio = (): string => host.querySelector('#form-anuncio')?.textContent ?? '';
  const cabecalho = () =>
    controller.expectOne((r) => r.method === 'PUT' && r.url === ROTA_HABILITACAO);

  async function ateOCabecalho(): Promise<void> {
    controller
      .expectOne(ROTA_PROCESSO)
      .flush({ ...PROCESSO_COM_DERIVACOES, cronogramaFases: FASES });
    await proximoPasso();
    cabecalho().flush(null, SEM_CONTEUDO);
    await proximoPasso();
  }

  it('o formulário nasce como a cópia do modelo, gravado, e a região viva anuncia o resultado', async () => {
    const copiada = {
      ...HABILITACAO_GRAVADA,
      faseId: 'F-HABILITACAO',
      modeloOrigem: { id: 'hab', codigo: 'HAB' },
      paginas: [pagina('REVISAO_E_ACEITE', 0, BlocoSistemaCodigo.REVISAO_E_ACEITE)],
      coleta: { itens: [], grupos: [] },
    };

    const acrescimo = acrescentarComModelo();
    expect(store.operacaoEmAndamento(), 'um segundo pedido esperaria a cópia').toBe(true);
    await ateOCabecalho();
    controller.expectOne(ROTA_APLICACAO).flush(relato('HABILITACAO'));
    await proximoPasso();
    controller.expectOne(ROTA_PROCESSO).flush({
      ...PROCESSO_COM_DERIVACOES,
      cronogramaFases: FASES,
      formularios: [GRAVADO, copiada],
    });
    await acrescimo;
    fixture.detectChanges();

    const formulario = formularioDoCodigo(store.draft().formulario, 'HABILITACAO');
    expect(formulario?.gravado).toBe(true);
    expect(formulario?.modeloOrigemCodigo).toBe('HAB');
    expect(store.operacaoEmAndamento()).toBe(false);
    expect(anuncio()).toContain('passou a ser a cópia do modelo');
    expect(anuncio()).not.toContain('com o modelo escolhido');
  });

  it('a cópia recusada deixa o formulário criado sem ela, com a recusa em texto e a aplicação na aba', async () => {
    const acrescimo = acrescentarComModelo();
    await ateOCabecalho();
    controller
      .expectOne(ROTA_APLICACAO)
      .flush(
        { type: 'about:blank', title: 'O modelo não serve a este processo.', status: 422 },
        { status: 422, statusText: 'Unprocessable Entity', headers: PROBLEM_JSON },
      );
    await acrescimo;
    fixture.detectChanges();

    expect(formularioDoCodigo(store.draft().formulario, 'HABILITACAO')?.modeloOrigemCodigo).toBe(
      null,
    );
    expect(anuncio()).toContain('O modelo não foi aplicado');
    expect(host.querySelector('#form-1-recusa-modelo')?.textContent).toContain(
      'O modelo não foi aplicado',
    );
    const aplicar = host.querySelector<HTMLButtonElement>('#form-1-aplicar-modelo');
    expect(aplicar?.disabled).toBe(false);
  });

  it('a cópia em aberto noutro formulário recusa a criação com cópia, sem chamar a API', async () => {
    store.aplicacoesDeModeloEmAberto.set(
      new Map([
        ['INSCRICAO', { modeloId: 'insc', modeloNome: 'Inscrição', copiaConfirmada: false }],
      ]),
    );

    await acrescentarComModelo();
    fixture.detectChanges();

    expect(formularioDoCodigo(store.draft().formulario, 'HABILITACAO')).not.toBeNull();
    expect(anuncio()).toContain('INSCRICAO');
    expect(host.querySelector('#form-1-recusa-modelo')).not.toBeNull();
  });

  it('na inscrição, com outro formulário já gravado, a cópia pede a confirmação da aba', async () => {
    const modelo = servicoDeModelos()
      .modelos()
      .find((item) => item.id === 'insc');
    if (modelo === undefined) throw new Error('O modelo de inscrição não foi carregado.');

    await fixture.componentInstance.acrescentar({
      faseCodigo: 'INSCRICAO',
      codigo: 'INSCRICAO_COMPLEMENTAR',
      modelo,
    });

    expect(fixture.debugElement.injector.get(AplicacaoDeModelo).pendente()?.formulario.codigo).toBe(
      'INSCRICAO_COMPLEMENTAR',
    );
    expect(store.operacaoEmAndamento()).toBe(false);
  });

  it('sem modelo, nada é aplicado e o formulário só é criado ao gravar o passo', async () => {
    await fixture.componentInstance.acrescentar({
      faseCodigo: 'HABILITACAO',
      codigo: 'HABILITACAO',
      modelo: null,
    });
    fixture.detectChanges();

    expect(formularioDoCodigo(store.draft().formulario, 'HABILITACAO')?.gravado).toBe(false);
    expect(anuncio()).toContain('criado no processo ao gravar o passo');
  });
});
