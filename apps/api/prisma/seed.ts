import { PrismaClient, UserRole } from '@prisma/client'
import * as bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@seichonoie.org.br'
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'ChangeMe123!'
  const adminName = process.env.ADMIN_NAME ?? 'Administrador'

  console.log(`> Garantindo usuário admin: ${adminEmail}`)

  const passwordHash = await bcrypt.hash(adminPassword, 12)

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: adminName,
      passwordHash,
      role: UserRole.ADMIN,
      active: true,
    },
  })
  console.log(`  OK admin id=${admin.id}`)

  console.log('> Criando automação padrão de opt-out (inativa)')
  const existing = await prisma.automationRule.findFirst({
    where: { name: 'Resposta automática de opt-out' },
  })
  if (!existing) {
    await prisma.automationRule.create({
      data: {
        name: 'Resposta automática de opt-out',
        description:
          'Envia mensagem de confirmação quando o contato pede para sair. Ative após cadastrar e aprovar o template correspondente.',
        triggerType: 'OPT_OUT_RECEIVED',
        actionType: 'SEND_TEMPLATE_MESSAGE',
        actionConfig: {
          templateName: '',
          whatsAppNumberId: '',
          variables: {},
        },
        active: false,
      },
    })
    console.log('  OK automação criada (desativada)')
  } else {
    console.log('  OK automação já existe, ignorando')
  }

  console.log('\nSeed concluído.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
