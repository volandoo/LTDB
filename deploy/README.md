# FluxionDB Helm Chart

Deploy FluxionDB to Kubernetes using Helm.

## Quick Start

```bash
# Install FluxionDB
helm install my-fluxiondb ./helm/fluxiondb \
  --set secret.secretKey="your-secret-key" \
  --set resources.limits.memory="2Gi" \
  --set persistence.size="4Gi"
```

## Configuration

See [`helm/fluxiondb/values.yaml`](helm/fluxiondb/values.yaml) for all configuration options.

### Essential Settings

```yaml
# Secret key for authentication (REQUIRED)
secret:
  secretKey: "change-me"

# Resource limits
resources:
  requests:
    memory: "512Mi"
    cpu: "250m"
  limits:
    memory: "512Mi"
    cpu: "1000m"

# Persistent storage
persistence:
  enabled: true
  size: "10Gi"
```

### Enable Public HTTPS Access (Optional)

```yaml
ingress:
  enabled: true
  className: "nginx"
  hosts:
    - host: "fluxiondb.example.com"
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: fluxiondb-tls
      hosts:
        - fluxiondb.example.com
```

**Prerequisites for ingress:**
- NGINX Ingress Controller
- cert-manager (for automatic SSL certificates)

## Architecture

FluxionDB is a **single-pod, stateful service**:
- ✅ Runs as one pod (does NOT support horizontal scaling)
- ✅ Uses persistent storage (ReadWriteOnce)
- ✅ Scale vertically (increase RAM/CPU per instance)
- ✅ For multi-tenancy: Deploy multiple separate instances

## Documentation

- **Helm Chart**: [`helm/fluxiondb/README.md`](helm/fluxiondb/README.md)
- **Configuration**: [`helm/fluxiondb/values.yaml`](helm/fluxiondb/values.yaml)
- **Templates**: [`helm/fluxiondb/templates/`](helm/fluxiondb/templates/)

## Examples

### Development Instance

```bash
helm install fluxiondb-dev ./helm/fluxiondb \
  --create-namespace \
  --namespace fluxiondb-dev \
  --set secret.secretKey="dev-secret" \
  --set resources.limits.memory="512Mi" \
  --set persistence.size="1Gi"
```

### Production Instance

```bash
helm install fluxiondb-prod ./helm/fluxiondb \
  --create-namespace \
  --namespace fluxiondb-prod \
  --set secret.secretKey="$PROD_SECRET_KEY" \
  --set resources.limits.memory="4Gi" \
  --set persistence.size="8Gi" \
  --set ingress.enabled=true \
  --set ingress.hosts[0].host="db.example.com"
```

## Upgrade

```bash
# Update RAM allocation
helm upgrade fluxiondb-prod ./helm/fluxiondb \
  --namespace fluxiondb-prod \
  --reuse-values \
  --set resources.limits.memory="8Gi" \
  --set persistence.size="16Gi"
```

## Uninstall

```bash
helm uninstall fluxiondb-prod --namespace fluxiondb-prod

# Optional: Delete namespace and PVC
kubectl delete namespace fluxiondb-prod
```

## Support

For issues or questions, please visit: https://github.com/your-org/fluxiondb

