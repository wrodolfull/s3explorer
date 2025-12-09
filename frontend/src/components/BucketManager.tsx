import { useState, useEffect } from 'react'
import { bucketApi, Bucket, BucketCreate, BucketUpdate } from '../lib/api'

interface BucketManagerProps {
  onBucketSelect: (bucket: Bucket | null) => void
  selectedBucket: Bucket | null
}

export default function BucketManager({
  onBucketSelect,
  selectedBucket,
}: BucketManagerProps) {
  const [buckets, setBuckets] = useState<Bucket[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
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

  useEffect(() => {
    loadBuckets()
  }, [])

  const loadBuckets = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await bucketApi.list()
      // Garante que data é um array antes de usar
      if (Array.isArray(data)) {
        setBuckets(data)
        if (data.length > 0 && !selectedBucket) {
          onBucketSelect(data[0])
        }
      } else {
        console.error('Dados retornados não são um array:', data)
        setBuckets([])
        setError('Erro: resposta da API inválida')
      }
    } catch (err: any) {
      console.error('Erro ao carregar buckets:', err)
      setBuckets([])
      const errorMessage = err.message || err.response?.data?.detail || 'Erro ao carregar buckets'
      
      // Mensagem mais amigável para erros de conexão
      if (errorMessage.includes('Backend não está respondendo') || 
          errorMessage.includes('Network Error') ||
          errorMessage.includes('ECONNREFUSED')) {
        setError('⚠️ Não foi possível conectar ao backend. Verifique se o servidor está rodando.')
      } else {
        setError(errorMessage)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      if (editingBucket) {
        // Atualizar bucket existente
        const updateData: BucketUpdate = {
          name: formData.name,
          bucket_name: formData.bucket_name,
          aws_access_key: formData.aws_access_key,
          aws_secret_key: formData.aws_secret_key,
          region: formData.region,
        }
        await bucketApi.update(editingBucket.id, updateData)
      } else {
        // Criar novo bucket
        await bucketApi.create(formData)
      }
      setShowForm(false)
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
      console.error('Erro ao salvar bucket:', err)
      const status = err.response?.status
      let errorMessage = err.response?.data?.detail || err.message || 'Erro ao salvar bucket'
      
      // Mensagens mais específicas para diferentes erros
      if (status === 401) {
        errorMessage = 'Erro de autenticação. Por favor, faça login novamente.'
      } else if (status === 405) {
        errorMessage = 'Método HTTP não permitido. Verifique a configuração do servidor.'
      } else if (status === 400) {
        errorMessage = err.response?.data?.detail || 'Dados inválidos. Verifique os campos preenchidos.'
      } else if (status === 403) {
        errorMessage = 'Acesso negado. Verifique suas permissões.'
      }
      
      setError(errorMessage)
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
      aws_access_key: '', // Não preencher por segurança
      aws_secret_key: '', // Não preencher por segurança
      region: bucket.region,
      active: bucket.active,
    })
    setShowForm(true)
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
      // Atualiza o bucket selecionado se for o mesmo
      if (selectedBucket?.id === bucket.id) {
        onBucketSelect(updated)
      }
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Erro ao alterar status do bucket')
    }
  }

  const handleCancel = () => {
    setShowForm(false)
    setEditingBucket(null)
    setFormData({
      name: '',
      bucket_name: '',
      aws_access_key: '',
      aws_secret_key: '',
      region: 'us-east-1',
      active: true,
    })
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">Carregando buckets...</div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-gray-800">Meus Buckets</h2>
        <button
          onClick={() => {
            if (showForm) {
              handleCancel()
            } else {
              setShowForm(true)
              setEditingBucket(null)
            }
          }}
          className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
        >
          {showForm ? 'Cancelar' : '+ Novo Bucket'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6 p-4 bg-gray-50 rounded-lg">
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
          <div className="flex gap-2 mt-4">
            <button
              type="submit"
              disabled={submitting}
              className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Salvando...' : editingBucket ? 'Atualizar' : 'Criar Bucket'}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={submitting}
              className="bg-gray-300 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-400 disabled:opacity-50 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {buckets.length === 0 ? (
        <p className="text-gray-500 text-center py-8">
          Nenhum bucket configurado. Adicione um bucket para começar.
        </p>
      ) : (
        <div className="space-y-2">
          {buckets.map((bucket) => (
            <div
              key={bucket.id}
              onClick={() => bucket.active && onBucketSelect(bucket)}
              className={`p-4 border-2 rounded-lg transition-colors ${
                selectedBucket?.id === bucket.id
                  ? 'border-primary-500 bg-primary-50'
                  : bucket.active
                  ? 'border-gray-200 hover:border-primary-300 cursor-pointer'
                  : 'border-gray-200 bg-gray-100 opacity-60'
              }`}
            >
              <div className="flex justify-between items-center">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-800">{bucket.name}</h3>
                    {!bucket.active && (
                      <span className="px-2 py-1 text-xs bg-gray-300 text-gray-700 rounded">
                        Inativo
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">
                    {bucket.bucket_name} • {bucket.region}
                  </p>
                </div>
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={(e) => handleToggleActive(bucket, e)}
                    className={`px-3 py-1 text-sm rounded transition-colors ${
                      bucket.active
                        ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                    }`}
                    title={bucket.active ? 'Desativar' : 'Ativar'}
                  >
                    {bucket.active ? 'Desativar' : 'Ativar'}
                  </button>
                  <button
                    onClick={(e) => handleEdit(bucket, e)}
                    className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                    title="Editar"
                  >
                    Editar
                  </button>
                  <button
                    onClick={(e) => handleDelete(bucket, e)}
                    disabled={deleting === bucket.id}
                    className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50 transition-colors"
                    title="Deletar"
                  >
                    {deleting === bucket.id ? '...' : 'Deletar'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

