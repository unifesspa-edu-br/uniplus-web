import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { CatalogosDeClassificacaoService } from '../classificacao/catalogos-de-classificacao.service';

import {
  RESOLUCAO,
  ROTA_CLASSIFICACAO,
  componente,
  controller,
  digitar,
  escolherNoSeletor,
  fixture,
  linhaDoCadastro,
  montarEliminacao,
  oferecidas,
  prepararClassificacaoLocal,
  store,
} from './eliminacao.testing';

describe('regras de eliminação por área', () => {
  montarEliminacao();

  describe('ELIM-CORTE-EM-AREA — área do quadro e mínimo', () => {
    const CORTE = {
      regraCodigo: 'ELIM-CORTE-EM-AREA',
      regraVersao: 'v1',
      etapaRef: '',
      notaMinima: '',
      minimo: '',
      areaCodigo: '',
    };

    /** Classificação ENEM pela média ponderada, com o cadastro da resolução lido. */
    function comCadastroLido(corte: number | null = null): void {
      prepararClassificacaoLocal();
      store.patchObjectSection('classificacao', {
        baseadoEmEnem: true,
        resolucaoPesoAreaEnem: RESOLUCAO,
      });
      TestBed.inject(CatalogosDeClassificacaoService).garantirPesosAreaEnem(0);
      controller
        .expectOne((requisicao) => requisicao.url.endsWith('/api/configuracao/pesos-area-enem'))
        .flush([
          {
            ...linhaDoCadastro(1),
            areas: [{ codigo: 'REDACAO', rotulo: 'Redação', peso: 1, corte }],
          },
        ]);
      controller
        .expectOne((requisicao) =>
          requisicao.url.endsWith('/api/configuracao/pesos-area-enem/areas'),
        )
        .flush([
          { codigo: 'MATEMATICA', rotulo: 'Matemática e suas Tecnologias' },
          { codigo: 'REDACAO', rotulo: 'Redação' },
        ]);
    }

    it('recusa sem baseadoEmEnem, mesmo com área e mínimo informados', () => {
      prepararClassificacaoLocal();
      store.patchObjectSection('classificacao', {
        regrasEliminacao: [{ ...CORTE, areaCodigo: 'REDACAO', minimo: '400' }],
      });

      const resultado = componente.validate();
      expect(resultado.valid).toBe(false);
      expect(resultado.messages?.join(' ')).toContain('baseada em ENEM');
    });

    it('recusa sem a área', () => {
      comCadastroLido();
      store.patchObjectSection('classificacao', {
        regrasEliminacao: [{ ...CORTE, minimo: '400' }],
      });

      const resultado = componente.validate();
      expect(resultado.valid).toBe(false);
      expect(resultado.messages?.join(' ')).toContain('selecione a área do ENEM');
    });

    it('aceita a área que está em todos os grupos do quadro, com o mínimo informado', () => {
      comCadastroLido();
      store.patchObjectSection('classificacao', {
        regrasEliminacao: [{ ...CORTE, areaCodigo: 'REDACAO', minimo: '400' }],
      });

      expect(componente.validate()).toEqual({ valid: true });
    });

    it('recusa a área que o quadro da resolução não tem em todos os grupos', () => {
      comCadastroLido();
      store.patchObjectSection('classificacao', {
        regrasEliminacao: [{ ...CORTE, areaCodigo: 'MATEMATICA', minimo: '400' }],
      });

      const resultado = componente.validate();
      expect(resultado.valid).toBe(false);
      expect(resultado.messages?.join(' ')).toContain(
        'Matemática e suas Tecnologias não está em todos os grupos',
      );
    });

    it('recusa dois cortes na mesma área e aponta a segunda regra', () => {
      comCadastroLido();
      store.patchObjectSection('classificacao', {
        regrasEliminacao: [
          { ...CORTE, areaCodigo: 'REDACAO', minimo: '400' },
          { ...CORTE, areaCodigo: 'REDACAO', minimo: '500' },
        ],
      });

      const resultado = componente.validate();
      expect(resultado.valid).toBe(false);
      expect(resultado.messages).toContain(
        'Regra de eliminação 2: Redação já tem um corte em outra regra.',
      );
    });

    it('não oferece a área que outro corte já cita', () => {
      comCadastroLido();
      store.patchObjectSection('classificacao', {
        regrasEliminacao: [{ ...CORTE, areaCodigo: 'REDACAO', minimo: '400' }, CORTE],
      });

      expect(oferecidas('elim-area-1')).not.toContain('REDACAO');
      expect(oferecidas('elim-area-0')).toContain('REDACAO');
    });

    it('sugere o corte da área no quadro quando o mínimo está vazio', () => {
      comCadastroLido(450);
      store.patchObjectSection('classificacao', { regrasEliminacao: [CORTE] });

      escolherNoSeletor('elim-area-0', 'REDACAO');

      expect(store.draft().classificacao.regrasEliminacao[0]).toMatchObject({
        areaCodigo: 'REDACAO',
        minimo: '450',
      });
    });

    /** O cadastro com Redação (corte 450) e Matemática (corte 300) em todos os grupos. */
    function comDuasAreasComCorte(): void {
      prepararClassificacaoLocal();
      store.patchObjectSection('classificacao', {
        baseadoEmEnem: true,
        resolucaoPesoAreaEnem: RESOLUCAO,
      });
      TestBed.inject(CatalogosDeClassificacaoService).garantirPesosAreaEnem(0);
      controller
        .expectOne((requisicao) => requisicao.url.endsWith('/api/configuracao/pesos-area-enem'))
        .flush([
          {
            ...linhaDoCadastro(1),
            areas: [
              { codigo: 'REDACAO', rotulo: 'Redação', peso: 1, corte: 450 },
              {
                codigo: 'MATEMATICA',
                rotulo: 'Matemática e suas Tecnologias',
                peso: 1,
                corte: 300,
              },
            ],
          },
        ]);
      controller
        .expectOne((requisicao) =>
          requisicao.url.endsWith('/api/configuracao/pesos-area-enem/areas'),
        )
        .flush([
          { codigo: 'MATEMATICA', rotulo: 'Matemática e suas Tecnologias' },
          { codigo: 'REDACAO', rotulo: 'Redação' },
        ]);
    }

    it('trocar de área troca o mínimo que veio da sugestão da área anterior', () => {
      comDuasAreasComCorte();
      store.patchObjectSection('classificacao', { regrasEliminacao: [CORTE] });

      escolherNoSeletor('elim-area-0', 'REDACAO');
      escolherNoSeletor('elim-area-0', 'MATEMATICA');

      expect(store.draft().classificacao.regrasEliminacao[0]).toMatchObject({
        areaCodigo: 'MATEMATICA',
        minimo: '300',
      });
    });

    it('trocar de área preserva o mínimo que o operador digitou', () => {
      comDuasAreasComCorte();
      store.patchObjectSection('classificacao', { regrasEliminacao: [CORTE] });

      escolherNoSeletor('elim-area-0', 'REDACAO');
      digitar('elim-minimo-0', '500');
      escolherNoSeletor('elim-area-0', 'MATEMATICA');

      expect(store.draft().classificacao.regrasEliminacao[0].minimo).toBe('500');
    });

    it('não troca o mínimo que o operador já informou pelo corte do quadro', () => {
      comCadastroLido(450);
      store.patchObjectSection('classificacao', {
        regrasEliminacao: [{ ...CORTE, minimo: '380' }],
      });

      escolherNoSeletor('elim-area-0', 'REDACAO');

      expect(store.draft().classificacao.regrasEliminacao[0].minimo).toBe('380');
    });

    it('dá ao mínimo o rótulo completo, com a área, e liga a sugestão ao campo', () => {
      comCadastroLido(450);
      store.patchObjectSection('classificacao', {
        regrasEliminacao: [{ ...CORTE, areaCodigo: 'REDACAO', minimo: '450' }],
      });
      fixture.detectChanges();

      const raiz = fixture.nativeElement as HTMLElement;
      expect(raiz.querySelector('label[for="elim-minimo-0"]')?.textContent?.trim()).toBe(
        'Nota mínima em Redação',
      );
      const minimo = raiz.querySelector('#elim-minimo-0');
      const dica = raiz.querySelector(`#${minimo?.getAttribute('aria-describedby') ?? 'ausente'}`);
      expect(dica?.textContent).toContain('corte 450');
    });

    it('com a cópia congelada em vigor e sem cadastro lido, mostra a área gravada e o corte do quadro', () => {
      prepararClassificacaoLocal();
      store.patchObjectSection('classificacao', {
        baseadoEmEnem: true,
        resolucaoPesoAreaEnem: RESOLUCAO,
        regrasEliminacao: [{ ...CORTE, areaCodigo: 'REDACAO', minimo: '450' }],
      });
      store.classificacao.gravada.set({
        estado: 'com-quadro',
        resolucao: RESOLUCAO,
        confirmada: true,
        grupos: [
          {
            codigo: 'TECNOLOGICA',
            rotulo: 'Tecnológica',
            baseLegal: 'Anexo I',
            areas: [{ codigo: 'REDACAO', rotulo: 'Redação', peso: 1, corte: 450 }],
          },
        ],
      });
      fixture.detectChanges();

      const raiz = fixture.nativeElement as HTMLElement;
      const area = raiz.querySelector<HTMLSelectElement>('#elim-area-0');
      expect(area?.value).toBe('REDACAO');
      expect(area?.selectedOptions[0]?.textContent?.trim()).toBe('Redação');
      expect(raiz.querySelector('#elim-area-dica-0')).toBeNull();
      expect(raiz.querySelector('#elim-minimo-dica-0')?.textContent).toContain('corte 450');
      expect(raiz.querySelector('label[for="elim-minimo-0"]')?.textContent?.trim()).toBe(
        'Nota mínima em Redação',
      );
    });

    /** A cópia gravada de R1: só Matemática em todos os grupos, com corte 300. */
    function gravadaComMatematica(resolucao = RESOLUCAO): void {
      store.classificacao.gravada.set({
        estado: 'com-quadro',
        resolucao,
        confirmada: true,
        grupos: [
          {
            codigo: 'TECNOLOGICA',
            rotulo: 'Tecnológica',
            baseLegal: 'Anexo I',
            areas: [
              {
                codigo: 'MATEMATICA',
                rotulo: 'Matemática e suas Tecnologias',
                peso: 1,
                corte: 300,
              },
            ],
          },
        ],
      });
    }

    it('com outra resolução no rascunho, confere contra o quadro que a gravação vai copiar', () => {
      comCadastroLido(450);
      gravadaComMatematica('Resolução anterior');

      expect(componente.quadro().areas?.map((area) => area.codigo)).toEqual(['REDACAO']);
    });

    it('com o cadastro da mesma resolução alterado, vale o cadastro, não a cópia gravada', () => {
      comCadastroLido(450);
      gravadaComMatematica();

      expect(componente.quadro().areas?.map((area) => area.codigo)).toEqual(['REDACAO']);
      store.patchObjectSection('classificacao', {
        regrasEliminacao: [{ ...CORTE, areaCodigo: 'REDACAO' }],
      });
      fixture.detectChanges();
      expect(
        (fixture.nativeElement as HTMLElement).querySelector('#elim-minimo-dica-0')?.textContent,
      ).toContain('corte 450');
    });

    it('com o rascunho fora da média ponderada do ENEM, oferece qualquer área, mesmo com cópia gravada', () => {
      comCadastroLido();
      gravadaComMatematica();
      store.patchObjectSection('classificacao', { baseadoEmEnem: false });

      expect(componente.quadro().areas?.map((area) => area.codigo)).toEqual([
        'MATEMATICA',
        'REDACAO',
      ]);
    });

    it('sem o cadastro lido, a cópia gravada de outra resolução não decide', () => {
      prepararClassificacaoLocal();
      store.patchObjectSection('classificacao', {
        baseadoEmEnem: true,
        resolucaoPesoAreaEnem: RESOLUCAO,
      });
      gravadaComMatematica('Resolução anterior');

      expect(componente.quadro().areas).toBeNull();
    });

    it('mostra a área gravada no seletor mesmo fora das áreas oferecidas', () => {
      comCadastroLido();
      store.patchObjectSection('classificacao', {
        regrasEliminacao: [{ ...CORTE, areaCodigo: 'MATEMATICA', minimo: '400' }],
      });

      expect(oferecidas('elim-area-0')).toContain('MATEMATICA');
    });

    it('põe a recusa do servidor junto do campo, com aria-invalid, e a tira quando a regra muda', async () => {
      comCadastroLido();
      store.patchObjectSection('classificacao', {
        regrasEliminacao: [{ ...CORTE, areaCodigo: 'REDACAO', minimo: '400' }],
      });

      const gravacao = componente.persistir();
      controller.expectOne(ROTA_CLASSIFICACAO).flush(
        {
          type: 'about:blank',
          title: 'Recusada.',
          status: 422,
          code: 'uniplus.validacao',
          traceId: 't',
          errors: [
            {
              field: 'regrasEliminacao[0]',
              code: 'uniplus.selecao.configuracao_classificacao.corte_em_area_repetido',
              message: 'repetido',
            },
          ],
        },
        {
          status: 422,
          statusText: 'Unprocessable Entity',
          headers: { 'content-type': 'application/problem+json' },
        },
      );
      await gravacao;
      fixture.detectChanges();

      const raiz = fixture.nativeElement as HTMLElement;
      const area = raiz.querySelector('#elim-area-0');
      expect(area?.getAttribute('aria-invalid')).toBe('true');
      expect(area?.getAttribute('aria-describedby')).toContain('elim-area-erro-0');
      expect(raiz.querySelector('#elim-area-erro-0')?.textContent).toContain('já tem um corte');
      expect(raiz.querySelector('#elim-minimo-0')?.getAttribute('aria-invalid')).toBeNull();

      digitar('elim-minimo-0', '410');
      fixture.detectChanges();
      expect(raiz.querySelector('#elim-area-erro-0')).toBeNull();
    });

    it('traduz a recusa do servidor ao corte fora do quadro, nomeando a regra', async () => {
      comCadastroLido();
      store.patchObjectSection('classificacao', {
        regrasEliminacao: [{ ...CORTE, areaCodigo: 'REDACAO', minimo: '400' }],
      });

      const gravacao = componente.persistir();
      controller.expectOne(ROTA_CLASSIFICACAO).flush(
        {
          type: 'about:blank',
          title: 'Recusada.',
          status: 422,
          code: 'uniplus.validacao',
          traceId: 't',
          errors: [
            {
              field: 'regrasEliminacao[0].areaCodigo',
              code: 'uniplus.selecao.configuracao_classificacao.corte_em_area_fora_do_quadro',
              message: 'fora',
            },
          ],
        },
        {
          status: 422,
          statusText: 'Unprocessable Entity',
          headers: { 'content-type': 'application/problem+json' },
        },
      );
      const resultado = await gravacao;

      expect(resultado.valid).toBe(false);
      expect(resultado.messages?.[0]).toMatch(
        /^Regra de eliminação 1: a área não está em todos os grupos/,
      );
    });
  });
});
