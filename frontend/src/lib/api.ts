import axios from 'axios'
import { supabase } from './supabase'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

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
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token) {
      config.headers.Authorization = `Bearer ${session.access_token}`
    }
    return config
  },
  (error) => {
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
    const response = await api.get('/api/buckets')
    return response.data
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
    return response.data
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
    return response.data
  },
}

