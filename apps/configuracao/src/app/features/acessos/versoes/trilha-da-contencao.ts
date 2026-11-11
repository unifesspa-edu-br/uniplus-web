import type { EventoDaTrilhaDto, RegistroDaContencaoDto } from '@uniplus/shared-data/autorizacao';
import { etapa } from '../rotulos-de-acesso';

const ORIGEM_DA_RETOMADA: Readonly<Record<string, string>> = {
  decisao_da_etapa: 'Decorreu da decisão da última etapa exigida.',
  troca_de_vigencia: 'Decorreu da troca da versão em vigor, que mudou as etapas exigidas.',
  reclassificacao: 'Decorreu da reclassificação de uma permissão do perfil.',
};

/** As frases do registro que não são o motivo digitado, na ordem em que a pessoa as lê. */
function frases(registro: RegistroDaContencaoDto): readonly string[] {
  const { tipo, etapa: codigo, origem, perfilProtegido, decisorTemConcessao } = registro;
  return [
    tipo === 'suspensao' && codigo ? `Determinada pela ${etapa(codigo).toLowerCase()}.` : '',
    tipo === 'decisao_da_retomada' && codigo ? `Etapa: ${etapa(codigo).toLowerCase()}.` : '',
    tipo === 'decisao_da_retomada' && perfilProtegido ? 'O perfil era protegido na decisão.' : '',
    decisorTemConcessao ? 'Quem decidiu tem concessão do perfil.' : '',
    origem ? (ORIGEM_DA_RETOMADA[origem] ?? '') : '',
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
): readonly EventoDaTrilhaDto[] {
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
