import { AUTH_ALLOWED_URLS, AuthService, provideAuth } from '@uniplus/shared-auth/bootstrap';
import { provideRuntimeConfig } from '@uniplus/shared-data/config';
import { testarInicializacaoDoAplicativo } from '@uniplus/shared-testing';
import { appConfig } from './app.config';

testarInicializacaoDoAplicativo({
  configuracao: appConfig,
  servicoDeAutenticacao: AuthService,
  urlsAutorizadas: AUTH_ALLOWED_URLS,
  fornecerRuntime: provideRuntimeConfig,
  fornecerAutenticacao: provideAuth,
});
