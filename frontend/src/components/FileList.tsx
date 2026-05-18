import { useState, useEffect, type ReactNode } from 'react'
import { fileApi, FileInfo } from '../lib/api'
import { Bucket } from '../lib/api'

interface FileListProps {
  bucket: Bucket | null
}

interface ActionButtonProps {
  title: string
  ariaLabel: string
  onClick?: () => void
  disabled?: boolean
  children: ReactNode
  variant?: 'primary' | 'neutral'
}

function ActionButton({
  title,
  ariaLabel,
  onClick,
  disabled = false,
  children,
  variant = 'neutral',
}: ActionButtonProps) {
  const baseClasses =
    'inline-flex items-center justify-center h-9 w-9 rounded-lg border transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50'
  const variantClasses =
    variant === 'primary'
      ? 'border-primary-200 bg-primary-50 text-primary-700 hover:bg-primary-100 focus:ring-primary-500'
      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-100 hover:text-gray-800 focus:ring-gray-400'

  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={ariaLabel}
      disabled={disabled}
      className={`${baseClasses} ${variantClasses}`}
    >
      {children}
    </button>
  )
}

export default function FileList({ bucket }: FileListProps) {
  const [files, setFiles] = useState<FileInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [nextToken, setNextToken] = useState<string | undefined>(undefined)
  const [pageTokens, setPageTokens] = useState<Record<number, string | undefined>>({ 1: undefined })
  const [searchText, setSearchText] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [downloading, setDownloading] = useState(false)
  const [readingTranscription, setReadingTranscription] = useState<string | null>(null)
  const [transcriptionContent, setTranscriptionContent] = useState<any>(null)
  const [showTranscriptionModal, setShowTranscriptionModal] = useState(false)
  const [showAudioModal, setShowAudioModal] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [audioPlayingLabel, setAudioPlayingLabel] = useState<string | null>(null)
  const [detailedView, setDetailedView] = useState(false)

  const [appliedSearchText, setAppliedSearchText] = useState('')
  const [appliedDateFrom, setAppliedDateFrom] = useState('')
  const [appliedDateTo, setAppliedDateTo] = useState('')

  const pageSize = 50

  useEffect(() => {
    if (bucket) {
      setPage(1)
      setNextToken(undefined)
      setPageTokens({ 1: undefined })
      setSelectedFiles(new Set())
      setAppliedSearchText('')
      setAppliedDateFrom('')
      setAppliedDateTo('')
      setSearchText('')
      setDateFrom('')
      setDateTo('')
      loadFiles(1)
    } else {
      setFiles([])
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bucket])

  useEffect(() => {
    if (!bucket) return

    const timer = setTimeout(() => {
      if (searchText !== appliedSearchText) {
        setPage(1)
        setNextToken(undefined)
        setPageTokens({ 1: undefined })
        setSelectedFiles(new Set())
        setAppliedSearchText(searchText)
        loadFiles(1, undefined, searchText, dateFrom, dateTo)
      }
    }, 800)

    return () => clearTimeout(timer)

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchText])

  useEffect(() => {
    if (!bucket) return

    if (dateFrom !== appliedDateFrom || dateTo !== appliedDateTo) {
      setPage(1)
      setNextToken(undefined)
      setPageTokens({ 1: undefined })
      setSelectedFiles(new Set())
      setAppliedDateFrom(dateFrom)
      setAppliedDateTo(dateTo)
      loadFiles(1, undefined, searchText, dateFrom, dateTo)
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo])

  useEffect(() => {
    if (!bucket) return

    const interval = setInterval(() => {
      loadFiles(page, nextToken, appliedSearchText, appliedDateFrom, appliedDateTo)
    }, 3600000)

    return () => clearInterval(interval)

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bucket, page, nextToken, appliedSearchText, appliedDateFrom, appliedDateTo])

  const loadFiles = async (
    pageNum: number,
    token?: string,
    search?: string,
    dateFromParam?: string,
    dateToParam?: string,
  ) => {
    if (!bucket) return

    try {
      setLoading(true)
      setError(null)

      const data = await fileApi.list(bucket.id, {
        page: pageNum,
        pageSize,
        nextToken: token,
        search: search || undefined,
        dateFrom: dateFromParam || undefined,
        dateTo: dateToParam || undefined,
      })

      if (data && Array.isArray(data.files)) {
        setFiles(data.files)
        setHasMore(data.has_more || false)
        setNextToken(data.next_token)
        setPageTokens((prev) => ({
          ...prev,
          [pageNum + 1]: data.next_token,
        }))
      } else {
        console.error('Dados retornados não têm estrutura esperada:', data)
        setFiles([])
        setHasMore(false)
        setNextToken(undefined)
        setError('Erro: resposta da API inválida')
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Erro ao carregar arquivos')
    } finally {
      setLoading(false)
    }
  }

  const handleApplyFilters = () => {
    setPage(1)
    setNextToken(undefined)
    setPageTokens({ 1: undefined })
    setSelectedFiles(new Set())
    setAppliedSearchText(searchText)
    setAppliedDateFrom(dateFrom)
    setAppliedDateTo(dateTo)
    loadFiles(1, undefined, searchText, dateFrom, dateTo)
  }

  const handleClearFilters = () => {
    setSearchText('')
    setDateFrom('')
    setDateTo('')
    setAppliedSearchText('')
    setAppliedDateFrom('')
    setAppliedDateTo('')
    setPage(1)
    setNextToken(undefined)
    setPageTokens({ 1: undefined })
    setSelectedFiles(new Set())
    loadFiles(1)
  }

  const handlePageChange = (newPage: number) => {
    const tokenForPage = pageTokens[newPage]
    setPage(newPage)
    setSelectedFiles(new Set())
    loadFiles(newPage, tokenForPage, appliedSearchText, appliedDateFrom, appliedDateTo)
  }

  const handleReadTranscription = async (fileKey: string) => {
    if (!bucket) return

    try {
      setReadingTranscription(fileKey)

      const data = await fileApi.readContent(bucket.id, fileKey)

      setTranscriptionContent(data.content)
      setShowTranscriptionModal(true)
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Erro ao ler transcrição')
    } finally {
      setReadingTranscription(null)
    }
  }

  const handleDownload = async (fileKey: string) => {
    if (!bucket) return

    try {
      const { url } = await fileApi.download(bucket.id, fileKey)
      window.open(url, '_blank')
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Erro ao fazer download')
    }
  }

  const handleDownloadMultiple = async () => {
    if (!bucket || selectedFiles.size === 0) return

    try {
      setDownloading(true)

      const fileKeys = Array.from(selectedFiles)
      const result = await fileApi.downloadMultiple(bucket.id, fileKeys)

      for (const item of result.urls) {
        if (item.url) {
          const link = document.createElement('a')
          link.href = item.url
          link.download = item.file_key.split('/').pop() || item.file_key
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)

          await new Promise((resolve) => setTimeout(resolve, 100))
        }
      }

      setSelectedFiles(new Set())
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Erro ao fazer download múltiplo')
    } finally {
      setDownloading(false)
    }
  }

  const handleDownloadAll = async () => {
    if (!bucket || files.length === 0) return

    try {
      setDownloading(true)

      const fileKeys = files.map((f) => f.key)
      const result = await fileApi.downloadMultiple(bucket.id, fileKeys)

      for (const item of result.urls) {
        if (item.url) {
          const link = document.createElement('a')
          link.href = item.url
          link.download = item.file_key.split('/').pop() || item.file_key
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)

          await new Promise((resolve) => setTimeout(resolve, 100))
        }
      }
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Erro ao fazer download massivo')
    } finally {
      setDownloading(false)
    }
  }

  const handleSelectFile = (fileKey: string) => {
    const newSelected = new Set(selectedFiles)

    if (newSelected.has(fileKey)) {
      newSelected.delete(fileKey)
    } else {
      newSelected.add(fileKey)
    }

    setSelectedFiles(newSelected)
  }

  const handleSelectAll = () => {
    const allAudioKeys = mergedFiles.map((item) => item.audio.key)
    if (selectedFiles.size === allAudioKeys.length) {
      setSelectedFiles(new Set())
    } else {
      setSelectedFiles(new Set(allAudioKeys))
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'

    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`
  }

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString('pt-BR')
  }

  const toInputDate = (date: Date): string => {
    return date.toISOString().slice(0, 10)
  }

  const applyPresetRange = (daysBack: number) => {
    const now = new Date()
    const start = new Date(now)
    start.setDate(now.getDate() - daysBack)
    setDateFrom(toInputDate(start))
    setDateTo(toInputDate(now))
  }

  const applyYesterdayRange = () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const value = toInputDate(yesterday)
    setDateFrom(value)
    setDateTo(value)
  }

  const getFriendlyName = (recording: FileInfo | string): string => {
    const fileInfo = typeof recording === 'string'
      ? files.find((file) => file.key === recording)
      : recording
    const fileKey = typeof recording === 'string' ? recording : recording.key
    const metadata = fileInfo?.call_metadata as Record<string, unknown> | undefined
    const candidateNumber =
      metadata?.mainNumber ??
      metadata?.primaryNumber ??
      metadata?.phoneNumber ??
      metadata?.number ??
      fileInfo?.call_metadata?.phone_number ??
      fileInfo?.call_metadata?.extension ??
      fileKey.match(/(\d{4,15})/)?.[1] ??
      ''

    const cleanNumber = String(candidateNumber).trim()

    if (!cleanNumber || cleanNumber.toLowerCase() === 'unknown') {
      return 'Gravação sem número identificado'
    }

    const onlyDigits = cleanNumber.replace(/\D/g, '')

    if (onlyDigits && onlyDigits.length <= 5) {
      return `Gravação - Ramal ${onlyDigits}`
    }

    return `Gravação - ${cleanNumber}`
  }

  const formatTimeFromMs = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    const milliseconds = ms % 1000

    return `${minutes.toString().padStart(2, '0')}:${seconds
      .toString()
      .padStart(2, '0')}.${Math.floor(milliseconds / 100)
      .toString()
      .padStart(1, '0')}`
  }

  const getAudioTranscriptionUid = (filename: string): string | null => {
    const match = filename.match(/~([a-f0-9-]{36})\.mp3$/i)
    return match ? match[1] : null
  }

  const getJsonUid = (filename: string): string | null => {
    const match = filename.match(/~([a-f0-9-]{36})\.json$/i)
    return match ? match[1] : null
  }

  const audios = files.filter((file) => file.key.toLowerCase().endsWith('.mp3'))
  const transcriptions = files.filter((file) => file.key.toLowerCase().endsWith('.json'))

  const transcriptionsByUid = new Map<string, FileInfo>()
  for (const json of transcriptions) {
    const uid = getJsonUid(json.key)
    if (uid) {
      transcriptionsByUid.set(uid, json)
    }
  }

  const mergedFiles = audios.map((audio) => {
    const uid = getAudioTranscriptionUid(audio.key)

    return {
      audio,
      transcriptionUid: uid,
      transcription: uid ? transcriptionsByUid.get(uid) || null : null,
    }
  })

  const totalStorage = mergedFiles.reduce((acc, item) => acc + item.audio.size, 0)
  const todayLabel = new Date().toDateString()
  const recordingsToday = mergedFiles.filter(
    ({ audio }) => new Date(audio.last_modified).toDateString() === todayLabel,
  ).length
  const lastUpdated = mergedFiles.length
    ? mergedFiles.reduce((latest, current) =>
        new Date(current.audio.last_modified) > new Date(latest.audio.last_modified) ? current : latest,
      ).audio.last_modified
    : null

  const metadataColumns = Array.from(
    new Set(
      mergedFiles.flatMap(({ audio }) =>
        Object.keys(audio.call_metadata || {}).filter((key) => key !== 'file_type'),
      ),
    ),
  ).sort()

  const handleListenCall = async (fileKey: string) => {
    if (!bucket) return

    try {
      const { url } = await fileApi.download(bucket.id, fileKey)
      setAudioUrl(url)
      setAudioPlayingLabel(getFriendlyName(fileKey))
      setShowAudioModal(true)
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Erro ao carregar áudio')
    }
  }

  if (!bucket) {
    return (
      <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
        Selecione um bucket para ver os arquivos
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-gray-800">Gravações</h2>

        <div className="flex gap-2">
          {selectedFiles.size > 0 && (
            <button
              onClick={handleDownloadMultiple}
              disabled={downloading}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {downloading ? 'Baixando...' : `Download Selecionados (${selectedFiles.size})`}
            </button>
          )}

          <button
            onClick={() => {
              if (mergedFiles.length > 100) {
                const confirmDownload = window.confirm(
                  `Você está prestes a baixar ${mergedFiles.length} gravações. Deseja continuar?`,
                )
                if (!confirmDownload) return
              }
              handleDownloadAll()
            }}
            disabled={downloading || mergedFiles.length === 0}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {downloading ? 'Baixando...' : 'Download Todos'}
          </button>

          <button
            onClick={() => setDetailedView((current) => !current)}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            {detailedView ? 'Visão Resumida' : 'Detalhado'}
          </button>

          <button
            onClick={() =>
              loadFiles(page, nextToken, appliedSearchText, appliedDateFrom, appliedDateTo)
            }
            disabled={loading}
            className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Carregando...' : 'Atualizar'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3 mb-4">
        {[
          { label: 'Total de gravações', value: mergedFiles.length.toString() },
          { label: 'Gravações hoje', value: recordingsToday.toString() },
          { label: 'Tamanho total armazenado', value: formatFileSize(totalStorage) },
          { label: 'Última atualização', value: lastUpdated ? formatDate(lastUpdated) : '-' },
          { label: 'Bucket atual', value: bucket.bucket_name },
        ].map((card) => (
          <div key={card.label} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
            <div className="text-xs uppercase tracking-wide text-gray-500">{card.label}</div>
            <div className="text-sm font-semibold text-gray-800 mt-1 break-words">{card.value}</div>
          </div>
        ))}
      </div>

      <div className="mb-4 p-4 bg-gray-50 rounded-lg">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Buscar
            </label>

            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleApplyFilters()
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              placeholder="Buscar por número, nome do arquivo, data ou UUID"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Data Inicial
            </label>

            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Data Final
            </label>

            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        <div className="mt-4 flex gap-2 items-center">
          <button
            onClick={() => {
              const today = toInputDate(new Date())
              setDateFrom(today)
              setDateTo(today)
            }}
            className="text-sm px-3 py-2 border border-gray-300 rounded-lg hover:bg-white"
          >
            Hoje
          </button>
          <button
            onClick={applyYesterdayRange}
            className="text-sm px-3 py-2 border border-gray-300 rounded-lg hover:bg-white"
          >
            Ontem
          </button>
          <button
            onClick={() => applyPresetRange(6)}
            className="text-sm px-3 py-2 border border-gray-300 rounded-lg hover:bg-white"
          >
            Últimos 7 dias
          </button>
          <button
            onClick={() => applyPresetRange(29)}
            className="text-sm px-3 py-2 border border-gray-300 rounded-lg hover:bg-white"
          >
            Últimos 30 dias
          </button>

          <button
            onClick={handleApplyFilters}
            className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
          >
            Aplicar Filtros
          </button>

          {(appliedSearchText || appliedDateFrom || appliedDateTo) && (
            <>
              <span className="text-sm text-gray-500">|</span>

              <button
                onClick={handleClearFilters}
                className="text-sm text-primary-600 hover:text-primary-800"
              >
                Limpar filtros
              </button>
            </>
          )}

          <span className="text-xs text-gray-500 ml-auto">
            Atualização automática a cada 1 hora
          </span>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {loading && files.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          Carregando arquivos...
        </div>
      ) : mergedFiles.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          Nenhum arquivo encontrado neste bucket
        </div>
      ) : (
        <>
          <div className="mb-2 text-sm text-gray-600">
            Mostrando {mergedFiles.length} áudio(s) - Página {page}
            {selectedFiles.size > 0 && ` - ${selectedFiles.size} selecionado(s)`}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left w-12">
                    <input
                      type="checkbox"
                      checked={
                        selectedFiles.size === mergedFiles.length && mergedFiles.length > 0
                      }
                      onChange={handleSelectAll}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                  </th>

                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4">
                    Gravação
                  </th>

                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                    Tipo
                  </th>

                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                    Número principal
                  </th>

                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-40">
                    Data/Hora
                  </th>

                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                    Duração
                  </th>

                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                    Tamanho
                  </th>

                  {detailedView &&
                    metadataColumns.map((column) => (
                      <th
                        key={column}
                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        {column.replace(/_/g, ' ')}
                      </th>
                    ))}

                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-40">
                    Ações
                  </th>

                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                    ...
                  </th>
                </tr>
              </thead>

              <tbody className="bg-white divide-y divide-gray-200">
                {mergedFiles.map(({ audio: audioFile, transcription: transcriptionFile }) => {
                  const baseFile = audioFile

                  return (
                    <tr
                      key={baseFile.key}
                      className={`hover:bg-gray-50 ${
                        selectedFiles.has(baseFile.key) ? 'bg-primary-50' : ''
                      }`}
                    >
                      <td className="px-4 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedFiles.has(baseFile.key)}
                          onChange={() => handleSelectFile(baseFile.key)}
                          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                      </td>

                      <td className="px-4 py-4">
                        <div
                          className="text-sm font-medium text-gray-900 break-words"
                          title={baseFile.key}
                        >
                          {getFriendlyName(baseFile)}
                        </div>
                        <div className="text-xs text-gray-500">
                          {formatDate(baseFile.last_modified)}
                        </div>
                        <div className="text-xs text-gray-400 truncate" title={baseFile.key}>
                          {baseFile.key}
                        </div>
                      </td>

                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">
                          {baseFile.call_metadata?.file_type === 'audio' ? (
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                              Áudio
                            </span>
                          ) : baseFile.call_metadata?.file_type === 'transcription' ? (
                            <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                              Transcrição
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">
                          {baseFile.call_metadata?.phone_number || '-'}
                        </div>
                      </td>

                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">
                          {formatDate(baseFile.last_modified)}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                        {baseFile.call_metadata?.timestamp || '-'}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatFileSize(baseFile.size)}
                      </td>

                      {detailedView &&
                        metadataColumns.map((column) => (
                          <td key={`${baseFile.key}-${column}`} className="px-4 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-500">
                              {baseFile.call_metadata?.[column as keyof typeof baseFile.call_metadata] ?? '-'}
                            </div>
                          </td>
                        ))}

                      <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end gap-1.5 rounded-xl bg-gray-50 border border-gray-200 p-1.5">
                          {audioFile && (
                            <ActionButton
                              onClick={() => handleListenCall(audioFile.key)}
                              title="Ouvir chamada"
                              ariaLabel="Ouvir chamada"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                                className="w-5 h-5"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm14.28-.53-4.5-3a.75.75 0 00-1.155.624v6a.75.75 0 001.155.624l4.5-3a.75.75 0 000-1.248z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            </ActionButton>
                          )}

                          {transcriptionFile ? (
                            <ActionButton
                              onClick={() =>
                                handleReadTranscription(transcriptionFile?.key || baseFile.key)
                              }
                              disabled={
                                readingTranscription ===
                                (transcriptionFile?.key || baseFile.key)
                              }
                              title="Ler transcrição"
                              ariaLabel="Ler transcrição"
                              variant="primary"
                            >
                              {readingTranscription ===
                              (transcriptionFile?.key || baseFile.key) ? (
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  className="w-5 h-5 animate-spin"
                                >
                                  <circle
                                    className="opacity-25"
                                    cx="12"
                                    cy="12"
                                    r="10"
                                    stroke="currentColor"
                                    strokeWidth="4"
                                  />
                                  <path
                                    className="opacity-75"
                                    fill="currentColor"
                                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                                  />
                                </svg>
                              ) : (
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  viewBox="0 0 24 24"
                                  fill="currentColor"
                                  className="w-5 h-5"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M5.625 1.5A2.625 2.625 0 003 4.125v15.75A2.625 2.625 0 005.625 22.5h12.75A2.625 2.625 0 0021 19.875V8.56a2.625 2.625 0 00-.769-1.856l-4.935-4.935A2.625 2.625 0 0013.44 1H5.625zm7.5 5.25a.75.75 0 000 1.5h1.5a.75.75 0 000-1.5h-1.5zm-3 4.5a.75.75 0 000 1.5h4.5a.75.75 0 000-1.5h-4.5zm0 4.5a.75.75 0 000 1.5h4.5a.75.75 0 000-1.5h-4.5z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                              )}
                            </ActionButton>
                          ) : (
                            <span className="inline-flex items-center rounded-md bg-amber-100 text-amber-700 px-2 py-1 text-[11px] font-medium">
                              Processando
                            </span>
                          )}

                          <ActionButton
                            onClick={() => handleDownload(baseFile.key)}
                            title="Download"
                            ariaLabel="Download"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                              className="w-5 h-5"
                            >
                              <path
                                fillRule="evenodd"
                                d="M12 2.25a.75.75 0 01.75.75v10.19l2.72-2.72a.75.75 0 111.06 1.06l-4 4a.75.75 0 01-1.06 0l-4-4a.75.75 0 111.06-1.06l2.72 2.72V3a.75.75 0 01.75-.75z"
                                clipRule="evenodd"
                              />
                              <path d="M3.75 15a.75.75 0 01.75.75v3a.75.75 0 00.75.75h13.5a.75.75 0 00.75-.75v-3a.75.75 0 011.5 0v3a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18.75v-3a.75.75 0 01.75-.75z" />
                            </svg>
                          </ActionButton>
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <details className="text-xs text-gray-600">
                          <summary
                            className="cursor-pointer list-none text-gray-500 hover:text-gray-700 [&::-webkit-details-marker]:hidden"
                            title="Ver detalhes"
                            aria-label="Ver detalhes"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                              className="w-5 h-5"
                            >
                              <path d="M12 6.75a1.125 1.125 0 110-2.25 1.125 1.125 0 010 2.25zM12 13.125a1.125 1.125 0 110-2.25 1.125 1.125 0 010 2.25zM12 19.5a1.125 1.125 0 110-2.25 1.125 1.125 0 010 2.25z" />
                            </svg>
                          </summary>

                          <div className="mt-2 space-y-1">
                            <div>
                              <strong>UUID:</strong> {baseFile.call_metadata?.call_uuid || '-'}
                            </div>

                            <div>
                              <strong>Leg:</strong> {baseFile.call_metadata?.leg || '-'}
                            </div>

                            <div>
                              <strong>Tamanho:</strong> {formatFileSize(baseFile.size)}
                            </div>

                            <div>
                              <strong>Transcrição:</strong>{' '}
                              {transcriptionFile ? 'Encontrada' : 'Não encontrada'}
                            </div>
                          </div>
                        </details>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Página {page}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handlePageChange(page - 1)}
                disabled={page === 1 || loading}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Anterior
              </button>

              <button
                onClick={() => handlePageChange(page + 1)}
                disabled={!hasMore || loading}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Próxima
              </button>
            </div>
          </div>
        </>
      )}

      {showAudioModal && audioUrl && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl">
            <h2 className="text-xl font-bold mb-4">Ouvir chamada</h2>

            {audioPlayingLabel && (
              <p className="text-sm text-gray-600 mb-2">{audioPlayingLabel}</p>
            )}

            <audio src={audioUrl} controls className="w-full" />

            <div className="mt-3 text-sm text-gray-600">
              Use os controles do player para adiantar e acelerar o áudio.
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => {
                  setShowAudioModal(false)
                  setAudioUrl(null)
                }}
                className="bg-gray-300 px-4 py-2 rounded-lg"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {showTranscriptionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-800">Transcrição</h2>

              <button
                onClick={() => {
                  setShowTranscriptionModal(false)
                  setTranscriptionContent(null)
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {transcriptionContent ? (
                <div className="space-y-4">
                  {transcriptionContent.results &&
                  Array.isArray(transcriptionContent.results) ? (
                    transcriptionContent.results
                      .sort(
                        (a: any, b: any) =>
                          (a.startTimeMs || 0) - (b.startTimeMs || 0)
                      )
                      .map((utterance: any, index: number) => {
                        const channel = utterance.channel ?? 0
                        const isLegA = channel === 0
                        const startTime = utterance.startTimeMs
                          ? formatTimeFromMs(utterance.startTimeMs)
                          : ''
                        const endTime = utterance.endTimeMs
                          ? formatTimeFromMs(utterance.endTimeMs)
                          : ''

                        return (
                          <div
                            key={index}
                            className={`p-4 rounded-lg border-l-4 ${
                              isLegA
                                ? 'bg-purple-50 border-purple-500'
                                : 'bg-orange-50 border-orange-500'
                            }`}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`px-2 py-1 rounded text-xs font-semibold ${
                                    isLegA
                                      ? 'bg-purple-100 text-purple-700'
                                      : 'bg-orange-100 text-orange-700'
                                  }`}
                                >
                                  Leg {isLegA ? 'A' : 'B'}
                                </span>

                                {(startTime || endTime) && (
                                  <span className="text-xs text-gray-500">
                                    {startTime} - {endTime}
                                  </span>
                                )}
                              </div>

                              {utterance.languageCode && (
                                <span className="text-xs text-gray-400">
                                  {utterance.languageCode.toUpperCase()}
                                </span>
                              )}
                            </div>

                            <p className="text-gray-800 leading-relaxed">
                              {utterance.transcript ||
                                utterance.text ||
                                'Sem transcrição'}
                            </p>
                          </div>
                        )
                      })
                  ) : typeof transcriptionContent === 'object' ? (
                    <pre className="bg-gray-50 p-4 rounded-lg text-sm text-gray-800 whitespace-pre-wrap break-words">
                      {JSON.stringify(transcriptionContent, null, 2)}
                    </pre>
                  ) : (
                    <pre className="bg-gray-50 p-4 rounded-lg text-sm text-gray-800 whitespace-pre-wrap break-words">
                      {transcriptionContent}
                    </pre>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  Carregando...
                </div>
              )}
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => {
                  setShowTranscriptionModal(false)
                  setTranscriptionContent(null)
                }}
                className="bg-gray-300 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-400 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
