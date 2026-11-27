import { ComponentFixture, TestBed } from '@angular/core/testing';
import type {
  DefinirClassificacaoRequest,
  ProcessoSeletivoDto,
} from '@uniplus/shared-data/selecao';

import { controller } from '../eliminacao/eliminacao.testing';
import { FormulaPassoComponent } from './formula.component';

/**
 * O passo Fórmula no mesmo editor do passo Eliminação já montado por `montarEliminacao()`: os dois
 * dividem o rascunho e a gravação, como na página.
 */
export function montarFormulaNoEditorDaEliminacao(): {
  readonly formula: FormulaPassoComponent;
  readonly fixture: ComponentFixture<FormulaPassoComponent>;
} {
  const fixture = TestBed.createComponent(FormulaPassoComponent);
  fixture.detectChanges();
  for (const requisicao of controller.match(() => true)) requisicao.flush([]);
  fixture.detectChanges();
  return { formula: fixture.componentInstance, fixture };
}

type Referencia = { readonly codigo: string; readonly versao: string } | null;

function referencia(codigo?: string | null, versao?: string | null): Referencia {
  return codigo == null || versao == null ? null : { codigo, versao };
}

/** O que o servidor devolve ao detalhar o processo cuja classificação ele acabou de gravar. */
export function detalheComoOServidorGravou(
  comando: DefinirClassificacaoRequest,
): ProcessoSeletivoDto {
  const classificacao = {
    ...regrasGravadas(comando),
    ...valoresGravados(comando),
    regrasEliminacao: [],
  };
  return { opcoesDeclaradas: [], classificacao } as unknown as ProcessoSeletivoDto;
}

function regrasGravadas(comando: DefinirClassificacaoRequest) {
  return {
    regraCalculo: referencia(comando.regraCalculoCodigo, comando.regraCalculoVersao),
    regraArredondamento: referencia(
      comando.regraArredondamentoCodigo,
      comando.regraArredondamentoVersao,
    ),
    regraOrdemAlocacao: referencia(
      comando.regraOrdemAlocacaoCodigo,
      comando.regraOrdemAlocacaoVersao,
    ),
  };
}

function valoresGravados(comando: DefinirClassificacaoRequest) {
  return {
    casasArredondamento: comando.casasArredondamento,
    baseadoEmEnem: comando.baseadoEmEnem,
    escalaNotaFinal: comando.escalaNotaFinal,
    resolucaoPesoAreaEnem: comando.resolucaoPesoAreaEnem,
  };
}
