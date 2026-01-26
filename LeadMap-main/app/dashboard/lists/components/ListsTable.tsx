'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MoreVertical, Trash2, Edit2, Download, ArrowRight } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/app/components/ui/dropdown-menu'
import { Badge } from '@/app/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/ui/table'
import { Checkbox } from '@/app/components/ui/checkbox'
import { cn } from '@/app/lib/utils'
import { Users, Building2 } from 'lucide-react'

interface List {
  id: string
  name: string
  type?: 'people' | 'properties'
  item_count?: number
  created_at?: string
  updated_at?: string
  user_id?: string
}

type DisplayView = 'default' | 'compact' | 'detailed' | 'map'

interface ListsTableProps {
  lists: List[]
  onRefresh: () => void
  type?: 'people' | 'properties'
  displayView?: DisplayView
}

export default function ListsTable({ lists, onRefresh, type, displayView = 'default' }: ListsTableProps) {
  const router = useRouter()
  const [hoveredRow, setHoveredRow] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleDelete = async (listId: string, listName: string) => {
    if (!confirm(`Are you sure you want to delete "${listName}"? This action cannot be undone.`)) {
      return
    }
    
    try {
      setDeletingId(listId)
      const response = await fetch(`/api/lists/${listId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (response.ok) {
        onRefresh()
      } else {
        alert(data.error || 'Failed to delete list')
      }
    } catch (err) {
      console.error('Error:', err)
      alert('Failed to delete list')
    } finally {
      setDeletingId(null)
      setMenuOpen(null)
    }
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffSecs = Math.floor(diffMs / 1000)
    const diffMins = Math.floor(diffSecs / 60)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffSecs < 60) return `${diffSecs} second${diffSecs !== 1 ? 's' : ''} ago`
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    })
  }

  const handleExportCSV = async (listId: string, listName: string) => {
    try {
      // Fetch all list items (we'll get all pages)
      const response = await fetch(`/api/lists/${listId}/paginated?page=1&pageSize=1000`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        }
      })

      if (!response.ok) {
        alert('Failed to fetch list items for export')
        return
      }

      const data = await response.json()
      const items = data.data || []

      if (items.length === 0) {
        alert('No items to export')
        return
      }

      // Determine headers based on list type
      const list = lists.find(l => l.id === listId)
      const isPropertiesList = list?.type === 'properties' || type === 'properties'

      let headers: string[]
      let rows: string[][]

      if (isPropertiesList) {
        // Properties list - export listing data
        headers = [
          'Listing ID', 'Address', 'City', 'State', 'Zip Code', 'Price', 
          'Beds', 'Baths', 'Sqft', 'Status', 'Agent Name', 'Agent Email', 
          'Agent Phone', 'Score', 'Year Built', 'Last Sale Price', 'Last Sale Date', 'Property URL'
        ]
        
        rows = items.map((item: any) => [
          item.listing_id || '',
          item.street || '',
          item.city || '',
          item.state || '',
          item.zip_code || '',
          item.list_price?.toString() || '',
          item.beds?.toString() || '',
          item.full_baths?.toString() || '',
          item.sqft?.toString() || '',
          item.status || '',
          item.agent_name || '',
          item.agent_email || '',
          item.agent_phone || '',
          item.ai_investment_score?.toString() || '',
          item.year_built?.toString() || '',
          item.last_sale_price?.toString() || '',
          item.last_sale_date || '',
          item.property_url || ''
        ])
      } else {
        // People list - export contact data
        headers = [
          'Name', 'Email', 'Phone', 'Company', 'Job Title', 
          'Address', 'City', 'State', 'Zip Code', 'Source'
        ]
        
        rows = items.map((item: any) => [
          `${item.first_name || ''} ${item.last_name || ''}`.trim() || item.agent_name || '',
          item.email || item.agent_email || '',
          item.phone || item.agent_phone || '',
          item.company || '',
          item.job_title || '',
          item.address || item.street || '',
          item.city || '',
          item.state || '',
          item.zip_code || '',
          item.source || ''
        ])
      }

      // Create CSV content
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      ].join('\n')

      // Download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${listName.replace(/[^a-z0-9]/gi, '_')}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Error exporting CSV:', err)
      alert('Failed to export list')
    }
  }

  const handleAddToPipeline = (listId: string) => {
    // TODO: Implement add to pipeline functionality
    console.log('Add to pipeline:', listId)
    alert('Add to pipeline functionality coming soon')
  }

  if (lists.length === 0) {
    return (
      <div className="rounded-lg border border-stroke dark:border-strokedark bg-white dark:bg-boxdark p-12 text-center">
        <div className="text-bodydark dark:text-bodydark2 font-medium mb-2">
          No lists found
        </div>
        <div className="text-sm text-bodydark2 dark:text-bodydark2/70">
          Create your first list to get started
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-stroke dark:border-strokedark bg-white dark:bg-boxdark overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50 dark:bg-gray-800/50">
              <TableHead className="w-12">
                <Checkbox />
              </TableHead>
              <TableHead className="text-base font-semibold py-4">
                LIST NAME
              </TableHead>
              <TableHead className="text-base font-semibold py-4 text-right">
                # OF RECORDS
              </TableHead>
              <TableHead className="text-base font-semibold py-4">
                TYPE
              </TableHead>
              <TableHead className="text-base font-semibold py-4">
                CREATED BY
              </TableHead>
              <TableHead className="text-base font-semibold py-4">
                LAST MODIFIED
              </TableHead>
              <TableHead className="text-base font-semibold py-4 text-right">
                ACTIONS
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lists.map((list) => {
              const isHovered = hoveredRow === list.id
              const isDeleting = deletingId === list.id
              const listType = list.type || type || 'properties'
              
              return (
                <TableRow
                  key={list.id}
                  className={cn(
                    "cursor-pointer transition-colors",
                    isHovered && "bg-gray-50 dark:bg-gray-800/30"
                  )}
                  onMouseEnter={() => setHoveredRow(list.id)}
                  onMouseLeave={() => setHoveredRow(null)}
                  onClick={() => router.push(`/dashboard/lists/${list.id}`)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox />
                  </TableCell>
                  <TableCell>
                    <span className="text-sm font-medium text-primary hover:text-primary/80 cursor-pointer transition-colors">
                      {list.name}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-sm font-semibold text-black dark:text-white font-mono">
                      {list.item_count || 0}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={listType === 'people' ? "lightPrimary" : "lightWarning"}
                      className="inline-flex items-center gap-1"
                    >
                      {listType === 'people' ? (
                        <Users className="h-3 w-3" />
                      ) : (
                        <Building2 className="h-3 w-3" />
                      )}
                      {listType === 'people' ? 'Prospects' : 'Properties'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-bodydark dark:text-bodydark2">
                    You
                  </TableCell>
                  <TableCell className="text-sm text-bodydark dark:text-bodydark2">
                    {formatDate(list.updated_at || list.created_at)}
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleExportCSV(list.id, list.name)
                        }}
                        title="Download CSV"
                        className="h-8 w-8"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <DropdownMenu open={menuOpen === list.id} onOpenChange={(open) => setMenuOpen(open ? list.id : null)}>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation()
                            }}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem
                            className="flex gap-2 items-center cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation()
                              setMenuOpen(null)
                              // TODO: Implement edit
                              alert('Edit functionality coming soon')
                            }}
                          >
                            <Edit2 className="h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="flex gap-2 items-center cursor-pointer text-red-600 focus:text-red-600"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDelete(list.id, list.name)
                            }}
                            disabled={isDeleting}
                          >
                            <Trash2 className="h-4 w-4" />
                            {isDeleting ? 'Deleting...' : 'Delete'}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
