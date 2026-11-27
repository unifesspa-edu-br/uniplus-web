import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BasesLegaisDoFada } from './bases-legais-do-fada.service';
import { FadaPassoComponent } from './fada.component';
import {
  BASE_LEGAL_ID,
  ROTA_DAS_BASES,
  ROTA_DOS_TIPOS,
  TIPO_DA_BASE,
  montarPasso,
} from './fada.component.testing';

describe('FadaPassoComponent — base legal escolhida', () => {
  let componente: FadaPassoComponent;
  let basesLegais: BasesLegaisDoFada;
  let controller: HttpTestingController;
  let fixture: ComponentFixture<FadaPassoComponent>;

  beforeEach(() => {
    ({ componente, basesLegais, controller, fixture } = montarPasso());
  });

  afterEach(() => controller.verify());

  describe('seletor de base legal', () => {
    it('mostra em cada opção o rótulo do tipo que veio na base, junto da identificação', () => {
      basesLegais.carregar();
      controller
        .expectOne((r) => r.url === ROTA_DAS_BASES)
        .flush([
          {
            id: BASE_LEGAL_ID,
            tipoInstrumento: TIPO_DA_BASE,
            identificacao: 'Identificação de teste',
            descricao: 'Descrição de teste.',
            municipios: [],
            criadoEm: '2026-01-01T00:00:00Z',
          },
        ]);
      componente.escolherAplicacao(true);
      fixture.detectChanges();

      const opcoes = Array.from<HTMLOptionElement>(
        fixture.nativeElement.querySelectorAll('#f-fada-base-legal option'),
      ).map((opcao) => opcao.textContent?.trim());
      expect(opcoes).toContain(`${TIPO_DA_BASE.rotulo} Identificação de teste`);
    });

    it('avisa junto do seletor quando o vocabulário de tipos de norma não carrega', () => {
      basesLegais.carregarTiposDeInstrumento();
      controller
        .expectOne((r) => r.url === ROTA_DOS_TIPOS)
        .flush(
          { type: 'about:blank', title: 'Erro', status: 500, traceId: 't' },
          { status: 500, statusText: 'Server Error' },
        );
      componente.escolherAplicacao(true);
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain(
        'Não foi possível carregar como se lê o tipo de cada norma.',
      );
    });
  });

  describe('municipiosDaBaseLegalSelecionada()', () => {
    it('não lista município nenhum quando não há base legal escolhida', () => {
      expect(basesLegais.municipiosDaSelecionada()).toEqual([]);
    });

    it('lista os municípios da base legal escolhida, ordenados por nome', () => {
      basesLegais.carregar();
      controller
        .expectOne((r) => r.url === ROTA_DAS_BASES)
        .flush([
          {
            id: BASE_LEGAL_ID,
            tipoInstrumento: TIPO_DA_BASE,
            identificacao: 'Portaria Unifesspa nº 2514/2023',
            descricao: 'Institui inclusão regional.',
            municipios: [
              { codigoIbge: '1500107', nome: 'Xinguara', uf: 'PA' },
              { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' },
              { codigoIbge: '1500859', nome: 'Abel Figueiredo', uf: 'PA' },
            ],
            criadoEm: '2026-01-01T00:00:00Z',
          },
        ]);

      componente.escolherBaseLegal(BASE_LEGAL_ID);

      expect(basesLegais.municipiosDaSelecionada().map((m) => m.nome)).toEqual([
        'Abel Figueiredo',
        'Marabá',
        'Xinguara',
      ]);
    });

    it('não expõe tabindex/role/aria-labelledby quando a tabela não transborda a caixa', () => {
      basesLegais.carregar();
      controller
        .expectOne((r) => r.url === ROTA_DAS_BASES)
        .flush([
          {
            id: BASE_LEGAL_ID,
            tipoInstrumento: TIPO_DA_BASE,
            identificacao: 'Portaria Unifesspa nº 2514/2023',
            descricao: 'Institui inclusão regional.',
            municipios: [{ codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' }],
            criadoEm: '2026-01-01T00:00:00Z',
          },
        ]);

      componente.escolherAplicacao(true);
      componente.escolherBaseLegal(BASE_LEGAL_ID);
      fixture.detectChanges();

      // jsdom não faz layout de verdade — scrollHeight/clientHeight ficam
      // ambos em 0, o mesmo estado de "cabe sem rolar" que uma base legal com
      // poucos municípios produz numa tela real.
      const regiao = fixture.nativeElement.querySelector(
        '.fada-municipios__scroll',
      ) as HTMLDivElement;
      expect(regiao?.hasAttribute('tabindex')).toBe(false);
      expect(regiao?.hasAttribute('role')).toBe(false);
      expect(regiao?.hasAttribute('aria-labelledby')).toBe(false);
    });

    it('a região com rolagem é alcançável por teclado e tem nome acessível quando a tabela transborda a caixa', () => {
      basesLegais.carregar();
      controller
        .expectOne((r) => r.url === ROTA_DAS_BASES)
        .flush([
          {
            id: BASE_LEGAL_ID,
            tipoInstrumento: TIPO_DA_BASE,
            identificacao: 'Portaria Unifesspa nº 2514/2023',
            descricao: 'Institui inclusão regional.',
            municipios: [{ codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' }],
            criadoEm: '2026-01-01T00:00:00Z',
          },
        ]);

      componente.escolherAplicacao(true);
      componente.escolherBaseLegal(BASE_LEGAL_ID);
      fixture.detectChanges();

      const regiao = fixture.nativeElement.querySelector(
        '.fada-municipios__scroll',
      ) as HTMLDivElement;
      vi.spyOn(regiao as HTMLDivElement, 'scrollHeight', 'get').mockReturnValue(500);
      vi.spyOn(regiao as HTMLDivElement, 'clientHeight', 'get').mockReturnValue(256);
      window.dispatchEvent(new Event('resize'));
      fixture.detectChanges();

      expect(regiao?.getAttribute('tabindex')).toBe('0');
      expect(regiao?.getAttribute('role')).toBe('region');

      const legendaId = regiao?.getAttribute('aria-labelledby');
      const legenda = fixture.nativeElement.querySelector(`#${legendaId}`) as HTMLElement;
      expect(legenda?.textContent).toContain('1 município(s) beneficiado(s)');
    });
  });
});
