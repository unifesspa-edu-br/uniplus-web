import { describe, expect, it } from 'vitest';
import {
  acrescentarOcorrencia,
  declararSemOcorrencia,
  gruposDoEnvio,
  removerOcorrencia,
  rotuloDaOcorrencia,
  type GrupoSimulavel,
  type SimulacaoDosGrupos,
} from './simulacao-de-grupos';

const MEMBROS: GrupoSimulavel = { codigo: 'MEMBROS', rotulo: 'Composição familiar', finalidade: 'INSCRICAO', minimo: 1, maximo: 2, incluiCandidato: false, campos: [] };
const BENS: GrupoSimulavel = { ...MEMBROS, codigo: 'BENS', rotulo: 'Bens', maximo: null };
const nenhum: SimulacaoDosGrupos = new Map();

function vezes(estado: SimulacaoDosGrupos, grupo: GrupoSimulavel, quantas: number): SimulacaoDosGrupos {
  return Array.from({ length: quantas }).reduce<SimulacaoDosGrupos>((atual) => acrescentarOcorrencia(atual, grupo), estado);
}

describe('simulação das ocorrências de grupo', () => {
  it('o grupo não respondido fica fora do envio, e o declarado sem ocorrência vai com a lista vazia', () => {
    const declarado = declararSemOcorrencia(nenhum, 'BENS', true);

    expect(gruposDoEnvio(nenhum), 'nenhum grupo respondido: o corpo fica sem grupos').toBeNull();
    expect(gruposDoEnvio(declarado), 'MEMBROS, não respondido, fica sem a chave').toEqual({ BENS: [] });
  });

  it('a identidade da ocorrência removida não volta em outra acrescentada depois', () => {
    const duas = vezes(nenhum, MEMBROS, 2);
    const depois = acrescentarOcorrencia(removerOcorrencia(duas, 'MEMBROS', 2), MEMBROS);

    expect(gruposDoEnvio(depois)?.['MEMBROS'].map((ocorrencia) => ocorrencia.id)).toEqual(['MEMBROS#1', 'MEMBROS#3']);
  });

  it('não acrescenta ocorrência além do máximo do grupo', () => {
    const noLimite = vezes(nenhum, MEMBROS, 2);

    expect(acrescentarOcorrencia(noLimite, MEMBROS)).toBe(noLimite);
  });

  it('sem máximo, acrescenta quantas ocorrências o candidato informaria', () => {
    expect(gruposDoEnvio(vezes(nenhum, BENS, 12))?.['BENS']).toHaveLength(12);
  });

  it('a ocorrência é nomeada pela posição atual no grupo, e não pela identidade', () => {
    const semAPrimeira = removerOcorrencia(vezes(nenhum, MEMBROS, 2), 'MEMBROS', 1);

    expect(rotuloDaOcorrencia(semAPrimeira, 'MEMBROS', 'Composição familiar', 'MEMBROS#2')).toBe('Composição familiar, ocorrência 1');
  });

  it('remover a última ocorrência devolve o grupo a não respondido', () => {
    const uma = acrescentarOcorrencia(nenhum, MEMBROS);

    expect(gruposDoEnvio(removerOcorrencia(uma, 'MEMBROS', 1))).toBeNull();
  });
});
