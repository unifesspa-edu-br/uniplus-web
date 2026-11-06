import { FormArray, FormControl, FormGroup } from '@angular/forms';
import { ProblemDetails } from '@uniplus/shared-core/http';
import { describe, expect, it } from 'vitest';
import { criarGrupoDeCriacao } from './pesos-enem-form';
import {
  aplicarRecusaDoGrupo,
  descartarRecusasDoServidor,
  ehRecusaAcionavelPeloOperador,
} from './pesos-enem-recusas';
import { AREAS, grupo } from './pesos-enem.testing';

const titulo = (problem: ProblemDetails): string => `titulo ${problem.status}`;
const problema = (status: number, errors?: ProblemDetails['errors']): ProblemDetails =>
  ({ type: 'x', title: 'Falha', status, code: 'c', traceId: 't', errors }) as ProblemDetails;

describe('recusas do servidor', () => {
  it('a recusa 4xx é do operador; a de rede e a de servidor, não', () => {
    expect(ehRecusaAcionavelPeloOperador(problema(404))).toBe(true);
    expect(ehRecusaAcionavelPeloOperador(problema(0))).toBe(false);
    expect(ehRecusaAcionavelPeloOperador(problema(503))).toBe(false);
  });

  it('o erro do item inteiro e o do código vão ao peso, o corte ao corte e o resto fica sem campo', () => {
    const areas = criarGrupoDeCriacao(grupo('TECNOLOGICA'), AREAS).controls.areas;

    const semCampo = aplicarRecusaDoGrupo(
      areas,
      problema(422, [
        { field: 'areas[1]', code: 'a', message: 'Item inválido.' },
        { field: 'areas[1].codigo', code: 'b', message: 'Código fora do domínio.' },
        { field: 'areas[2].corte', code: 'c', message: 'Corte alto.' },
        { field: 'grupoCurso', code: 'd', message: 'Grupo inválido.' },
        { field: 'areas[99].peso', code: 'e', message: 'Área inexistente.' },
      ]),
      {},
      titulo,
    );

    expect(areas.at(1).controls.peso.getError('backend')).toEqual({
      code: 'a',
      message: 'Item inválido. Código fora do domínio.',
    });
    expect(areas.at(2).controls.corte.getError('backend').message).toBe('Corte alto.');
    expect(semCampo).toEqual(['Grupo inválido.', 'Área inexistente.']);
  });

  it('a recusa 4xx sem errors vai ao banner e a falha transitória não acrescenta nada', () => {
    const areas = criarGrupoDeCriacao(grupo('TECNOLOGICA'), AREAS).controls.areas;

    expect(aplicarRecusaDoGrupo(areas, problema(404), {}, titulo)).toEqual(['titulo 404']);
    expect(aplicarRecusaDoGrupo(areas, problema(500), {}, titulo)).toEqual([]);
    expect(aplicarRecusaDoGrupo(areas, problema(0), {}, titulo)).toEqual([]);
  });

  it('descartar as recusas limpa só o erro do servidor, sem emitir valueChanges', () => {
    const livre = new FormControl('a');
    const aninhado = new FormGroup({ lista: new FormArray([new FormControl('b')]), outro: livre });
    const doServidor = aninhado.controls.lista.at(0);
    doServidor.setErrors({ backend: { code: 'c', message: 'm' } });
    livre.setErrors({ outro: true });
    let emissoes = 0;
    doServidor.valueChanges.subscribe(() => (emissoes += 1));
    aninhado.valueChanges.subscribe(() => (emissoes += 1));

    descartarRecusasDoServidor(aninhado);

    expect(doServidor.errors).toBeNull();
    expect(livre.hasError('outro')).toBe(true);
    expect(emissoes).toBe(0);
  });
});
