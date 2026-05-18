# KotodamaCRM 言霊

> **言霊** · *Kotodama* · O espírito e poder da palavra
>
> Sistema de CRM com envio de mensagens via WhatsApp Business API oficial (Meta)
>
> Cliente: **Seicho-No-Ie do Brasil**

## Estrutura

Monorepo gerenciado com **npm workspaces** + **Turborepo**.

```
kotodama-crm/
├── apps/
│   ├── api/      # Backend NestJS + Prisma + BullMQ
│   └── web/      # Frontend Next.js 14 (App Router)
└── packages/
    └── shared/   # Tipos e constantes compartilhados
```

## Stack

| Camada       | Tecnologia |
|--------------|------------|
| Backend      | NestJS 10, TypeScript, Prisma 5, PostgreSQL 16, Redis 7, BullMQ |
| Frontend     | Next.js 14, Tailwind, shadcn/ui, React Query, Zustand |
| Fonte        | Figtree (Google Fonts) |
| Infra        | Railway.app |

## Desenvolvimento

### Pré-requisitos
- Node.js 20+
- PostgreSQL 16
- Redis 7

### Setup

```bash
# Instalar dependências
npm install

# Configurar variáveis de ambiente
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local

# Rodar migrations e seed do admin
npm run db:migrate
npm run db:seed

# Subir tudo em dev
npm run dev
```

## Scripts úteis

| Comando             | Descrição |
|---------------------|-----------|
| `npm run dev`       | Sobe api + web + worker em modo dev |
| `npm run build`     | Build de produção |
| `npm run db:migrate`| Aplica migrations Prisma |
| `npm run db:seed`   | Cria o usuário admin inicial |
| `npm run db:studio` | Abre o Prisma Studio |

## Deploy

Deploy via **Railway.app**. Ver `railway.toml` na raiz. Três serviços compartilham o mesmo repositório:

- `kotodama-api` — servidor HTTP (NestJS)
- `kotodama-web` — frontend Next.js
- `kotodama-worker` — processadores BullMQ

---

*Desenvolvido pela Veranno Comunicação para a SEICHO-NO-IE DO BRASIL.*
