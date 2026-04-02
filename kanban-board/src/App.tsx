import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { ensureAnonymousSession } from './lib/auth'
import './App.css'

type UserType = {
  id: string
} | null

type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'done'

type Task = {
  id: string
  title: string
  status: TaskStatus
  user_id: string
  created_at: string
}

const columns: { key: TaskStatus; label: string }[] = [
  { key: 'todo', label: 'To Do' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'in_review', label: 'In Review' },
  { key: 'done', label: 'Done!' },

]

function App() {
  const [user, setUser] = useState<UserType>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [authLoading, setAuthLoading] = useState(true)
  const [taskLoading, setTaskLoading] = useState(false)
  const [authError, setAuthError] = useState('')
  const [taskError, setTaskError] = useState('')

  useEffect(() => {
    let mounted = true

    async function initAuth() {
      try {
        setAuthLoading(true)
        const session = await ensureAnonymousSession()

        if (mounted) {
          setUser(session?.user ? { id: session.user.id } : null)
        }

      } catch (error: any) {
        console.error('Anonymous auth failed:', error)
        if (mounted) {
          setAuthError(error.message || 'Failed to start guest session.')
        }

      } finally {
        if (mounted) {
          setAuthLoading(false)
        }
      }
    }

    initAuth()
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? { id: session.user.id } : null)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  async function fetchTasks() {
    try {
      setTaskLoading(true)
      setTaskError('')

      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      setTasks((data || []) as Task[])
    } catch (error: any) {
      console.error('Fetch tasks failed:', error)
      setTaskError(error.message || 'Failed to load tasks.')
    } finally {
      setTaskLoading(false)
    }
  }

  async function createTestTask() {
    if (!user?.id) return

    try {
      setTaskError('')

      const { error } = await supabase.from('tasks').insert([
        {
          title: `Task ${tasks.length + 1}`,
          status: 'todo',
          user_id: user.id,
        },
      ])

      if (error) throw error

      await fetchTasks()
    } catch (error: any) {
      console.error('Create task failed:', error)
      setTaskError(error.message || 'Failed to create task.')
    }
  }

  useEffect(() => {
    if (user?.id) {
      fetchTasks()
    }
  }, [user?.id])

  const tasksByStatus: Record<TaskStatus, Task[]> = {
    todo: tasks.filter((task) => task.status === 'todo'),
    in_progress: tasks.filter((task) => task.status === 'in_progress'),
    in_review: tasks.filter((task) => task.status === 'in_review'),
    done: tasks.filter((task) => task.status === 'done'),
  }

  if (authLoading) {
    return <div className="page-state">Starting guest session...</div>
  }

  if (authError) {
    return <div className="page-state">Error: {authError}</div>
  }

  return (
    <main className="board-page">
      <header className="board-header">
        <div>
          <h1>Kanban Board</h1>
          <p className="subtext">Guest user id: {user?.id}</p>
        </div>

        <button className="create-button" onClick={createTestTask}>
          Create Test Task
        </button>
      </header>

      {taskLoading && <p className="info-message">Loading tasks...</p>}
      {taskError && <p className="error-message">Error: {taskError}</p>}

      <section className="board-grid">
        {columns.map((column) => (
          <div key={column.key} className="board-column">
            <div className="column-header">
              <h2>{column.label}</h2>
              <span className="task-count">{tasksByStatus[column.key].length}</span>
            </div>

            <div className="column-body">
              {tasksByStatus[column.key].length === 0 ? (
                <div className="empty-state">No tasks</div>
              ) : (
                tasksByStatus[column.key].map((task) => (
                  <article key={task.id} className="task-card">
                    <h3>{task.title}</h3>
                    <p className="task-status">{task.status}</p>
                  </article>
                ))
              )}
            </div>
          </div>
        ))}
      </section>
    </main>
  )
}

export default App
