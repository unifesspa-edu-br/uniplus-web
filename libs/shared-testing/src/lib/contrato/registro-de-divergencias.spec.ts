import { expect, it } from 'vitest';
import { RegistroDeDivergencias } from './registro-de-divergencias.testing';

function pendencia() {
  let concluir: () => void = () => undefined;
  const promessa = new Promise<void>((resolver) => {
    concluir = resolver;
  });
  return { promessa, concluir: () => concluir() };
}

it('aguarda pendências e trabalho acrescentado durante o encerramento', async () => {
  const registro = new RegistroDeDivergencias();
  const primeira = pendencia();
  const segunda = pendencia();
  let terminou = false;
  registro.acompanhar(primeira.promessa);
  const encerramento = registro.encerrar().then(() => {
    terminou = true;
  });
  await Promise.resolve();
  expect(terminou).toBe(false);
  registro.acompanhar(segunda.promessa);
  primeira.concluir();
  await primeira.promessa;
  expect(terminou).toBe(false);
  segunda.concluir();
  await encerramento;
  expect(terminou).toBe(true);
});

it('registra resposta tardia e limpa o registro para o próximo teste', async () => {
  const registro = new RegistroDeDivergencias();
  const resposta = pendencia();
  registro.acompanhar(
    resposta.promessa.then(() =>
      registro.registrar([
        { metodo: 'GET', caminho: '/api/{...}', campo: 'resposta', regra: 'inválida' },
      ]),
    ),
  );
  const encerramento = registro.encerrar();
  resposta.concluir();
  await expect(encerramento).rejects.toThrow('inválida');
  await expect(registro.encerrar()).resolves.toBeUndefined();
});
