export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  const { ensureDatabase } = await import('./lib/db')
  try {
    await ensureDatabase()
  } catch (error) {
    console.error('Database bootstrap failed', error)
  }
}
