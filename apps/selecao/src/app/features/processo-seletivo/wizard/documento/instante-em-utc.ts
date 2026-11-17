import { instanteDoCampo } from '../shared/fuso-institucional';

/**
 * O instante que o documento guarda para o que o campo de data e hora devolveu: a hora de parede
 * do fuso institucional escrita em UTC, com o sufixo `Z` que o esquema exige. Campo vazio ou data
 * que não existe no calendário não vira instante.
 */
export function instanteEmUtc(campo: string): string | undefined {
  if (!dataExiste(campo)) return undefined;
  const comFuso = instanteDoCampo(campo);
  if (comFuso === null) return undefined;
  const instante = new Date(comFuso);
  if (Number.isNaN(instante.getTime())) return undefined;
  return instante.toISOString().replace('.000Z', 'Z');
}

function dataExiste(campo: string): boolean {
  const partes = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(?::(\d{2}))?$/.exec(campo.trim());
  if (partes === null) return false;
  const data = `${partes[1]}:${partes[2] ?? '00'}`;
  const instante = new Date(`${data}Z`);
  return !Number.isNaN(instante.getTime()) && instante.toISOString().slice(0, 19) === data;
}
