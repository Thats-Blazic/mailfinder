'use client'

import { ChangeEvent, FormEvent, useMemo, useState } from 'react'
import { Building2, Check, Copy, ImagePlus, LoaderCircle, Send, Sparkles, Wallet, Zap } from 'lucide-react'
import { DarkSelect } from '@/components/dark-select'

type Plan = {
  id: string
  name: string
  description: string
  price: string | number
  currency: string
  durationDays: number
  cryptoPrice: unknown
}

const planMeta: Record<string, { icon: typeof Sparkles; highlight: string; features: string[] }> = {
  STARTER: {
    icon: Sparkles,
    highlight: '30 sites / 30 min',
    features: ['Deep public crawl', 'CSV and TXT upload', '30 sites every 30 minutes'],
  },
  PRO: {
    icon: Zap,
    highlight: '1,000 sites, no wait',
    features: ['Up to 1,000 sites at once', 'No rate limit', 'Deeper sitemap crawl'],
  },
  BUSINESS: {
    icon: Building2,
    highlight: 'Highest coverage',
    features: ['Up to 1,000 sites at once', 'No rate limit', 'Widest page coverage'],
  },
}

export function BillingCheckout({
  plans,
  cryptocurrencies,
}: {
  plans: Plan[]
  cryptocurrencies: string[]
}) {
  const [planId, setPlanId] = useState(plans[1]?.id || plans[0]?.id || '')
  const [crypto, setCrypto] = useState(cryptocurrencies[0] || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [payment, setPayment] = useState<{
    id: string
    amount: string
    cryptocurrency: string
    walletAddress: string
  }>()

  const selected = plans.find((plan) => plan.id === planId)
  const cryptoAmount = useMemo(() => {
    const prices = (selected?.cryptoPrice || {}) as Record<string, number>
    return prices[crypto]
  }, [selected, crypto])

  async function startPayment(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, cryptocurrency: crypto }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || 'Unable to create payment request')
      setPayment(body.payment)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to create payment request')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-3">
        {plans.map((plan) => {
          const meta = planMeta[plan.name] || planMeta.STARTER
          const Icon = meta.icon
          const active = plan.id === planId
          return (
            <button
              key={plan.id}
              type="button"
              onClick={() => setPlanId(plan.id)}
              className={`panel p-6 text-left transition ${active ? 'ring-2 ring-cyan-300/70' : 'hover:border-white/20'}`}
            >
              <span className="grid size-10 place-items-center rounded-xl bg-cyan-300/10 text-cyan-300">
                <Icon className="size-5" />
              </span>
              <p className="mt-4 text-xs font-semibold uppercase tracking-[.16em] text-cyan-300">{plan.name}</p>
              <div className="mt-2 text-3xl font-semibold tracking-tight text-white">
                {plan.price} <span className="text-base font-medium text-slate-500">{plan.currency}</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">{plan.durationDays} days · {meta.highlight}</p>
              <p className="mt-3 text-sm leading-6 text-slate-400">{plan.description}</p>
              <ul className="mt-4 space-y-2 text-xs text-slate-300">
                {meta.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2">
                    <Check className="size-3.5 text-emerald-300" />
                    {feature}
                  </li>
                ))}
              </ul>
            </button>
          )
        })}
      </div>

      <div className="panel p-6">
        <div className="flex items-start gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-cyan-300/10 text-cyan-300">
            <Wallet className="size-5" />
          </span>
          <div>
            <h2 className="font-semibold text-white">Pay with crypto</h2>
            <p className="mt-1 text-sm leading-6 text-slate-400">
              Send the exact amount to the wallet, then upload a screenshot — the same way you would send proof on Telegram. An admin activates your plan after checking the image.
            </p>
          </div>
        </div>

        {!plans.length || !cryptocurrencies.length ? (
          <div className="notice mt-5">No plan or wallet address is configured yet.</div>
        ) : payment ? (
          <PaymentProof payment={payment} />
        ) : (
          <form onSubmit={startPayment} className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="block text-xs text-slate-300">
              Pay with
              <DarkSelect
                className="mt-2"
                value={crypto}
                onChange={setCrypto}
                options={cryptocurrencies.map((item) => ({ value: item, label: item }))}
              />
            </div>
            <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-[.14em] text-slate-500">Amount to send</p>
              <p className="mt-1 text-lg font-semibold text-white">
                {cryptoAmount ? `${cryptoAmount} ${crypto}` : 'Not priced'}
              </p>
            </div>
            {error && <div className="notice notice-error sm:col-span-2">{error}</div>}
            <button disabled={busy || !cryptoAmount} className="primary-btn sm:col-span-2">
              {busy ? <LoaderCircle className="size-4 animate-spin" /> : 'Show wallet address'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

function PaymentProof({
  payment,
}: {
  payment: { id: string; amount: string; cryptocurrency: string; walletAddress: string }
}) {
  const [copied, setCopied] = useState(false)
  const [preview, setPreview] = useState('')
  const [file, setFile] = useState<File>()
  const [telegram, setTelegram] = useState('')
  const [hash, setHash] = useState('')
  const [state, setState] = useState('')
  const [busy, setBusy] = useState(false)

  function onFile(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.files?.[0]
    if (!next) return
    setFile(next)
    setPreview(URL.createObjectURL(next))
  }

  async function copyAddress() {
    await navigator.clipboard.writeText(payment.walletAddress)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setState('')
    const form = new FormData()
    if (file) form.append('screenshot', file)
    if (telegram) form.append('telegramHandle', telegram)
    if (hash) form.append('transactionHash', hash)
    const response = await fetch(`/api/payments/${payment.id}/submit`, { method: 'POST', body: form })
    const body = await response.json().catch(() => ({}))
    setBusy(false)
    setState(response.ok ? 'Screenshot sent. An administrator will activate your plan after review.' : body.error || 'Submission failed')
  }

  return (
    <div className="mt-6 space-y-5">
      <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[.06] p-5">
        <p className="text-xs text-slate-400">Send exactly</p>
        <p className="mt-1 text-2xl font-semibold text-white">
          {payment.amount} {payment.cryptocurrency}
        </p>
        <p className="mt-4 text-[10px] uppercase tracking-[.14em] text-slate-500">Wallet address</p>
        <p className="mt-1 break-all font-mono text-sm text-white">{payment.walletAddress}</p>
        <button type="button" onClick={copyAddress} className="secondary-btn mt-4">
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? 'Copied' : 'Copy address'}
        </button>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <label className="block cursor-pointer">
          <span className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-300">
            <ImagePlus className="size-4 text-cyan-300" />
            Payment screenshot
          </span>
          <div className="grid min-h-40 place-items-center rounded-2xl border border-dashed border-white/15 bg-black/20 p-4 text-center">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Payment screenshot preview" className="max-h-64 rounded-xl object-contain" />
            ) : (
              <div>
                <Send className="mx-auto size-6 text-cyan-300" />
                <p className="mt-2 text-sm text-white">Drop or choose a screenshot</p>
                <p className="mt-1 text-xs text-slate-500">JPG, PNG, WEBP, or GIF · max 5 MB</p>
              </div>
            )}
          </div>
          <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={onFile} className="sr-only" />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-xs text-slate-300">
            Telegram username <span className="text-slate-600">(optional)</span>
            <input value={telegram} onChange={(e) => setTelegram(e.target.value)} placeholder="@username" className="field mt-2" />
          </label>
          <label className="text-xs text-slate-300">
            Transaction hash <span className="text-slate-600">(optional)</span>
            <input value={hash} onChange={(e) => setHash(e.target.value)} className="field mt-2" />
          </label>
        </div>
        <button disabled={busy || !file} className="primary-btn w-full">
          {busy ? <LoaderCircle className="size-4 animate-spin" /> : <><Send className="size-4" />Send screenshot for review</>}
        </button>
        {state && <p className="text-xs text-slate-400">{state}</p>}
      </form>
    </div>
  )
}
