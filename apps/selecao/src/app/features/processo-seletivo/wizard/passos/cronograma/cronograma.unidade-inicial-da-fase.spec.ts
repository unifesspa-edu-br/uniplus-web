import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { CatalogoDeFases } from './catalogos/catalogo-de-fases.service';
import { CatalogoDeUnidadesDoCadastro } from './catalogos/catalogo-de-unidades-do-cadastro.service';
import { ID_INSCRICAO, ID_AVALIACAO, ID_RESULTADO, FASES_CANONICAS } from './cronograma.testing';
import { type ContextoDoCronograma, usarCronograma } from './cronograma-passo.testing';
import { AjudantesDeUnidades, ID_CEPS, ID_CGA, ROTA_UNIDADES } from './cronograma-unidades.testing';

describe('CronogramaPassoComponent: unidade inicial da fase', () => {
  let expansao: ContextoDoCronograma['expansao'];
  let cronograma: ContextoDoCronograma['cronograma'];
  let store: ContextoDoCronograma['store'];
  let controller: ContextoDoCronograma['controller'];
  let detectar: ContextoDoCronograma['detectar'];
  let nativo: ContextoDoCronograma['nativo'];
  let proximoPasso: ContextoDoCronograma['proximoPasso'];
  let comFases: ContextoDoCronograma['comFases'];
  let comUnidadesNoCadastro: AjudantesDeUnidades['comUnidadesNoCadastro'];
  let botaoAcrescentar: AjudantesDeUnidades['botaoAcrescentar'];
  let unidadeDoSelect: AjudantesDeUnidades['unidadeDoSelect'];
  let acrescentar: AjudantesDeUnidades['acrescentar'];

  usarCronograma((tela) => {
    ({ expansao, cronograma, store, controller, detectar, nativo, proximoPasso, comFases } = tela);
    ({ comUnidadesNoCadastro, botaoAcrescentar, unidadeDoSelect, acrescentar } =
      new AjudantesDeUnidades(tela));
  });

  describe('unidade responsável da fase', () => {
    describe('unidade inicial da fase acrescentada', () => {
      it('não deixa acrescentar fase enquanto as unidades ainda carregam', () => {
        const catalogos = TestBed.inject(CatalogoDeUnidadesDoCadastro);
        cronograma.formulario.controls.faseAAcrescentar.setValue(ID_AVALIACAO);
        comUnidadesNoCadastro();
        expect(botaoAcrescentar().disabled).toBe(false);

        catalogos.carregando.set(true);
        detectar();
        expect(botaoAcrescentar().disabled).toBe(true);
      });

      it('mostra o erro e bloqueia acrescentar fase enquanto a carga das unidades falha', () => {
        const catalogos = TestBed.inject(CatalogoDeUnidadesDoCadastro);
        catalogos.carregando.set(true);
        catalogos.erro.set('falhou');
        detectar();
        cronograma.formulario.controls.faseAAcrescentar.setValue(ID_AVALIACAO);
        detectar();

        expect(botaoAcrescentar().disabled).toBe(true);
        expect(nativo.querySelector('[role="alert"]')?.textContent).toContain('falhou');

        catalogos.erro.set(null);
        catalogos.carregando.set(false);
        detectar();
        expect(botaoAcrescentar().disabled).toBe(false);
      });

      describe('falha das unidades com várias fases abertas', () => {
        function abrirFases(): void {
          comFases(ID_INSCRICAO, ID_AVALIACAO, ID_RESULTADO);
          for (const indice of [0, 1, 2]) expansao.alternarFase(indice);
          const catalogos = TestBed.inject(CatalogoDeUnidadesDoCadastro);
          catalogos.erro.set('Não foi possível carregar as unidades.');
          catalogos.carregando.set(false);
          detectar();
        }

        const avisosDasUnidades = (): Element[] =>
          Array.from(nativo.querySelectorAll('[role="alert"]')).filter((aviso) =>
            aviso.textContent?.includes('Não foi possível carregar as unidades'),
          );
        const tentar = (): HTMLButtonElement[] =>
          Array.from(nativo.querySelectorAll<HTMLButtonElement>('button')).filter((botao) =>
            botao.textContent?.includes('Tentar novamente'),
          );
        const dicas = (): Element[] =>
          Array.from(nativo.querySelectorAll('[id^="cr-unidade-sem-lista-"]'));

        it('mostra um só aviso e um só botão, e uma dica sem papel em cada campo', () => {
          abrirFases();

          expect(avisosDasUnidades()).toHaveLength(1);
          expect(tentar()).toHaveLength(1);
          expect(dicas()).toHaveLength(3);
          expect(dicas().every((dica) => !dica.hasAttribute('role'))).toBe(true);
          expect(unidadeDoSelect(1).getAttribute('aria-describedby')).toContain(
            'cr-unidade-sem-lista-1',
          );
        });

        it('todo id que o campo cita em aria-describedby existe, e a dica da falha aparece junto', () => {
          abrirFases();

          for (const indice of [0, 1, 2]) {
            const citados = (unidadeDoSelect(indice).getAttribute('aria-describedby') ?? '')
              .split(' ')
              .filter(Boolean);
            expect(citados).toContain(`cr-unidade-dica-${indice}`);
            expect(citados).toContain(`cr-unidade-sem-lista-${indice}`);
            for (const id of citados)
              expect(nativo.querySelector(`[id="${id}"]`), id).not.toBeNull();
          }
        });

        it('na nova tentativa que dá certo, leva o foco ao primeiro campo e tira as dicas', async () => {
          abrirFases();
          tentar()[0]?.focus();
          tentar()[0]?.click();
          detectar();
          controller.expectOne((req) => req.url === ROTA_UNIDADES).flush([]);
          await proximoPasso();
          detectar();
          await proximoPasso();
          detectar();

          expect(avisosDasUnidades()).toHaveLength(0);
          expect(dicas()).toHaveLength(0);
          expect(document.activeElement?.id).toBe('cr-unidade-0');
        });
      });

      function sugerindo(unidadeSugerida: { origemId: string } | null): void {
        const doCatalogo = FASES_CANONICAS.map((fase) =>
          fase.id === ID_AVALIACAO ? { ...fase, unidadeSugerida } : fase,
        );
        TestBed.inject(CatalogoDeFases).fases.set(doCatalogo as never);
      }

      it('é a unidade que a fase canônica sugere, quando ela está entre as do cadastro', () => {
        store.patchObjectSection('identificacao', { unidadeAdministradoraId: ID_CEPS });
        comUnidadesNoCadastro();
        sugerindo({ origemId: ID_CGA });

        acrescentar(ID_AVALIACAO);

        expect(cronograma.fases.at(0).controls.unidadeResponsavelId.value).toBe(ID_CGA);
      });

      it('é a administradora quando a sugestão não está entre as unidades do cadastro', () => {
        store.patchObjectSection('identificacao', { unidadeAdministradoraId: ID_CEPS });
        comUnidadesNoCadastro();
        sugerindo({ origemId: '01960000-0000-7000-0000-0000000000a9' });

        acrescentar(ID_AVALIACAO);

        expect(cronograma.fases.at(0).controls.unidadeResponsavelId.value).toBe(ID_CEPS);
      });

      it('é a administradora quando a fase canônica não sugere unidade', () => {
        store.patchObjectSection('identificacao', { unidadeAdministradoraId: ID_CEPS });
        comUnidadesNoCadastro();
        sugerindo(null);

        acrescentar(ID_AVALIACAO);

        expect(cronograma.fases.at(0).controls.unidadeResponsavelId.value).toBe(ID_CEPS);
      });
    });
  });
});
