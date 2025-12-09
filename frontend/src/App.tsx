import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { Bucket } from './lib/api'
import Login from './components/Login'
import Header from './components/Header'
import FileList from './components/FileList'
import FileUpload from './components/FileUpload'
import LogsView from './components/LogsView'
import { bucketApi } from './lib/api'

function App() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [selectedBucket, setSelectedBucket] = useState<Bucket | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [showLogs, setShowLogs] = useState(false)
  const [buckets, setBuckets] = useState<Bucket[]>([])

  useEffect(() => {
    // Verifica sessão atual
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Escuta mudanças de autenticação
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (user) {
      loadBuckets()
    }
  }, [user])

  const loadBuckets = async () => {
    try {
      const data = await bucketApi.list()
      // Garante que data é um array antes de usar
      if (Array.isArray(data)) {
        setBuckets(data)
      } else {
        console.error('Dados retornados não são um array:', data)
        setBuckets([])
      }
    } catch (err: any) {
      console.error('Erro ao carregar buckets:', err)
      setBuckets([])
      // Log mais detalhado para ajudar no debug
      if (err.message?.includes('Backend não está respondendo')) {
        console.error('💡 Dica: Certifique-se de que o backend está rodando:')
        console.error('   cd backend')
        console.error('   uvicorn app.main:app --reload --port 8000')
      }
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setSelectedBucket(null)
  }

  const handleUploadSuccess = () => {
    // Força recarregamento da lista de arquivos
    setRefreshKey(prev => prev + 1)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Carregando...</div>
      </div>
    )
  }

  if (!user) {
    return <Login onLoginSuccess={() => {
      // Recarrega a sessão após login bem-sucedido
      supabase.auth.getSession().then(({ data: { session } }) => {
        setUser(session?.user ?? null)
      })
    }} />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        selectedBucket={selectedBucket}
        onBucketSelect={setSelectedBucket}
        onShowLogs={() => setShowLogs(!showLogs)}
        onLogout={handleLogout}
        showLogs={showLogs}
      />

      {/* Main Content */}
      <main className="w-full px-4 sm:px-6 lg:px-8 py-8">
        {showLogs ? (
          <LogsView 
            buckets={buckets} 
            onBackToFiles={() => setShowLogs(false)}
          />
        ) : (
          <>
            {selectedBucket && (
              <>
                <FileUpload
                  bucket={selectedBucket}
                  onUploadSuccess={handleUploadSuccess}
                />
                <FileList key={refreshKey} bucket={selectedBucket} />
              </>
            )}
            {!selectedBucket && (
              <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
                Selecione um bucket no menu acima para começar.
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}

export default App

