'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Eye,
  FileText,
  Image as ImageIcon,
  Link2,
  Loader2,
  MessageCircle,
  Phone,
  Plus,
  Trash2,
  Video,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useMemo } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { api, apiErrorMessage } from '@/lib/api'

const HeaderType = z.enum(['NONE', 'TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT'])

const buttonSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('QUICK_REPLY'),
    text: z.string().min(1, 'Texto obrigatório').max(25, 'Max 25 chars'),
  }),
  z.object({
    type: z.literal('URL'),
    text: z.string().min(1).max(25),
    url: z.string().url('URL inválida'),
    example: z.string().optional(),
  }),
  z.object({
    type: z.literal('PHONE_NUMBER'),
    text: z.string().min(1).max(25),
    phone: z.string().min(5, 'Telefone obrigatório'),
  }),
  z.object({
    type: z.literal('COPY_CODE'),
    example: z.string().min(1, 'Exemplo de código obrigatório'),
  }),
])

const schema = z.object({
  whatsAppNumberId: z.string().min(1, 'Selecione o número'),
  name: z
    .string()
    .min(2, 'Mínimo 2 caracteres')
    .regex(/^[a-z0-9_]+$/, 'Apenas a-z, 0-9 e _'),
  category: z.enum(['MARKETING', 'UTILITY', 'AUTHENTICATION']),
  language: z.string().default('pt_BR'),
  headerType: HeaderType.default('NONE'),
  headerText: z.string().max(60, 'Max 60 chars').optional(),
  headerExample: z.string().optional(),
  headerMediaHandle: z.string().optional(),
  bodyText: z.string().min(1, 'Corpo obrigatório').max(1024, 'Max 1024 chars'),
  bodyExamples: z.array(z.string()).optional(),
  footerText: z.string().max(60, 'Max 60 chars').optional(),
  buttons: z.array(buttonSchema).max(10, 'Máximo 10 botões').optional(),
})

export type TemplateFormValues = z.infer<typeof schema>

interface NumberOpt {
  id: string
  displayName: string
  phoneNumber: string
}

interface TemplateFormProps {
  templateId?: string
  initial?: Partial<TemplateFormValues>
}

function extractVarsFromText(text: string): string[] {
  const set = new Set<string>()
  const re = /\{\{\s*(\d+)\s*\}\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) set.add(m[1])
  return Array.from(set).sort((a, b) => Number(a) - Number(b))
}

function substituteVars(text: string, examples: string[]): string {
  return text.replace(/\{\{\s*(\d+)\s*\}\}/g, (_, n) => {
    const idx = Number(n) - 1
    const ex = examples[idx]
    return ex && ex.trim() ? ex : `{{${n}}}`
  })
}

function buildComponents(data: TemplateFormValues): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = []

  if (data.headerType === 'TEXT' && data.headerText?.trim()) {
    const headerVars = extractVarsFromText(data.headerText)
    const comp: Record<string, unknown> = {
      type: 'HEADER',
      format: 'TEXT',
      text: data.headerText,
    }
    if (headerVars.length > 0 && data.headerExample?.trim()) {
      comp.example = { header_text: [data.headerExample] }
    }
    out.push(comp)
  } else if (
    (data.headerType === 'IMAGE' ||
      data.headerType === 'VIDEO' ||
      data.headerType === 'DOCUMENT') &&
    data.headerMediaHandle?.trim()
  ) {
    out.push({
      type: 'HEADER',
      format: data.headerType,
      example: { header_handle: [data.headerMediaHandle] },
    })
  }

  const bodyVars = extractVarsFromText(data.bodyText)
  const bodyComp: Record<string, unknown> = {
    type: 'BODY',
    text: data.bodyText,
  }
  if (bodyVars.length > 0) {
    const examples = (data.bodyExamples ?? []).slice(0, bodyVars.length)
    const filled = bodyVars.map((_, i) => examples[i] ?? '')
    if (filled.every((v) => v.trim())) {
      bodyComp.example = { body_text: [filled] }
    }
  }
  out.push(bodyComp)

  if (data.footerText?.trim()) {
    out.push({ type: 'FOOTER', text: data.footerText })
  }

  if (data.buttons && data.buttons.length > 0) {
    const buttons = data.buttons.map((b) => {
      if (b.type === 'QUICK_REPLY') {
        return { type: 'QUICK_REPLY', text: b.text }
      }
      if (b.type === 'URL') {
        const urlVars = extractVarsFromText(b.url)
        const out: Record<string, unknown> = {
          type: 'URL',
          text: b.text,
          url: b.url,
        }
        if (urlVars.length > 0 && b.example?.trim()) {
          out.example = [b.example]
        }
        return out
      }
      if (b.type === 'PHONE_NUMBER') {
        return { type: 'PHONE_NUMBER', text: b.text, phone_number: b.phone }
      }
      return { type: 'COPY_CODE', example: b.example }
    })
    out.push({ type: 'BUTTONS', buttons })
  }

  return out
}

export function TemplateForm({ templateId, initial }: TemplateFormProps) {
  const router = useRouter()
  const qc = useQueryClient()
  const isEdit = Boolean(templateId)

  const numbersQuery = useQuery({
    queryKey: ['whatsapp-numbers'],
    queryFn: async () =>
      (await api.get<NumberOpt[]>('/whatsapp-numbers')).data,
  })

  const form = useForm<TemplateFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      whatsAppNumberId: initial?.whatsAppNumberId ?? '',
      name: initial?.name ?? '',
      category: initial?.category ?? 'UTILITY',
      language: initial?.language ?? 'pt_BR',
      headerType: initial?.headerType ?? 'NONE',
      headerText: initial?.headerText ?? '',
      headerExample: initial?.headerExample ?? '',
      headerMediaHandle: initial?.headerMediaHandle ?? '',
      bodyText: initial?.bodyText ?? '',
      bodyExamples: initial?.bodyExamples ?? [],
      footerText: initial?.footerText ?? '',
      buttons: initial?.buttons ?? [],
    },
  })

  const buttons = useFieldArray({ control: form.control, name: 'buttons' })

  const headerType = form.watch('headerType')
  const headerText = form.watch('headerText') ?? ''
  const headerExample = form.watch('headerExample') ?? ''
  const bodyText = form.watch('bodyText') ?? ''
  const bodyExamples = form.watch('bodyExamples') ?? []
  const footerText = form.watch('footerText') ?? ''
  const watchedButtons = form.watch('buttons') ?? []

  const headerVars = useMemo(() => extractVarsFromText(headerText), [headerText])
  const bodyVars = useMemo(() => extractVarsFromText(bodyText), [bodyText])

  const save = useMutation({
    mutationFn: async (data: TemplateFormValues) => {
      const components = buildComponents(data)
      if (isEdit && templateId) {
        return (
          await api.put(`/templates/${templateId}`, {
            category: data.category,
            components,
          })
        ).data
      }
      return (
        await api.post('/templates', {
          whatsAppNumberId: data.whatsAppNumberId,
          name: data.name,
          category: data.category,
          language: data.language,
          components,
        })
      ).data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['templates'] })
      toast.success(
        isEdit
          ? 'Template atualizado'
          : 'Template cadastrado — envie à Meta para aprovação',
      )
      router.push('/settings/templates')
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  })

  const bodyPreview = useMemo(
    () => substituteVars(bodyText, bodyExamples),
    [bodyText, bodyExamples],
  )
  const headerPreview = useMemo(
    () => substituteVars(headerText, [headerExample]),
    [headerText, headerExample],
  )

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <form
        onSubmit={form.handleSubmit((d) => save.mutate(d))}
        className="space-y-6 lg:col-span-2"
      >
        {/* Identificação */}
        <div className="card p-6">
          <h2 className="mb-4 text-base font-semibold text-ink">Identificação</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">Número *</label>
              <select
                className="input"
                disabled={isEdit}
                {...form.register('whatsAppNumberId')}
              >
                <option value="">Selecione...</option>
                {(numbersQuery.data ?? []).map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.displayName}
                  </option>
                ))}
              </select>
              {form.formState.errors.whatsAppNumberId && (
                <p className="mt-1 text-xs text-danger">
                  {form.formState.errors.whatsAppNumberId.message}
                </p>
              )}
            </div>
            <div>
              <label className="label">Nome (snake_case) *</label>
              <input
                className="input font-mono"
                placeholder="comunicado_eventos"
                disabled={isEdit}
                {...form.register('name')}
              />
              {form.formState.errors.name && (
                <p className="mt-1 text-xs text-danger">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>
            <div>
              <label className="label">Categoria *</label>
              <select className="input" {...form.register('category')}>
                <option value="UTILITY">Utilitário</option>
                <option value="MARKETING">Marketing</option>
                <option value="AUTHENTICATION">Autenticação</option>
              </select>
            </div>
            <div>
              <label className="label">Idioma</label>
              <select className="input" {...form.register('language')}>
                <option value="pt_BR">Português (Brasil)</option>
                <option value="en_US">Inglês (EUA)</option>
                <option value="es">Espanhol</option>
              </select>
            </div>
          </div>
        </div>

        {/* Header */}
        <div className="card p-6">
          <h2 className="mb-1 text-base font-semibold text-ink">Cabeçalho</h2>
          <p className="mb-4 text-xs text-muted-foreground">
            Opcional. Pode ser texto, imagem, vídeo ou PDF (apenas um por template).
          </p>

          <div className="mb-4 flex flex-wrap gap-2">
            {(['NONE', 'TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT'] as const).map((t) => (
              <button
                key={t}
                type="button"
                className={`btn-ghost text-sm ${
                  headerType === t ? 'border-primary bg-primary/10 text-primary' : ''
                }`}
                onClick={() => form.setValue('headerType', t)}
              >
                {t === 'NONE' && 'Nenhum'}
                {t === 'TEXT' && (
                  <>
                    <MessageCircle className="h-3.5 w-3.5" /> Texto
                  </>
                )}
                {t === 'IMAGE' && (
                  <>
                    <ImageIcon className="h-3.5 w-3.5" /> Imagem
                  </>
                )}
                {t === 'VIDEO' && (
                  <>
                    <Video className="h-3.5 w-3.5" /> Vídeo
                  </>
                )}
                {t === 'DOCUMENT' && (
                  <>
                    <FileText className="h-3.5 w-3.5" /> PDF
                  </>
                )}
              </button>
            ))}
          </div>

          {headerType === 'TEXT' && (
            <div className="space-y-3">
              <div>
                <label className="label">Texto do cabeçalho</label>
                <input
                  className="input"
                  maxLength={60}
                  placeholder="Ex.: Olá {{1}}, novidade!"
                  {...form.register('headerText')}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Máx 60 chars. Pode ter no máximo 1 variável <code>&#123;&#123;1&#125;&#125;</code>.
                </p>
              </div>
              {headerVars.length > 0 && (
                <div>
                  <label className="label">Exemplo para <code>&#123;&#123;1&#125;&#125;</code></label>
                  <input
                    className="input"
                    placeholder="Ex.: Maria"
                    {...form.register('headerExample')}
                  />
                </div>
              )}
            </div>
          )}

          {(headerType === 'IMAGE' ||
            headerType === 'VIDEO' ||
            headerType === 'DOCUMENT') && (
            <div className="space-y-2">
              <label className="label">Media handle (upload via Meta)</label>
              <input
                className="input font-mono text-xs"
                placeholder="4::aW1hZ2UvanBlZw==:..."
                {...form.register('headerMediaHandle')}
              />
              <p className="text-xs text-muted-foreground">
                Por enquanto cole aqui o handle retornado pelo resumable upload da
                Meta. O upload direto pela UI entra em um próximo slice.
              </p>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="card p-6">
          <h2 className="mb-1 text-base font-semibold text-ink">Corpo *</h2>
          <p className="mb-4 text-xs text-muted-foreground">
            Texto principal — aceita emojis 😊 e variáveis <code>&#123;&#123;1&#125;&#125;</code>,
            <code> &#123;&#123;2&#125;&#125;</code>, etc.
          </p>
          <textarea
            className="input min-h-[160px] resize-y"
            maxLength={1024}
            placeholder="Olá {{1}}! O evento {{2}} acontece em {{3}}. Esperamos você 💛"
            {...form.register('bodyText')}
          />
          {form.formState.errors.bodyText && (
            <p className="mt-1 text-xs text-danger">
              {form.formState.errors.bodyText.message}
            </p>
          )}

          {bodyVars.length > 0 && (
            <div className="mt-4 rounded-md border border-border bg-bg/40 p-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Valores de exemplo (obrigatórios pra Meta aprovar):
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {bodyVars.map((v, idx) => (
                  <div key={v}>
                    <label className="label">
                      <code>&#123;&#123;{v}&#125;&#125;</code>
                    </label>
                    <input
                      className="input"
                      placeholder={`Exemplo para ${v}`}
                      {...form.register(`bodyExamples.${idx}` as const)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="card p-6">
          <h2 className="mb-1 text-base font-semibold text-ink">Rodapé</h2>
          <p className="mb-4 text-xs text-muted-foreground">
            Opcional. Texto plano (sem variáveis), max 60 chars.
          </p>
          <input
            className="input"
            maxLength={60}
            placeholder="Ex.: Responda PARE para não receber mais"
            {...form.register('footerText')}
          />
        </div>

        {/* Buttons */}
        <div className="card p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-ink">Botões</h2>
              <p className="text-xs text-muted-foreground">
                Até 10 botões. Combinações têm regras (ex: até 3 quick-reply).
              </p>
            </div>
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                className="btn-ghost text-xs"
                onClick={() =>
                  buttons.append({ type: 'QUICK_REPLY', text: '' })
                }
                disabled={watchedButtons.length >= 10}
              >
                <Plus className="h-3 w-3" /> Resposta rápida
              </button>
              <button
                type="button"
                className="btn-ghost text-xs"
                onClick={() =>
                  buttons.append({
                    type: 'URL',
                    text: '',
                    url: '',
                    example: '',
                  })
                }
                disabled={watchedButtons.length >= 10}
              >
                <Link2 className="h-3 w-3" /> Link
              </button>
              <button
                type="button"
                className="btn-ghost text-xs"
                onClick={() =>
                  buttons.append({ type: 'PHONE_NUMBER', text: '', phone: '' })
                }
                disabled={watchedButtons.length >= 10}
              >
                <Phone className="h-3 w-3" /> Telefone
              </button>
              <button
                type="button"
                className="btn-ghost text-xs"
                onClick={() => buttons.append({ type: 'COPY_CODE', example: '' })}
                disabled={watchedButtons.length >= 10}
              >
                <Plus className="h-3 w-3" /> Copiar código
              </button>
            </div>
          </div>

          {buttons.fields.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum botão adicionado.</p>
          ) : (
            <div className="space-y-3">
              {buttons.fields.map((field, idx) => {
                const t = watchedButtons[idx]?.type ?? 'QUICK_REPLY'
                return (
                  <div
                    key={field.id}
                    className="rounded-md border border-border bg-bg/40 p-3"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">
                        {idx + 1}.{' '}
                        {t === 'QUICK_REPLY' && 'Resposta rápida'}
                        {t === 'URL' && 'Link'}
                        {t === 'PHONE_NUMBER' && 'Telefone'}
                        {t === 'COPY_CODE' && 'Copiar código'}
                      </span>
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-danger"
                        onClick={() => buttons.remove(idx)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {t === 'QUICK_REPLY' && (
                      <input
                        className="input"
                        maxLength={25}
                        placeholder="Texto do botão (max 25)"
                        {...form.register(`buttons.${idx}.text` as const)}
                      />
                    )}
                    {t === 'URL' && (
                      <div className="space-y-2">
                        <input
                          className="input"
                          maxLength={25}
                          placeholder="Texto do botão"
                          {...form.register(`buttons.${idx}.text` as const)}
                        />
                        <input
                          className="input font-mono text-xs"
                          placeholder="https://exemplo.com/{{1}}"
                          {...form.register(`buttons.${idx}.url` as const)}
                        />
                        <input
                          className="input"
                          placeholder="Exemplo p/ {{1}} se a URL for dinâmica"
                          {...form.register(`buttons.${idx}.example` as const)}
                        />
                      </div>
                    )}
                    {t === 'PHONE_NUMBER' && (
                      <div className="space-y-2">
                        <input
                          className="input"
                          maxLength={25}
                          placeholder="Texto do botão"
                          {...form.register(`buttons.${idx}.text` as const)}
                        />
                        <input
                          className="input font-mono"
                          placeholder="+551199999999"
                          {...form.register(`buttons.${idx}.phone` as const)}
                        />
                      </div>
                    )}
                    {t === 'COPY_CODE' && (
                      <input
                        className="input font-mono"
                        placeholder="Ex: PROMO10"
                        {...form.register(`buttons.${idx}.example` as const)}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="btn-ghost"
            onClick={() => router.back()}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={save.isPending}
          >
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? 'Salvar alterações' : 'Cadastrar template'}
          </button>
        </div>
      </form>

      {/* Preview */}
      <aside className="lg:col-span-1">
        <div className="card sticky top-6 p-5">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Eye className="h-3.5 w-3.5" />
            Preview WhatsApp
          </div>
          <div className="rounded-lg bg-[#E5DDD5] p-3">
            <div className="ml-auto max-w-[280px] overflow-hidden rounded-lg bg-[#DCF8C6] shadow-sm">
              {/* Header media */}
              {headerType === 'IMAGE' && (
                <div className="flex aspect-video items-center justify-center bg-black/10 text-xs text-muted-foreground">
                  <ImageIcon className="mr-1 h-4 w-4" /> Imagem do cabeçalho
                </div>
              )}
              {headerType === 'VIDEO' && (
                <div className="flex aspect-video items-center justify-center bg-black/20 text-xs text-white/70">
                  <Video className="mr-1 h-4 w-4" /> Vídeo
                </div>
              )}
              {headerType === 'DOCUMENT' && (
                <div className="flex items-center gap-2 bg-black/5 p-2 text-xs">
                  <FileText className="h-4 w-4" />
                  <span className="truncate">documento.pdf</span>
                </div>
              )}

              <div className="p-3">
                {headerType === 'TEXT' && headerPreview && (
                  <div className="mb-1 text-sm font-bold text-ink">
                    {headerPreview}
                  </div>
                )}
                <div className="whitespace-pre-wrap text-sm text-ink">
                  {bodyPreview || (
                    <span className="text-muted-foreground">
                      O corpo da mensagem aparecerá aqui…
                    </span>
                  )}
                </div>
                {footerText && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    {footerText}
                  </div>
                )}
              </div>

              {watchedButtons.length > 0 && (
                <div className="border-t border-black/10 bg-white/50">
                  {watchedButtons.map((b, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-center gap-1 border-b border-black/5 px-3 py-2 text-xs font-medium text-[#1B4FA8] last:border-0"
                    >
                      {b.type === 'URL' && <Link2 className="h-3 w-3" />}
                      {b.type === 'PHONE_NUMBER' && <Phone className="h-3 w-3" />}
                      {b.type === 'COPY_CODE' ? (
                        <span>📋 Copiar código</span>
                      ) : (
                        <span>{b.text || '...'}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>
    </div>
  )
}
