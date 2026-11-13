import { TestBed } from '@angular/core/testing';
import { CaraterEtapa } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';
import { CatalogoDeTiposDeEtapa } from './catalogos/catalogo-de-tipos-de-etapa.service';
import {
  PROCESSO_ID,
  ROTA_ETAPAS,
  ROTA_FASES,
  ID_AVALIACAO,
  TIPO_ETAPA,
} from './cronograma.testing';
import { type ContextoDoCronograma, usarCronograma } from './cronograma-passo.testing';

describe('CronogramaPassoComponent: tipos de etapa', () => {
  let componente: ContextoDoCronograma['componente'];
  let expansao: ContextoDoCronograma['expansao'];
  let edicao: ContextoDoCronograma['edicao'];
  let cronograma: ContextoDoCronograma['cronograma'];
  let store: ContextoDoCronograma['store'];
  let controller: ContextoDoCronograma['controller'];
  let detectar: ContextoDoCronograma['detectar'];
  let nativo: ContextoDoCronograma['nativo'];
  let comFases: ContextoDoCronograma['comFases'];
  let comEtapasEmFases: ContextoDoCronograma['comEtapasEmFases'];
  let comUmaEtapa: ContextoDoCronograma['comUmaEtapa'];

  usarCronograma((tela) => {
    ({
      componente,
      expansao,
      edicao,
      cronograma,
      store,
      controller,
      detectar,
      nativo,
      comFases,
      comEtapasEmFases,
      comUmaEtapa,
    } = tela);
  });

  /**
   * Um tipo removido do cadastro continua descrevendo a etapa que o gravou — sem ele na lista o
   * campo aparece em branco, e o operador grava por cima sem ver o que estava configurado. O
   * catálogo do spec devolve só `TIPOS_ETAPA`, sem o tipo referenciado.
   */
  describe('tipo de etapa que o cadastro não tem', () => {
    const removido = '01960000-0000-7000-0000-0000000000e9';

    function oferecidos() {
      comFases(ID_AVALIACAO);
      comUmaEtapa();
      cronograma.etapas.at(0).controls.tipoEtapaOrigemId.setValue(removido);
      return edicao.tiposEscolhiveisPara(cronograma.etapas.at(0));
    }

    it('mantém no seletor o tipo referenciado e o nomeia como removido do cadastro', () => {
      const tipos = oferecidos();

      expect(tipos.find((tipo) => tipo.id === removido)?.nome).toBe('Tipo removido do cadastro');
      expect(tipos.map((tipo) => tipo.id)).toContain(TIPO_ETAPA);
    });

    it('nomeia pelo que o processo congelou o tipo que o cadastro já não tem', () => {
      comFases(ID_AVALIACAO);
      comUmaEtapa();
      const etapa = cronograma.etapas.at(0);
      etapa.controls.tipoEtapaOrigemId.setValue(removido);
      etapa.controls.tipoCongelado.setValue({
        origemId: removido,
        nome: 'Prova de redação',
        notaDeOrigemNoEnem: false,
      });

      expect(edicao.tiposEscolhiveisPara(etapa).find((tipo) => tipo.id === removido)?.nome).toBe(
        'Prova de redação (removido do cadastro)',
      );
    });

    it('sem cópia congelada, o tipo ausente do cadastro leva um texto genérico', () => {
      expect(oferecidos().find((tipo) => tipo.id === removido)?.nome).toBe(
        'Tipo removido do cadastro',
      );
    });

    it('a opção referenciada leva o nome congelado, mesmo com o tipo renomeado no cadastro', () => {
      comFases(ID_AVALIACAO);
      comUmaEtapa();
      const etapa = cronograma.etapas.at(0);
      etapa.controls.tipoCongelado.setValue({
        origemId: TIPO_ETAPA,
        nome: 'Prova A',
        notaDeOrigemNoEnem: false,
      });

      const tipos = edicao.tiposEscolhiveisPara(etapa);

      expect(tipos.find((tipo) => tipo.id === TIPO_ETAPA)?.nome).toBe('Prova A');
      expect(edicao.marcasDaEtapa(etapa)).toContain('Prova A');
    });
  });

  /**
   * "Removido do cadastro" só se afirma com o catálogo carregado: enquanto ele carrega ou falha, a
   * página substitui a linha do tempo pela espera ou pelo erro, e nenhuma etapa chega à tela.
   */
  describe('etapas enquanto o catálogo de tipos não está confirmado', () => {
    function comEtapaNaTela(): void {
      comFases(ID_AVALIACAO);
      comEtapasEmFases(['AVALIACAO']);
      expansao.alternarFase(0);
      detectar();
      expect(nativo.querySelector('.etapa-resumo__marca')).not.toBeNull();
    }

    it('não renderiza etapa enquanto o catálogo carrega', () => {
      comEtapaNaTela();
      TestBed.inject(CatalogoDeTiposDeEtapa).carregando.set(true);
      detectar();

      expect(nativo.querySelector('.etapa-resumo__marca')).toBeNull();
      expect(nativo.textContent).toContain('Carregando');
    });

    it('não renderiza etapa quando o catálogo falhou', () => {
      comEtapaNaTela();
      TestBed.inject(CatalogoDeTiposDeEtapa).erro.set('Falha');
      detectar();

      expect(nativo.querySelector('.etapa-resumo__marca')).toBeNull();
      expect(nativo.querySelector('[role="alert"]')).not.toBeNull();
    });
  });

  /**
   * É o `id` que critério de desempate e regra de eliminação referenciam.
   * Reordenar removendo e recriando daria outro identificador no servidor, e
   * essas regras ficariam apontando para uma etapa que deixou de existir — por
   * isso o grupo é movido, não recriado.
   */
  it('reordena as etapas preservando o identificador de cada uma', () => {
    comFases(ID_AVALIACAO);
    store.patchObjectSection('cronograma', {
      etapas: [
        {
          id: 'etapa-primeira',
          nome: 'Prova',
          carater: CaraterEtapa.classificatoria,
          tipoEtapaOrigemId: TIPO_ETAPA,
          peso: '1',
          notaMinima: '',
          ordem: 1,
          faseCodigo: '',
          produtos: [],
          inicio: '',
          fim: '',
          emiteParecerIndividual: false,
          bancas: [],
          recursos: [],
        },
        {
          id: 'etapa-segunda',
          nome: 'Redação',
          carater: CaraterEtapa.classificatoria,
          tipoEtapaOrigemId: TIPO_ETAPA,
          peso: '2',
          notaMinima: '',
          ordem: 2,
          faseCodigo: '',
          produtos: [],
          inicio: '',
          fim: '',
          emiteParecerIndividual: false,
          bancas: [],
          recursos: [],
        },
      ],
    });
    detectar();

    cronograma.moverEtapa(0, 1);

    const depois = store.draft().cronograma.etapas;
    expect(depois.map((etapa) => etapa.id)).toEqual(['etapa-segunda', 'etapa-primeira']);
    expect(depois.map((etapa) => etapa.ordem)).toEqual([1, 2]);
    expect(depois.map((etapa) => etapa.nome)).toEqual(['Redação', 'Prova']);
  });

  it('recusa gravar enquanto a conferência aponta problema, sem chamar a API', async () => {
    store.processoSeletivoId.set(PROCESSO_ID);
    comFases(ID_AVALIACAO);

    const resultado = await componente.persistir();

    expect(resultado.valid).toBe(false);
    controller.expectNone(ROTA_ETAPAS);
    controller.expectNone(ROTA_FASES);
  });
});
