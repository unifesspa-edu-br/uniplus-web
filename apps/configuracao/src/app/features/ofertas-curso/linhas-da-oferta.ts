import { ResolucaoDeVinculo, descreverVinculo } from '@uniplus/shared-core/http';
import { OfertaCursoDto } from '@uniplus/shared-data/configuracao';
import { rotuloDoPrograma, rotuloDosTurnos } from './rotulos-da-oferta';
import type { VinculosDaOferta } from './vinculos-da-oferta';

/** A oferta como a linha da tabela a mostra: os vínculos resolvidos e o nome acessível das ações. */
export interface LinhaDaOferta {
  readonly oferta: OfertaCursoDto;
  readonly curso: ResolucaoDeVinculo;
  readonly grau: string;
  readonly local: ResolucaoDeVinculo;
  readonly identificador: string;
}

type Resolvedor = Pick<VinculosDaOferta, 'cursoDaOferta' | 'grauDoCurso' | 'localDaOferta'>;

/**
 * Identificador da linha para as ações só-ícone, no lugar do UUID que um leitor de tela não
 * relaciona a nenhuma coluna visível. A listagem reúne ofertas de todos os cursos e o backend não
 * declara chave natural, então o nome repete as colunas que distinguem as ofertas na prática:
 * curso, unidade, local, programa e turnos. Curso e local usam o mesmo texto da célula: enquanto o
 * catálogo carrega ou falha, o botão diz isso em vez de soar como dado legítimo.
 */
function identificadorDaOferta(
  oferta: OfertaCursoDto,
  curso: ResolucaoDeVinculo,
  local: ResolucaoDeVinculo,
): string {
  return [
    descreverVinculo(curso),
    oferta.unidadeOfertante.sigla,
    descreverVinculo(local),
    rotuloDoPrograma(oferta.programaDeOferta),
    rotuloDosTurnos(oferta.turnos),
  ].join(' · ');
}

/** Quando duas linhas coincidem em todas as colunas do nome, um ordinal ("1 de 2") as separa. */
function comOrdinais(nomes: readonly string[]): readonly string[] {
  const total = new Map<string, number>();
  for (const nome of nomes) {
    total.set(nome, (total.get(nome) ?? 0) + 1);
  }
  const vistos = new Map<string, number>();
  return nomes.map((nome) => {
    const repeticoes = total.get(nome) ?? 1;
    if (repeticoes === 1) {
      return nome;
    }
    const ordem = (vistos.get(nome) ?? 0) + 1;
    vistos.set(nome, ordem);
    return `${nome} (${ordem} de ${repeticoes})`;
  });
}

export function montarLinhas(
  ofertas: readonly OfertaCursoDto[],
  vinculos: Resolvedor,
): readonly LinhaDaOferta[] {
  const base = ofertas.map((oferta) => ({
    oferta,
    curso: vinculos.cursoDaOferta(oferta.cursoId),
    grau: vinculos.grauDoCurso(oferta.cursoId),
    local: vinculos.localDaOferta(oferta.localOfertaId),
  }));
  const nomes = comOrdinais(
    base.map(({ oferta, curso, local }) => identificadorDaOferta(oferta, curso, local)),
  );
  return base.map((linha, indice) => ({ ...linha, identificador: nomes[indice] }));
}
