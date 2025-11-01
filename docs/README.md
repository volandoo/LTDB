# FluxionDB Helm Chart Repository

This directory contains packaged Helm charts for FluxionDB.

## Usage

Add the repository:

```bash
helm repo add fluxiondb https://volandoo.github.io/FluxionDB
helm repo update
```

Install FluxionDB:

```bash
helm install my-fluxiondb fluxiondb/fluxiondb \
  --set secret.secretKey="your-secret-key"
```

## Available Charts

Charts are automatically published via GitHub Actions when changes are pushed to `deploy/helm/fluxiondb/`.

See the [chart documentation](../deploy/helm/fluxiondb/README.md) for configuration options.

## How This Works

1. Charts are packaged from `deploy/helm/fluxiondb/`
2. Packaged `.tgz` files and `index.yaml` are stored here
3. GitHub Pages serves these files from the `gh-pages` branch
4. Users add this repository and install charts via Helm

## Manual Update

If needed, you can manually package a chart:

```bash
../scripts/update-helm-repo.sh
git add .
git commit -m "update helm chart"
git push
```

