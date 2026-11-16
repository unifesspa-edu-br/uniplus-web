import { HttpTestingController } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { CascataRemanejamentoComponent } from './cascata-remanejamento.component';
import {
  BASE,
  LB_PPI,
  REGRA_CASCATA_ANTERIOR,
  distribuicaoFederal,
  montarCascata,
} from './cascata-remanejamento.testing';

describe('CascataRemanejamentoComponent — busca da versão da regra', () => {
  let componente: CascataRemanejamentoComponent;
  let store: ProcessoSeletivoStore;
  let controller: HttpTestingController;
  let elemento: HTMLElement;
  let detectar: () => void;

  beforeEach(async () => {
    ({ componente, store, controller, elemento, detectar } = await montarCascata());
  });

  afterEach(() => controller.verify());

  /**
   * A seleção hidratada (ou de uma gravação
   * anterior) pode referenciar uma versão que a listagem ativa não traz mais
   * — `regraEscolhida()` não pode ficar `undefined` só porque a listagem
   * não tem a versão, senão a tabela e o checkbox somem e `validar()` cai
   * no "confirme a cascata" sem controle nenhum na tela (item já referenciado
   * permanece legível como snapshot).
   */
  it('busca a versão específica quando a seleção hidratada não está na listagem, e resolve a matriz normalmente', () => {
    store.patchObjectSection('vagas', {
      ofertas: [distribuicaoFederal([{ id: LB_PPI, codigo: 'LB_PPI' }])],
      cascata: { regraCodigo: 'REMANEJ-CASCATA-LEI-12711', regraVersao: 'v0' },
    });
    detectar();

    const requisicao = controller.expectOne(
      `${BASE}/api/selecao/regras-catalogo/REMANEJ-CASCATA-LEI-12711/versoes/v0`,
    );
    expect(requisicao.request.method).toBe('GET');
    requisicao.flush(REGRA_CASCATA_ANTERIOR);
    detectar();

    expect(componente.esquemaNaoReconhecido()).toBe(false);
    expect(componente.regraNaoEncontrada()).toBe(false);
    expect(componente.matriz()).toEqual({
      fallbackCodigo: 'AC',
      ordens: [{ origem: 'LB_PPI', destinos: ['LB_Q', 'AC'] }],
    });
    expect(elemento.querySelector('.cascata-matriz__terminal')?.textContent).toContain('AC');

    // A regra resolvida por busca direta precisa aparecer como opção do
    // seletor — sem isto o controle segura um valor sem <option>
    // correspondente e o <select> aparece em branco, mesmo com a matriz
    // conferível e gravável (D1).
    const select = elemento.querySelector<HTMLSelectElement>('#c-regra-cascata');
    const opcaoSelecionada = select?.querySelector('option[value="REMANEJ-CASCATA-LEI-12711|v0"]');
    expect(opcaoSelecionada).not.toBeNull();
    expect(opcaoSelecionada?.textContent).toContain('v0');
    expect(select?.value).toBe('REMANEJ-CASCATA-LEI-12711|v0');
  });

  it('marca a regra como não encontrada quando a busca direta da versão também falha, sem confundir com esquemaArgs malformado', () => {
    store.patchObjectSection('vagas', {
      ofertas: [distribuicaoFederal([{ id: LB_PPI, codigo: 'LB_PPI' }])],
      cascata: { regraCodigo: 'REMANEJ-CASCATA-REMOVIDA', regraVersao: 'v9' },
    });
    detectar();

    const requisicao = controller.expectOne(
      `${BASE}/api/selecao/regras-catalogo/REMANEJ-CASCATA-REMOVIDA/versoes/v9`,
    );
    requisicao.flush(
      { type: 'about:blank', title: 'Regra não encontrada.', status: 404, traceId: 't' },
      { status: 404, statusText: 'Not Found' },
    );
    detectar();

    expect(componente.regraNaoEncontrada()).toBe(true);
    expect(componente.esquemaNaoReconhecido()).toBe(false);
    expect(componente.matriz()).toBeNull();
    expect(elemento.textContent).toContain('não foi encontrada no catálogo');
  });

  /**
   * Um 5xx (ou falha de rede/autorização) na
   * busca da versão fora da listagem não prova que a regra não existe —
   * classificar como `nao_encontrada` transformaria uma indisponibilidade
   * transitória num veredito permanente, e a busca nunca mais tentaria de
   * novo (D2). `falhaAoConsultarRegra()` é o estado certo, com saída via
   * `leituraDaRegra.tentar()`.
   */
  it('marca falha ao consultar (não "não encontrada") quando a busca direta responde 5xx, e permite tentar de novo', () => {
    store.patchObjectSection('vagas', {
      ofertas: [distribuicaoFederal([{ id: LB_PPI, codigo: 'LB_PPI' }])],
      cascata: { regraCodigo: 'REMANEJ-CASCATA-LEI-12711', regraVersao: 'v0' },
    });
    detectar();

    controller
      .expectOne(`${BASE}/api/selecao/regras-catalogo/REMANEJ-CASCATA-LEI-12711/versoes/v0`)
      .flush(
        { type: 'about:blank', title: 'Erro interno.', status: 503, traceId: 't' },
        { status: 503, statusText: 'Service Unavailable' },
      );
    detectar();

    expect(componente.falhaAoConsultarRegra()).toBe(true);
    expect(componente.regraNaoEncontrada()).toBe(false);
    expect(componente.esquemaNaoReconhecido()).toBe(false);
    expect(componente.matriz()).toBeNull();
    expect(elemento.textContent).toContain('a consulta falhou, não a regra');

    componente.leituraDaRegra.tentar();
    detectar();

    const retentativa = controller.expectOne(
      `${BASE}/api/selecao/regras-catalogo/REMANEJ-CASCATA-LEI-12711/versoes/v0`,
    );
    retentativa.flush(REGRA_CASCATA_ANTERIOR);
    detectar();

    expect(componente.falhaAoConsultarRegra()).toBe(false);
    expect(componente.matriz()).toEqual({
      fallbackCodigo: 'AC',
      ordens: [{ origem: 'LB_PPI', destinos: ['LB_Q', 'AC'] }],
    });
  });

  /**
   * Trocar de processo (A → B sem cascata) com a busca direta da versão
   * de A ainda em curso abandona essa busca — a resposta, quando vier, não é
   * mais de quem está na tela. Ao voltar para A, o `buscando` abandonado não
   * pode passar por "já tratado", senão nenhuma consulta nova sai e a matriz
   * só volta com recarga da página.
   */
  describe('busca abandonada por troca de processo (A → B → A)', () => {
    const URL_V0 = `${BASE}/api/selecao/regras-catalogo/REMANEJ-CASCATA-LEI-12711/versoes/v0`;
    const SELECAO_A = { regraCodigo: 'REMANEJ-CASCATA-LEI-12711', regraVersao: 'v0' };

    function abandonarBuscaDeA(): void {
      store.patchObjectSection('vagas', {
        ofertas: [distribuicaoFederal([{ id: LB_PPI, codigo: 'LB_PPI' }])],
        cascata: SELECAO_A,
      });
      detectar();
      const abandonada = controller.expectOne(URL_V0);

      store.patchObjectSection('vagas', { cascata: null });
      detectar();
      expect(abandonada.cancelled).toBe(true);

      store.patchObjectSection('vagas', { cascata: SELECAO_A });
      detectar();
    }

    it('refaz a busca da versão ao voltar e resolve a regra e a matriz', () => {
      abandonarBuscaDeA();

      controller.expectOne(URL_V0).flush(REGRA_CASCATA_ANTERIOR);
      detectar();

      expect(componente.regraNaoEncontrada()).toBe(false);
      expect(componente.falhaAoConsultarRegra()).toBe(false);
      expect(componente.matriz()).toEqual({
        fallbackCodigo: 'AC',
        ordens: [{ origem: 'LB_PPI', destinos: ['LB_Q', 'AC'] }],
      });
      expect(elemento.querySelector('.cascata-matriz__terminal')?.textContent).toContain('AC');
    });

    it('preserva a falha retentável quando a nova busca falha', () => {
      abandonarBuscaDeA();

      controller
        .expectOne(URL_V0)
        .flush(
          { type: 'about:blank', title: 'Erro interno.', status: 503, traceId: 't' },
          { status: 503, statusText: 'Service Unavailable' },
        );
      detectar();

      expect(componente.falhaAoConsultarRegra()).toBe(true);
      expect(componente.matriz()).toBeNull();

      componente.leituraDaRegra.tentar();
      detectar();
      controller.expectOne(URL_V0).flush(REGRA_CASCATA_ANTERIOR);
      detectar();

      expect(componente.falhaAoConsultarRegra()).toBe(false);
      expect(componente.matriz()).not.toBeNull();
    });
  });
});
