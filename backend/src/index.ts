import { env } from './config/env';

console.error(`Server ready — provider: ${env.LLM_PROVIDER}, port: ${env.PORT}`);