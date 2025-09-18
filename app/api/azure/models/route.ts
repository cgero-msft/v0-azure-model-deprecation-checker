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

          const deprecatedModels = {
            "gpt-35-turbo": { deprecation: "2024-07-05", retirement: "2025-01-05" },
            "gpt-35-turbo-16k": { deprecation: "2024-07-05", retirement: "2025-01-05" },
            "text-embedding-ada-002": { deprecation: "2024-12-01", retirement: "2025-06-01" },
            "text-davinci-003": { deprecation: "2024-01-04", retirement: "2024-07-04" },
            "text-curie-001": { deprecation: "2024-01-04", retirement: "2024-07-04" },
            "text-babbage-001": { deprecation: "2024-01-04", retirement: "2024-07-04" },
            "text-ada-001": { deprecation: "2024-01-04", retirement: "2024-07-04" },
            "code-davinci-002": { deprecation: "2024-01-04", retirement: "2024-07-04" },
            "code-cushman-001": { deprecation: "2024-01-04", retirement: "2024-07-04" },
          }

          // Check for deprecated models
          if (deprecatedModels[modelName]) {
            status = "deprecated"
            deprecationDate = deprecatedModels[modelName].deprecation
            retirementDate = deprecatedModels[modelName].retirement
          }

          // Check if retirement is within 6 months
          if (retirementDate) {
            const retirementTime = new Date(retirementDate).getTime()
            const now = Date.now()
            const sixMonthsFromNow = now + 6 * 30 * 24 * 60 * 60 * 1000

            if (retirementTime <= sixMonthsFromNow) {
              status = "retiring"
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
