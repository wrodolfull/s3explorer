import { useState, useEffect } from 'react'
import { logApi, Log, Bucket } from '../lib/api'

interface LogsViewProps {
  buckets: Bucket[]
  onBackToFiles?: () => void
}

export default function LogsView({ buckets, onBackToFiles }: LogsViewProps) {
  const [logs, setLogs] = useState<Log[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedBucketId, setSelectedBucketId] = useState<string>('')
  const [selectedActionType, setSelectedActionType] = useState<string>('')

  useEffect(() => {
    loadLogs()
  }, [selectedBucketId, selectedActionType])

  const loadLogs = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await logApi.list(
        selectedBucketId || undefined,
        selectedActionType || undefined,
        100
      )
      // Garante que data.logs é um array antes de usar
      if (data && Array.isArray(data.logs)) {
        setLogs(data.logs)
      } else {
        console.error('Dados retornados não têm estrutura esperada:', data)
        setLogs([])
        setError('Erro: resposta da API inválida')
      }
    } catch (err: any) {
      console.error('Erro ao carregar logs:', err)
      setLogs([])
      setError(err.response?.data?.detail || err.message || 'Erro ao carregar logs')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString('pt-BR')
  }

  const getActionLabel = (actionType: string): string => {
    return actionType === 'download' ? 'Download' : 'Exclusão'
  }

  const getActionColor = (actionType: string): string => {
    return actionType === 'download'
      ? 'bg-blue-100 text-blue-700'
      : 'bg-red-100 text-red-700'
  }

  const getBucketName = (bucketId: string): string => {
    const bucket = buckets.find((b) => b.id === bucketId)
    return bucket ? bucket.name : bucketId
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-4">
          {onBackToFiles && (
            <button
              onClick={onBackToFiles}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-2"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
              Voltar para Arquivos
            </button>
          )}
          <h2 className="text-2xl font-bold text-gray-800">Logs de Ações</h2>
        </div>
        <button
          onClick={loadLogs}
          className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
        >
          Atualizar
        </button>
      </div>

      {/* Filtros */}
      <div className="mb-4 flex gap-4">
        <select
          value={selectedBucketId}
          onChange={(e) => setSelectedBucketId(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
        >
          <option value="">Todos os buckets</option>
          {buckets.map((bucket) => (
            <option key={bucket.id} value={bucket.id}>
              {bucket.name}
            </option>
          ))}
        </select>

        <select
          value={selectedActionType}
          onChange={(e) => setSelectedActionType(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
        >
          <option value="">Todas as ações</option>
          <option value="download">Download</option>
          <option value="delete">Exclusão</option>
        </select>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-8">
          <div className="animate-pulse text-gray-500">Carregando logs...</div>
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          Nenhum log encontrado.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Data/Hora
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ação
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Bucket
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Arquivo
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(log.created_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 text-xs font-semibold rounded ${getActionColor(
                        log.action_type
                      )}`}
                    >
                      {getActionLabel(log.action_type)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {getBucketName(log.bucket_id)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <div className="break-words" title={log.file_key}>
                      {log.file_key}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {logs.length > 0 && (
        <div className="mt-4 text-sm text-gray-500 text-center">
          Total: {logs.length} log(s)
        </div>
      )}
    </div>
  )
}

