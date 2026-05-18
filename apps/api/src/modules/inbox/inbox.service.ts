import { Injectable } from '@nestjs/common'
import { MessageDirection } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class InboxService {
  constructor(private readonly prisma: PrismaService) {}

  async listConversations(limit = 50) {
    const groups = await this.prisma.inboxMessage.groupBy({
      by: ['contactId'],
      _max: { receivedAt: true },
      orderBy: { _max: { receivedAt: 'desc' } },
      take: limit,
    })
    const contactIds = groups.map((g) => g.contactId)
    if (contactIds.length === 0) return []

    const [contacts, latestMessages, unreadCounts] = await Promise.all([
      this.prisma.contact.findMany({
        where: { id: { in: contactIds } },
        select: { id: true, name: true, phone: true, optInStatus: true },
      }),
      Promise.all(
        contactIds.map((id) =>
          this.prisma.inboxMessage.findFirst({
            where: { contactId: id },
            orderBy: { receivedAt: 'desc' },
            select: {
              id: true,
              direction: true,
              messageType: true,
              content: true,
              receivedAt: true,
              status: true,
            },
          }),
        ),
      ),
      this.prisma.inboxMessage.groupBy({
        by: ['contactId'],
        where: {
          contactId: { in: contactIds },
          direction: MessageDirection.INBOUND,
          isResolved: false,
        },
        _count: { _all: true },
      }),
    ])

    const contactsById = new Map(contacts.map((c) => [c.id, c]))
    const unreadByContact = new Map(
      unreadCounts.map((u) => [u.contactId, u._count._all]),
    )

    return groups
      .map((g, idx) => {
        const contact = contactsById.get(g.contactId)
        if (!contact) return null
        return {
          contact,
          lastMessage: latestMessages[idx],
          unreadCount: unreadByContact.get(g.contactId) ?? 0,
          lastMessageAt: g._max.receivedAt,
        }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
  }
}
