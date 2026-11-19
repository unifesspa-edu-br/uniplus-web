import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { CatalogoDeUnidadesDoCadastro } from './catalogos/catalogo-de-unidades-do-cadastro.service';
import {
  PROCESSO_ID,
  ROTA_FASES,
  ID_INSCRICAO,
  ID_RESULTADO,
  PROCESSO_COM_ETAPA_GRAVADA,
} from './cronograma.testing';
import { type ContextoDoCronograma, usarCronograma } from './cronograma-passo.testing';
import { AjudantesDeUnidades, ID_CEPS, ID_CGA } from './cronograma-unidades.testing';

describe('CronogramaPassoComponent: unidade responsável da fase', () => {
  let componente: ContextoDoCronograma['componente'];
  let expansao: ContextoDoCronograma['expansao'];
  let cronograma: ContextoDoCronograma['cronograma'];
  let unidades: ContextoDoCronograma['unidades'];
  let store: ContextoDoCronograma['store'];
  let controller: ContextoDoCronograma['controller'];
  let detectar: ContextoDoCronograma['detectar'];
  let nativo: ContextoDoCronograma['nativo'];
  let proximoPasso: ContextoDoCronograma['proximoPasso'];
  let gravouExigencias: ContextoDoCronograma['gravouExigencias'];
  let gravouEtapas: ContextoDoCronograma['gravouEtapas'];
  let comFases: ContextoDoCronograma['comFases'];
  let comUnidadesNoCadastro: AjudantesDeUnidades['comUnidadesNoCadastro'];
  let unidadeDoSelect: AjudantesDeUnidades['unidadeDoSelect'];
  let fasesDoCorpo: AjudantesDeUnidades['fasesDoCorpo'];
  let acrescentar: AjudantesDeUnidades['acrescentar'];
  let recusarUnidadeNaFase: AjudantesDeUnidades['recusarUnidadeNaFase'];

  usarCronograma((tela) => {
    ({
      componente,
      expansao,
      cronograma,
      unidades,
      store,
      controller,
      detectar,
      nativo,
      proximoPasso,
      gravouExigencias,
      gravouEtapas,
      comFases,
    } = tela);
    ({ comUnidadesNoCadastro, unidadeDoSelect, fasesDoCorpo, acrescentar, recusarUnidadeNaFase } =
      new AjudantesDeUnidades(tela));
  });

  describe('unidade responsável da fase', () => {
    it('a fase acrescentada nasce com a unidade administradora do processo', () => {
      store.patchObjectSection('identificacao', { unidadeAdministradoraId: ID_CEPS });
      comUnidadesNoCadastro();

      acrescentar(ID_INSCRICAO);

      expect(cronograma.fases.at(0).controls.unidadeResponsavelId.value).toBe(ID_CEPS);
      expect(cronograma.linhaDoTempo()[0]?.unidade).toBe('CEPS — Centro de Processos Seletivos');
    });

    it('oferece as unidades do cadastro, e a escolhida segue na gravação', async () => {
      store.processoSeletivoId.set(PROCESSO_ID);
      comUnidadesNoCadastro();
      comFases(ID_INSCRICAO);
      expansao.alternarFase(0);
      detectar();

      const opcoes = [...unidadeDoSelect(0).options].map((opcao) => opcao.text);
      expect(opcoes).toEqual([
        'Selecione',
        'CEPS — Centro de Processos Seletivos',
        'CGA — Centro de Gestão Acadêmica',
      ]);

      cronograma.fases.at(0).controls.unidadeResponsavelId.setValue(ID_CGA);
      const gravacao = componente.persistir();
      const requisicao = controller.expectOne(ROTA_FASES);
      expect(fasesDoCorpo(requisicao)[0]?.unidadeResponsavelId).toBe(ID_CGA);
      requisicao.flush(null, { status: 204, statusText: 'No Content' });
      await proximoPasso();
      await gravouEtapas();
      await gravouExigencias();
      await gravacao;
    });

    it('a fase sem unidade é sinalizada e o rascunho ainda é gravado', async () => {
      store.processoSeletivoId.set(PROCESSO_ID);
      comUnidadesNoCadastro();
      comFases(ID_INSCRICAO);
      expansao.alternarFase(0);
      detectar();

      expect(cronograma.linhaDoTempo()[0]?.unidade).toBeNull();
      expect(nativo.querySelector('#cr-unidade-erro-0')?.textContent).toContain(
        'sem unidade responsável',
      );
      expect(unidadeDoSelect(0).getAttribute('aria-invalid')).toBe('true');
      expect(unidadeDoSelect(0).getAttribute('aria-describedby')).toContain('cr-unidade-erro-0');
      expect(nativo.querySelector('.etapa-resumo__marca')?.textContent).toContain(
        'Sem unidade responsável',
      );

      const gravacao = componente.persistir();
      const requisicao = controller.expectOne(ROTA_FASES);
      expect(fasesDoCorpo(requisicao)[0]?.unidadeResponsavelId).toBeNull();
      requisicao.flush(null, { status: 204, statusText: 'No Content' });
      await proximoPasso();
      await gravouEtapas();
      await gravouExigencias();
      await gravacao;
    });

    it('a cópia gravada no processo nomeia a unidade, mesmo com outro nome no cadastro', () => {
      comUnidadesNoCadastro();
      comFases(ID_INSCRICAO);
      cronograma.fases.at(0).controls.unidadeResponsavelId.setValue(ID_CGA);
      store.remoteSnapshot.set({
        ...PROCESSO_COM_ETAPA_GRAVADA,
        cronogramaFases: [
          {
            codigo: 'COLETA_INSCRICAO',
            unidadeResponsavel: {
              origemId: ID_CGA,
              sigla: 'CECA',
              slug: 'ceca',
              nome: 'Centro de Estudos Acadêmicos',
            },
          },
        ],
      } as never);

      expect(cronograma.linhaDoTempo()[0]?.unidade).toBe('CECA — Centro de Estudos Acadêmicos');
    });

    it('oferece uma vez só a unidade gravada fora do cadastro que várias fases referenciam', () => {
      comUnidadesNoCadastro();
      comFases(ID_INSCRICAO, ID_RESULTADO);
      const gravada = {
        origemId: '01960000-0000-7000-0000-0000000000a9',
        sigla: 'CAT',
        slug: 'cat',
        nome: 'Coordenação extinta',
      };
      store.remoteSnapshot.set({
        ...PROCESSO_COM_ETAPA_GRAVADA,
        cronogramaFases: [{ unidadeResponsavel: gravada }, { unidadeResponsavel: gravada }],
      } as never);

      const ids = unidades.unidadesParaEscolha().map((opcao) => opcao.id);

      expect(ids.filter((id) => id === gravada.origemId)).toHaveLength(1);
    });

    it('nunca mostra o identificador da unidade que não está no cadastro nem no processo', () => {
      comUnidadesNoCadastro();
      TestBed.inject(CatalogoDeUnidadesDoCadastro).carregando.set(false);
      comFases(ID_INSCRICAO);
      cronograma.fases
        .at(0)
        .controls.unidadeResponsavelId.setValue('01960000-0000-7000-0000-0000000000f9');

      expect(cronograma.linhaDoTempo()[0]?.unidade).toBe('Unidade não encontrada no cadastro');
    });

    it('não afirma que a unidade falta enquanto o cadastro carrega nem se ele falhou', () => {
      const catalogos = TestBed.inject(CatalogoDeUnidadesDoCadastro);
      comFases(ID_INSCRICAO);
      cronograma.fases
        .at(0)
        .controls.unidadeResponsavelId.setValue('01960000-0000-7000-0000-0000000000f9');
      catalogos.carregando.set(true);

      expect(cronograma.linhaDoTempo()[0]?.unidade).toBe('Carregando unidade…');

      catalogos.erro.set('falhou');
      cronograma.fases.at(0).controls.unidadeResponsavelId.setValue('outra');

      expect(cronograma.linhaDoTempo()[0]?.unidade).toBe('Cadastro de unidades indisponível');
    });

    it('descarta o destino que não é fase do cronograma', async () => {
      comFases(ID_INSCRICAO);
      store.irParaFase('FASE_QUE_NAO_EXISTE');
      detectar();
      await proximoPasso();

      expect(store.faseEmFoco()).toBeNull();
      expect(expansao.faseExpandida(0)).toBe(false);
    });

    it('cada fase mostra a cópia que gravou, mesmo com outra cópia da mesma unidade em outra fase', () => {
      comUnidadesNoCadastro();
      comFases(ID_INSCRICAO, ID_RESULTADO);
      cronograma.fases.at(0).controls.unidadeResponsavelId.setValue(ID_CGA);
      cronograma.fases.at(1).controls.unidadeResponsavelId.setValue(ID_CGA);
      const copia = (sigla: string, nome: string) => ({
        origemId: ID_CGA,
        sigla,
        slug: sigla.toLowerCase(),
        nome,
      });
      store.remoteSnapshot.set({
        ...PROCESSO_COM_ETAPA_GRAVADA,
        cronogramaFases: [
          { codigo: 'COLETA_INSCRICAO', unidadeResponsavel: copia('CECA', 'Estudos Acadêmicos') },
          { codigo: 'RESULTADO_FINAL', unidadeResponsavel: copia('CGA', 'Gestão Acadêmica') },
        ],
      } as never);

      const [primeira, segunda] = cronograma.linhaDoTempo();

      expect(primeira?.unidade).toBe('CECA — Estudos Acadêmicos');
      expect(segunda?.unidade).toBe('CGA — Gestão Acadêmica');
    });

    it('a unidade gravada que saiu do cadastro continua oferecida à fase', () => {
      comUnidadesNoCadastro();
      comFases(ID_INSCRICAO);
      store.remoteSnapshot.set({
        ...PROCESSO_COM_ETAPA_GRAVADA,
        cronogramaFases: [
          {
            unidadeResponsavel: {
              origemId: '01960000-0000-7000-0000-0000000000a9',
              sigla: 'CAT',
              slug: 'cat',
              nome: 'Coordenação extinta',
            },
          },
        ],
      } as never);

      expect(unidades.unidadesParaEscolha().map((opcao) => opcao.rotulo)).toContain(
        'CAT — Coordenação extinta',
      );
    });

    it('a recusa de unidade inexistente aparece no campo da fase citada e recarrega a lista', async () => {
      store.processoSeletivoId.set(PROCESSO_ID);
      comUnidadesNoCadastro();
      comFases(ID_INSCRICAO, ID_RESULTADO);
      cronograma.fases.at(0).controls.unidadeResponsavelId.setValue(ID_CEPS);
      cronograma.fases.at(1).controls.unidadeResponsavelId.setValue(ID_CGA);

      const resultado = await recusarUnidadeNaFase(1);

      expect(resultado.valid).toBe(false);
      expect(unidades.unidadeRecusada(cronograma.fases.at(1))).toBe(true);
      expect(unidades.unidadeRecusada(cronograma.fases.at(0))).toBe(false);
      expect(expansao.faseExpandida(1)).toBe(true);
      const erro = nativo.querySelector('#cr-unidade-erro-1');
      expect(erro?.textContent).toContain('não está mais no cadastro');
      expect(erro?.getAttribute('role')).toBe('alert');
      expect(unidadeDoSelect(1).getAttribute('aria-describedby')).toContain('cr-unidade-erro-1');
      expect(unidadeDoSelect(1).getAttribute('aria-invalid')).toBe('true');
    });

    it('a recusa da unidade some quando a fase passa a ter outra unidade', async () => {
      store.processoSeletivoId.set(PROCESSO_ID);
      comUnidadesNoCadastro();
      comFases(ID_INSCRICAO);
      cronograma.fases.at(0).controls.unidadeResponsavelId.setValue(ID_CGA);
      await recusarUnidadeNaFase(0);
      expect(unidades.unidadeRecusada(cronograma.fases.at(0))).toBe(true);

      cronograma.fases.at(0).controls.unidadeResponsavelId.setValue(ID_CEPS);
      detectar();

      expect(unidades.unidadeRecusada(cronograma.fases.at(0))).toBe(false);
      expect(nativo.querySelector('#cr-unidade-erro-0')).toBeNull();
    });

    it('a fase citada só abre quando o passo Cronograma é o visível', async () => {
      comUnidadesNoCadastro();
      comFases(ID_INSCRICAO, ID_RESULTADO);

      store.faseEmFoco.set('RESULTADO_FINAL');
      detectar();
      await proximoPasso();

      expect(expansao.faseExpandida(1)).toBe(false);
      expect(store.faseEmFoco()).toBe('RESULTADO_FINAL');
    });

    it('a fase citada pela recusa de publicação abre com o foco na unidade', async () => {
      comUnidadesNoCadastro();
      comFases(ID_INSCRICAO, ID_RESULTADO);
      store.irParaFase('RESULTADO_FINAL');
      detectar();
      await proximoPasso();

      expect(expansao.faseExpandida(1)).toBe(true);
      expect(expansao.faseExpandida(0)).toBe(false);
      expect(store.faseEmFoco()).toBeNull();
      expect(document.activeElement).toBe(unidadeDoSelect(1));
    });

    it('a fase de data definida na execução não pede início nem fim', () => {
      comFases(ID_RESULTADO);
      expansao.alternarFase(0);
      detectar();

      expect(nativo.querySelector('#cr-inicio-0')).toBeNull();
      expect(nativo.querySelector('#cr-fim-0')).toBeNull();
      expect(nativo.textContent).toContain(
        'A data desta fase não consta do edital: a unidade responsável a define na execução.',
      );
    });
  });
});
