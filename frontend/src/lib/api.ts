import axios from 'axios'
import { supabase } from './supabase'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// Log da URL da API para debug (apenas em desenvolvimento)
if (import.meta.env.DEV) {
  console.log('🔧 API Base URL:', API_BASE_URL)
  if (!import.meta.env.VITE_API_URL) {
    console.warn('⚠️ VITE_API_URL não está definido. Usando padrão:', API_BASE_URL)
    console.warn('💡 Para configurar, crie um arquivo .env na pasta frontend com:')
    console.warn('   VITE_API_URL=http://localhost:8000')
  }
}

// Cria instância do axios
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Interceptor para adicionar token de autenticação
api.interceptors.request.use(
  async (config) => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession()
      if (error) {
        console.error('Erro ao obter sessão:', error)
      }
      if (session?.access_token) {
        config.headers.Authorization = `Bearer ${session.access_token}`
      } else {
        // Avisa se não há sessão (mas não bloqueia a requisição, pode ser endpoint público)
        console.warn('⚠️ Nenhuma sessão ativa. A requisição pode falhar se o endpoint requer autenticação.')
      }
    } catch (err) {
      console.error('Erro no interceptor de requisição:', err)
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Interceptor para tratar erros de resposta
api.interceptors.response.use(
  (response) => {
    // Verifica se a resposta é HTML (erro comum quando backend não está rodando)
    const contentType = response.headers['content-type'] || ''
    const responseData = response.data
    
    if (contentType.includes('text/html') || 
        (typeof responseData === 'string' && responseData.trim().startsWith('<!doctype html>'))) {
      const errorMsg = `⚠️ Backend retornou HTML em vez de JSON.\n\n` +
        `Isso geralmente significa que:\n` +
        `1. O backend não está rodando\n` +
        `2. A URL da API está incorreta (atual: ${API_BASE_URL})\n` +
        `3. O backend está redirecionando para a página inicial\n\n` +
        `Verifique se o backend está rodando e se VITE_API_URL está configurado corretamente.`
      console.error(errorMsg)
      return Promise.reject(new Error('Backend não está respondendo corretamente. Verifique se o servidor está rodando.'))
    }
    return response
  },
  (error) => {
    const status = error.response?.status
    const method = error.config?.method?.toUpperCase()
    const url = error.config?.url
    
    // Se for erro 401 (não autorizado)
    if (status === 401) {
      console.error('Erro de autenticação (401):', error)
      console.error('💡 Verifique se você está logado e se o token de autenticação é válido')
    }
    
    // Se for erro 405 (Method Not Allowed)
    if (status === 405) {
      const errorMsg = `⚠️ Método HTTP não permitido (405)\n\n` +
        `Tentativa: ${method} ${url}\n` +
        `Base URL: ${API_BASE_URL}\n\n` +
        `Possíveis causas:\n` +
        `1. O endpoint não suporta o método ${method}\n` +
        `2. Problema de configuração no servidor/reverse proxy\n` +
        `3. CORS preflight (OPTIONS) pode estar falhando\n\n` +
        `Verifique a configuração do servidor e se o endpoint está correto.`
      console.error(errorMsg)
      return Promise.reject(new Error(`Método ${method} não permitido no endpoint ${url}. Verifique a configuração do servidor.`))
    }
    
    // Se for erro de rede (backend não está rodando)
    if (error.code === 'ECONNREFUSED' || error.message?.includes('Network Error')) {
      const errorMsg = `⚠️ Não foi possível conectar ao backend em ${API_BASE_URL}\n\n` +
        `Verifique se:\n` +
        `1. O backend está rodando (uvicorn app.main:app --reload --port 8000)\n` +
        `2. VITE_API_URL está configurado corretamente no arquivo .env\n` +
        `3. Não há firewall bloqueando a conexão`
      console.error(errorMsg)
    }
    
    // Verifica se a resposta de erro é HTML
    if (error.response?.data && typeof error.response.data === 'string' && error.response.data.includes('<!doctype html>')) {
      const errorMsg = `⚠️ Backend retornou HTML em vez de JSON.\n\n` +
        `URL tentada: ${url || 'N/A'}\n` +
        `Base URL: ${API_BASE_URL}\n\n` +
        `Verifique se o backend está rodando e se VITE_API_URL está configurado corretamente.`
      console.error(errorMsg)
      return Promise.reject(new Error('Backend não está respondendo corretamente. Verifique se o servidor está rodando.'))
    }
    
    return Promise.reject(error)
  }
)

// Tipos
export interface Bucket {
  id: string
  user_id: string
  name: string
  bucket_name: string
  region: string
  active: boolean
  created_at: string
  updated_at: string
}

export interface BucketCreate {
  name: string
  bucket_name: string
  aws_access_key: string
  aws_secret_key: string
  region: string
  active?: boolean
}

export interface BucketUpdate {
  name?: string
  bucket_name?: string
  aws_access_key?: string
  aws_secret_key?: string
  region?: string
  active?: boolean
}

export interface CallMetadata {
  file_type: 'audio' | 'transcription'
  call_uuid?: string
  file_uuid?: string
  leg?: 'A' | 'B'
  phone_number?: string
  timestamp?: string
  date_path?: string
  extension?: string
}

export interface FileInfo {
  key: string
  size: number
  last_modified: string
  etag?: string
  call_metadata?: CallMetadata
}

export interface FileListResponse {
  bucket_id: string
  bucket_name: string
  files: FileInfo[]
  total: number
  page: number
  page_size: number
  has_more: boolean
  next_token?: string
}

// API Functions
export const bucketApi = {
  // Criar bucket
  create: async (bucket: BucketCreate): Promise<Bucket> => {
    const response = await api.post('/api/buckets', bucket)
    return response.data
  },

  // Listar buckets do usuário
  list: async (): Promise<Bucket[]> => {
    try {
      const response = await api.get('/api/buckets')
      // Garante que sempre retorna um array
      if (Array.isArray(response.data)) {
        return response.data
      }
      // Se não for array, verifica se é HTML (backend não está rodando)
      if (typeof response.data === 'string' && response.data.includes('<!doctype html>')) {
        console.error('⚠️ Backend retornou HTML. Verifique se o servidor está rodando em', API_BASE_URL)
        throw new Error('Backend não está respondendo corretamente. Verifique se o servidor está rodando.')
      }
      // Se não for array, retorna array vazio
      console.error('API retornou dados não-array:', response.data)
      return []
    } catch (error: any) {
      // Re-throw para que o componente possa tratar
      throw error
    }
  },

  // Buscar bucket por ID
  get: async (bucketId: string): Promise<Bucket> => {
    const response = await api.get(`/api/buckets/${bucketId}`)
    return response.data
  },

  // Atualizar bucket
  update: async (bucketId: string, bucket: BucketUpdate): Promise<Bucket> => {
    const response = await api.patch(`/api/buckets/${bucketId}`, bucket)
    return response.data
  },

  // Deletar bucket
  delete: async (bucketId: string): Promise<{ message: string; bucket_id: string }> => {
    const response = await api.delete(`/api/buckets/${bucketId}`)
    return response.data
  },

  // Alternar status ativo/inativo
  toggleActive: async (bucketId: string): Promise<Bucket> => {
    const response = await api.patch(`/api/buckets/${bucketId}/toggle-active`)
    return response.data
  },
}

export const fileApi = {
  // Listar arquivos de um bucket
  list: async (
    bucketId: string,
    options?: {
      prefix?: string
      page?: number
      pageSize?: number
      nextToken?: string
      search?: string
      dateFrom?: string
      dateTo?: string
      fileExtension?: string
    }
  ): Promise<FileListResponse> => {
    const params: any = {}
    if (options?.prefix) params.prefix = options.prefix
    if (options?.page) params.page = options.page
    if (options?.pageSize) params.page_size = options.pageSize
    if (options?.nextToken) params.next_token = options.nextToken
    if (options?.search) params.search = options.search
    if (options?.dateFrom) params.date_from = options.dateFrom
    if (options?.dateTo) params.date_to = options.dateTo
    if (options?.fileExtension) params.file_extension = options.fileExtension
    const response = await api.get(`/api/buckets/${bucketId}/files`, { params })
    // Garante que a resposta tem a estrutura esperada
    if (response.data && Array.isArray(response.data.files)) {
      return response.data
    }
    // Se não tiver a estrutura esperada, retorna estrutura padrão
    console.error('API retornou dados com estrutura inválida:', response.data)
    return {
      bucket_id: bucketId,
      bucket_name: '',
      files: [],
      total: 0,
      page: options?.page || 1,
      page_size: options?.pageSize || 50,
      has_more: false,
    }
  },

  // Download múltiplo
  downloadMultiple: async (
    bucketId: string,
    fileKeys: string[]
  ): Promise<{ urls: Array<{ file_key: string; url?: string; error?: string }>; total: number }> => {
    const response = await api.post(`/api/buckets/${bucketId}/files/download-multiple`, fileKeys)
    return response.data
  },

  // Upload de arquivo
  upload: async (
    bucketId: string,
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<{ message: string; file_key: string; bucket_name: string }> => {
    const formData = new FormData()
    formData.append('file', file)

    const response = await api.post(
      `/api/buckets/${bucketId}/upload`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          if (onProgress && progressEvent.total) {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            )
            onProgress(percentCompleted)
          }
        },
      }
    )
    return response.data
  },

  // Download de arquivo (retorna URL pré-assinada)
  download: async (
    bucketId: string,
    fileKey: string
  ): Promise<{ url: string; file_key: string }> => {
    const response = await api.get(
      `/api/buckets/${bucketId}/files/${encodeURIComponent(fileKey)}/download`
    )
    return response.data
  },

  // Deletar arquivo
  delete: async (
    bucketId: string,
    fileKey: string
  ): Promise<{ message: string; file_key: string }> => {
    const response = await api.delete(
      `/api/buckets/${bucketId}/files/${encodeURIComponent(fileKey)}`
    )
    return response.data
  },

  // Buscar arquivos relacionados
  getRelated: async (
    bucketId: string,
    fileKey: string
  ): Promise<{
    current_file: { key: string; metadata: CallMetadata }
    related: {
      leg_a?: FileInfo
      leg_b?: FileInfo
      transcription?: FileInfo
    }
  }> => {
    const response = await api.get(
      `/api/buckets/${bucketId}/files/${encodeURIComponent(fileKey)}/related`
    )
    return response.data
  },

  // Ler conteúdo de arquivo (para transcrições)
  readContent: async (
    bucketId: string,
    fileKey: string
  ): Promise<{
    file_key: string
    content: any
    content_type: string
  }> => {
    const response = await api.get(
      `/api/buckets/${bucketId}/files/${encodeURIComponent(fileKey)}/read`
    )
    return response.data
  },
}

export interface Log {
  id: string
  user_id: string
  action_type: string
  bucket_id: string
  file_key: string
  created_at: string
}

export interface LogListResponse {
  logs: Log[]
  total: number
}

export const logApi = {
  // Listar logs
  list: async (
    bucketId?: string,
    actionType?: string,
    limit?: number
  ): Promise<LogListResponse> => {
    const params: any = {}
    if (bucketId) params.bucket_id = bucketId
    if (actionType) params.action_type = actionType
    if (limit) params.limit = limit
    const response = await api.get('/api/logs', { params })
    // Garante que a resposta tem a estrutura esperada
    if (response.data && Array.isArray(response.data.logs)) {
      return response.data
    }
    // Se não tiver a estrutura esperada, retorna estrutura padrão
    console.error('API retornou dados com estrutura inválida:', response.data)
    return { logs: [], total: 0 }
  },
}

