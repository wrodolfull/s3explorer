import { useState, useEffect, useRef } from 'react'
import { bucketApi, Bucket, BucketCreate, BucketUpdate } from '../lib/api'

interface HeaderProps {
  selectedBucket: Bucket | null
  onBucketSelect: (bucket: Bucket | null) => void
  onShowLogs: () => void
  onLogout: () => void
  showLogs: boolean
}

export default function Header({
  selectedBucket,
  onBucketSelect,
  onShowLogs,
  onLogout,
  showLogs,
}: HeaderProps) {
  const [buckets, setBuckets] = useState<Bucket[]>([])
  const [showBucketsDropdown, setShowBucketsDropdown] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingBucket, setEditingBucket] = useState<Bucket | null>(null)
  const [formData, setFormData] = useState<BucketCreate>({
    name: '',
    bucket_name: '',
    aws_access_key: '',
    aws_secret_key: '',
    region: 'us-east-1',
    active: true,
  })
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadBuckets()
  }, [])

  useEffect(() => {
    // Fecha dropdown ao clicar fora
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowBucketsDropdown(false)
      }
    }

    if (showBucketsDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showBucketsDropdown])

  const loadBuckets = async () => {
    try {
      const data = await bucketApi.list()
      // Garante que data é um array antes de usar
      if (Array.isArray(data)) {
        setBuckets(data)
        if (data.length > 0 && !selectedBucket) {
          onBucketSelect(data.find((b) => b.active) || data[0])
        }
      } else {
        console.error('Dados retornados não são um array:', data)
        setBuckets([])
      }
    } catch (err: any) {
      console.error('Erro ao carregar buckets:', err)
      setBuckets([])
      // Não mostra erro no Header para não poluir a UI, apenas no console
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      if (editingBucket) {
        const updateData: BucketUpdate = {
          name: formData.name,
          bucket_name: formData.bucket_name,
          aws_access_key: formData.aws_access_key,
          aws_secret_key: formData.aws_secret_key,
          region: formData.region,
        }
        await bucketApi.update(editingBucket.id, updateData)
      } else {
        await bucketApi.create(formData)
      }
      setShowCreateForm(false)
      setEditingBucket(null)
      setFormData({
        name: '',
        bucket_name: '',
        aws_access_key: '',
        aws_secret_key: '',
        region: 'us-east-1',
        active: true,
      })
      await loadBuckets()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Erro ao salvar bucket')
    } finally {
      setSubmitting(false)
    }
  }

  const handleEdit = (bucket: Bucket, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingBucket(bucket)
    setFormData({
      name: bucket.name,
      bucket_name: bucket.bucket_name,
      aws_access_key: '',
      aws_secret_key: '',
      region: bucket.region,
      active: bucket.active,
    })
    setShowCreateForm(true)
    setShowBucketsDropdown(false)
  }

  const handleDelete = async (bucket: Bucket, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm(`Tem certeza que deseja deletar o bucket "${bucket.name}"?`)) {
      return
    }

    try {
      setDeleting(bucket.id)
      await bucketApi.delete(bucket.id)
      if (selectedBucket?.id === bucket.id) {
        onBucketSelect(null)
      }
      await loadBuckets()
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Erro ao deletar bucket')
    } finally {
      setDeleting(null)
    }
  }

  const handleToggleActive = async (bucket: Bucket, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const updated = await bucketApi.toggleActive(bucket.id)
      await loadBuckets()
      if (selectedBucket?.id === bucket.id) {
        onBucketSelect(updated)
      }
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Erro ao alterar status do bucket')
    }
  }

  const handleNewBucket = () => {
    setEditingBucket(null)
    setFormData({
      name: '',
      bucket_name: '',
      aws_access_key: '',
      aws_secret_key: '',
      region: 'us-east-1',
      active: true,
    })
    setShowCreateForm(true)
    setShowBucketsDropdown(false)
  }

  return (
    <header className="bg-white shadow">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800">S3 Explorer</h1>
          <div className="flex items-center gap-4">
            {/* Menu Buckets */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowBucketsDropdown(!showBucketsDropdown)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-2"
              >
                Buckets
                <svg
                  className={`w-4 h-4 transition-transform ${
                    showBucketsDropdown ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {showBucketsDropdown && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-96 overflow-y-auto">
                  <div className="p-2">
                    <button
                      onClick={handleNewBucket}
                      className="w-full text-left px-4 py-2 text-primary-600 hover:bg-primary-50 rounded-lg font-medium flex items-center gap-2"
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
                          d="M12 4v16m8-8H4"
                        />
                      </svg>
                      + Criar Bucket
                    </button>
                  </div>
                  <div className="border-t border-gray-200">
                    {buckets.length === 0 ? (
                      <div className="p-4 text-center text-gray-500 text-sm">
                        Nenhum bucket criado
                      </div>
                    ) : (
                      buckets.map((bucket) => (
                        <div
                          key={bucket.id}
                          onClick={() => {
                            if (bucket.active) {
                              onBucketSelect(bucket)
                              setShowBucketsDropdown(false)
                              // Fecha logs se estiver aberto
                              if (showLogs) {
                                onShowLogs()
                              }
                            }
                          }}
                          className={`p-3 border-b border-gray-100 last:border-b-0 ${
                            selectedBucket?.id === bucket.id
                              ? 'bg-primary-50'
                              : bucket.active
                              ? 'hover:bg-gray-50 cursor-pointer'
                              : 'bg-gray-100 opacity-60'
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-gray-800 truncate">
                                  {bucket.name}
                                </h3>
                                {!bucket.active && (
                                  <span className="px-2 py-0.5 text-xs bg-gray-300 text-gray-700 rounded">
                                    Inativo
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-500 truncate">
                                {bucket.bucket_name} • {bucket.region}
                              </p>
                            </div>
                            <div
                              className="flex items-center gap-1 ml-2"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                onClick={(e) => handleToggleActive(bucket, e)}
                                className={`p-1.5 rounded transition-colors ${
                                  bucket.active
                                    ? 'text-yellow-600 hover:bg-yellow-100'
                                    : 'text-green-600 hover:bg-green-100'
                                }`}
                                title={bucket.active ? 'Desativar' : 'Ativar'}
                              >
                                {bucket.active ? (
                                  <svg
                                    className="w-4 h-4"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                                    />
                                  </svg>
                                ) : (
                                  <svg
                                    className="w-4 h-4"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                                    />
                                  </svg>
                                )}
                              </button>
                              <button
                                onClick={(e) => handleEdit(bucket, e)}
                                className="p-1.5 text-blue-600 hover:bg-blue-100 rounded transition-colors"
                                title="Editar"
                              >
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                  />
                                </svg>
                              </button>
                              <button
                                onClick={(e) => handleDelete(bucket, e)}
                                disabled={deleting === bucket.id}
                                className="p-1.5 text-red-600 hover:bg-red-100 rounded transition-colors disabled:opacity-50"
                                title="Deletar"
                              >
                                {deleting === bucket.id ? (
                                  <svg
                                    className="w-4 h-4 animate-spin"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                  >
                                    <circle
                                      className="opacity-25"
                                      cx="12"
                                      cy="12"
                                      r="10"
                                      stroke="currentColor"
                                      strokeWidth="4"
                                    ></circle>
                                    <path
                                      className="opacity-75"
                                      fill="currentColor"
                                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                    ></path>
                                  </svg>
                                ) : (
                                  <svg
                                    className="w-4 h-4"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                    />
                                  </svg>
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Menu Arquivos - aparece quando está em Logs */}
            {showLogs && (
              <button
                onClick={onShowLogs}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Arquivos
              </button>
            )}

            {/* Menu Logs */}
            <button
              onClick={onShowLogs}
              className={`px-4 py-2 rounded-lg transition-colors ${
                showLogs
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              Logs
            </button>

            {/* Botão Sair */}
            <button
              onClick={onLogout}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
            >
              Sair
            </button>
          </div>
        </div>
      </div>

      {/* Modal de Criar/Editar Bucket */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-800">
                {editingBucket ? 'Editar Bucket' : 'Criar Novo Bucket'}
              </h2>
              <button
                onClick={() => {
                  setShowCreateForm(false)
                  setEditingBucket(null)
                  setError(null)
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

            {error && (
              <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                {error}
              </div>
            )}

            <form onSubmit={handleCreate}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome Amigável
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    placeholder="Meu Bucket Principal"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome do Bucket S3
                  </label>
                  <input
                    type="text"
                    value={formData.bucket_name}
                    onChange={(e) =>
                      setFormData({ ...formData, bucket_name: e.target.value })
                    }
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    placeholder="meu-bucket-s3"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    AWS Access Key ID
                  </label>
                  <input
                    type="text"
                    value={formData.aws_access_key}
                    onChange={(e) =>
                      setFormData({ ...formData, aws_access_key: e.target.value })
                    }
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    placeholder="AKIAIOSFODNN7EXAMPLE"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    AWS Secret Access Key
                  </label>
                  <input
                    type="password"
                    value={formData.aws_secret_key}
                    onChange={(e) =>
                      setFormData({ ...formData, aws_secret_key: e.target.value })
                    }
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Região AWS
                  </label>
                  <select
                    value={formData.region}
                    onChange={(e) =>
                      setFormData({ ...formData, region: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="us-east-1">us-east-1</option>
                    <option value="us-west-2">us-west-2</option>
                    <option value="eu-west-1">eu-west-1</option>
                    <option value="sa-east-1">sa-east-1</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2 mt-6">
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
                >
                  {submitting
                    ? 'Salvando...'
                    : editingBucket
                    ? 'Atualizar'
                    : 'Criar Bucket'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false)
                    setEditingBucket(null)
                    setError(null)
                  }}
                  disabled={submitting}
                  className="bg-gray-300 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-400 disabled:opacity-50 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  )
}

