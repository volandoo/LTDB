# FluxionDB Helm Chart

This Helm chart deploys FluxionDB, a single-pod in-memory time series database with persistent storage, to a Kubernetes cluster.

## ⚠️ Important: Single-Pod Architecture

**FluxionDB does NOT support horizontal scaling.** Each instance runs as a single pod and cannot be replicated across multiple pods.

For multi-tenancy or higher capacity:

-   Deploy multiple separate FluxionDB instances (one per tenant/database)
-   Each instance scales **vertically** (increase RAM/CPU per pod)
-   Instances are isolated in separate namespaces

## Prerequisites

-   Kubernetes 1.19+
-   Helm 3.0+
-   PersistentVolume provisioner support in the cluster (for persistence)

## Multi-Tenant Deployment

This chart is designed for multi-tenant deployments where each user gets their own isolated FluxionDB instance.

### User Inputs (Simple!)

Users only need to provide:

1. **RAM Size** (e.g., "512Mi", "1Gi", "2Gi", "4Gi")
2. **API Secret Key** (their authentication key)

**Everything else is automatic:**

-   Storage is automatically set to **2x RAM**
-   CPU limits are set based on RAM
-   Namespace is created from user ID

### Quick Start

Deploy via Helm:

```bash
# User wants 2Gi RAM - storage automatically becomes 4Gi
helm install db-user123 ./fluxiondb \
  --namespace fluxiondb-user123 \
  --create-namespace \
  --set secret.secretKey="user-secret-key" \
  --set resources.requests.memory="2Gi" \
  --set resources.limits.memory="2Gi" \
  --set persistence.size="4Gi"
```

### Update RAM Later

```bash
# User upgrades to 4Gi RAM - storage becomes 8Gi
helm upgrade db-user123 ./fluxiondb \
  --namespace fluxiondb-user123 \
  --reuse-values \
  --set resources.requests.memory="4Gi" \
  --set resources.limits.memory="4Gi" \
  --set persistence.size="8Gi"
```

### Programmatic Deployment via API

See `DEPLOYMENT_API.md` for complete guide and examples.

**Quick Go example:**

```go
deployer := NewDeployer("./helm/fluxiondb")

// Provision
info, err := deployer.Provision(ctx, FluxionDBRequest{
    UserID:  "user123",
    RamSize: "2Gi",      // User chooses RAM
    APIKey:  "secret",   // User's secret key
})
// Storage is automatically 4Gi (2x RAM)

// Update RAM later
info, err = deployer.UpdateRAM(ctx, "user123", "4Gi")
// Storage automatically becomes 8Gi
```

See `deploy/k8s-api-deployer.go` and `deploy/api-example.go` for ready-to-use code.

## Configuration

### Core Parameters

| Parameter          | Description                                            | Default              |
| ------------------ | ------------------------------------------------------ | -------------------- |
| `replicaCount`     | Number of replicas (MUST be 1 - no horizontal scaling) | `1`                  |
| `image.repository` | FluxionDB image repository                             | `volandoo/fluxiondb` |
| `image.tag`        | Image tag                                              | `latest`             |
| `image.pullPolicy` | Image pull policy                                      | `IfNotPresent`       |

### Resource Parameters

| Parameter                   | Description    | Default |
| --------------------------- | -------------- | ------- |
| `resources.requests.memory` | Memory request | `512Mi` |
| `resources.requests.cpu`    | CPU request    | `250m`  |
| `resources.limits.memory`   | Memory limit   | `512Mi` |
| `resources.limits.cpu`      | CPU limit      | `1000m` |

### Health Check Parameters

| Parameter                            | Description                 | Default |
| ------------------------------------ | --------------------------- | ------- |
| `livenessProbe.enabled`              | Enable liveness probe       | `true`  |
| `readinessProbe.enabled`             | Enable readiness probe      | `true`  |
| `livenessProbe.initialDelaySeconds`  | Initial delay for liveness  | `10`    |
| `readinessProbe.initialDelaySeconds` | Initial delay for readiness | `5`     |

### Persistence Parameters

| Parameter                   | Description                              | Default         |
| --------------------------- | ---------------------------------------- | --------------- |
| `persistence.enabled`       | Enable persistence                       | `true`          |
| `persistence.storageClass`  | Storage class name                       | `""`            |
| `persistence.accessModes`   | PVC access modes (must be ReadWriteOnce) | `ReadWriteOnce` |
| `persistence.size`          | PVC size                                 | `10Gi`          |
| `persistence.existingClaim` | Use existing PVC                         | `""`            |

### Secret Parameters

| Parameter          | Description          | Default         |
| ------------------ | -------------------- | --------------- |
| `secret.create`    | Create secret        | `true`          |
| `secret.secretKey` | FluxionDB secret key | `""` (REQUIRED) |
| `secret.name`      | Use existing secret  | `""`            |

### Service Parameters

| Parameter      | Description  | Default     |
| -------------- | ------------ | ----------- |
| `service.type` | Service type | `ClusterIP` |
| `service.port` | Service port | `8080`      |

### Ingress Parameters

| Parameter           | Description    | Default         |
| ------------------- | -------------- | --------------- |
| `ingress.enabled`   | Enable ingress | `false`         |
| `ingress.className` | Ingress class  | `""`            |
| `ingress.hosts`     | Ingress hosts  | See values.yaml |

### Network Policy Parameters

| Parameter                   | Description           | Default                 |
| --------------------------- | --------------------- | ----------------------- |
| `networkPolicy.enabled`     | Enable network policy | `false`                 |
| `networkPolicy.policyTypes` | Policy types          | `["Ingress", "Egress"]` |

## Examples

### Example 1: Basic User Deployment

```yaml
# user-basic-values.yaml
secret:
    secretKey: "user-generated-secret-key-abc123"

resources:
    requests:
        memory: "1Gi"
        cpu: "500m"
    limits:
        memory: "1Gi"
        cpu: "1000m"

persistence:
    size: "20Gi"
    storageClass: "fast-ssd"
```

```bash
helm install user-basic-db ./fluxiondb \
  --namespace user-basic \
  --create-namespace \
  --values user-basic-values.yaml
```

### Example 2: Premium User with High Resources

```yaml
# user-premium-values.yaml
secret:
    secretKey: "premium-user-secret-xyz789"

resources:
    requests:
        memory: "8Gi"
        cpu: "2000m"
    limits:
        memory: "8Gi"
        cpu: "4000m"

persistence:
    enabled: true
    size: "100Gi"
    storageClass: "premium-ssd"

networkPolicy:
    enabled: true
    policyTypes:
        - Ingress
    ingress:
        - from:
              - namespaceSelector:
                    matchLabels:
                        name: ingress-nginx
          ports:
              - protocol: TCP
                port: 8080
```

```bash
helm install user-premium-db ./fluxiondb \
  --namespace user-premium \
  --create-namespace \
  --values user-premium-values.yaml
```

### Example 3: Programmatic Deployment (Go)

```go
package main

import (
    "context"
    "fmt"
    "helm.sh/helm/v3/pkg/action"
    "helm.sh/helm/v3/pkg/chart/loader"
    "helm.sh/helm/v3/pkg/cli"
)

func deployUserDB(userID, secretKey, memorySize, storageSize string) error {
    settings := cli.New()
    actionConfig := new(action.Configuration)

    if err := actionConfig.Init(settings.RESTClientGetter(),
        fmt.Sprintf("user-%s", userID),
        "secret",
        func(format string, v ...interface{}) {}); err != nil {
        return err
    }

    install := action.NewInstall(actionConfig)
    install.Namespace = fmt.Sprintf("user-%s", userID)
    install.CreateNamespace = true
    install.ReleaseName = fmt.Sprintf("fluxiondb-user-%s", userID)

    chartPath := "./fluxiondb"
    chart, err := loader.Load(chartPath)
    if err != nil {
        return err
    }

    values := map[string]interface{}{
        "secret": map[string]interface{}{
            "secretKey": secretKey,
        },
        "resources": map[string]interface{}{
            "requests": map[string]interface{}{
                "memory": memorySize,
            },
            "limits": map[string]interface{}{
                "memory": memorySize,
            },
        },
        "persistence": map[string]interface{}{
            "size": storageSize,
        },
    }

    _, err = install.Run(chart, values)
    return err
}
```

## Security Considerations

1. **Secret Management**

    - Never commit real secret keys to version control
    - Use Kubernetes External Secrets Operator or similar for production
    - Rotate keys regularly

2. **Network Isolation**

    - Enable NetworkPolicy in production
    - Use namespace isolation
    - Consider service mesh for advanced traffic control

3. **Resource Limits**

    - Always set memory/CPU limits to prevent noisy neighbor issues
    - Use ResourceQuotas at namespace level
    - Monitor resource usage per tenant

4. **Storage Security**
    - Use encrypted storage classes
    - Implement backup policies per tenant
    - Set appropriate PVC reclaim policies

## Monitoring

Consider adding these annotations for Prometheus monitoring:

```yaml
podAnnotations:
    prometheus.io/scrape: "true"
    prometheus.io/port: "8080"
    prometheus.io/path: "/metrics"
```

## Troubleshooting

### Pod Not Starting

Check if secret key is provided:

```bash
kubectl get secret -n <namespace>
kubectl describe deployment -n <namespace>
```

### Out of Memory

Increase memory limits:

```bash
helm upgrade user-123-db ./fluxiondb \
  --namespace user-123 \
  --reuse-values \
  --set resources.limits.memory="2Gi"
```

### Storage Issues

Check PVC status:

```bash
kubectl get pvc -n <namespace>
kubectl describe pvc -n <namespace>
```

## Uninstallation

```bash
helm uninstall fluxiondb-user-123 --namespace user-123
kubectl delete namespace user-123  # Optional: remove namespace
```

**Note:** By default, PVCs are not deleted. Delete manually if needed:

```bash
kubectl delete pvc -n user-123 --all
```
