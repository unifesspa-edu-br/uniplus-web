import { TipoDoRegistroDoBloqueioCodigo } from '@uniplus/shared-data/autorizacao';
import type { RegistroDaContencaoDto } from '@uniplus/shared-data/autorizacao';
import type { EventoDaTabela } from '../trilha-de-acesso.component';
import { porQuemDecide } from './rotulos-da-versao';

/** A frase da etapa que decidiu: quem determinou a suspensão ou qual etapa decidiu a retomada. */
function fraseDaEtapa({ tipo, etapa }: RegistroDaContencaoDto): string {
  if (!etapa) return '';
  if (tipo.codigo === TipoDoRegistroDoBloqueioCodigo.SUSPENSAO) {
    return `Determinada ${porQuemDecide(etapa.codigo)}.`;
  }
  return tipo.codigo === TipoDoRegistroDoBloqueioCodigo.DECISAO_DA_RETOMADA
    ? `Etapa: ${etapa.rotulo}.`
    : '';
}

/** As frases do registro que não são o motivo digitado, na ordem em que a pessoa as lê. */
function frases(registro: RegistroDaContencaoDto): readonly string[] {
  const { tipo, origem, perfilProtegido, decisorTemConcessao } = registro;
  const decisaoDaRetomada = tipo.codigo === TipoDoRegistroDoBloqueioCodigo.DECISAO_DA_RETOMADA;
  return [
    fraseDaEtapa(registro),
    decisaoDaRetomada && perfilProtegido ? 'O perfil era protegido na decisão.' : '',
    decisorTemConcessao ? 'Quem decidiu tem concessão do perfil.' : '',
    origem ? `Origem da retomada: ${origem.rotulo}.` : '',
  ].filter((frase) => frase !== '');
}

/** O detalhe do registro: as frases do ato e, por último, o motivo como foi digitado. */
export function detalheDoRegistro(registro: RegistroDaContencaoDto): string | null {
  const partes = [...frases(registro), ...(registro.motivo ? [`Motivo: ${registro.motivo}`] : [])];
  return partes.length === 0 ? null : partes.join(' ');
}

/**
 * Os registros da contenção na forma da trilha da concessão, para a mesma tabela mostrar as duas:
 * a pessoa que agiu aparece como lá, e o ato do sistema aparece sem pessoa, como "Sistema".
 */
export function registrosComoEventos(
  registros: readonly RegistroDaContencaoDto[],
): readonly EventoDaTabela[] {
  return [...registros]
    .sort((a, b) => a.ordem - b.ordem)
    .map((registro) => ({
      tipo: registro.tipo,
      instante: registro.instante,
      autor: registro.pessoa,
      ator: registro.ator,
      detalhe: detalheDoRegistro(registro),
    }));
}
