'use client'

import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowLeft, FileUp, Loader2, Upload } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'
import { PageHeader } from '@/components/layout/page-header'
import { api, apiErrorMessage } from '@/lib/api'

interface TagOpt {
  id: string
  name: string
}

interface PreviewState {
  file: File
  headers: string[]
  rows: Record<string, unknown>[]
}

type FieldKey = 'name' | 'phone' | 'email' | 'notes'
const FIELD_LABEL: Record<FieldKey, string> = {
  name: 'Nome',
  phone: 'Telefone (obrigatório)',
  email: 'E-mail',
  notes: 'Notas',
}

export default function NewImportPage() {
  const router = useRouter()
  const [preview, setPreview] = useState<PreviewState | null>(null)
  const [mapping, setMapping] = useState<Partial<Record<FieldKey, string>>>({})
  const [tagColumns, setTagColumns] = useState<string[]>([])
  const [fixedTags, setFixedTags] = useState<string[]>([])
  const [treatAsOptedIn, setTreatAsOptedIn] = useState(false)

  const tagsQuery = useQuery({
    queryKey: ['tags'],
    queryFn: async () => (await api.get<TagOpt[]>('/tags')).data,
  })

  const handleFile = async (file: File) => {
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: '',
        raw: false,
      })
      const headers = rows.length > 0 ? Object.keys(rows[0]) : []
      setPreview({ file, headers, rows: rows.slice(0, 5) })

      // auto-mapping heurístico
      const guess: Partial<Record<FieldKey, string>> = {}
      for (const h of headers) {
        const low = h.toLowerCase().trim()
        if (!guess.name && /^(nome|name|contato|contact)$/.test(low)) guess.name = h
        if (!guess.phone && /(telefone|celular|whatsapp|phone|fone|numero|número)/.test(low))
          guess.phone = h
        if (!guess.email && /(email|e-mail|mail)/.test(low)) guess.email = h
        if (!guess.notes && /(nota|notes|obs|observa)/.test(low)) guess.notes = h
      }
      setMapping(guess)
    } catch (err) {
      toast.error(`Falha ao ler arquivo: ${err instanceof Error ? err.message : err}`)
    }
  }

  const upload = useMutation({
    mutationFn: async () => {
      if (!preview) throw new Error('Sem arquivo')
      if (!mapping.phone) throw new Error('Mapeie a coluna de telefone')
      const fd = new FormData()
      fd.append('file', preview.file)
      fd.append('columnMapping', JSON.stringify(mapping))
      fd.append('tagColumns', JSON.stringify(tagColumns))
      fd.append('fixedTags', JSON.stringify(fixedTags))
      fd.append('treatAsOptedIn', String(treatAsOptedIn))
      const res = await api.post('/imports', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120_000,
      })
      return res.data as { id: string; successRows: number; errorRows: number }
    },
    onSuccess: (data) => {
      toast.success(
        `Importação concluída: ${data.successRows} ok, ${data.errorRows} erros`,
      )
      router.push('/imports')
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  })

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Nova importação"
        description="Carregue um CSV ou Excel com contatos para importar em massa."
        actions={
          <Link href="/imports" className="btn-ghost text-sm">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>
        }
      />

      {!preview && (
        <div className="card flex flex-col items-center gap-3 p-10 text-center">
          <FileUp className="h-10 w-10 text-muted-foreground" />
          <h3 className="text-lg font-medium text-ink">Selecione o arquivo</h3>
          <p className="text-xs text-muted-foreground">
            Aceita CSV, XLSX ou XLS. Máx. 10 MB / 50.000 linhas.
          </p>
          <label className="btn-primary cursor-pointer">
            <input
              type="file"
              className="hidden"
              accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void handleFile(f)
              }}
            />
            <Upload className="h-4 w-4" />
            Escolher arquivo
          </label>
        </div>
      )}

      {preview && (
        <div className="space-y-4">
          <div className="card p-4">
            <div className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">
              Arquivo
            </div>
            <div className="font-medium text-ink">{preview.file.name}</div>
            <div className="text-xs text-muted-foreground">
              {(preview.file.size / 1024).toFixed(1)} KB ·{' '}
              {preview.headers.length} coluna(s)
            </div>
            <button
              type="button"
              className="btn-ghost mt-2 text-xs"
              onClick={() => {
                setPreview(null)
                setMapping({})
                setTagColumns([])
              }}
            >
              Trocar arquivo
            </button>
          </div>

          <div className="card p-4">
            <h3 className="mb-3 font-medium text-ink">Mapeamento</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {(Object.keys(FIELD_LABEL) as FieldKey[]).map((field) => (
                <div key={field}>
                  <label className="label">{FIELD_LABEL[field]}</label>
                  <select
                    className="input text-sm"
                    value={mapping[field] ?? ''}
                    onChange={(e) =>
                      setMapping((m) => ({
                        ...m,
                        [field]: e.target.value || undefined,
                      }))
                    }
                  >
                    <option value="">— ignorar —</option>
                    {preview.headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-4">
            <h3 className="mb-1 font-medium text-ink">Tags</h3>
            <p className="mb-3 text-xs text-muted-foreground">
              Aplicadas a TODOS os contatos importados.
            </p>
            <div className="flex flex-wrap gap-2">
              {(tagsQuery.data ?? []).map((t) => {
                const checked = fixedTags.includes(t.id)
                return (
                  <button
                    type="button"
                    key={t.id}
                    className={`badge cursor-pointer ${
                      checked ? 'ring-2 ring-primary' : 'bg-bg text-muted-foreground'
                    }`}
                    onClick={() =>
                      setFixedTags((curr) =>
                        curr.includes(t.id)
                          ? curr.filter((x) => x !== t.id)
                          : [...curr, t.id],
                      )
                    }
                  >
                    {t.name}
                  </button>
                )
              })}
              {(tagsQuery.data ?? []).length === 0 && (
                <span className="text-xs text-muted-foreground">
                  Cadastre tags em Configurações → Tags
                </span>
              )}
            </div>
          </div>

          <div className="card p-4">
            <h3 className="mb-1 font-medium text-ink">Colunas dinâmicas de tags</h3>
            <p className="mb-3 text-xs text-muted-foreground">
              Selecione colunas cujo conteúdo (não vazio) será adicionado como
              tag — uma tag por valor distinto. Útil pra categorias variáveis.
            </p>
            <div className="grid gap-1 sm:grid-cols-2">
              {preview.headers.map((h) => {
                const checked = tagColumns.includes(h)
                return (
                  <label
                    key={h}
                    className="flex items-center gap-2 rounded p-1 hover:bg-bg/40"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setTagColumns((c) =>
                          c.includes(h) ? c.filter((x) => x !== h) : [...c, h],
                        )
                      }
                    />
                    <span className="text-sm">{h}</span>
                  </label>
                )
              })}
            </div>
          </div>

          <div className="card p-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={treatAsOptedIn}
                onChange={(e) => setTreatAsOptedIn(e.target.checked)}
              />
              <span>
                Tratar como <strong>OPTED_IN</strong> — só marque se você tem o
                consentimento explícito dos contatos.
              </span>
            </label>
          </div>

          {preview.rows.length > 0 && (
            <div className="card overflow-x-auto p-0">
              <div className="border-b border-border px-4 py-2 text-xs uppercase tracking-wider text-muted-foreground">
                Pré-visualização (5 primeiras linhas)
              </div>
              <table className="w-full text-xs">
                <thead className="bg-bg/40">
                  <tr>
                    {preview.headers.map((h) => (
                      <th
                        key={h}
                        className="border-r border-border px-3 py-2 text-left font-medium"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((r, i) => (
                    <tr key={i} className="border-t border-border">
                      {preview.headers.map((h) => (
                        <td
                          key={h}
                          className="border-r border-border px-3 py-2 font-mono"
                        >
                          {String(r[h] ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Link href="/imports" className="btn-ghost">
              Cancelar
            </Link>
            <button
              type="button"
              className="btn-primary"
              disabled={upload.isPending || !mapping.phone}
              onClick={() => upload.mutate()}
            >
              {upload.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              Importar contatos
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
