"use client"

import type React from "react"

import { CardDescription } from "@/components/ui/card"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { createPortal } from "react-dom"
import {
  Loader2,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock,
  Search,
  Settings,
  ExternalLink,
  ChevronUp,
  ChevronDown,
  X,
  Filter,
  Download,
  Copy,
  Check,
} from "lucide-react"

interface AzureModel {
  id: string
  name: string
  version: string
  status: "active" | "deprecated" | "retiring"
  deprecationDate?: string
  retirementDate?: string
  resourceGroup: string
  region: string
  deploymentName: string
  capabilities: string[]
  resourceName?: string
  createdAt?: number
  updatedAt?: number
}

type SortField =
  | "name"
  | "status"
  | "version"
  | "deploymentName"
  | "resourceName"
  | "region"
  | "deprecationDate"
  | "retirementDate"
type SortDirection = "asc" | "desc"

interface ColumnFilters {
  name: string
  status: string
  version: string
  deploymentName: string
  resourceName: string
  region: string
  deprecationDate: string
  retirementDate: string
}

function AzureModelDashboard() {
  const [models, setModels] = useState<AzureModel[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [subscriptionId, setSubscriptionId] = useState("")
  const [accessToken, setAccessToken] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [sortField, setSortField] = useState<SortField>("name")
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")

  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({
    name: "",
    status: "",
    version: "",
    deploymentName: "",
    resourceName: "",
    region: "",
    deprecationDate: "",
    retirementDate: "",
  })

  const [copied, setCopied] = useState(false)
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number } | null>(null)

  const updateColumnFilter = (column: keyof ColumnFilters, value: string) => {
    console.log("[v0] Updating column filter:", column, "to:", value)
    setColumnFilters((prev) => ({
      ...prev,
      [column]: value,
    }))
    closeDropdown() // Close dropdown after selection
  }

  const clearAllFilters = () => {
    setColumnFilters({
      name: "",
      status: "",
      version: "",
      deploymentName: "",
      resourceName: "",
      region: "",
      deprecationDate: "",
      retirementDate: "",
    })
    setSearchTerm("")
  }

  const hasActiveFilters = Object.values(columnFilters).some((filter) => filter !== "") || searchTerm !== ""

  const fetchModels = async () => {
    if (!subscriptionId.trim()) {
      setError("Please enter your Azure subscription ID")
      return
    }

    if (!accessToken.trim()) {
      setError("Please enter your Azure access token")
      return
    }

    setLoading(true)
    setError(null)

    try {
      console.log("[v0] Starting API call to fetch models")
      const response = await fetch(
        `/api/azure/models?subscriptionId=${encodeURIComponent(subscriptionId)}&accessToken=${encodeURIComponent(accessToken)}`,
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const data = await response.json()
      console.log("[v0] Received models data:", data.models?.length || 0, "models")

      setModels(data.models || [])
      setLastUpdated(new Date())
    } catch (err) {
      console.error("[v0] Error fetching models:", err)
      setError(
        err instanceof Error
          ? err.message
          : "Failed to fetch models from Azure. Please check your credentials and permissions.",
      )
    } finally {
      setLoading(false)
    }
  }

  const getAuthOptions = () => (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold text-foreground mb-2">Choose Your Authentication Method</h3>
        <p className="text-muted-foreground">Select the approach that best fits your needs</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Quick Access Token Option */}
        <Card className="border-2 border-success-green/30 bg-success-green/5">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-success-green/20 rounded-lg flex items-center justify-center">
                <Clock className="w-4 h-4 text-success-green" />
              </div>
              <CardTitle className="text-base text-foreground">Quick Start - Access Token</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-success-green" />
                <span className="text-foreground">Ready in 2 minutes</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <AlertTriangle className="w-4 h-4 text-warning-orange" />
                <span className="text-foreground">Token expires (typically 1 hour)</span>
              </div>
            </div>

            <div className="bg-muted/50 p-3 rounded-lg">
              <p className="text-sm font-medium text-foreground mb-2">Setup steps:</p>
              <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Log into Azure Portal</li>
                <li>Open the Cloud Shell</li>
                <li>Run the following command:</li>
              </ol>
              <div className="relative mt-2">
                <code className="text-xs bg-background px-2 py-1 rounded block pr-10">
                  az account get-access-token --resource https://management.azure.com/
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-0.5 h-6 w-6 p-0 hover:bg-muted"
                  onClick={() =>
                    copyToClipboard("az account get-access-token --resource https://management.azure.com/")
                  }
                >
                  {copied ? (
                    <Check className="w-3 h-3 text-success-green" />
                  ) : (
                    <Copy className="w-3 h-3 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Perfect for quick checks and testing. You'll need to refresh the token when it expires.
            </p>
          </CardContent>
        </Card>

        {/* App Registration Option */}
        <Card className="border-2 border-azure-blue/30 bg-azure-blue/5">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-azure-blue/20 rounded-lg flex items-center justify-center">
                <Settings className="w-4 h-4 text-azure-blue" />
              </div>
              <CardTitle className="text-base text-foreground">Production - App Registration</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-warning-orange" />
                <span className="text-foreground">Setup takes 10-15 minutes</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-success-green" />
                <span className="text-foreground">Long-lived permissions</span>
              </div>
            </div>

            <div className="bg-muted/50 p-3 rounded-lg">
              <p className="text-sm font-medium text-foreground mb-2">Setup steps:</p>
              <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Create app registration in Azure Portal</li>
                <li>Assign Cognitive Services Reader role</li>
                <li>Generate client secret</li>
                <li>Use client credentials flow</li>
              </ol>
            </div>

            <a
              href="https://portal.azure.com/#view/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/~/RegisteredApps"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-foreground hover:text-foreground/80 underline"
            >
              Open Azure Portal <ExternalLink className="w-3 h-3" />
            </a>

            <p className="text-xs text-muted-foreground">
              Best for production use, monitoring dashboards, and automated workflows.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )

  const getStatusBadge = (status: string, deprecationDate?: string) => {
    switch (status) {
      case "active":
        return (
          <Badge className="bg-success-green/20 text-success-green border-success-green/30">
            <CheckCircle className="w-3 h-3 mr-1" />
            Active
          </Badge>
        )
      case "deprecated":
        return (
          <Badge className="bg-warning-orange/20 text-warning-orange border-warning-orange/30">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Deprecated
          </Badge>
        )
      case "retiring":
        return (
          <Badge className="bg-danger-red/20 text-danger-red border-danger-red/30">
            <Clock className="w-3 h-3 mr-1" />
            Retiring
          </Badge>
        )
      default:
        return <Badge variant="secondary">Unknown</Badge>
    }
  }

  const exportToJSON = () => {
    const dataStr = JSON.stringify(models, null, 2)
    const dataBlob = new Blob([dataStr], { type: "application/json" })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement("a")
    link.href = url
    link.download = `azure-foundry-models-${new Date().toISOString().split("T")[0]}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const exportToCSV = () => {
    const headers = [
      "Model Name",
      "Model ID",
      "Status",
      "Version",
      "Deployment Name",
      "Resource Name",
      "Resource Group",
      "Region",
      "Deprecation Date",
      "Retirement Date",
      "Created At",
      "Updated At",
    ]

    const csvData = models.map((model) => [
      model.name,
      model.id,
      model.status,
      model.version,
      model.deploymentName,
      model.resourceName || "",
      model.resourceGroup,
      model.region,
      model.deprecationDate || "",
      model.retirementDate || "",
      model.createdAt ? new Date(model.createdAt).toISOString() : "",
      model.updatedAt ? new Date(model.updatedAt).toISOString() : "",
    ])

    const csvContent = [headers, ...csvData].map((row) => row.map((field) => `"${field}"`).join(",")).join("\n")

    const dataBlob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement("a")
    link.href = url
    link.download = `azure-foundry-models-${new Date().toISOString().split("T")[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <div className="w-4 h-4" />
    }
    return sortDirection === "asc" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
  }

  const getUniqueValues = (field: keyof AzureModel): string[] => {
    console.log("[v0] Getting unique values for field:", field)
    const values = models.map((model) => {
      const value = model[field]
      if (field === "deprecationDate" || field === "retirementDate") {
        return value ? new Date(value as string).toLocaleDateString() : "No Date"
      }
      return value?.toString() || "N/A"
    })
    const uniqueValues = Array.from(new Set(values)).sort()
    console.log("[v0] Unique values for", field, ":", uniqueValues)
    return uniqueValues
  }

  const hasColumnFilter = (column: keyof ColumnFilters): boolean => {
    return columnFilters[column] !== ""
  }

  const handleDocumentClick = (event: MouseEvent) => {
    if (openDropdown && !(event.target as Element).closest(".filter-dropdown")) {
      closeDropdown()
    }
  }

  const handleFilterClick = (column: string, event: React.MouseEvent) => {
    console.log("[v0] Filter button clicked for column:", column)
    event.stopPropagation()

    if (openDropdown === column) {
      closeDropdown()
    } else {
      const rect = event.currentTarget.getBoundingClientRect()
      setDropdownPosition({
        top: rect.bottom + 4, // Just add small offset below the button
        left: rect.left + rect.width / 2, // Center horizontally on the button
      })
      setOpenDropdown(column)
      console.log("[v0] Opening dropdown for column:", column, "at position:", {
        top: rect.bottom + 4,
        left: rect.left + rect.width / 2,
      })
    }
  }

  const closeDropdown = () => {
    setOpenDropdown(null)
    setDropdownPosition(null)
  }

  useEffect(() => {
    const handleScroll = () => {
      if (openDropdown && dropdownPosition) {
        // Close dropdown on scroll to prevent positioning issues
        closeDropdown()
      }
    }

    const handleResize = () => {
      if (openDropdown) {
        closeDropdown()
      }
    }

    document.addEventListener("click", handleDocumentClick)
    window.addEventListener("scroll", handleScroll, true)
    window.addEventListener("resize", handleResize)

    return () => {
      document.removeEventListener("click", handleDocumentClick)
      window.removeEventListener("scroll", handleScroll, true)
      window.removeEventListener("resize", handleResize)
    }
  }, [openDropdown, dropdownPosition])

  const filteredAndSortedModels = models
    .filter((model) => {
      // Global search filter
      const matchesSearch =
        searchTerm === "" ||
        model.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        model.deploymentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        model.resourceGroup.toLowerCase().includes(searchTerm.toLowerCase())

      const matchesColumnFilters =
        (columnFilters.name === "" || model.name === columnFilters.name) &&
        (columnFilters.status === "" || model.status === columnFilters.status) &&
        (columnFilters.version === "" || model.version === columnFilters.version) &&
        (columnFilters.deploymentName === "" || model.deploymentName === columnFilters.deploymentName) &&
        (columnFilters.resourceName === "" || (model.resourceName || "N/A") === columnFilters.resourceName) &&
        (columnFilters.region === "" || model.region === columnFilters.region) &&
        (columnFilters.deprecationDate === "" ||
          (model.deprecationDate ? new Date(model.deprecationDate).toLocaleDateString() : "No Date") ===
            columnFilters.deprecationDate) &&
        (columnFilters.retirementDate === "" ||
          (model.retirementDate ? new Date(model.retirementDate).toLocaleDateString() : "No Date") ===
            columnFilters.retirementDate)

      return matchesSearch && matchesColumnFilters
    })
    .sort((a, b) => {
      let aValue: string | number = ""
      let bValue: string | number = ""

      switch (sortField) {
        case "name":
          aValue = a.name.toLowerCase()
          bValue = b.name.toLowerCase()
          break
        case "status":
          aValue = a.status
          bValue = b.status
          break
        case "version":
          aValue = a.version
          bValue = b.version
          break
        case "deploymentName":
          aValue = a.deploymentName.toLowerCase()
          bValue = b.deploymentName.toLowerCase()
          break
        case "resourceName":
          aValue = (a.resourceName || "").toLowerCase()
          bValue = (b.resourceName || "").toLowerCase()
          break
        case "region":
          aValue = a.region.toLowerCase()
          bValue = b.region.toLowerCase()
          break
        case "deprecationDate":
          aValue = a.deprecationDate ? new Date(a.deprecationDate).getTime() : 0
          bValue = b.deprecationDate ? new Date(b.deprecationDate).getTime() : 0
          break
        case "retirementDate":
          aValue = a.retirementDate ? new Date(a.retirementDate).getTime() : 0
          bValue = b.retirementDate ? new Date(b.retirementDate).getTime() : 0
          break
      }

      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1
      return 0
    })

  const deprecatedCount = models.filter((m) => m.status === "deprecated" || m.status === "retiring").length

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy text: ", err)
    }
  }

  const FilterDropdown = ({ column, fieldKey }: { column: string; fieldKey: keyof AzureModel }) => {
    if (openDropdown !== column || !dropdownPosition) return null

    const uniqueValues = getUniqueValues(fieldKey)
    console.log(`[v0] Rendering dropdown for ${column} with ${uniqueValues.length} unique values:`, uniqueValues)

    const dropdownContent = (
      <div
        className="filter-dropdown fixed z-[9999] bg-background border border-border rounded-md shadow-lg py-1 min-w-[200px] max-h-60 overflow-y-auto"
        style={{
          position: "fixed",
          top: `${dropdownPosition.top}px`,
          left: `${dropdownPosition.left}px`,
          transform: "translateX(-50%)", // Center horizontally relative to the button
        }}
      >
        <button
          className="w-full px-3 py-2 text-left text-sm hover:bg-muted font-medium"
          onClick={() => {
            console.log(`[v0] Clearing ${column} filter`)
            updateColumnFilter(column as keyof ColumnFilters, "")
          }}
        >
          All{" "}
          {column === "name"
            ? "Models"
            : column === "status"
              ? "Status"
              : column === "version"
                ? "Versions"
                : column === "deploymentName"
                  ? "Deployments"
                  : column === "resourceName"
                    ? "Resources"
                    : column === "region"
                      ? "Regions"
                      : "Dates"}
        </button>
        <div className="border-t border-border my-1" />
        {uniqueValues.map((value, index) => {
          console.log(`[v0] Rendering ${column} option:`, value, "index:", index)
          return (
            <button
              key={`${column}-${value}-${index}`}
              className={`w-full px-3 py-2 text-left text-sm hover:bg-muted ${
                columnFilters[column as keyof ColumnFilters] === value ? "bg-azure-blue/10" : ""
              }`}
              onClick={() => {
                console.log(`[v0] Selecting ${column} filter:`, value)
                updateColumnFilter(column as keyof ColumnFilters, value)
              }}
            >
              {value}
            </button>
          )
        })}
      </div>
    )

    return typeof document !== "undefined" ? createPortal(dropdownContent, document.body) : null
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg flex items-center justify-center">
                <img src="/logo.png" alt="Azure AI Foundry Logo" className="w-12 h-12 object-contain" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-foreground">Azure AI Foundry Model Lifecycle Monitor</h1>
                <p className="text-sm text-muted-foreground">Track model deployments and deprecation dates</p>
              </div>
            </div>
            {lastUpdated && (
              <div className="text-sm text-muted-foreground">Last updated: {lastUpdated.toLocaleTimeString()}</div>
            )}
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8 space-y-6">
        {/* Configuration Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Azure Configuration</CardTitle>
            <CardDescription>Enter your Azure credentials to fetch Foundry model deployments</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <Input
                placeholder="Azure Subscription ID"
                value={subscriptionId}
                onChange={(e) => setSubscriptionId(e.target.value)}
                className="w-full"
              />
              <Input
                type="password"
                placeholder="Azure Access Token"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                className="w-full"
              />
              <Button
                onClick={fetchModels}
                disabled={loading}
                className="bg-azure-blue hover:bg-azure-blue/90 w-full sm:w-auto"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Fetching Models...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Fetch Models
                  </>
                )}
              </Button>
            </div>

            {!accessToken && getAuthOptions()}

            {error && (
              <Alert className="border-danger-red/30 bg-danger-red/10">
                <AlertTriangle className="h-4 w-4 text-danger-red" />
                <AlertDescription className="text-danger-red">{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {models.length > 0 && (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Models</p>
                      <p className="text-2xl font-bold text-foreground">{models.length}</p>
                    </div>
                    <div className="w-12 h-12 bg-azure-blue/20 rounded-lg flex items-center justify-center">
                      <Settings className="w-6 h-6 text-azure-blue" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Active Models</p>
                      <p className="text-2xl font-bold text-success-green">
                        {models.filter((m) => m.status === "active").length}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-success-green/20 rounded-lg flex items-center justify-center">
                      <CheckCircle className="w-6 h-6 text-success-green" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Deprecated</p>
                      <p className="text-2xl font-bold text-warning-orange">{deprecatedCount}</p>
                    </div>
                    <div className="w-12 h-12 bg-warning-orange/20 rounded-lg flex items-center justify-center">
                      <AlertTriangle className="w-6 h-6 text-warning-orange" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Resource Groups</p>
                      <p className="text-2xl font-bold text-foreground">
                        {new Set(models.map((m) => m.resourceGroup)).size}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-muted/50 rounded-lg flex items-center justify-center">
                      <Settings className="w-6 h-6 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Models Table */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Model Deployments</CardTitle>
                    <CardDescription>All Foundry models deployed across your Azure subscription</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                      <Input
                        placeholder="Search models..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 w-64"
                      />
                    </div>
                    {hasActiveFilters && (
                      <Button
                        onClick={clearAllFilters}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-1 bg-transparent"
                      >
                        <X className="w-4 h-4" />
                        Clear Filters
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead
                          className="font-semibold cursor-pointer hover:bg-muted/70 select-none"
                          onClick={() => handleSort("name")}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1">
                              Model
                              <SortIcon field="name" />
                            </div>
                            <div className="relative">
                              <Button
                                variant="ghost"
                                size="sm"
                                className={`h-6 w-6 p-0 ${hasColumnFilter("name") ? "text-azure-blue" : "text-muted-foreground"}`}
                                onClick={(e) => handleFilterClick("name", e)}
                              >
                                <Filter className="h-3 w-3" />
                              </Button>
                              <FilterDropdown column="name" fieldKey="name" />
                            </div>
                          </div>
                        </TableHead>
                        <TableHead
                          className="font-semibold cursor-pointer hover:bg-muted/70 select-none"
                          onClick={() => handleSort("status")}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1">
                              Status
                              <SortIcon field="status" />
                            </div>
                            <div className="relative">
                              <Button
                                variant="ghost"
                                size="sm"
                                className={`h-6 w-6 p-0 ${hasColumnFilter("status") ? "text-azure-blue" : "text-muted-foreground"}`}
                                onClick={(e) => handleFilterClick("status", e)}
                              >
                                <Filter className="h-3 w-3" />
                              </Button>
                              <FilterDropdown column="status" fieldKey="status" />
                            </div>
                          </div>
                        </TableHead>
                        <TableHead
                          className="font-semibold cursor-pointer hover:bg-muted/70 select-none"
                          onClick={() => handleSort("version")}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1">
                              Version
                              <SortIcon field="version" />
                            </div>
                            <div className="relative">
                              <Button
                                variant="ghost"
                                size="sm"
                                className={`h-6 w-6 p-0 ${hasColumnFilter("version") ? "text-azure-blue" : "text-muted-foreground"}`}
                                onClick={(e) => handleFilterClick("version", e)}
                              >
                                <Filter className="h-3 w-3" />
                              </Button>
                              <FilterDropdown column="version" fieldKey="version" />
                            </div>
                          </div>
                        </TableHead>
                        <TableHead
                          className="font-semibold cursor-pointer hover:bg-muted/70 select-none"
                          onClick={() => handleSort("deploymentName")}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1">
                              Deployment
                              <SortIcon field="deploymentName" />
                            </div>
                            <div className="relative">
                              <Button
                                variant="ghost"
                                size="sm"
                                className={`h-6 w-6 p-0 ${hasColumnFilter("deploymentName") ? "text-azure-blue" : "text-muted-foreground"}`}
                                onClick={(e) => handleFilterClick("deploymentName", e)}
                              >
                                <Filter className="h-3 w-3" />
                              </Button>
                              <FilterDropdown column="deploymentName" fieldKey="deploymentName" />
                            </div>
                          </div>
                        </TableHead>
                        <TableHead
                          className="font-semibold cursor-pointer hover:bg-muted/70 select-none"
                          onClick={() => handleSort("resourceName")}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1">
                              Resource
                              <SortIcon field="resourceName" />
                            </div>
                            <div className="relative">
                              <Button
                                variant="ghost"
                                size="sm"
                                className={`h-6 w-6 p-0 ${hasColumnFilter("resourceName") ? "text-azure-blue" : "text-muted-foreground"}`}
                                onClick={(e) => handleFilterClick("resourceName", e)}
                              >
                                <Filter className="h-3 w-3" />
                              </Button>
                              <FilterDropdown column="resourceName" fieldKey="resourceName" />
                            </div>
                          </div>
                        </TableHead>
                        <TableHead
                          className="font-semibold cursor-pointer hover:bg-muted/70 select-none"
                          onClick={() => handleSort("region")}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1">
                              Region
                              <SortIcon field="region" />
                            </div>
                            <div className="relative">
                              <Button
                                variant="ghost"
                                size="sm"
                                className={`h-6 w-6 p-0 ${hasColumnFilter("region") ? "text-azure-blue" : "text-muted-foreground"}`}
                                onClick={(e) => handleFilterClick("region", e)}
                              >
                                <Filter className="h-3 w-3" />
                              </Button>
                              <FilterDropdown column="region" fieldKey="region" />
                            </div>
                          </div>
                        </TableHead>
                        <TableHead
                          className="font-semibold cursor-pointer hover:bg-muted/70 select-none"
                          onClick={() => handleSort("deprecationDate")}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1">
                              Deprecation Date
                              <SortIcon field="deprecationDate" />
                            </div>
                            <div className="relative">
                              <Button
                                variant="ghost"
                                size="sm"
                                className={`h-6 w-6 p-0 ${hasColumnFilter("deprecationDate") ? "text-azure-blue" : "text-muted-foreground"}`}
                                onClick={(e) => handleFilterClick("deprecationDate", e)}
                              >
                                <Filter className="h-3 w-3" />
                              </Button>
                              <FilterDropdown column="deprecationDate" fieldKey="deprecationDate" />
                            </div>
                          </div>
                        </TableHead>
                        <TableHead
                          className="font-semibold cursor-pointer hover:bg-muted/70 select-none"
                          onClick={() => handleSort("retirementDate")}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1">
                              Retirement Date
                              <SortIcon field="retirementDate" />
                            </div>
                            <div className="relative">
                              <Button
                                variant="ghost"
                                size="sm"
                                className={`h-6 w-6 p-0 ${hasColumnFilter("retirementDate") ? "text-azure-blue" : "text-muted-foreground"}`}
                                onClick={(e) => handleFilterClick("retirementDate", e)}
                              >
                                <Filter className="h-3 w-3" />
                              </Button>
                              <FilterDropdown column="retirementDate" fieldKey="retirementDate" />
                            </div>
                          </div>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAndSortedModels.map((model, index) => (
                        <TableRow key={`${model.id}-${model.deploymentName}-${index}`} className="hover:bg-muted/30">
                          <TableCell>
                            <div>
                              <div className="font-medium text-foreground">{model.name}</div>
                              <div className="text-sm text-muted-foreground font-mono">{model.id}</div>
                            </div>
                          </TableCell>
                          <TableCell>{getStatusBadge(model.status, model.deprecationDate)}</TableCell>
                          <TableCell>
                            <code className="bg-muted px-2 py-1 rounded text-sm font-mono">{model.version}</code>
                          </TableCell>
                          <TableCell className="font-mono text-sm">{model.deploymentName}</TableCell>
                          <TableCell>
                            <div>
                              <div className="text-sm font-medium">{model.resourceName}</div>
                              <div className="text-xs text-muted-foreground">{model.resourceGroup}</div>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{model.region}</TableCell>
                          <TableCell>
                            {model.deprecationDate ? (
                              <span className="text-warning-orange font-medium">
                                {new Date(model.deprecationDate).toLocaleDateString()}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {model.retirementDate ? (
                              <span className="text-danger-red font-medium">
                                {new Date(model.retirementDate).toLocaleDateString()}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {filteredAndSortedModels.length === 0 && (searchTerm || hasActiveFilters) && (
                  <div className="text-center py-8 text-muted-foreground">
                    No models found matching the current filters
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Export Section */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Export Data</CardTitle>
                <CardDescription>Download your model deployment data for external analysis</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button onClick={exportToJSON} variant="outline" className="flex items-center gap-2 bg-transparent">
                    <Download className="w-4 h-4" />
                    Export as JSON
                  </Button>
                  <Button onClick={exportToCSV} variant="outline" className="flex items-center gap-2 bg-transparent">
                    <Download className="w-4 h-4" />
                    Export as CSV
                  </Button>
                  <div className="text-sm text-muted-foreground flex items-center">
                    {filteredAndSortedModels.length} model{filteredAndSortedModels.length !== 1 ? "s" : ""} will be
                    exported
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {models.length === 0 && !loading && (
          <Card>
            <CardContent className="py-12 text-center">
              <Settings className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No Models Found</h3>
              <p className="text-muted-foreground mb-4">
                Enter your Azure credentials above to fetch your Foundry model deployments
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

export { AzureModelDashboard }
