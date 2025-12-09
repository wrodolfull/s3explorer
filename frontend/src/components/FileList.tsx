import { useState, useEffect } from 'react'
import { fileApi, FileInfo } from '../lib/api'
import { Bucket } from '../lib/api'

interface FileListProps {
  bucket: Bucket | null
}

export default function FileList({ bucket }: FileListProps) {
  const [files, setFiles] = useState<FileInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [nextToken, setNextToken] = useState<string | undefined>(undefined)
  const [searchText, setSearchText] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [fileExtension, setFileExtension] = useState('')
  const [downloading, setDownloading] = useState(false)
  const [readingTranscription, setReadingTranscription] = useState<string | null>(null)
  const [transcriptionContent, setTranscriptionContent] = useState<any>(null)
  const [showTranscriptionModal, setShowTranscriptionModal] = useState(false)
  // Estados para filtros aplicados (que realmente fazem a busca)
  const [appliedSearchText, setAppliedSearchText] = useState('')
  const [appliedDateFrom, setAppliedDateFrom] = useState('')
  const [appliedDateTo, setAppliedDateTo] = useState('')
  const [appliedFileExtension, setAppliedFileExtension] = useState('')
  const pageSize = 50

  useEffect(() => {
    if (bucket) {
      setPage(1)
      setNextToken(undefined)
      setSelectedFiles(new Set())
      setAppliedSearchText('')
      setAppliedDateFrom('')
      setAppliedDateTo('')
      setAppliedFileExtension('')
      setSearchText('')
      setDateFrom('')
      setDateTo('')
      setFileExtension('')
      loadFiles(1)
    } else {
      setFiles([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bucket])

  // Debounce para filtros de texto - aplica após 800ms sem digitar
  useEffect(() => {
    if (!bucket) return
    
    const timer = setTimeout(() => {
      if (searchText !== appliedSearchText || fileExtension !== appliedFileExtension) {
        setPage(1)
        setNextToken(undefined)
        setSelectedFiles(new Set())
        setAppliedSearchText(searchText)
        setAppliedFileExtension(fileExtension)
        loadFiles(1, undefined, searchText, dateFrom, dateTo, fileExtension)
      }
    }, 800)

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchText, fileExtension])

  // Para datas, aplica imediatamente quando mudar
  useEffect(() => {
    if (!bucket) return
    
    if (dateFrom !== appliedDateFrom || dateTo !== appliedDateTo) {
      setPage(1)
      setNextToken(undefined)
      setSelectedFiles(new Set())
      setAppliedDateFrom(dateFrom)
      setAppliedDateTo(dateTo)
      loadFiles(1, undefined, searchText, dateFrom, dateTo, fileExtension)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo])

  // Atualização automática a cada 1 hora
  useEffect(() => {
    if (!bucket) return

    const interval = setInterval(() => {
      loadFiles(page, nextToken, appliedSearchText, appliedDateFrom, appliedDateTo, appliedFileExtension)
    }, 3600000) // 1 hora = 3600000ms

    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bucket, page, nextToken, appliedSearchText, appliedDateFrom, appliedDateTo, appliedFileExtension])

  const loadFiles = async (
    pageNum: number,
    token?: string,
    search?: string,
    dateFromParam?: string,
    dateToParam?: string,
    fileExtensionParam?: string
  ) => {
    if (!bucket) return

    try {
      setLoading(true)
      setError(null)
      const data = await fileApi.list(bucket.id, {
        page: pageNum,
        pageSize: pageSize,
        nextToken: token,
        search: search || undefined,
        dateFrom: dateFromParam || undefined,
        dateTo: dateToParam || undefined,
        fileExtension: fileExtensionParam || undefined,
      })
      // Garante que data.files é um array antes de usar
      if (data && Array.isArray(data.files)) {
        setFiles(data.files)
        setHasMore(data.has_more || false)
        setNextToken(data.next_token)
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
    setSelectedFiles(new Set())
    setAppliedSearchText(searchText)
    setAppliedDateFrom(dateFrom)
    setAppliedDateTo(dateTo)
    setAppliedFileExtension(fileExtension)
    loadFiles(1, undefined, searchText, dateFrom, dateTo, fileExtension)
  }

  const handlePageChange = (newPage: number) => {
    setPage(newPage)
    setSelectedFiles(new Set())
    loadFiles(newPage, nextToken, appliedSearchText, appliedDateFrom, appliedDateTo, appliedFileExtension)
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
      
      // Faz download de cada arquivo
      for (const item of result.urls) {
        if (item.url) {
          const link = document.createElement('a')
          link.href = item.url
          link.download = item.file_key.split('/').pop() || item.file_key
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
          // Pequeno delay entre downloads para evitar bloqueio do navegador
          await new Promise(resolve => setTimeout(resolve, 100))
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
      const fileKeys = files.map(f => f.key)
      const result = await fileApi.downloadMultiple(bucket.id, fileKeys)
      
      // Faz download de cada arquivo
      for (const item of result.urls) {
        if (item.url) {
          const link = document.createElement('a')
          link.href = item.url
          link.download = item.file_key.split('/').pop() || item.file_key
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
          // Pequeno delay entre downloads para evitar bloqueio do navegador
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      }
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Erro ao fazer download massivo')
    } finally {
      setDownloading(false)
    }
  }

  const handleDelete = async (fileKey: string) => {
    if (!bucket) return

    if (!confirm(`Tem certeza que deseja deletar "${fileKey}"?`)) {
      return
    }

    try {
      setDeleting(fileKey)
      await fileApi.delete(bucket.id, fileKey)
      await loadFiles(page, nextToken)
      setSelectedFiles(new Set())
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Erro ao deletar arquivo')
    } finally {
      setDeleting(null)
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
    if (selectedFiles.size === files.length) {
      setSelectedFiles(new Set())
    } else {
      setSelectedFiles(new Set(files.map(f => f.key)))
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString('pt-BR')
  }

  const formatTimeFromMs = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    const milliseconds = ms % 1000
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${Math.floor(milliseconds / 100).toString().padStart(1, '0')}`
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
        <h2 className="text-2xl font-bold text-gray-800">Arquivos</h2>
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
            onClick={handleDownloadAll}
            disabled={downloading || files.length === 0}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {downloading ? 'Baixando...' : 'Download Todos'}
          </button>
          <button
            onClick={() => loadFiles(page, nextToken, appliedSearchText, appliedDateFrom, appliedDateTo, appliedFileExtension)}
            disabled={loading}
            className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Carregando...' : 'Atualizar'}
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="mb-4 p-4 bg-gray-50 rounded-lg">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Buscar (case sensitive)
            </label>
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleApplyFilters()
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              placeholder="Digite e pressione Enter ou clique em Aplicar"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Extensão do Arquivo
            </label>
            <input
              type="text"
              value={fileExtension}
              onChange={(e) => setFileExtension(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleApplyFilters()
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              placeholder="Ex: .pdf, .jpg, .txt"
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
            onClick={handleApplyFilters}
            className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
          >
            Aplicar Filtros
          </button>
          {(appliedSearchText || appliedDateFrom || appliedDateTo || appliedFileExtension) && (
            <>
              <span className="text-sm text-gray-500">|</span>
              <button
                onClick={() => {
                  setSearchText('')
                  setDateFrom('')
                  setDateTo('')
                  setFileExtension('')
                  setAppliedSearchText('')
                  setAppliedDateFrom('')
                  setAppliedDateTo('')
                  setAppliedFileExtension('')
                  setPage(1)
                  setNextToken(undefined)
                  setSelectedFiles(new Set())
                  loadFiles(1)
                }}
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
        <div className="text-center py-8 text-gray-500">Carregando arquivos...</div>
      ) : files.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          Nenhum arquivo encontrado neste bucket
        </div>
      ) : (
        <>
          <div className="mb-2 text-sm text-gray-600">
            Mostrando {files.length} arquivo(s) - Página {page}
            {selectedFiles.size > 0 && ` - ${selectedFiles.size} selecionado(s)`}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left w-12">
                    <input
                      type="checkbox"
                      checked={selectedFiles.size === files.length && files.length > 0}
                      onChange={handleSelectAll}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4">
                    Nome
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                    Tipo
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                    Leg
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                    Número
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/5">
                    UUID Chamada
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                    Tamanho
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-40">
                    Modificado
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {files.map((file) => (
                  <tr
                    key={file.key}
                    className={`hover:bg-gray-50 ${
                      selectedFiles.has(file.key) ? 'bg-primary-50' : ''
                    }`}
                  >
                    <td className="px-4 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedFiles.has(file.key)}
                        onChange={() => handleSelectFile(file.key)}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm font-medium text-gray-900 break-words" title={file.key}>
                        {file.key}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">
                        {file.call_metadata?.file_type === 'audio' ? (
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">Áudio</span>
                        ) : file.call_metadata?.file_type === 'transcription' ? (
                          <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">Transcrição</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">
                        {file.call_metadata?.leg ? (
                          <span className={`px-2 py-1 rounded text-xs ${
                            file.call_metadata.leg === 'A' 
                              ? 'bg-purple-100 text-purple-700' 
                              : 'bg-orange-100 text-orange-700'
                          }`}>
                            Leg {file.call_metadata.leg}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">
                        {file.call_metadata?.phone_number || '-'}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-xs text-gray-500 break-all" title={file.call_metadata?.call_uuid || ''}>
                        {file.call_metadata?.call_uuid || '-'}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{formatFileSize(file.size)}</div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{formatDate(file.last_modified)}</div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-2">
                        {file.call_metadata?.file_type === 'transcription' && (
                          <button
                            onClick={() => handleReadTranscription(file.key)}
                            disabled={readingTranscription === file.key}
                            className="text-green-600 hover:text-green-900 disabled:opacity-50"
                            title="Ler transcrição"
                          >
                            {readingTranscription === file.key ? 'Carregando...' : 'Ler'}
                          </button>
                        )}
                        <button
                          onClick={() => handleDownload(file.key)}
                          className="text-primary-600 hover:text-primary-900"
                        >
                          Download
                        </button>
                        <button
                          onClick={() => handleDelete(file.key)}
                          disabled={deleting === file.key}
                          className="text-red-600 hover:text-red-900 disabled:opacity-50"
                        >
                          {deleting === file.key ? 'Deletando...' : 'Deletar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
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

      {/* Modal de Transcrição */}
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
                  {transcriptionContent.results && Array.isArray(transcriptionContent.results) ? (
                    // Formatação amigável para transcrições estruturadas
                    transcriptionContent.results
                      .sort((a: any, b: any) => (a.startTimeMs || 0) - (b.startTimeMs || 0))
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
                              {utterance.transcript || utterance.text || 'Sem transcrição'}
                            </p>
                          </div>
                        )
                      })
                  ) : typeof transcriptionContent === 'object' ? (
                    // Fallback para JSON genérico
                    <pre className="bg-gray-50 p-4 rounded-lg text-sm text-gray-800 whitespace-pre-wrap break-words">
                      {JSON.stringify(transcriptionContent, null, 2)}
                    </pre>
                  ) : (
                    // Texto simples
                    <pre className="bg-gray-50 p-4 rounded-lg text-sm text-gray-800 whitespace-pre-wrap break-words">
                      {transcriptionContent}
                    </pre>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">Carregando...</div>
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
