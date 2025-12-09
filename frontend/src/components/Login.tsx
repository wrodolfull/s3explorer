import { useState } from 'react'
import { supabase } from '../lib/supabase'

interface LoginProps {
  onLoginSuccess: () => void
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) {
          console.error('Erro no login:', error)
          // Mensagens mais específicas para diferentes erros
          if (error.message.includes('Invalid login credentials')) {
            throw new Error('Email ou senha incorretos')
          } else if (error.message.includes('Email not confirmed')) {
            throw new Error('Email não confirmado. Verifique sua caixa de entrada.')
          } else if (error.status === 400) {
            throw new Error('Dados inválidos. Verifique o email e senha.')
          }
          throw error
        }
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        })
        if (error) {
          console.error('Erro no registro:', error)
          if (error.message.includes('already registered')) {
            throw new Error('Este email já está cadastrado. Faça login.')
          } else if (error.status === 422) {
            throw new Error('Dados inválidos. Verifique o email e senha (mínimo 6 caracteres).')
          }
          throw error
        }
        // Se o registro foi bem-sucedido mas requer confirmação
        if (data.user && !data.session) {
          setError('Registro realizado! Verifique seu email para confirmar a conta.')
          return
        }
      }
      onLoginSuccess()
    } catch (err: any) {
      const errorMessage = err.message || err.error_description || 'Erro ao autenticar'
      setError(errorMessage)
      console.error('Erro completo:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8">
        <h2 className="text-3xl font-bold text-center text-gray-800 mb-8">
          {isLogin ? 'Login' : 'Registro'}
        </h2>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="seu@email.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Senha
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading
              ? 'Carregando...'
              : isLogin
              ? 'Entrar'
              : 'Criar conta'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setIsLogin(!isLogin)
              setError(null)
            }}
            className="text-primary-600 hover:text-primary-700 text-sm font-medium"
          >
            {isLogin
              ? 'Não tem conta? Registre-se'
              : 'Já tem conta? Faça login'}
          </button>
        </div>
      </div>
    </div>
  )
}



