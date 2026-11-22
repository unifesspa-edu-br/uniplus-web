import type { FaseDoCronograma } from '../../processo-seletivo.models';
import { alvosDaRecusaDaBanca, type CampoDaBanca } from '../../shared/deliberacao/recusas-da-regra';
import { alvosDoControleDosParametros } from '../../shared/configuracao-do-recurso/ids-dos-parametros';
import { NO_TOPO_DA_FASE, posicaoNaLista } from './campo-da-fase';
import {
  BLOCO_DAS_RECUSAS_DO_RECURSO,
  CONTROLE_DO_RECURSO,
  idDaFase,
  PARAMETRO_DO_RECURSO,
  prefixoDoRecursoDaFase,
} from './ids-da-fase';

/**
 * Os elementos que podem receber o foco quando a recusa é o primeiro problema do passo, do
 * preferido ao de reserva. O controle vem antes; o bloco das recusas, que aceita foco, serve
 * quando a fase não tem controle naquele ponto, como a lista de publicações ainda vazia ou o
 * prazo da 2ª instância, que só existe quando a tela o mostra. `indice` é a posição da
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
  if (campo.startsWith('produtos')) return alvosDaPublicacao(campo, fase);
  if (campo === 'bancasRequeridas') return [id('banca-0'), id('bancas-erro')];
  if (campo.startsWith('bancasRequeridas')) return alvosDaBancaRequerida(campo, fase);
  if (campo === 'emiteParecerIndividual') return [id('parecer'), id('parecer-erro')];
  if (campo.startsWith('recurso')) return alvosDoRecurso(campo, fase);
  return campo === NO_TOPO_DA_FASE ? [id('recusas')] : [];
}

/**
 * O controle da linha de publicações que a recusa aponta, com o bloco das recusas da linha e o da
 * lista de reserva. A recusa à lista inteira vai à primeira linha.
 */
function alvosDaPublicacao(campo: string, fase: FaseDoCronograma): readonly string[] {
  const id = (sufixo: string) => idDaFase(fase.codigo, sufixo);
  const posicao = posicaoNaLista(campo, 'produtos');
  if (posicao === null) return [id('produto-ato-0'), id('produtos-erro')];
  const controle = campo.endsWith('.papel') ? 'produto-papel' : 'produto-ato';
  return [id(`${controle}-${posicao}`), id(`produto-${posicao}-erro`), id('produtos-erro')];
}

/** O controle da regra da banca requerida, com o bloco das recusas dele e, de reserva, o das bancas. */
function alvosDaBancaRequerida(campo: string, fase: FaseDoCronograma): readonly string[] {
  const [, posicao, controle] = campo.split('.');
  const base = idDaFase(fase.codigo, `regra-${posicao}`);
  return [
    ...alvosDaRecusaDaBanca(base, controle as CampoDaBanca),
    idDaFase(fase.codigo, 'bancas-erro'),
  ];
}

function alvosDoRecurso(campo: string, fase: FaseDoCronograma): readonly string[] {
  const bloco = idDaFase(fase.codigo, BLOCO_DAS_RECUSAS_DO_RECURSO);
  const controle = CONTROLE_DO_RECURSO.get(campo);
  if (controle !== undefined) return [idDaFase(fase.codigo, controle), bloco];
  const parametro = PARAMETRO_DO_RECURSO.get(campo);
  if (parametro === undefined) return [bloco];
  const admite = fase.regraRecurso?.admiteInstanciaSuperior ?? null;
  const prefixo = prefixoDoRecursoDaFase(fase.faseCanonicaId);
  return [...alvosDoControleDosParametros(prefixo, parametro, admite), bloco];
}
