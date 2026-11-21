import { ApplicationRef } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { TipoMotivoDeDecisaoCodigo, type MotivoDeDecisaoDto } from '@uniplus/shared-data/selecao';

import type { ModoDaSecao } from '../modo-da-secao';
import { MotivosDaFaseOuEtapaComponent } from './motivos-da-fase-ou-etapa.component';
import type { RecusaDaEscolha } from './escolha-dos-motivos';
import type { FaseOuEtapaDoMotivo, MotivoNoDocumento } from './motivo-no-documento';
import { FASE_DA_INSCRICAO, umMotivoDoCadastro } from './motivos.testing';

export type FixtureDosMotivos = ComponentFixture<MotivosDaFaseOuEtapaComponent>;

export interface EntradasDosMotivos {
  readonly faseOuEtapa: FaseOuEtapaDoMotivo;
  readonly nomeDaFaseOuEtapa: string;
  readonly escolhidos: readonly MotivoNoDocumento[];
  readonly catalogo: readonly MotivoDeDecisaoDto[];
  readonly catalogoCarregado: boolean;
  readonly tiposDeclarados: readonly string[];
  readonly recusas: readonly RecusaDaEscolha[];
  readonly modo: ModoDaSecao;
  readonly idBase: string;
}

const ENTRADAS_PADRAO: EntradasDosMotivos = {
  faseOuEtapa: FASE_DA_INSCRICAO,
  nomeDaFaseOuEtapa: 'Inscrição',
  escolhidos: [],
  catalogo: [],
  catalogoCarregado: true,
  tiposDeclarados: ['HOMOLOGACAO_DAS_INSCRICOES'],
  recusas: [],
  modo: 'edicao',
  idBase: 'motivos',
};

/** Deixa a tela se atualizar, inclusive o que roda depois da renderização. */
export async function assentar(fixture: FixtureDosMotivos): Promise<void> {
  fixture.detectChanges();
  TestBed.inject(ApplicationRef).tick();
  await new Promise((resolver) => setTimeout(resolver));
}

/** Muda só as entradas informadas, como faz quem usa o componente ao atualizar o documento. */
export async function atualizar(
  fixture: FixtureDosMotivos,
  entradas: Partial<EntradasDosMotivos>,
): Promise<void> {
  for (const [nome, valor] of Object.entries(entradas)) {
    fixture.componentRef.setInput(nome, valor);
  }
  await assentar(fixture);
}

/** O componente montado no documento da página, para o foco e o axe enxergarem a árvore real. */
export async function montarMotivos(
  entradas: Partial<EntradasDosMotivos> = {},
): Promise<FixtureDosMotivos> {
  const fixture = TestBed.createComponent(MotivosDaFaseOuEtapaComponent);
  document.body.appendChild(fixture.nativeElement);
  await atualizar(fixture, { ...ENTRADAS_PADRAO, ...entradas });
  return fixture;
}

export function caixaDoMotivo(
  fixture: FixtureDosMotivos,
  codigo: string,
  tipo = 'HOMOLOGACAO_DAS_INSCRICOES',
): HTMLInputElement | null {
  return (fixture.nativeElement as HTMLElement).querySelector(`#motivos-${tipo}-${codigo}`);
}

export function legendas(fixture: FixtureDosMotivos): string[] {
  const legendasDaTela = (fixture.nativeElement as HTMLElement).querySelectorAll('legend');
  return Array.from(legendasDaTela, (legenda) => legenda.textContent?.trim() ?? '');
}

/** Os motivos do cadastro que as seções de teste escolhem entre. */
export const CATALOGO_DE_TESTE = {
  semEnem: umMotivoDoCadastro({ codigo: 'SEM_ENEM', descricao: 'Sem ENEM.' }),
  cota: umMotivoDoCadastro({
    codigo: 'FORA_DA_COTA',
    descricao: 'Fora da cota.',
    subclassificacao: 'Cota racial',
  }),
  renda: umMotivoDoCadastro({
    tipo: TipoMotivoDeDecisaoCodigo.ISENCAO_DA_TAXA,
    codigo: 'RENDA_ALTA',
    descricao: 'Renda acima do limite.',
  }),
  empate: umMotivoDoCadastro({
    tipo: TipoMotivoDeDecisaoCodigo.CLASSIFICACAO,
    codigo: 'EMPATE',
    descricao: 'Empate na nota.',
  }),
};

export function textoDe(fixture: FixtureDosMotivos): string {
  return (fixture.nativeElement.textContent ?? '').replace(/\s+/g, ' ');
}
