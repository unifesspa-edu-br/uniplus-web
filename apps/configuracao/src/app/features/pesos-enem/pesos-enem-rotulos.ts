import {
  AreaPesoAreaEnemDto,
  PesoAreaEnemAreaDto,
  PesoAreaEnemDto,
  type GrupoAreaEnemDto,
} from '@uniplus/shared-data/configuracao';
import { formatarNumeroPtBr } from '@uniplus/shared-utils';
import { textoExibivel } from '../../shared/codigo-e-rotulo';
import { slug } from './pesos-enem-agrupamento';
import type { CampoDaArea } from './pesos-enem-limites';

/** A área como a tela a mostra: o rótulo oficial, ou o código quando a lista não o traz. */
export function rotuloDaArea(areas: readonly AreaPesoAreaEnemDto[], codigo: string): string {
  return textoExibivel({ codigo, rotulo: areas.find((area) => area.codigo === codigo)?.rotulo });
}

/** O grupo como a tela o mostra: rótulo, código, ou "—" quando não há identificação. */
export function rotuloDoGrupo(grupo: GrupoAreaEnemDto): string {
  return textoExibivel(grupo);
}

/** O que segue "Peso"/"Corte" no nome acessível: oculto na tela, onde o rótulo visível é curto
 *  e a área e o grupo já aparecem no cabeçalho e na linha. */
export function sufixoDoRotulo(areaRotulo: string, grupoRotulo: string): string {
  return ` de ${areaRotulo} — ${grupoRotulo}`;
}

/** Nome acessível completo do campo: área e grupo, para quem navega campo a campo sem ver o
 *  cabeçalho da coluna (ex.: "Peso de Matemática e suas Tecnologias — Tecnológica"). */
export function rotuloDoCampo(campo: CampoDaArea, areaRotulo: string, grupoRotulo: string): string {
  return `${campo === 'peso' ? 'Peso' : 'Corte'}${sufixoDoRotulo(areaRotulo, grupoRotulo)}`;
}

/** Valor de `aria-describedby`: os ids presentes, ou nenhum atributo. */
export function descritoPor(...ids: readonly (string | null)[]): string | null {
  const presentes = ids.filter((id): id is string => id !== null);
  return presentes.length > 0 ? presentes.join(' ') : null;
}

/** Id de um campo editável da edição em linha. */
export function idCampo(
  resolucao: string,
  grupo: number,
  area: number,
  campo: CampoDaArea,
): string {
  return `pe-${slug(resolucao)}-g${grupo}-a${area}-${campo}`;
}

/** Id do campo somente leitura: distinto do da edição, para o foco ao abrir a edição nunca
 *  cair no input que está saindo da tela. */
export function idCampoLeitura(resolucao: string, grupo: number, area: number): string {
  return `pe-${slug(resolucao)}-g${grupo}-a${area}-leitura`;
}

/** Id de um elemento de apoio (dica, erro) de uma área no drawer de criação. */
export function idDrawer(grupo: number, area: number, sufixo: string): string {
  return `pe-drawer-g${grupo}-a${area}-${sufixo}`;
}

export function valorDaArea(
  linha: PesoAreaEnemDto,
  codigo: string,
): PesoAreaEnemAreaDto | undefined {
  return linha.areas.find((area) => area.codigo?.trim() === codigo);
}

/** O corte da área como texto em pt-BR, ou `null` quando a área não tem corte (o zero é corte
 *  válido e aparece). */
export function corteExibido(valor: PesoAreaEnemAreaDto | undefined): string | null {
  const corte = valor?.corte;
  return corte === null || corte === undefined ? null : formatarNumeroPtBr(corte);
}

/** O id do botão que abre a edição de uma resolução, para devolver o foco a ele. */
export function idDoBotaoDeEdicao(resolucao: string): string {
  return `pe-editar-${slug(resolucao)}`;
}

/** O id do botão que pede a remoção de uma resolução. */
export function idDoBotaoDeRemocao(resolucao: string): string {
  return `pe-remover-${slug(resolucao)}`;
}
