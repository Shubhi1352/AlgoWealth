'use client'

/**
 * Dashboard Page
 *
 * Main dashboard for AlgoWealth paper trading platform.
 * Features:
 *  - Portfolio overview with virtual balance
 *  - Watchlist management
 *  - Trade history
 *  - AI agent performance metrics
 */

import { useEffect, useState } from 'react'

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Simulate initial data load
    const timer = setTimeout(() => {
      setLoading(false)
    }, 500)

    return () => clearTimeout(timer)
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white" />
      </div>
    )
  }

  return (
    <div className="min-h-screen p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Dashboard</h1>
        <p className="text-white/60">Welcome back to your trading dashboard</p>
      </div>

      {/* Portfolio Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
          <h3 className="text-white/80 text-sm font-medium mb-2">Virtual Balance</h3>
          <p className="text-3xl font-bold text-white">$100,000.00</p>
          <p className="text-green-400 text-sm mt-2">+$0.00 (0.00%)</p>
        </div>

        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
          <h3 className="text-white/80 text-sm font-medium mb-2">Total Trades</h3>
          <p className="text-3xl font-bold text-white">0</p>
          <p className="text-white/60 text-sm mt-2">All time</p>
        </div>

        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
          <h3 className="text-white/80 text-sm font-medium mb-2">Win Rate</h3>
          <p className="text-3xl font-bold text-white">0%</p>
          <p className="text-white/60 text-sm mt-2">No trades yet</p>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Watchlist */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
          <h2 className="text-xl font-semibold text-white mb-4">Watchlist</h2>
          <div className="text-white/60 text-center py-8">
            <p>Your watchlist is empty</p>
            <p className="text-sm mt-2">Add stocks to start tracking</p>
          </div>
        </div>

        {/* Recent Trades */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
          <h2 className="text-xl font-semibold text-white mb-4">Recent Trades</h2>
          <div className="text-white/60 text-center py-8">
            <p>No trades yet</p>
            <p className="text-sm mt-2">Start trading to see your history</p>
          </div>
        </div>
      </div>
    </div>
  )
}
