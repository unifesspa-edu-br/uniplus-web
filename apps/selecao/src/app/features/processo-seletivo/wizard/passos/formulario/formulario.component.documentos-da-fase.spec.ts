import { SituacaoDoProcessoSeletivoCodigo } from '@uniplus/shared-data/selecao';
import { BlocoSistemaCodigo } from '@uniplus/shared-data/selecao';
import { TestBed } from '@angular/core/testing';
import { fatoComOperadores } from '@uniplus/shared-data/configuracao';
import { describe, expect, it } from 'vitest';

import type { ExigenciaDeDocumento } from '../../processo-seletivo.models';
import {
  comExigenciaSemGrupo,
  exigenciaNova,
} from '../../shared/exigencias/exigencias-documentais';
import { PASSO_CRONOGRAMA } from '../../shared/documentos-exigidos';
import { CatalogoDasConsequenciasDeIndeferimento } from '../cronograma/catalogos/catalogo-das-consequencias-de-indeferimento.service';
import { CatalogoDeFatos } from '../cronograma/catalogos/catalogo-de-fatos.service';
import { conteudoDoFormulario } from './formulario-do-processo';
import {
  campo,
  CONGELADOS_DA_INSCRICAO,
  pagina,
  FASE_INSCRICAO,
  GRAVADO,
  PCD_NO_CATALOGO,
  PROCESSO,
  PROCESSO_ID,
  usarPasso,
  type ContextoDoPasso,
} from './formulario-passo.testing';

describe('FormularioPassoComponent: documentos da fase', () => {
  let fixture: ContextoDoPasso['fixture'];
  let store: ContextoDoPasso['store'];
  let host: ContextoDoPasso['host'];

  usarPasso((contexto) => {
    ({ fixture, store, host } = contexto);
  });

  describe('página dos documentos do formulário', () => {
    const TIPO_LAUDO = '01960000-0000-7000-0000-0000000000d1';
    const COM_PAGINA_DE_DOCUMENTOS = {
      ...GRAVADO,
      paginas: [
        pagina('DADOS_BASICOS', 0),
        pagina('DOCUMENTOS', 1, BlocoSistemaCodigo.COMPROVACAO_DOCUMENTAL),
        pagina('REVISAO_E_ACEITE', 2, BlocoSistemaCodigo.REVISAO_E_ACEITE),
      ],
      coleta: { itens: [campo('NOME', 0, 'DADOS_BASICOS')], grupos: [] },
    };

    /** O processo publicado: os passos mostram o que está gravado como texto. */
    function emConsulta(): void {
      TestBed.inject(CatalogoDeFatos).fatos.set([fatoComOperadores(PCD_NO_CATALOGO)]);
      store.patchObjectSection('formulario', {
        conteudo: conteudoDoFormulario(COM_PAGINA_DE_DOCUMENTOS),
      });
      store.remoteSnapshot.set({
        ...PROCESSO,
        id: PROCESSO_ID,
        situacao: {
          codigo: SituacaoDoProcessoSeletivoCodigo.PUBLICADO,
          rotulo: SituacaoDoProcessoSeletivoCodigo.PUBLICADO,
        },
      } as never);
      fixture.detectChanges();
    }

    it('lista os documentos da fase do formulário, com a condição de cada um, em vez de "Nenhum campo"', () => {
      const laudo = {
        ...exigenciaNova(TIPO_LAUDO, 'INSCRICAO'),
        tipoDocumentoNome: 'Laudo médico',
        consequenciaIndeferimento: 'ELIMINA',
        aplicabilidade: 'CONDICIONAL',
        condicoes: [{ clausula: 0, fato: 'PCD', operador: 'IGUAL', valor: 'true' }],
        formatosPermitidos: {
          tipo: 'lista',
          itens: [{ formato: 'PDF', tamanhoMaximoBytes: null }],
        },
        tamanhoMaximoBytes: 5 * 1024 * 1024,
      } as ExigenciaDeDocumento;
      const certidaoDeOutraFase = {
        ...exigenciaNova(TIPO_LAUDO, 'MATRICULA'),
        tipoDocumentoNome: 'Outra fase',
      };
      store.patchSection(
        'documentos',
        comExigenciaSemGrupo(
          comExigenciaSemGrupo({ regrasDeComprovacao: [], emTodasAsFases: [] }, laudo),
          certidaoDeOutraFase,
        ),
      );

      fixture.debugElement.injector
        .get(CatalogoDasConsequenciasDeIndeferimento)
        .consequencias.set([{ codigo: 'ELIMINA', rotulo: 'Consequência definida pela API' }]);
      emConsulta();

      const texto = host.textContent ?? '';
      expect(texto).toContain('Laudo médico');
      expect(texto).toContain('Obrigatório');
      expect(texto).toContain('Consequência definida pela API');
      expect(texto).toContain('Pessoa com deficiência');
      expect(texto).toContain('PDF, até 5,0 MB');
      expect(texto).not.toContain('Outra fase');
      expect(host.querySelector('sel-documentos-do-formulario')?.textContent).toContain(
        'Laudo médico',
      );
    });

    it('não diz que a fase não exige nada quando o documento ainda não tem formulário escolhido', () => {
      const dividida = {
        ...FASE_INSCRICAO,
        congelados: { ...CONGELADOS_DA_INSCRICAO, coletaSolicitacaoIsencao: true },
      };
      store.patchSection('cronograma', { ...store.draft().cronograma, fases: [dividida] });
      store.patchSection(
        'documentos',
        comExigenciaSemGrupo(
          { regrasDeComprovacao: [], emTodasAsFases: [] },
          exigenciaNova(TIPO_LAUDO, 'INSCRICAO'),
        ),
      );

      emConsulta();

      const texto = host.textContent ?? '';
      expect(texto).toContain('1 documento desta fase depende da escolha do formulário');
      expect(texto).not.toContain('Nenhum documento exigido nesta fase');
    });

    it('lista o documento exigido em todas as fases, também na fase acrescentada depois', () => {
      const antes = {
        ...FASE_INSCRICAO,
        codigo: 'ANTES',
        congelados: { ...CONGELADOS_DA_INSCRICAO, coletaInscricao: false },
      };
      store.patchSection('cronograma', {
        ...store.draft().cronograma,
        fases: [antes, FASE_INSCRICAO],
      });
      store.patchSection('documentos', {
        ...comExigenciaSemGrupo(
          { regrasDeComprovacao: [], emTodasAsFases: [] },
          { ...exigenciaNova(TIPO_LAUDO, 'ANTES'), tipoDocumentoNome: 'Laudo médico' },
        ),
        emTodasAsFases: [TIPO_LAUDO],
      });

      emConsulta();

      expect(host.querySelector('sel-documentos-do-formulario')?.textContent).toContain(
        'Laudo médico',
      );
    });

    it('sem documento na fase, diz que nenhum é exigido e leva ao Cronograma', () => {
      store.patchObjectSection('formulario', {
        conteudo: conteudoDoFormulario(COM_PAGINA_DE_DOCUMENTOS),
      });
      fixture.detectChanges();

      expect(host.textContent).toContain('Nenhum documento exigido nesta fase');
      host.querySelector<HTMLButtonElement>('sel-documentos-do-formulario button')?.click();
      expect(store.passoAtual()).toBe(PASSO_CRONOGRAMA);
    });
  });
});
