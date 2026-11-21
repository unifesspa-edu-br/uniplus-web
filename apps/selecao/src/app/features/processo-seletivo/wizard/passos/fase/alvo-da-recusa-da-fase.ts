import type { FaseDoCronograma } from '../../processo-seletivo.models';
import { NO_TOPO_DA_FASE } from '../cronograma/servicos/distribuicao-das-recusas-das-fases';
import { BLOCO_DAS_RECUSAS_DO_RECURSO, CONTROLE_DO_RECURSO, idDaFase } from './ids-da-fase';

/** A opção marcada de "admite instância superior", ou a primeira quando nenhuma está marcada. */
function opcaoDaInstanciaSuperior(fase: FaseDoCronograma): string {
  return fase.regraRecurso?.admiteInstanciaSuperior === false ? 'superior-nao' : 'superior-sim';
}

function controleDoRecurso(campo: string, fase: FaseDoCronograma): string | undefined {
  return campo === 'recurso.admiteInstanciaSuperior'
    ? opcaoDaInstanciaSuperior(fase)
    : CONTROLE_DO_RECURSO.get(campo);
}

/**
 * Os elementos que podem receber o foco quando a recusa é o primeiro problema do passo, do
 * preferido ao de reserva. O controle vem antes; o bloco das recusas, que aceita foco, serve
 * quando a fase não tem controle naquele ponto, como a lista de publicações ainda vazia ou a
 * suspensividade da 2ª instância, que só existe com instância superior. `indice` é a posição da
 * fase na linha do tempo, que nomeia os campos do período e da unidade.
 */
export function alvosDaRecusaDaFase(
  campo: string,
  fase: FaseDoCronograma,
  indice: number,
): readonly string[] {
  const id = (sufixo: string) => idDaFase(fase.codigo, sufixo);
  if (campo === 'unidadeResponsavelId') return [`cr-unidade-${indice}`];
  if (campo === 'inicio' || campo === 'fim') return [`cr-${campo}-${indice}`];
  if (campo === 'produtos') return [id('produto-ato-0'), id('produtos-erro')];
  if (campo === 'bancasRequeridas') return [id('banca-0'), id('bancas-erro')];
  if (campo === 'emiteParecerIndividual') return [id('parecer'), id('parecer-erro')];
  if (campo.startsWith('recurso')) return alvosDoRecurso(campo, fase);
  return campo === NO_TOPO_DA_FASE ? [id('recusas')] : [];
}

function alvosDoRecurso(campo: string, fase: FaseDoCronograma): readonly string[] {
  const controle = controleDoRecurso(campo, fase);
  const bloco = idDaFase(fase.codigo, BLOCO_DAS_RECUSAS_DO_RECURSO);
  return controle === undefined ? [bloco] : [idDaFase(fase.codigo, controle), bloco];
}
