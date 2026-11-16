import { HttpTestingController } from '@angular/common/http/testing';
import { ProcessoSeletivoDto } from '@uniplus/shared-data/selecao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { CascataRemanejamentoComponent } from './cascata-remanejamento.component';
import {
  AC,
  LB_PPI,
  LB_Q,
  distribuicaoFederal,
  montarCascata,
} from './cascata-remanejamento.testing';

describe('CascataRemanejamentoComponent', () => {
  let componente: CascataRemanejamentoComponent;
  let store: ProcessoSeletivoStore;
  let controller: HttpTestingController;
  let elemento: HTMLElement;
  let detectar: () => void;

  beforeEach(async () => {
    ({ componente, store, controller, elemento, detectar } = await montarCascata());
  });

  afterEach(() => controller.verify());

  it('não exibe seletor nem alerta quando nenhuma oferta segue a cascata', () => {
    store.patchObjectSection('vagas', {
      ofertas: [distribuicaoFederal([{ id: LB_Q, codigo: 'LB_Q' }])],
    });
    detectar();

    expect(elemento.querySelector('#c-regra-cascata')).toBeNull();
    expect(elemento.textContent).not.toContain('fora do ramo federal');
  });

  it('alerta quando a oferta segue a cascata mas está fora do ramo federal', () => {
    store.patchObjectSection('vagas', {
      ofertas: [
        {
          ...distribuicaoFederal([{ id: LB_PPI, codigo: 'LB_PPI' }]),
          ramoDaDistribuicao: 'QUADRO_FIXADO_NO_EDITAL',
        },
      ],
    });
    detectar();

    expect(elemento.querySelector('#c-regra-cascata')).toBeNull();
    expect(elemento.textContent).toContain('fora do ramo federal');
  });

  it('reconhece o ramo federal pelo ramo da distribuição, e não pelo código da regra', () => {
    store.patchObjectSection('vagas', {
      ofertas: [
        {
          ...distribuicaoFederal([{ id: LB_PPI, codigo: 'LB_PPI' }]),
          regraDistribuicaoCodigo: 'DISTRIB-VAGAS-OUTRA',
        },
      ],
    });
    detectar();

    expect(elemento.querySelector('#c-regra-cascata')).not.toBeNull();
    expect(elemento.textContent).not.toContain('fora do ramo federal');
  });

  it('exibe o seletor sem regra pré-selecionada quando a seção se aplica', () => {
    store.patchObjectSection('vagas', {
      ofertas: [distribuicaoFederal([{ id: LB_PPI, codigo: 'LB_PPI' }])],
    });
    detectar();

    const select = elemento.querySelector<HTMLSelectElement>('#c-regra-cascata');
    expect(select).not.toBeNull();
    expect(select?.querySelector('option[value="|"]')?.textContent).toContain('Selecione a regra');
    expect(componente.valorDoSelect()).toBe('|');
    expect(componente.cascata()).toBeNull();
  });

  it('deriva a matriz da regra escolhida e apresenta origem, destinos e fallback', () => {
    store.patchObjectSection('vagas', {
      ofertas: [distribuicaoFederal([{ id: LB_PPI, codigo: 'LB_PPI' }])],
    });
    detectar();

    componente.escolherRegra('REMANEJ-CASCATA-LEI-12711|v1');
    detectar();

    expect(store.draft().vagas.cascata).toEqual({
      regraCodigo: 'REMANEJ-CASCATA-LEI-12711',
      regraVersao: 'v1',
    });
    expect(componente.matriz()).toEqual({
      fallbackCodigo: 'AC',
      ordens: [{ origem: 'LB_PPI', destinos: ['LB_Q', 'AC'] }],
    });
    // A matriz é apresentada como a portaria a publica: origem na linha e a
    // ordem de preferência em colunas numeradas, não como cadeia de setas.
    const cabecalhos = Array.from(
      elemento.querySelectorAll('.cascata-matriz thead th') as NodeListOf<HTMLTableCellElement>,
    ).map((th) => th.textContent?.trim());
    expect(cabecalhos).toEqual(['Origem', '1ª', '2ª']);

    const primeiraLinha = Array.from(
      elemento.querySelector('.cascata-matriz tbody tr')?.querySelectorAll('th, td') ?? [],
    ).map((celula) => celula.textContent?.trim());
    expect(primeiraLinha).toEqual(['LB_PPI', 'LB_Q', 'AC']);

    // Até 767 px o design system esconde o `thead` e usa `data-label` como
    // rótulo visível da célula. Sem ele o cartão mostraria só os códigos, e a
    // ordem de preferência — o que a matriz existe para dizer — sumiria. O
    // rótulo é o ordinal do cabeçalho; o texto visível que descreve a matriz
    // diz que o ordinal é de preferência.
    const rotulos = Array.from(
      elemento.querySelectorAll(
        '.cascata-matriz tbody tr:first-child td',
      ) as NodeListOf<HTMLTableCellElement>,
    ).map((celula) => celula.getAttribute('data-label'));
    expect(rotulos).toEqual(['1ª', '2ª']);
    const leitura = elemento.querySelector(
      `#${elemento.querySelector('.cascata-matriz')?.getAttribute('aria-describedby')}`,
    );
    expect(leitura?.textContent?.replace(/\s+/g, ' ')).toContain('na ordem de preferência');

    // O destino final é enunciado fora da matriz: tratá-lo como linha sugeriria
    // que a ampla concorrência também remaneja.
    expect(elemento.querySelector('.cascata-matriz__terminal')?.textContent).toContain(
      'revertida à ampla concorrência',
    );
  });

  it('aponta o encaixe pendente e trava a confirmação quando a oferta não cobre a matriz', () => {
    // Só a origem está selecionada — nem o destino final nem o outro destino.
    store.patchObjectSection('vagas', {
      ofertas: [distribuicaoFederal([{ id: LB_PPI, codigo: 'LB_PPI' }])],
    });
    detectar();

    componente.escolherRegra('REMANEJ-CASCATA-LEI-12711|v1');
    detectar();

    expect(componente.problemas().length).toBeGreaterThan(0);
    expect(componente.pronta()).toBe(false);
  });

  it('libera e marca pronta quando a oferta cobre fallback e destino', () => {
    store.patchObjectSection('vagas', {
      ofertas: [
        distribuicaoFederal([
          { id: LB_PPI, codigo: 'LB_PPI' },
          { id: LB_Q, codigo: 'LB_Q' },
          { id: AC, codigo: 'AC' },
        ]),
      ],
    });
    detectar();

    componente.escolherRegra('REMANEJ-CASCATA-LEI-12711|v1');
    detectar();
    expect(componente.problemas()).toEqual([]);
    expect(componente.pronta()).toBe(true);
  });

  it('limpar o seletor de regra zera a cascata do rascunho', () => {
    store.patchObjectSection('vagas', {
      ofertas: [
        distribuicaoFederal([
          { id: LB_PPI, codigo: 'LB_PPI' },
          { id: LB_Q, codigo: 'LB_Q' },
          { id: AC, codigo: 'AC' },
        ]),
      ],
    });
    detectar();
    componente.escolherRegra('REMANEJ-CASCATA-LEI-12711|v1');
    detectar();
    expect(store.draft().vagas.cascata).not.toBeNull();

    componente.escolherRegra('|');
    detectar();

    expect(store.draft().vagas.cascata).toBeNull();
    expect(componente.pronta()).toBe(false);
  });

  it('reconhece que o servidor tem uma cascata a partir da hidratação, não do seletor', () => {
    store.remoteSnapshot.set({
      cascata: {
        id: 'cascata-1',
        regra: { codigo: 'REMANEJ-CASCATA-LEI-12711', versao: 'v1', hash: 'h' },
        fallbackCodigo: 'AC',
        destinos: [],
      },
    } as unknown as ProcessoSeletivoDto);
    detectar();

    expect(componente.existeNoServidor()).toBe(true);
  });

  it('não confunde cascata inexistente no servidor com rascunho vazio', () => {
    store.remoteSnapshot.set({ cascata: null } as unknown as ProcessoSeletivoDto);
    detectar();

    expect(componente.existeNoServidor()).toBe(false);
  });

  /**
   * As rotas do editor reusam a mesma instância de componente ao trocar de
   * processo — sem isto, a confirmação e o rastro de "existe no servidor" do
   * processo anterior vazariam para o processo que acabou de hidratar.
   */
  it('reseta confirmado e existeNoServidor a cada nova hidratação (troca de processo)', () => {
    store.remoteSnapshot.set({
      cascata: {
        id: 'cascata-a',
        regra: { codigo: 'REMANEJ-CASCATA-LEI-12711', versao: 'v1', hash: 'h' },
        fallbackCodigo: 'AC',
        destinos: [],
      },
    } as unknown as ProcessoSeletivoDto);
    detectar();
    expect(componente.existeNoServidor()).toBe(true);

    // Processo B, sem cascata gravada.
    store.remoteSnapshot.set({ cascata: null } as unknown as ProcessoSeletivoDto);
    detectar();

    expect(componente.existeNoServidor()).toBe(false);
  });

  it('desabilita o controle reativo do seletor quando o passo não aceita edição', () => {
    store.patchObjectSection('vagas', {
      ofertas: [distribuicaoFederal([{ id: LB_PPI, codigo: 'LB_PPI' }])],
    });
    detectar();
    expect(componente.regraControl.disabled).toBe(false);

    store.salvando.set(true);
    detectar();

    expect(componente.regraControl.disabled).toBe(true);
    const select = elemento.querySelector<HTMLSelectElement>('#c-regra-cascata');
    expect(select?.disabled).toBe(true);
  });

  it('sincroniza o controle reativo com o rascunho sem reemitir o evento', () => {
    store.patchObjectSection('vagas', {
      ofertas: [distribuicaoFederal([{ id: LB_PPI, codigo: 'LB_PPI' }])],
    });
    detectar();

    store.patchObjectSection('vagas', {
      cascata: { regraCodigo: 'REMANEJ-CASCATA-LEI-12711', regraVersao: 'v1' },
    });
    detectar();

    expect(componente.regraControl.value).toBe('REMANEJ-CASCATA-LEI-12711|v1');
  });

  it('em edição, a oferta fora do catálogo continua distinta das outras pelo identificador', () => {
    componente.catalogos.ofertas.set([]);
    componente.catalogos.modalidades.set([]);
    componente.catalogos.erro.set('Falha');

    expect(store.emConsulta()).toBe(false);
    expect(componente.rotuloDaOferta('uuid-x')).toBe('uuid-x');
    expect(componente.rotuloDaOferta('uuid-y')).toBe('uuid-y');
  });
});
