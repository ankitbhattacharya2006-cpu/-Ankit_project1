# DEPLOYMENT GUIDE - Production Ready

## Table of Contents
1. Prerequisites
2. Local Development Setup
3. Docker Deployment
4. Kubernetes Deployment
5. AWS Deployment
6. Azure Deployment
7. Performance Tuning
8. Monitoring & Logging
9. Backup & Disaster Recovery
10. Troubleshooting

---

## 1. Prerequisites

### System Requirements
- **OS:** Linux (Ubuntu 20.04+), macOS (12+), or Windows WSL2
- **Python:** 3.9+ (tested on 3.10, 3.11, 3.12)
- **Node.js:** 16+ or 18+ LTS
- **PostgreSQL:** 12+ (can use managed service)
- **Docker:** 20.10+ (for containerized deployment)
- **K8s:** 1.24+ (if using Kubernetes)

### Required Accounts
- AWS/Azure/GCP (for cloud deployment)
- Docker Hub (for image registry)
- GitHub (for CI/CD)

---

## 2. Local Development Setup

### 2.1 Quick Start (Using Docker Compose)

```bash
# Clone repository
git clone https://github.com/suvrojeetpaul/inner_eye_project.git
cd inner_eye_project

# Copy environment file
cp .env.example .env
# Edit .env with your configuration

# Start all services
docker-compose up -d

# Initialize database
docker-compose exec api python -m backend.init_db

# Run migrations
docker-compose exec api alembic upgrade head

# Access services
# Backend: http://localhost:8000
# Frontend: http://localhost:3000
# Postgres: localhost:5432
```

### 2.2 Manual Setup (For Development)

```bash
# Backend Setup
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

pip install -r requirements.txt
export DATABASE_URL="postgresql://user:password@localhost:5432/inner_eye"
python main.py

# Frontend Setup (new terminal)
cd frontend/medical-ui
npm install
npm start

# Access
# Backend: http://localhost:8000
# Frontend: http://localhost:3000
```

### 2.3 Environment Configuration

```bash
# .env file (NEVER commit this!)
DATABASE_URL=postgresql://user:password@localhost:5432/inner_eye
JWT_SECRET=your-super-secret-key-change-in-production
SYSTEM_ADMIN_INVITE_CODE=invite-code-here
HOSPITAL_ADMIN_INVITE_CODE=hospital-invite-code
DISHA_ENCRYPTION_KEY=your-fernet-key-base64-encoded
PUBLIC_API_BASE_URL=http://localhost:8000
REACT_APP_API_BASE_URL=http://localhost:8000

# Optional for production
AWS_ACCESS_KEY_ID=xxxxx
AWS_SECRET_ACCESS_KEY=xxxxx
AWS_REGION=us-east-1
```

---

## 3. Docker Deployment

### 3.1 Docker Image Build

```bash
# Build backend image
docker build -f docker/Dockerfile.backend -t inner-eye-backend:v1.0 .

# Build frontend image
docker build -f docker/Dockerfile.frontend -t inner-eye-frontend:v1.0 .

# Push to registry
docker tag inner-eye-backend:v1.0 yourregistry/inner-eye-backend:v1.0
docker push yourregistry/inner-eye-backend:v1.0
```

### 3.2 Docker Compose for Production

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: inner_eye
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backups:/backups
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5

  api:
    image: inner-eye-backend:v1.0
    environment:
      DATABASE_URL: postgresql://${DB_USER}:${DB_PASSWORD}@postgres:5432/inner_eye
      JWT_SECRET: ${JWT_SECRET}
      DISHA_ENCRYPTION_KEY: ${DISHA_ENCRYPTION_KEY}
    ports:
      - "8000:8000"
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  frontend:
    image: inner-eye-frontend:v1.0
    environment:
      REACT_APP_API_BASE_URL: ${API_BASE_URL}
    ports:
      - "3000:3000"
    depends_on:
      - api
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  postgres_data:
```

```bash
# Run production stack
docker-compose -f docker-compose.prod.yml up -d
```

---

## 4. Kubernetes Deployment

### 4.1 Namespace & Secrets Setup

```yaml
# 01-namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: inner-eye-prod

---
# 02-secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: inner-eye-secrets
  namespace: inner-eye-prod
type: Opaque
stringData:
  DB_USER: postgres
  DB_PASSWORD: "ChangeMe123!"
  JWT_SECRET: "your-jwt-secret-change-me"
  DISHA_ENCRYPTION_KEY: "your-fernet-key"
  DATABASE_URL: "postgresql://postgres:ChangeMe123!@postgres:5432/inner_eye"
```

### 4.2 PostgreSQL StatefulSet

```yaml
# 03-postgres.yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
  namespace: inner-eye-prod
spec:
  serviceName: postgres
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: postgres:15-alpine
        ports:
        - containerPort: 5432
        env:
        - name: POSTGRES_USER
          valueFrom:
            secretKeyRef:
              name: inner-eye-secrets
              key: DB_USER
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: inner-eye-secrets
              key: DB_PASSWORD
        - name: POSTGRES_DB
          value: inner_eye
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
        livenessProbe:
          exec:
            command: ["pg_isready", "-U", "postgres"]
          initialDelaySeconds: 30
          periodSeconds: 10
  volumeClaimTemplates:
  - metadata:
      name: postgres-storage
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 100Gi
```

### 4.3 Backend Deployment

```yaml
# 04-backend-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: inner-eye-backend
  namespace: inner-eye-prod
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: inner-eye-backend
  template:
    metadata:
      labels:
        app: inner-eye-backend
    spec:
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
          - weight: 100
            podAffinityTerm:
              labelSelector:
                matchExpressions:
                - key: app
                  operator: In
                  values:
                  - inner-eye-backend
              topologyKey: kubernetes.io/hostname
      containers:
      - name: api
        image: inner-eye-backend:v1.0
        imagePullPolicy: Always
        ports:
        - containerPort: 8000
          name: http
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: inner-eye-secrets
              key: DATABASE_URL
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: inner-eye-secrets
              key: JWT_SECRET
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 20
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 10
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 2

---
apiVersion: v1
kind: Service
metadata:
  name: inner-eye-backend
  namespace: inner-eye-prod
spec:
  selector:
    app: inner-eye-backend
  ports:
  - port: 8000
    targetPort: 8000
    name: http
  type: ClusterIP
```

### 4.4 Frontend Deployment

```yaml
# 05-frontend-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: inner-eye-frontend
  namespace: inner-eye-prod
spec:
  replicas: 2
  selector:
    matchLabels:
      app: inner-eye-frontend
  template:
    metadata:
      labels:
        app: inner-eye-frontend
    spec:
      containers:
      - name: web
        image: inner-eye-frontend:v1.0
        ports:
        - containerPort: 3000
        env:
        - name: REACT_APP_API_BASE_URL
          value: "https://api.yourdomain.com"
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "200m"

---
apiVersion: v1
kind: Service
metadata:
  name: inner-eye-frontend
  namespace: inner-eye-prod
spec:
  selector:
    app: inner-eye-frontend
  ports:
  - port: 3000
    targetPort: 3000
  type: ClusterIP
```

### 4.5 Ingress Configuration

```yaml
# 06-ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: inner-eye-ingress
  namespace: inner-eye-prod
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - yourdomain.com
    - api.yourdomain.com
    secretName: inner-eye-tls
  rules:
  - host: yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: inner-eye-frontend
            port:
              number: 3000
  - host: api.yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: inner-eye-backend
            port:
              number: 8000
```

### 4.6 Deploy to Kubernetes

```bash
# Create namespace and secrets
kubectl apply -f 01-namespace.yaml
kubectl apply -f 02-secrets.yaml

# Deploy services
kubectl apply -f 03-postgres.yaml
kubectl apply -f 04-backend-deployment.yaml
kubectl apply -f 05-frontend-deployment.yaml
kubectl apply -f 06-ingress.yaml

# Monitor deployment
kubectl get pods -n inner-eye-prod
kubectl logs -n inner-eye-prod -f deployment/inner-eye-backend
```

---

## 5. AWS Deployment (ECS + RDS)

### 5.1 RDS PostgreSQL Setup

```bash
# Via AWS CLI
aws rds create-db-instance \
  --db-instance-identifier inner-eye-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --master-username postgres \
  --master-user-password ChangeMe123! \
  --allocated-storage 100 \
  --storage-type gp3 \
  --multi-az \
  --region us-east-1 \
  --enable-cloudwatch-logs-exports postgresql

# Get endpoint
aws rds describe-db-instances \
  --db-instance-identifier inner-eye-db \
  --query 'DBInstances[0].Endpoint.Address'
```

### 5.2 ECS Cluster Setup

```bash
# Create ECS cluster
aws ecs create-cluster --cluster-name inner-eye-prod

# Register task definition
aws ecs register-task-definition --cli-input-json file://task-definition.json

# Create service
aws ecs create-service \
  --cluster inner-eye-prod \
  --service-name inner-eye-backend \
  --task-definition inner-eye-backend:1 \
  --desired-count 3 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx,subnet-yyy],securityGroups=[sg-xxx],assignPublicIp=DISABLED}"
```

### 5.3 CloudFront CDN

```bash
# Create distribution
aws cloudfront create-distribution --distribution-config file://cloudfront-config.json

# Invalidate cache after updates
aws cloudfront create-invalidation \
  --distribution-id E123EXAMPLE \
  --paths "/*"
```

---

## 6. Azure Deployment (App Service + PostgreSQL)

### 6.1 Create Resource Group

```bash
# Create resource group
az group create \
  --name inner-eye-rg \
  --location eastus

# Create PostgreSQL server
az postgres server create \
  --resource-group inner-eye-rg \
  --name inner-eye-db \
  --location eastus \
  --admin-user postgres \
  --admin-password ChangeMe123! \
  --sku-name B_Gen5_1 \
  --storage-size 51200 \
  --version 11
```

### 6.2 Deploy Backend

```bash
# Create App Service Plan
az appservice plan create \
  --name inner-eye-plan \
  --resource-group inner-eye-rg \
  --sku B1 \
  --is-linux

# Create App Service
az webapp create \
  --resource-group inner-eye-rg \
  --plan inner-eye-plan \
  --name inner-eye-api \
  --runtime "python:3.10"

# Deploy code
az webapp up --resource-group inner-eye-rg --name inner-eye-api --runtime python:3.10
```

### 6.3 Deploy Frontend

```bash
# Create static web app
az staticwebapp create \
  --name inner-eye-frontend \
  --resource-group inner-eye-rg \
  --location eastus \
  --build-folder build
```

---

## 7. Performance Tuning

### 7.1 Database Tuning

```sql
-- PostgreSQL Configuration for 1M+ records
-- In postgresql.conf

# Memory settings
shared_buffers = 256MB        # 25% of system RAM
effective_cache_size = 1GB    # 50% of system RAM
maintenance_work_mem = 64MB

# Query planning
random_page_cost = 1.1        # For SSD

# Parallelization
max_parallel_workers = 4
max_parallel_workers_per_gather = 2
max_worker_processes = 4

# Connection pooling
max_connections = 200

-- Then reload configuration
SELECT pg_reload_conf();
```

### 7.2 Connection Pooling (PgBouncer)

```ini
# pgbouncer.ini
[databases]
inner_eye = host=localhost port=5432 dbname=inner_eye

[pgbouncer]
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 25
min_pool_size = 10
reserve_pool_size = 5
reserve_pool_timeout = 3
max_idle = 600
```

### 7.3 Backend Optimization

```python
# In main.py
from fastapi.middleware.gzip import GZIPMiddleware

# Enable GZIP compression
app.add_middleware(GZIPMiddleware, minimum_size=500)

# Connection pool optimization
from sqlalchemy.pool import NullPool
engine = create_engine(DATABASE_URL, poolclass=NullPool)

# Caching
from redis import Redis
redis_client = Redis(host='localhost', port=6379, db=0)
```

---

## 8. Monitoring & Logging

### 8.1 Prometheus Metrics

```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'inner-eye-backend'
    static_configs:
      - targets: ['localhost:8000/metrics']

  - job_name: 'postgres'
    static_configs:
      - targets: ['localhost:9187']
```

### 8.2 ELK Stack (Elasticsearch/Logstash/Kibana)

```yaml
# docker-compose with logging
services:
  api:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
    environment:
      LOG_LEVEL: INFO

  logstash:
    image: docker.elastic.co/logstash/logstash:8.0.0
    volumes:
      - ./logstash.conf:/usr/share/logstash/pipeline/logstash.conf
```

### 8.3 CloudWatch (AWS)

```bash
# Enable CloudWatch logs
aws logs create-log-group --log-group-name /inner-eye/backend
aws logs create-log-stream --log-group-name /inner-eye/backend --log-stream-name ecs

# View logs
aws logs tail /inner-eye/backend --follow
```

---

## 9. Backup & Disaster Recovery

### 9.1 Database Backups

```bash
# Automated daily backup (cron)
0 2 * * * pg_dump -h localhost -U postgres inner_eye | gzip > /backups/inner_eye_$(date +\%Y\%m\%d).sql.gz

# Restore from backup
gunzip < /backups/inner_eye_20260530.sql.gz | psql -h localhost -U postgres inner_eye
```

### 9.2 Point-in-Time Recovery (PITR)

```bash
# Enable WAL archiving
aws s3 mb s3://inner-eye-wal-backup

# Configure RDS for backups
aws rds modify-db-instance \
  --db-instance-identifier inner-eye-db \
  --backup-retention-period 30 \
  --enable-cloudwatch-logs-exports postgresql
```

### 9.3 Disaster Recovery Plan

**RTO (Recovery Time Objective):** 1 hour  
**RPO (Recovery Point Objective):** 15 minutes

```bash
# Failover procedure
1. Activate standby PostgreSQL instance
   aws rds promote-read-replica --db-instance-identifier inner-eye-db-replica

2. Update DNS
   aws route53 change-resource-record-sets --hosted-zone-id ZONE_ID ...

3. Redeploy application
   kubectl rollout restart deployment/inner-eye-backend -n inner-eye-prod

4. Verify health
   curl https://yourdomain.com/health
```

---

## 10. Troubleshooting

### Common Issues

**Issue: Database Connection Timeout**
```bash
# Fix: Increase connection pool size
DATABASE_URL=postgresql://...&connect_timeout=20

# Or check PostgreSQL is running
psql -h localhost -U postgres -d inner_eye -c "SELECT 1"
```

**Issue: High Memory Usage**
```bash
# Fix: Enable voxel decimation more aggressively
MAX_VOXELS = 1000  # Reduce from 1800

# Monitor memory
docker stats inner-eye-api
```

**Issue: Slow API Responses**
```bash
# Enable query logging
export LOG_LEVEL=DEBUG

# Check slow queries on PostgreSQL
SELECT query, mean_time FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;
```

---

## Summary

Your INNER_EYE system is now ready for:
- ✅ Local development
- ✅ Docker deployment
- ✅ Kubernetes production (high availability)
- ✅ AWS cloud deployment
- ✅ Azure cloud deployment
- ✅ Enterprise monitoring & logging
- ✅ Disaster recovery

**Next Steps:**
1. Choose deployment platform (K8s, AWS, or Azure)
2. Configure environment variables
3. Set up monitoring dashboards
4. Run security audit (OWASP top 10)
5. Conduct load testing (1,000+ concurrent users)

**Status: PRODUCTION-READY** ✅
