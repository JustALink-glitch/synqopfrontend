import { api } from './api'
import { supabase } from './supabase'
import { showFile, type ViewItem } from '@/components/files/FileViewer'

/** Private bucket the API signs uploads and downloads for. */
export const BUCKET = 'synqop-files'
/** Upload limit (§12 proposal). */
export const MAX_FILE_BYTES = 25 * 1024 * 1024

export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/** "PDF", "Notebook", "SQL" — a short kind from the file name, for file rows. */
export function fileKind(name: string, type?: string | null): string {
  if (type) {
    const byType: [RegExp, string][] = [
      [/pdf/, 'PDF'],
      [/^image\//, 'Image'],
      [/^video\//, 'Video'],
      [/spreadsheet|excel|csv/, 'Spreadsheet'],
      [/presentation|powerpoint/, 'Slides'],
      [/word|document/, 'Document'],
      [/zip/, 'Zip'],
      [/^text\//, 'Text'],
    ]
    const hit = byType.find(([re]) => re.test(type))
    if (hit) return hit[1]
  }
  if (!name.includes('.')) return 'File'
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  const known: Record<string, string> = {
    pdf: 'PDF',
    ipynb: 'Notebook',
    zip: 'Zip',
    doc: 'Word',
    docx: 'Word',
    xls: 'Excel',
    xlsx: 'Excel',
    csv: 'CSV',
    ppt: 'PowerPoint',
    pptx: 'PowerPoint',
    sql: 'SQL',
    py: 'Python',
    txt: 'Text',
    png: 'Image',
    jpg: 'Image',
    jpeg: 'Image',
  }
  return known[ext] ?? (ext ? ext.toUpperCase() : 'File')
}

/**
 * Uploads straight to storage: the API hands out a one-time signed URL for a path it chooses,
 * the browser sends the file there, and the form saves the path. Returns the storage path.
 */
export async function uploadFile(uploadsEndpoint: string, file: File): Promise<string> {
  if (file.size > MAX_FILE_BYTES) throw new Error(`${file.name} is larger than 25 MB.`)
  if (file.size === 0) throw new Error(`${file.name} is empty.`)
  const { upload } = await api<{ upload: { path: string; token: string } }>(uploadsEndpoint, {
    method: 'POST',
    body: { name: file.name, size: file.size, type: file.type || null },
  })
  const { error } = await supabase.storage.from(BUCKET).uploadToSignedUrl(upload.path, upload.token, file, file.type ? { contentType: file.type } : undefined)
  if (error) throw new Error(`${file.name} didn’t upload. Check your connection and try again.`)
  return upload.path
}

/** Asks the API for a short-lived link and starts the download. */
export async function downloadFile(endpoint: string): Promise<void> {
  const { url } = await api<{ url: string }>(endpoint)
  window.location.assign(url)
}

/** What the in-app viewer can show; anything else (Word, Excel, zip…) downloads. SVG and HTML never open inline. */
export function viewKind(name: string, type?: string | null): ViewItem['kind'] | null {
  const t = (type ?? '').toLowerCase()
  const ext = name.includes('.') ? name.split('.').pop()!.toLowerCase() : ''
  if (/^image\/(png|jpe?g|gif|webp|avif)$/.test(t) || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif'].includes(ext)) return 'image'
  if (/^video\/(mp4|webm|quicktime|ogg)$/.test(t) || ['mp4', 'webm', 'mov', 'm4v'].includes(ext)) return 'video'
  if (/^audio\//.test(t) || ['mp3', 'm4a', 'wav', 'ogg', 'aac'].includes(ext)) return 'audio'
  if (t === 'application/pdf' || t === 'text/plain' || ['pdf', 'txt'].includes(ext)) return 'document'
  return null
}

/**
 * Opens a stored file in the in-app viewer when it can be shown (pilot feedback, Nov 2026: resources went straight
 * to download), or downloads it. `endpoint` answers { url }; with ?view=1 the link opens instead of saving.
 */
export async function openFile(endpoint: string, name: string, type?: string | null): Promise<void> {
  const kind = viewKind(name, type)
  if (!kind) return downloadFile(endpoint)
  showFile({
    name,
    kind,
    load: () => api<{ url: string }>(`${endpoint}${endpoint.includes('?') ? '&' : '?'}view=1`).then((r) => r.url),
    download: () => downloadFile(endpoint),
  })
}
