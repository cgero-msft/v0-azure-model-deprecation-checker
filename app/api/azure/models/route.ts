import { type NextRequest, NextResponse } from "next/server"

interface AzureDeployment {
  id: string
  name: string
  properties: {
    model: {
      name: string
      version: string
      format: string
    }
    provisioningState: string
    deploymentId: string
    capabilities: Record<string, any>
    raiPolicyName?: string
  }
}

interface AzureResource {
  id: string
  name: string
  location: string
  properties: {
    endpoint: string
  }
}

interface AzureModel {
  id: string
  object: string
  created_at: number
  lifecycle_status?: string
  deprecation?: {
    fine_tune?: number
    inference?: number
  }
  capabilities?: {
    fine_tune?: boolean
    inference?: boolean
    completion?: boolean
    chat_completion?: boolean
    embeddings?: boolean
  }
}

interface ModelsListResponse {
  data: AzureModel[]
  object: string
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const subscriptionId = searchParams.get("subscriptionId")
  const accessToken = searchParams.get("accessToken")

  if (!subscriptionId) {
    return NextResponse.json({ error: "Subscription ID is required" }, { status: 400 })
  }

  if (!accessToken) {
    return NextResponse.json({ error: "Access token is required" }, { status: 400 })
  }

  try {
    console.log("[v0] Fetching Azure OpenAI resources for subscription:", subscriptionId)

    const resourcesResponse = await fetch(
      `https://management.azure.com/subscriptions/${subscriptionId}/providers/Microsoft.CognitiveServices/accounts?api-version=2024-10-01&$filter=kind eq 'OpenAI'`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      },
    )

    if (!resourcesResponse.ok) {
      console.log("[v0] Failed to fetch resources:", resourcesResponse.status, resourcesResponse.statusText)
      const errorText = await resourcesResponse.text()
      console.log("[v0] Resource fetch error details:", errorText)
      throw new Error(`Failed to fetch Azure resources: ${resourcesResponse.status} - ${resourcesResponse.statusText}`)
    }

    const resourcesData = await resourcesResponse.json()
    console.log("[v0] Found", resourcesData.value?.length || 0, "OpenAI resources")

    const allModels = []

    for (const resource of resourcesData.value || []) {
      try {
        console.log("[v0] Fetching deployments for resource:", resource.name)

        const resourceGroup = resource.id.split("/")[4]
        const resourceName = resource.name
        const region = resource.location
        const endpoint = resource.properties.endpoint

        const modelsWithDeprecation: Map<string, AzureModel> = new Map()
        try {
          const modelsResponse = await fetch(`${endpoint}/openai/models?api-version=2024-10-21`, {
            headers: {
              "api-key": accessToken,
              "Content-Type": "application/json",
            },
          })

          if (modelsResponse.ok) {
            const modelsData: ModelsListResponse = await modelsResponse.json()
            console.log("[v0] Fetched", modelsData.data?.length || 0, "models with deprecation info for", resourceName)

            // Create a map of model names to their deprecation info
            modelsData.data.forEach((model) => {
              modelsWithDeprecation.set(model.id, model)
            })
          } else {
            console.log("[v0] Could not fetch models list for", resourceName, "- status:", modelsResponse.status)
          }
        } catch (modelsError) {
          console.log("[v0] Error fetching models list for", resourceName, ":", modelsError)
        }

        // Get deployments using Management API
        const deploymentsResponse = await fetch(
          `https://management.azure.com/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.CognitiveServices/accounts/${resourceName}/deployments?api-version=2024-10-01`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
          },
        )

        if (!deploymentsResponse.ok) {
          console.log("[v0] Failed to fetch deployments for resource:", resourceName, deploymentsResponse.status)
          const errorText = await deploymentsResponse.text()
          console.log("[v0] Deployments error details:", errorText.substring(0, 200))
          continue
        }

        let deploymentsData
        try {
          const deploymentsText = await deploymentsResponse.text()
          deploymentsData = JSON.parse(deploymentsText)
        } catch (parseError) {
          console.log("[v0] Error parsing deployments response for resource:", resourceName, parseError)
          continue
        }

        console.log("[v0] Found", deploymentsData.value?.length || 0, "deployments in", resourceName)

        for (const deployment of deploymentsData.value || []) {
          const modelName = deployment.properties?.model?.name || "unknown"
          const modelVersion = deployment.properties?.model?.version || "unknown"

          let status = "active"
          let deprecationDate = null
          let retirementDate = null

          // Look up deprecation info from the models API
          const modelInfo = modelsWithDeprecation.get(modelName)
          if (modelInfo?.deprecation) {
            // If there's a deprecation timestamp, the model is deprecated
            if (modelInfo.deprecation.inference) {
              const inferenceDeprecationTime = modelInfo.deprecation.inference * 1000 // Convert to milliseconds
              deprecationDate = new Date(inferenceDeprecationTime).toISOString().split("T")[0]

              // Estimate retirement date as 6 months after deprecation if not explicitly provided
              const sixMonthsAfterDeprecation = inferenceDeprecationTime + 6 * 30 * 24 * 60 * 60 * 1000
              retirementDate = new Date(sixMonthsAfterDeprecation).toISOString().split("T")[0]

              status = "deprecated"

              // Check if retirement is within 6 months from now
              const now = Date.now()
              const sixMonthsFromNow = now + 6 * 30 * 24 * 60 * 60 * 1000
              if (sixMonthsAfterDeprecation <= sixMonthsFromNow) {
                status = "retiring"
              }
            }
          }

          allModels.push({
            id: `${resourceName}-${deployment.name}`,
            name: modelName,
            version: modelVersion,
            status,
            deprecationDate,
            retirementDate,
            resourceGroup,
            region,
            deploymentName: deployment.name,
            capabilities: deployment.properties?.capabilities ? Object.keys(deployment.properties.capabilities) : [],
            resourceName,
            provisioningState: deployment.properties?.provisioningState || "unknown",
            deploymentId: deployment.properties?.deploymentId,
          })
        }
      } catch (error) {
        console.log("[v0] Error processing resource:", resource.name, error.message)
        continue
      }
    }

    console.log("[v0] Total models found:", allModels.length)
    return NextResponse.json({ models: allModels })
  } catch (error) {
    console.error("[v0] Error fetching Azure models:", error)
    return NextResponse.json(
      {
        error: `Failed to fetch models from Azure: ${error.message}. Please check your subscription ID and access token permissions.`,
      },
      { status: 500 },
    )
  }
}
