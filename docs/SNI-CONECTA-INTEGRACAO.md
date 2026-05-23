# Integração KotodamaCRM → SNI Conecta (AWS)

> Documento técnico para incorporar o **KotodamaCRM** (sistema atual de
> CRM + WhatsApp da Seicho-No-Ie do Brasil) ao sistema unificado
> **SNI Conecta** hospedado na **Amazon Web Services**.

| Campo | Valor |
|---|---|
| Sistema origem | KotodamaCRM (`agenciaveranno/sni-crm`, branch `main`) |
| Sistema destino | SNI Conecta (a definir) |
| Plataforma destino | AWS (region recomendada: `sa-east-1` São Paulo) |
| Hospedagem atual | Railway.app (PaaS) |
| Data deste documento | 2026-05-23 |
| Status do origem | Em produção, ~17 mil linhas TS, 15 módulos backend, 23 páginas web |

---

## Índice

1. [Visão geral do KotodamaCRM](#1-visão-geral-do-kotodamacrm)
2. [Stack e arquitetura atual](#2-stack-e-arquitetura-atual)
3. [Modelo de dados](#3-modelo-de-dados)
4. [Integrações externas](#4-integrações-externas)
5. [Estratégias de incorporação ao SNI Conecta](#5-estratégias-de-incorporação-ao-sni-conecta)
6. [Arquitetura recomendada na AWS](#6-arquitetura-recomendada-na-aws)
7. [Mapeamento de componentes → serviços AWS](#7-mapeamento-de-componentes--serviços-aws)
8. [Variáveis de ambiente](#8-variáveis-de-ambiente)
9. [Autenticação e SSO](#9-autenticação-e-sso)
10. [Plano de migração de dados](#10-plano-de-migração-de-dados)
11. [Plano de migração de runtime](#11-plano-de-migração-de-runtime)
12. [Observabilidade, segurança e compliance](#12-observabilidade-segurança-e-compliance)
13. [Estimativa de custos AWS](#13-estimativa-de-custos-aws)
14. [Checklist de cutover](#14-checklist-de-cutover)
15. [Apêndice A — Endpoints REST](#apêndice-a--endpoints-rest)
16. [Apêndice B — Schema Prisma resumido](#apêndice-b--schema-prisma-resumido)
17. [Apêndice C — Permissões](#apêndice-c--permissões)

---

## 1. Visão geral do KotodamaCRM

CRM voltado à comunicação em escala via **WhatsApp Business Cloud API** (Meta
oficial). Atende a Seicho-No-Ie do Brasil para gestão de praticantes,
disparos de comunicados e atendimento via inbox unificada.

### Features em produção

- **Contatos** — CRUD, tags, normalização de telefone (BR+55 com BR9), merge
- **Tags** — taxonomia livre com cor
- **Números WhatsApp** — múltiplos números/WABAs por instância
- **Templates** — editor completo (HEADER text/IMAGE/VIDEO/DOCUMENT, BODY com
  variáveis, FOOTER, até 10 botões QUICK_REPLY/URL/PHONE/COPY_CODE),
  submissão automática pra aprovação na Meta, sync de status, upload de
  mídia resumable
- **Campanhas** — disparo em massa de templates aprovados, audiência por
  tags + opt-in, variáveis por contato (literal ou campo), worker BullMQ
  com rate-limit 60 msg/min, retries, pause/resume/cancel, stats por
  webhook (sent/delivered/read/failed)
- **Imports** — CSV/Excel até 50k linhas, mapeamento de colunas, tags
  fixas + dinâmicas, opção OPTED_IN
- **Inbox** — conversas unificadas, envio de texto e templates, status
  de entrega, "Nova conversa" pra contatos OPTED_IN sem histórico
- **Automations** — regras com triggers (OPT_OUT_RECEIVED, INBOUND_MESSAGE,
  CONTACT_CREATED, TAG_ADDED) e ações (SEND_TEMPLATE, ADD/REMOVE_TAG,
  CALL_WEBHOOK). Detecção automática de opt-out por palavras-chave PT-BR
- **Opt-in Links** — URLs públicas (`/opt-in/{code}`) para captação de
  consentimento com IP, redirect e tags
- **Audit Log** — histórico de ações (infra pronta; gravação granular a
  expandir)
- **Webhook Meta** — recepção de mensagens inbound, atualização de status
  com validação HMAC-SHA256
- **Permissões** — RBAC com 11 módulos × 6 ações por usuário

---

## 2. Stack e arquitetura atual

### Monorepo (npm workspaces + Turborepo)

```
sni-crm/
├── apps/
│   ├── api/              # Backend NestJS 10
│   │   ├── src/modules/  # 15 módulos
│   │   └── prisma/       # Schema + migrations
│   └── web/              # Frontend Next.js 14 App Router
└── packages/
    └── shared/           # Tipos e utilitários compartilhados
```

### Tecnologias

| Camada | Tecnologia | Versão |
|---|---|---|
| Linguagem | TypeScript | 5.4 |
| Runtime | Node.js | 20+ |
| Backend framework | NestJS | 10 |
| ORM | Prisma | 5.14 |
| DB | PostgreSQL | 16 |
| Cache/queue | Redis | 7 |
| Job runner | BullMQ | 5.7 |
| Auth | JWT (passport-jwt) | — |
| Frontend framework | Next.js (App Router) | 14.2 |
| Estado/data | React Query 5, Zustand 4 | — |
| Styling | Tailwind, shadcn/ui | — |
| Parsing | xlsx | 0.18 |
| Validação | class-validator + zod | — |

### Topologia atual (Railway)

```
                    ┌─────────────────────┐
   Internet ─────►  │   Web (Next.js)     │ — *.up.railway.app
                    └──────────┬──────────┘
                               │ HTTPS
                    ┌──────────▼──────────┐
                    │   API (NestJS)      │ ◄── Webhooks Meta
                    │   + Worker BullMQ   │ (mesmo processo)
                    └─────┬──────────┬────┘
                          │          │
                    ┌─────▼────┐ ┌───▼────┐
                    │ Postgres │ │ Redis  │
                    └──────────┘ └────────┘
```

> **Atenção**: hoje o **worker BullMQ roda no mesmo processo do API**.
> Pra escala em AWS, recomenda-se desacoplar (ver §6).

---

## 3. Modelo de dados

PostgreSQL 16 via Prisma. **15 tabelas**, esquema completo no
[Apêndice B](#apêndice-b--schema-prisma-resumido).

### Domínios

| Domínio | Tabelas principais |
|---|---|
| Identidade | `users`, `permissions` |
| Contatos | `contacts`, `tags`, `contact_tags` |
| Canais | `whatsapp_numbers` |
| Mensagens | `inbox_messages` |
| Marketing | `templates`, `campaigns`, `campaign_recipients` |
| Acquisição | `imports`, `opt_in_links` |
| Automação | `automation_rules` |
| Compliance | `audit_logs` |

### Volumes estimados (capacity planning)

| Tabela | Volume típico em 1 ano |
|---|---|
| `contacts` | 100k – 500k linhas |
| `inbox_messages` | 1M – 10M linhas (alvo de particionamento futuro) |
| `campaign_recipients` | 500k – 5M (cresce com campanhas) |
| `audit_logs` | 100k – 1M (politicas de retenção sugeridas) |
| Outras | < 10k cada |

### Dados sensíveis (LGPD)

- `users.passwordHash` — bcrypt rounds=12
- `whatsapp_numbers.accessToken` — token permanente da Meta, **deve ser
  criptografado em repouso** (hoje usa `CryptoModule` simples; ver §12)
- `contacts.email`, `contacts.phone`, `contacts.notes` — dados pessoais
- `contacts.optInIp`, `audit_logs.ip` — IPs

---

## 4. Integrações externas

### 4.1 Meta WhatsApp Business Cloud API

| Aspecto | Detalhe |
|---|---|
| Endpoint base | `https://graph.facebook.com/{version}` (default `v22.0`) |
| Auth saída | `Authorization: Bearer {accessToken_da_WABA}` |
| Webhook entrante | `POST /api/v1/webhooks/meta` (validação HMAC-SHA256 via `META_APP_SECRET`) |
| Verify token | `META_VERIFY_TOKEN` (handshake GET) |
| Resumable upload | Usa `META_APP_ID|META_APP_SECRET` como app token |

**Operações implementadas no `MetaService`**:
- `sendText` — texto livre dentro da janela 24h
- `sendTemplate` — template com header/body/buttons params
- `uploadMedia` — resumable upload em 2 fases (retorna `h:` handle)
- `createTemplate` — submete template pra aprovação
- `syncTemplates` — pull do estado atual da WABA
- `deleteTemplate` — remoção remota

### 4.2 Webhooks recebidos da Meta

- `messages` — mensagem inbound de contato
- `statuses` — atualização de status (sent/delivered/read/failed) das
  saídas, propagada para `inbox_messages` e `campaign_recipients`
- `template_status_update` — mudanças de aprovação de templates

---

## 5. Estratégias de incorporação ao SNI Conecta

Três modelos viáveis, com trade-offs distintos. **Recomendação ao final.**

### Estratégia A — Monolito unificado (reescrever)

Reescrever as features dentro da base de código do SNI Conecta usando
seu próprio stack. Banco único do SNI Conecta absorve as tabelas.

| Prós | Contras |
|---|---|
| Stack único, sem duplicação | Reescrita de ~17k linhas TS |
| UX coesa nativamente | 3–6 meses de roadmap parado |
| Auth/permissões nativas | Risco alto de regressão funcional |

**Quando faz sentido**: se o SNI Conecta usa stack muito diferente
(ex: Java/Spring + React Native) e a Veranno aceita parar features
por 1+ trimestre.

### Estratégia B — Microsserviço dedicado (recomendado)

KotodamaCRM continua como serviço autônomo, exposto via API REST + frontend
embutido por iframe ou link. SNI Conecta delega o módulo
"Comunicação/CRM" inteiro para ele.

| Prós | Contras |
|---|---|
| Reaproveita 100% do código atual | Dois domínios distintos (DNS + auth) |
| Deploy/release independente | Necessita SSO compartilhado |
| Time pode evoluir em paralelo | Telemetria precisa ser correlacionada |
| Menor blast radius em incidentes | Pequena duplicação de dados de usuário |

**Quando faz sentido**: o caminho mais rápido e seguro pra entrar em
produção. **Recomendado.**

### Estratégia C — Biblioteca embarcada (módulos npm privados)

Quebrar o backend em pacotes npm publicados num registry privado
(CodeArtifact) e o SNI Conecta importa só os módulos NestJS necessários.

| Prós | Contras |
|---|---|
| Reuso fino-granular | Trabalho grande de empacotamento |
| Banco compartilhado | Acopla deploy/versão fortemente |
| Telemetria unificada nativa | Migrations cruzadas viram problema |

**Quando faz sentido**: se o SNI Conecta também é NestJS+Prisma e há
intenção de fundir bancos. Caso contrário, evitar.

### Recomendação

> **Estratégia B** com plano evolutivo pra C em 12–18 meses se houver
> consolidação de stack.

O resto deste documento assume **Estratégia B**.

---

## 6. Arquitetura recomendada na AWS

### Topologia alvo

```
                    Internet
                       │
                       ▼
               ┌───────────────┐
               │  CloudFront   │  CDN + WAF + cert ACM
               └───┬───────┬───┘
                   │       │
            (web)  │       │  (api)
                   ▼       ▼
        ┌──────────────┐  ┌──────────────┐
        │  S3 (static) │  │     ALB      │  internet-facing
        │   + Amplify  │  └──────┬───────┘  HTTPS only
        │    Hosting   │         │
        └──────────────┘  ┌──────▼───────┐
                          │   ECS/Fargate│  2 services:
                          │              │  • api      (HTTP)
                          │              │  • worker   (BullMQ only)
                          └─┬────────┬───┘
                            │        │
                       ┌────▼──┐  ┌──▼─────────┐
                       │  RDS  │  │ElastiCache │
                       │Postgres│ │  Redis     │
                       │  (Multi│ │ (cluster)  │
                       │   AZ) │  └────────────┘
                       └───┬───┘
                           │
                       ┌───▼──────┐
                       │   S3     │  uploads/mídia (futuro)
                       └──────────┘

       AWS Cognito ─┐
       (SSO)        │
                    ▼
              SNI Conecta
              (auth source)
```

### Decisões de design

1. **Worker separado do API**. Hoje no Railway eles compartilham processo
   — funciona pra dezenas/centenas de envios mas trava sob carga.
   Em AWS rodamos **dois services ECS distintos** apontando para o mesmo
   código, com entrypoint diferente:
   - `api`: `node dist/main` (HTTP, atrás de ALB)
   - `worker`: `node dist/worker` (consome BullMQ, sem porta exposta)

2. **Uploads em S3, não em memória/disk**. O endpoint atual de upload de
   mídia para Meta recebe o arquivo em memória do API. Migrar para:
   - Frontend pede presigned URL (`PUT s3://bucket/uploads/...`)
   - Frontend faz upload direto ao S3
   - API recebe a key, baixa do S3 e faz o resumable upload Meta

3. **Multi-AZ obrigatório** em RDS e Redis (alta disponibilidade).

4. **Secrets em Secrets Manager**, **não em ECS task env**. Os tokens
   da Meta são valiosos.

5. **WAF na CloudFront** com regras default (OWASP) + rate limiting do
   `/api/v1/auth/login`.

6. **Webhook endpoint** `/api/v1/webhooks/meta` deve ter rota dedicada
   no ALB com bypass de autenticação JWT (já é `@Public()` no NestJS) e
   IP allowlist da Meta se possível.

---

## 7. Mapeamento de componentes → serviços AWS

| Componente atual | AWS equivalente | Notas |
|---|---|---|
| Railway web service (Next.js) | **AWS Amplify Hosting** ou **S3+CloudFront** | Amplify mais simples; CloudFront+S3 mais barato se SSR não for crítico |
| Railway api service | **ECS Fargate** (1 task `api`) | 0.5–1 vCPU, 1–2 GB RAM em t0 |
| Railway worker (mesmo proc) | **ECS Fargate** (task `worker`) | 0.25 vCPU, 512 MB suficiente p/ rate 60/min |
| Railway Postgres | **Amazon RDS for PostgreSQL 16** | `db.t4g.medium` Multi-AZ; backups 7 dias |
| Railway Redis | **ElastiCache for Redis 7** | `cache.t4g.micro` cluster mode disabled (BullMQ não precisa cluster) |
| Local FS uploads (efêmero) | **S3** | bucket `sni-conecta-crm-uploads-{env}` lifecycle 30d |
| Railway built-in HTTPS | **ACM** + **CloudFront** + **ALB** | cert wildcard `*.sniconecta.org.br` |
| Railway env vars | **Secrets Manager** (segredos) + **SSM Parameter Store** (config) | rotacionar JWT_SECRET via Secrets Manager |
| Sem logs estruturados | **CloudWatch Logs** + **Logs Insights** | log group por service |
| Sem APM | **CloudWatch Application Signals** ou **OpenTelemetry → X-Ray** | opcional v1 |
| Sem alarmes | **CloudWatch Alarms** + **SNS** | regras mínimas em §12 |
| Domínio | **Route 53** | zona `sniconecta.org.br` |

### Dimensionamento sugerido (v1)

| Recurso | Tamanho | Justificativa |
|---|---|---|
| ECS api task | 0.5 vCPU / 1 GB | NestJS é leve; pico de 50–100 req/s sem suor |
| ECS worker task | 0.25 vCPU / 0.5 GB | Rate de 60 msg/min ≈ 1 req/s pra Meta |
| RDS Postgres | `db.t4g.medium` (2 vCPU / 4 GB) Multi-AZ | 100GB gp3 |
| ElastiCache Redis | `cache.t4g.micro` (2 vCPU / 0.5 GB) | BullMQ usa pouco — ~10 MB |
| CloudFront | Pay-as-you-go | Free tier cobre 1 TB/mês |
| Auto-scaling api | min 1 / max 3, CPU 70% | escala em campanhas grandes |
| Auto-scaling worker | min 1 / max 5, fila > 1000 | conforme pendentes na BullMQ |

---

## 8. Variáveis de ambiente

### Backend (`api` + `worker`)

| Variável | Origem | Onde fica na AWS | Obs |
|---|---|---|---|
| `DATABASE_URL` | Postgres connection string | Secrets Manager | `postgresql://user:pass@host:5432/sniconecta?schema=crm` |
| `REDIS_URL` | Redis connection string | Secrets Manager | `redis://host:6379` (usar TLS em prod) |
| `JWT_SECRET` | random 32+ chars | Secrets Manager | rotação anual; pode ser substituído por integração Cognito |
| `JWT_EXPIRES_IN` | string | SSM Parameter Store | `7d` recomendado |
| `META_APP_ID` | ID app Meta | Secrets Manager | numérico |
| `META_APP_SECRET` | secret app Meta | Secrets Manager | sensitive |
| `META_VERIFY_TOKEN` | string aleatória | Secrets Manager | usado no handshake do webhook |
| `META_GRAPH_VERSION` | versão Graph API | SSM | default `v22.0` |
| `ENCRYPTION_KEY` | 32-byte hex | Secrets Manager | usada para criptografar `accessToken` no DB |
| `FRONTEND_URL` | URL do web | SSM | `https://crm.sniconecta.org.br` |
| `ADMIN_EMAIL` | seed inicial | SSM | só usado no `db:seed` |
| `ADMIN_PASSWORD` | seed inicial | Secrets Manager (one-shot) | trocar após primeiro login |
| `PORT` | porta HTTP | task definition env | `3000` |
| `NODE_ENV` | string | task definition env | `production` |

### Frontend (`web` Next.js)

| Variável | Origem | Onde fica na AWS | Obs |
|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | URL pública do API | Amplify env / build-time | `https://api-crm.sniconecta.org.br/api/v1` |

> Variáveis com prefixo `NEXT_PUBLIC_` ficam **embutidas no bundle** —
> não usar para segredos.

---

## 9. Autenticação e SSO

### Estado atual

KotodamaCRM tem auth próprio:
- `POST /api/v1/auth/login` (email + senha) → JWT HS256
- Senhas bcrypt rounds=12
- JWT em `Authorization: Bearer ...`
- RBAC via tabela `permissions` (módulo × ação)

### Opções de integração com SNI Conecta

#### Opção 1 — SSO via AWS Cognito (recomendado)

1. SNI Conecta usa **Cognito User Pool** como source-of-truth
2. KotodamaCRM aceita JWT do Cognito via OIDC
3. Mantém tabela `users` local (espelho) com `cognitoSub` único, sem
   `passwordHash`
4. Tela de login do CRM redireciona pro Hosted UI do Cognito

**Mudanças necessárias**:
- Substituir `passport-jwt` por `aws-jwt-verify`
- Sincronização de usuários: webhook Cognito → API CRM em `Confirmation`
  / `PostAuthentication` (Lambda trigger)
- Mapeamento de `cognito:groups` → `UserRole` (ADMIN/OPERATOR)

**Esforço estimado**: 3–5 dias

#### Opção 2 — SAML SSO via SNI Conecta IdP

Se SNI Conecta já tiver IdP SAML (Azure AD, Google Workspace), o CRM
vira SP via `@node-saml/passport-saml`.

**Esforço estimado**: 5–7 dias

#### Opção 3 — Federação JWT direta

SNI Conecta emite JWTs assinados com chave compartilhada, o CRM valida.

**Esforço estimado**: 1–2 dias **MAS** acopla emissor/consumidor;
problemático em rotação de chave.

### Permissões

A tabela `permissions` (Apêndice C) é projetada para coexistir com
qualquer mecanismo de SSO. **Recomenda-se manter** — o SSO autentica
mas o CRM autoriza com base no contexto local de quem pode operar
quais números/campanhas.

---

## 10. Plano de migração de dados

### Etapa 1 — Snapshot do Postgres atual

```bash
# A partir da Railway (ou do dump existente)
pg_dump --no-owner --no-acl --schema=public \
  postgresql://USER:PASS@HOST:PORT/railway \
  > kotodama_dump.sql
```

### Etapa 2 — Restaurar no RDS

```bash
# Criar database no RDS antes
psql postgresql://master@rds-endpoint:5432/sniconecta -c \
  "CREATE SCHEMA crm; CREATE USER crm_app PASSWORD '...';
   GRANT ALL ON SCHEMA crm TO crm_app;"

# Carregar o dump em um schema dedicado
sed -i 's/SET search_path = public/SET search_path = crm/g' kotodama_dump.sql
psql postgresql://crm_app@rds-endpoint:5432/sniconecta < kotodama_dump.sql
```

### Etapa 3 — Aplicar migrations futuras

```bash
DATABASE_URL=postgresql://crm_app@rds-endpoint:5432/sniconecta?schema=crm \
  npx prisma migrate deploy
```

### Etapa 4 — Validar integridade

- `SELECT count(*)` por tabela origem vs destino
- Spot-check: 10 contatos aleatórios, 10 mensagens, 5 campanhas
- Reexecutar consultas críticas (dashboard, lista de contatos)

### Etapa 5 — Re-criptografar `accessToken`

Se `ENCRYPTION_KEY` mudar entre Railway e AWS, **rotacionar**:

```bash
node scripts/rotate-encryption-key.ts \
  --old-key="$OLD_KEY" --new-key="$NEW_KEY"
```

(Script a criar; usa `CryptoService.decrypt(old).encrypt(new)` para
cada `whatsapp_numbers.accessToken`.)

### Etapa 6 — Migração de mídia (se houver)

Se já existirem uploads locais (não há hoje), `aws s3 sync` para o
bucket S3 e atualizar paths no DB.

---

## 11. Plano de migração de runtime

### Pre-cutover (1–2 semanas antes)

- [ ] Provisionar VPC, subnets, security groups, ALB
- [ ] Provisionar RDS Postgres Multi-AZ e ElastiCache Redis
- [ ] Provisionar bucket S3 + IAM roles
- [ ] Criar ECR repos: `sni-conecta-crm-api` e `sni-conecta-crm-web`
- [ ] Pipeline CI/CD (GitHub Actions → ECR → ECS deploy)
- [ ] Configurar Cognito User Pool (se opção 1 de SSO)
- [ ] Importar tokens Meta em Secrets Manager
- [ ] Criar registros DNS em Route 53 com TTL baixo (60s)
- [ ] Smoke test em ambiente `staging` com dataset sanitizado

### Cutover (janela de 30–60 min)

1. **Freeze** writes no Railway (modo manutenção no web)
2. Snapshot final do Postgres Railway
3. Restore no RDS (~5–15 min para 100k contatos)
4. Apontar DNS no Route 53 para CloudFront/ALB
5. Atualizar **webhook URL** na Meta App Dashboard:
   `https://api-crm.sniconecta.org.br/api/v1/webhooks/meta`
6. Smoke test: login, listar contatos, abrir conversa, enviar
   template para si mesmo
7. Tirar do modo manutenção

### Pós-cutover (primeiros 7 dias)

- [ ] Monitorar CloudWatch Logs por erros de assinatura HMAC (webhook)
- [ ] Comparar contagens de mensagens diárias com baseline Railway
- [ ] Smoke de campanha pequena (5–10 contatos) para validar fila
- [ ] Manter Railway de pé como **rollback hot standby** por 7 dias
- [ ] Desligar Railway após semana sem incidentes

### Rollback plan

- DNS revert (já com TTL baixo desde pre-cutover)
- Webhook URL revert na Meta
- Aceitar perda de inserts ocorridos durante janela AWS (idealmente
  exportados via WAL no `wal_level=logical` antes do desligamento)

---

## 12. Observabilidade, segurança e compliance

### Logs

| Origem | Destino | Retenção |
|---|---|---|
| ECS tasks (api/worker) | CloudWatch Logs `/sni-conecta/crm/{service}` | 30 dias |
| RDS slow query log | CloudWatch Logs | 14 dias |
| ALB access log | S3 `sni-conecta-logs/alb/` | 90 dias |
| WAF | CloudWatch + S3 | 90 dias |

### Métricas custom (CloudWatch)

Emitir do API:
- `Campaigns.MessagesSent` (count)
- `Campaigns.MessagesFailed` (count)
- `Meta.ApiLatency` (ms, p50/p95/p99)
- `BullMQ.QueueDepth` (gauge)
- `Webhook.Received` (count, dim=field)
- `Webhook.HmacInvalid` (count) — **alerta crítico**

### Alarmes mínimos

| Alarme | Condição | Severidade |
|---|---|---|
| API 5xx | `ALB.HTTPCode_Target_5XX_Count > 5/5min` | warn → SNS |
| Worker stuck | `BullMQ.QueueDepth > 1000 por 10min` | crit → PagerDuty |
| HMAC inválido | `Webhook.HmacInvalid > 0` | crit → security@ |
| RDS CPU | `> 80% por 15min` | warn |
| RDS storage | `< 20% livre` | crit |
| Redis evictions | `> 0` | warn |

### Segurança

- **VPC**: subnets privadas para ECS, RDS e Redis; públicas só pro ALB
- **Security Groups**:
  - API → RDS:5432, Redis:6379
  - Worker → RDS:5432, Redis:6379, Internet:443 (Meta API)
  - ALB → API:3000
  - Internet → ALB:443
- **IAM**: roles por service, princípio do mínimo privilégio
- **WAF rules**:
  - AWS Managed Rules: `CommonRuleSet`, `KnownBadInputsRuleSet`,
    `SQLiRuleSet`
  - Rate-limit `/api/v1/auth/login` (10 req/min/IP)
  - Bloquear países sem operação (opcional)
- **Secrets rotation**: JWT_SECRET anual; META_APP_SECRET sob mudança
  no app Meta; senhas DB via Secrets Manager auto-rotation
- **Backups**: RDS automated backups 7 dias + snapshots manuais antes
  de cada deploy
- **Encryption at rest**: RDS, Redis, S3, EBS — todos com KMS

### LGPD

- **Mapa de dados**: descrito em §3
- **Direito ao esquecimento**: implementar endpoint `DELETE /contacts/:id`
  com cascade real (hoje não tem). Sugestão: soft-delete com TTL de
  30 dias antes do hard-delete por job
- **Portabilidade**: `GET /contacts/:id/export` retornando JSON com
  todas as mensagens e dados
- **Trilha de consentimento**: `opt_in_links` já registra IP/método/
  timestamp — suficiente
- **Retenção** de `audit_logs`: 5 anos (LGPD recomenda)
- **Retenção** de `inbox_messages`: política a definir (sugestão: 2 anos
  para mensagens, indefinido para últimos 90 dias de cada contato ativo)
- **DPO**: incluir contato no rodapé das páginas de opt-in

---

## 13. Estimativa de custos AWS

> Em USD/mês, região `sa-east-1`, preços de referência maio/2026.
> **Não inclui custos de transferência de dados de saída pra Meta** que
> são insignificantes (kilobytes por mensagem).

### Cenário base (operação atual SNI)

Volume estimado: 50k contatos, 500k mensagens/mês, 5 usuários ativos.

| Serviço | Configuração | Custo mensal (USD) |
|---|---|---|
| ECS Fargate api (1 task contínua) | 0.5 vCPU / 1 GB | ~$15 |
| ECS Fargate worker (1 task contínua) | 0.25 vCPU / 0.5 GB | ~$8 |
| RDS Postgres Multi-AZ | `db.t4g.medium` 100GB gp3 | ~$95 |
| ElastiCache Redis | `cache.t4g.micro` | ~$15 |
| ALB | 1 LB + ~5GB tráfego | ~$25 |
| CloudFront | 100GB + 5M requests | ~$10 |
| S3 | <10 GB + requests | ~$1 |
| Route 53 | 1 zona | ~$0.50 |
| Secrets Manager | 8 secrets | ~$3 |
| CloudWatch Logs | 50 GB ingest, 30d retention | ~$25 |
| **Total base** | | **~$200/mês** |

### Cenário com Amplify Hosting

Se preferir Amplify ao invés de S3+CloudFront pro Next.js:

| Item adicional | Custo |
|---|---|
| Amplify build minutes (~100 min/mês) | ~$1 |
| Amplify hosting (5 GB served) | ~$1 |
| **Substitui S3+CloudFront do web** | (mantém pro upload S3) |

### Cenário escala (campanhas grandes)

500k contatos, 5M mensagens/mês:

| Serviço | Mudança | Custo extra |
|---|---|---|
| ECS api | auto-scale 1→3 em horários de pico | +$30 |
| ECS worker | auto-scale 1→5 durante campanhas | +$30 |
| RDS | upgrade pra `db.t4g.large` ou `db.m6g.large` | +$100 |
| **Total escala** | | **~$360/mês** |

### Comparação com Railway

Railway atual (suposição): ~$50–80/mês.

A AWS sai 3–5× mais cara mas entrega:
- Multi-AZ HA
- Auto-scaling real
- Backups automáticos
- Secrets/KMS
- Logs centralizados
- IAM/auditoria
- Compliance (SOC2/ISO27001)

---

## 14. Checklist de cutover

### Pré-requisitos

- [ ] Acesso à conta AWS `sni-conecta-prod`
- [ ] Acesso ao Meta App Dashboard (Business Settings)
- [ ] Acesso ao Railway atual com permissão de export
- [ ] Domínio `sniconecta.org.br` (ou subdomínio CRM) com Route 53 sendo NS

### Infraestrutura

- [ ] VPC com 3 AZs (pub + priv subnets)
- [ ] RDS Postgres Multi-AZ provisionado
- [ ] ElastiCache Redis provisionado
- [ ] Buckets S3 (`uploads`, `logs`)
- [ ] Secrets Manager populado com 11 secrets (§8)
- [ ] ECR repos `crm-api`, `crm-web`
- [ ] Cluster ECS Fargate
- [ ] ALB + target groups + listener rules
- [ ] CloudFront + ACM cert
- [ ] WAF associado
- [ ] CloudWatch dashboards + 6 alarmes

### Aplicação

- [ ] Build da imagem Docker da API (multi-stage, Node 20 slim)
- [ ] Build da imagem Docker do worker (mesma imagem, command diferente)
- [ ] Build do Next.js com `NEXT_PUBLIC_API_URL` apontando pro novo
- [ ] Task definitions ECS publicadas
- [ ] Services ECS rodando (1 task cada)
- [ ] Health check `/api/v1/health` verde

### Dados

- [ ] Dump Railway feito
- [ ] Restore RDS feito
- [ ] Migrations Prisma aplicadas
- [ ] Counts validados (±1%)
- [ ] AccessTokens recriptografados (se trocou `ENCRYPTION_KEY`)

### DNS + integrações externas

- [ ] Registros Route 53 criados (CNAME `crm.` e `api-crm.`)
- [ ] Webhook URL Meta atualizada
- [ ] Webhook validation token Meta atualizado (se trocou)
- [ ] Teste de webhook do Dashboard Meta com payload de exemplo

### Validação funcional

- [ ] Login admin funciona
- [ ] Lista de contatos carrega
- [ ] Inbox carrega conversas existentes
- [ ] Envio de template para teste
- [ ] Webhook de status retorna read e atualiza UI
- [ ] Criar campanha de 5 contatos e disparar
- [ ] Importar CSV de 10 linhas
- [ ] Página pública `/opt-in/{code}` submete

### Pós-cutover

- [ ] Comunicar usuários (e-mail interno SNI)
- [ ] Manter Railway em standby 7 dias
- [ ] Diff diário de contadores (mensagens enviadas, recebidas) AWS×Railway
- [ ] Após 7 dias estáveis: desligar Railway

---

## Apêndice A — Endpoints REST

Base URL: `/api/v1`

### Auth

| Verbo | Path | Auth | Descrição |
|---|---|---|---|
| POST | `/auth/login` | público | retorna `{ token, user }` |
| GET | `/auth/me` | JWT | usuário atual + permissões |

### Contatos

| Verbo | Path | Permission |
|---|---|---|
| GET | `/contacts` | CONTACTS:VIEW |
| POST | `/contacts` | CONTACTS:CREATE |
| GET | `/contacts/:id` | CONTACTS:VIEW |
| PATCH | `/contacts/:id` | CONTACTS:EDIT |
| DELETE | `/contacts/:id` | CONTACTS:DELETE |
| GET | `/contacts/:id/messages` | INBOX:VIEW |
| POST | `/contacts/:id/messages` | INBOX:SEND |
| POST | `/contacts/:id/opt-in` | CONTACTS:EDIT |
| POST | `/contacts/:id/opt-out` | CONTACTS:EDIT |
| POST | `/contacts/:id/merge/:targetId` | CONTACTS:DELETE |
| GET | `/contacts/export` | CONTACTS:EXPORT |

### Tags

| Verbo | Path | Permission |
|---|---|---|
| GET/POST/PATCH/DELETE | `/tags*` | TAGS:* |

### Inbox

| Verbo | Path | Permission |
|---|---|---|
| GET | `/inbox/conversations` | INBOX:VIEW |

### Templates

| Verbo | Path | Permission |
|---|---|---|
| GET | `/templates` | SETTINGS_TEMPLATES:VIEW |
| POST | `/templates` | SETTINGS_TEMPLATES:CREATE |
| GET/PATCH/DELETE | `/templates/:id` | SETTINGS_TEMPLATES:* |
| POST | `/templates/sync` | SETTINGS_TEMPLATES:EDIT |
| POST | `/templates/:id/resync` | SETTINGS_TEMPLATES:EDIT |

### Campanhas

| Verbo | Path | Permission |
|---|---|---|
| GET | `/campaigns` | CAMPAIGNS:VIEW |
| POST | `/campaigns` | CAMPAIGNS:CREATE |
| GET/PATCH/DELETE | `/campaigns/:id` | CAMPAIGNS:* |
| GET | `/campaigns/:id/recipients` | CAMPAIGNS:VIEW |
| POST | `/campaigns/:id/{start,pause,resume,cancel}` | CAMPAIGNS:SEND |

### Imports

| Verbo | Path | Permission |
|---|---|---|
| GET | `/imports` | IMPORTS:VIEW |
| POST | `/imports` | IMPORTS:CREATE |
| GET | `/imports/:id` | IMPORTS:VIEW |

### WhatsApp Numbers

| Verbo | Path | Permission |
|---|---|---|
| GET/POST/PATCH/DELETE | `/whatsapp-numbers*` | SETTINGS_NUMBERS:* |

### Automations

| Verbo | Path | Permission |
|---|---|---|
| GET/POST/PATCH/DELETE | `/automations*` | AUTOMATIONS:* |

### Opt-in Links

| Verbo | Path | Auth |
|---|---|---|
| GET/POST/PATCH/DELETE | `/opt-in-links*` (admin) | SETTINGS_OPT_IN_LINKS:* |
| GET | `/opt-in-links/public/:code` | público |
| POST | `/opt-in-links/public/:code/submit` | público |

### Meta

| Verbo | Path | Permission |
|---|---|---|
| POST | `/meta/upload` | SETTINGS_TEMPLATES:CREATE |

### Webhooks (Meta)

| Verbo | Path | Auth |
|---|---|---|
| GET | `/webhooks/meta` | público (handshake verify_token) |
| POST | `/webhooks/meta` | público (HMAC validation) |

### Audit Log

| Verbo | Path | Permission |
|---|---|---|
| GET | `/audit-log` | AUDIT_LOG:VIEW |

### Health

| Verbo | Path | Auth |
|---|---|---|
| GET | `/health` | público |

---

## Apêndice B — Schema Prisma resumido

```prisma
// 15 tabelas no esquema
// Ver apps/api/prisma/schema.prisma para definição autoritativa

enum UserRole { ADMIN, OPERATOR }
enum OptInStatus { PENDING, OPTED_IN, OPTED_OUT }
enum OptInMethod { MANUAL, IMPORT, FORM, QR_CODE }
enum NumberStatus { ACTIVE, INACTIVE, SUSPENDED }
enum QualityRating { GREEN, YELLOW, RED, UNKNOWN }
enum TemplateCategory { MARKETING, UTILITY, AUTHENTICATION }
enum TemplateStatus { PENDING, APPROVED, REJECTED, PAUSED, DISABLED }
enum CampaignStatus { DRAFT, SCHEDULED, RUNNING, PAUSED, COMPLETED, CANCELLED, FAILED }
enum RecipientStatus { PENDING, SENT, DELIVERED, READ, FAILED, OPTED_OUT, SKIPPED }
enum ImportStatus { UPLOADED, PROCESSING, COMPLETED, COMPLETED_WITH_ERRORS, FAILED }
enum MessageDirection { INBOUND, OUTBOUND }
enum MessageType { TEXT, IMAGE, DOCUMENT, AUDIO, VIDEO, STICKER, LOCATION, TEMPLATE, BUTTON, INTERACTIVE }
enum MessageStatus { SENT, DELIVERED, READ, FAILED, RECEIVED, ASSIGNED }
enum TriggerType { OPT_OUT_RECEIVED, TAG_ADDED, CONTACT_CREATED, INBOUND_MESSAGE }
enum ActionType { SEND_TEMPLATE_MESSAGE, ADD_TAG, REMOVE_TAG, CALL_WEBHOOK }

model User { id, name, email[unique], passwordHash, role, active, lastLoginAt, ... }
model Permission { userId, module, action, granted [unique(userId,module,action)] }
model Contact { id, name, phone[unique], email?, notes?, optInStatus, optInMethod?, optInAt?, optInSource?, optInIp?, ... }
model Tag { id, name[unique], color, description? }
model ContactTag { contactId, tagId, assignedAt, assignedBy? [pk(contactId,tagId)] }
model WhatsAppNumber { id, displayName, phoneNumber[unique], phoneNumberId[unique], wabaId, accessToken, webhookVerifyToken, qualityRating, messagingLimit, status, isDefault, ... }
model Template { id, name, language, category, status, components(Json), variables(String[]), externalId?, rejectionReason?, whatsAppNumberId, ... }
model Campaign { id, name, whatsAppNumberId, templateId, templateVariables(Json), tagIds(String[]), counters(Int), status, scheduledAt?, startedAt?, completedAt?, createdById, ... }
model CampaignRecipient { id, campaignId, contactId, phone, resolvedVariables(Json), status, waMessageId?, sentAt?, deliveredAt?, readAt?, failedAt?, errorCode?, errorMessage?, ... }
model Import { id, fileName, filePath, status, columnMapping(Json), tagColumns(String[]), fixedTags(String[]), counters(Int), errors(Json), processedById, ... }
model InboxMessage { id, direction, contactId, whatsAppNumberId, waMessageId[unique], messageType, content(Json), status, receivedAt, assignedToId?, ... }
model AutomationRule { id, name, description?, triggerType, triggerConditions(Json), actionType, actionConfig(Json), active, executionCount, lastExecutedAt?, ... }
model OptInLink { id, code[unique], description, redirectUrl?, tagsToApply(String[]), active, usageCount, ... }
model AuditLog { id, userId, userEmail, action, entity, entityId?, dataBefore?(Json), dataAfter?(Json), ip?, userAgent?, createdAt }
```

---

## Apêndice C — Permissões

11 módulos × 6 ações disponíveis. Verificação por `PermissionsGuard`
em `apps/api/src/common/guards/permissions.guard.ts`.

```ts
PermissionModule = CONTACTS | TAGS | CAMPAIGNS | IMPORTS | INBOX
                 | ANALYTICS | AUTOMATIONS | SETTINGS_NUMBERS
                 | SETTINGS_TEMPLATES | SETTINGS_OPT_IN_LINKS | AUDIT_LOG

PermissionAction = VIEW | CREATE | EDIT | DELETE | EXPORT | SEND
```

Usuários `role=ADMIN` recebem todas as permissões implicitamente.
Usuários `role=OPERATOR` ganham permissões via `permissions` table.

---

## Anexos úteis

- Schema autoritativo: [`apps/api/prisma/schema.prisma`](../apps/api/prisma/schema.prisma)
- Endpoints autoritativos: módulos em [`apps/api/src/modules/`](../apps/api/src/modules/)
- Webhook Meta: [`apps/api/src/modules/webhooks/webhooks.service.ts`](../apps/api/src/modules/webhooks/webhooks.service.ts)
- MetaService (única integração externa do business): [`apps/api/src/modules/meta/meta.service.ts`](../apps/api/src/modules/meta/meta.service.ts)
- Worker BullMQ: [`apps/api/src/modules/campaigns/dispatcher.processor.ts`](../apps/api/src/modules/campaigns/dispatcher.processor.ts)

---

**Pontos abertos pra discussão com o time SNI Conecta**:

1. SSO: Cognito, SAML interno, ou JWT compartilhado?
2. Subdomínio: `crm.sniconecta.org.br` ou path `/comunicacao/` dentro do
   domínio principal?
3. Banco compartilhado ou banco separado para o CRM?
4. Multi-tenancy: o SNI tem regionais (UNESPs, igrejas locais)?
   Precisa isolamento por organização? Hoje o CRM é single-tenant.
5. Política de retenção de mensagens (LGPD)?
6. Plano de DR (Disaster Recovery) — RTO/RPO esperados?

Quando esses pontos forem decididos, este documento será atualizado
com as definições e o plano de implantação ganha ETAs concretos.
