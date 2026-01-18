'use client'

import { useState, useEffect } from 'react'
import { Check, ChevronDown, ChevronUp } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Card } from '@/app/components/ui/card'
import { Button } from '@/app/components/ui/button'
import { Badge } from '@/app/components/ui/badge'
import { Checkbox } from '@/app/components/ui/checkbox'
import SimpleBar from 'simplebar-react'
import 'simplebar-react/dist/simplebar.min.css'

interface NextStep {
  id: string
  title: string
  description: string
  href: string
  completed: boolean
}

const defaultSteps: NextStep[] = [
  {
    id: 'connect-data',
    title: 'Connect your first data source',
    description: 'Import leads from CSV or connect an external data provider',
    href: '/dashboard/leads',
    completed: false
  },
  {
    id: 'explore-map',
    title: 'Explore properties on the map',
    description: 'Visualize your leads geographically to identify hot markets',
    href: '/dashboard/leads?view=map',
    completed: false
  }
]

export default function NextSteps() {
  const [steps, setSteps] = useState<NextStep[]>(defaultSteps)
  const [hideCompleted, setHideCompleted] = useState(false)
  const [expandedStep, setExpandedStep] = useState<string | null>(null)
  const router = useRouter()

  // Load progress from localStorage (in production, this would come from Supabase)
  useEffect(() => {
    const saved = localStorage.getItem('next_steps_progress')
    if (saved) {
      try {
        const savedSteps = JSON.parse(saved)
        setSteps(savedSteps)
      } catch (e) {
        console.error('Failed to load next steps progress:', e)
      }
    }
  }, [])

  // Save progress to localStorage
  const saveProgress = (updatedSteps: NextStep[]) => {
    localStorage.setItem('next_steps_progress', JSON.stringify(updatedSteps))
    // In production, also save to Supabase:
    // await supabase.from('users').update({ next_steps_progress: updatedSteps }).eq('id', userId)
  }

  const toggleStep = (id: string) => {
    const updatedSteps = steps.map(step =>
      step.id === id ? { ...step, completed: !step.completed } : step
    )
    setSteps(updatedSteps)
    saveProgress(updatedSteps)
  }

  const handleStart = (href: string) => {
    router.push(href)
  }

  const visibleSteps = hideCompleted ? steps.filter(s => !s.completed) : steps
  const completedCount = steps.filter(s => s.completed).length

  if (visibleSteps.length === 0) {
    return null
  }

  return (
    <Card className="mb-8">
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h4 className="card-title">Your next actions</h4>
            <p className="card-subtitle">
              Explore recommended actions to build on your setup and unlock more value
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={hideCompleted}
                onCheckedChange={(checked) => setHideCompleted(checked as boolean)}
              />
              <span className="text-sm text-gray-600 dark:text-gray-400">Hide completed</span>
            </label>
          </div>
        </div>

        {/* Progress Indicator */}
        {completedCount > 0 && (
          <div className="mb-4">
            <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
              <span>Account Setup</span>
              <span>{completedCount} of {steps.length} completed</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(completedCount / steps.length) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Steps List */}
      <SimpleBar className="max-h-[500px]">
        <div className="space-y-3">
          {visibleSteps.map((step) => (
            <div
              key={step.id}
              className="bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden transition-opacity duration-300"
              style={{ opacity: step.completed ? 0.6 : 1 }}
            >
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="mt-1">
                      <Checkbox
                        checked={step.completed}
                        onCheckedChange={() => toggleStep(step.id)}
                      />
                    </div>
                    <div className="flex-1">
                      <h6 className={`text-sm font-medium mb-1 ${step.completed ? 'text-gray-500 dark:text-gray-500 line-through' : 'text-gray-900 dark:text-white'}`}>
                        {step.title}
                      </h6>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{step.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {step.completed ? (
                      <Badge variant="lightSuccess" className="rounded-md py-1.5 text-sm">
                        Completed
                      </Badge>
                    ) : (
                      <Button
                        onClick={() => handleStart(step.href)}
                        variant="default"
                        size="sm"
                      >
                        Start
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setExpandedStep(expandedStep === step.id ? null : step.id)}
                    >
                      {expandedStep === step.id ? (
                        <ChevronUp className="w-5 h-5" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </SimpleBar>
    </Card>
  )
}

